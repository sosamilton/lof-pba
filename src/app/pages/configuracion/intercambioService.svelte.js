import {
  exportParcial,
  importWorkingSet,
  analizarMerge,
  aplicarMerge,
  limpiarDispositivo,
} from '$core/data/intercambio.js'
import { exportToLof } from '$core/data/exportImport.js'
import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { notify } from '$core/ui/notify.svelte'
import { trackEvent } from '$core/analytics/plausible.js'

/**
 * Servicio para el flujo de intercambio descentralizado (tab Configuración).
 *
 * Encapsula la lógica de export/import/merge que antes vivía inline en
 * IntercambioTab.svelte. El componente consume este servicio y se queda
 * solo con la presentación.
 *
 * Estado reactivo (Svelte 5 runes):
 * - config, isColaborador
 * - exportProfile, exporting, exportResult
 * - importingWs
 * - mergeFile, mergeAnalysis, analyzing, applying, mergeResult, doBackupBefore
 * - cleaning, patchExported, showCleanupConfirm
 */
export function createIntercambioService() {
  // --- Config / modo colaborador ---
  let config = $state(null)
  let isColaborador = $derived(config?.modo_colaborador === true)
  let cleaning = $state(false)
  let showCleanupConfirm = $state(false)
  let patchExported = $state(false)

  async function loadConfigData() {
    try { config = await loadConfig() } catch { /* ignore */ }
  }
  loadConfigData()

  // --- Export ---
  let exportProfile = $state('working_set') // fijo en working_set, no se cambia
  let exporting = $state(false)
  let exportResult = $state(null)
  let exportPassphrase = $state('')
  let exportConfirmPassphrase = $state('')

  const handleExportPatchYLimpiar = async () => {
    cleaning = true
    try {
      const profile = config?.modulo_carga_consolidada ? 'patch_consolidada' : 'patch_integral'
      // En modo colaborador, exportar sin contraseña (exportPassphrase siempre vacío)
      const opts = {}
      const res = await exportParcial(profile, opts)
      patchExported = true
      notify.success(`Cargas exportadas: ${res.filename} (${res.docCount} documentos)`)
      trackEvent('colaborador_patch_exported', { profile, doc_count: res.docCount, encrypted: false })
    } catch (e) {
      notify.error(e?.message || 'Error al exportar las cargas')
      patchExported = false
    } finally {
      cleaning = false
    }
  }

  const handleLimpiarDispositivo = async () => {
    cleaning = true
    try {
      await limpiarDispositivo()
      // limpiarDispositivo recarga la página, no llegamos acá
    } catch (e) {
      notify.error(e?.message || 'Error al limpiar dispositivo')
      cleaning = false
    }
  }


  const handleExport = async () => {
    // Validar que las passphrases coincidan si se ingresó una
    if (exportPassphrase && exportPassphrase !== exportConfirmPassphrase) {
      notify.error('Las contraseñas no coinciden.')
      return
    }

    exporting = true
    exportResult = null
    try {
      const opts = exportPassphrase ? { passphrase: exportPassphrase } : {}
      const res = await exportParcial('working_set', opts)
      exportResult = res
      trackEvent('intercambio_exported', { backend: 'pouch', profile: 'working_set', doc_count: res.docCount, encrypted: res.encrypted })
      notify.success(`Set de trabajo exportado: ${res.filename} (${res.docCount} documentos)${res.encrypted ? ' [cifrado]' : ''}`)
    } catch (e) {
      notify.error(e?.message || 'Error al exportar')
    } finally {
      exporting = false
    }
  }

  // --- Import working set ---
  let importingWs = $state(false)
  let wsPassphrase = $state('')

  const handleWsImport = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const file = input.files?.[0]
    if (!file) return
    importingWs = true
    const id = notify.loading('Importando set de trabajo…')
    try {
      const opts = wsPassphrase ? { passphrase: wsPassphrase } : {}
      const res = await importWorkingSet(file, opts)
      notify.dismiss(id)
      trackEvent('intercambio_ws_imported', { backend: 'pouch', inserted: res.inserted, skipped: res.skipped, encrypted: !!wsPassphrase })
      notify.success(`Set importado: ${res.inserted} documentos insertados, ${res.skipped} ya existían.`)
      wsPassphrase = ''
    } catch (e) {
      notify.dismiss(id)
      notify.error(e?.message || 'Error al importar set de trabajo')
    } finally {
      importingWs = false
      input.value = ''
    }
  }

  // --- Merge import (con análisis previo) ---
  let mergeFile = $state(null)
  let mergeAnalysis = $state(null)
  let analyzing = $state(false)
  let applying = $state(false)
  let mergeResult = $state(null)
  let doBackupBefore = $state(true)
  let mergePassphrase = $state('')

  const handleMergeFileSelect = async (/** @type {Event} */ e) => {
    const input = /** @type {HTMLInputElement} */ (e.target)
    const file = input.files?.[0]
    if (!file) return
    mergeFile = file
    mergeAnalysis = null
    mergeResult = null
    analyzing = true
    try {
      const report = await analizarMerge(file, mergePassphrase || undefined)
      mergeAnalysis = report
      trackEvent('intercambio_merge_analyzed', { backend: 'pouch', conflictos: report.resumen.conflictos, encrypted: !!mergePassphrase })
    } catch (e) {
      notify.error(e?.message || 'Error al analizar el patch')
      mergeFile = null
    } finally {
      analyzing = false
      input.value = ''
    }
  }

  const canApply = $derived(
    mergeAnalysis != null &&
    mergeAnalysis.resumen.conflictos === 0 &&
    mergeAnalysis.detalle.movimientos.length > 0 &&
    !applying
  )

  const handleApplyMerge = async () => {
    if (!mergeFile || !mergeAnalysis) return
    applying = true
    mergeResult = null

    // Backup opcional antes del merge
    if (doBackupBefore) {
      try {
        await exportToLof({ kind: 'full' })
        notify.info('Backup exportado antes del merge.')
      } catch (e) {
        notify.error('No se pudo exportar el backup previo. Merge cancelado por seguridad.')
        applying = false
        return
      }
    }

    const id = notify.loading('Aplicando merge…')
    try {
      const res = await aplicarMerge(mergeFile, mergeAnalysis.analisisHash, mergePassphrase || undefined)
      notify.dismiss(id)
      mergeResult = res
      trackEvent('intercambio_merge_applied', {
        backend: 'pouch',
        movimientos: res.added.movimientos,
        personas: res.added.personas,
        dedup: res.deduped.personas,
      })
      notify.success(
        `Merge completado: ${res.added.movimientos} movimiento(s), ${res.added.personas} persona(s) nueva(s), ${res.deduped.personas} deduplicada(s).`
      )
      // Limpiar estado
      mergeFile = null
      mergeAnalysis = null
    } catch (e) {
      notify.dismiss(id)
      notify.error(e?.message || 'Error al aplicar el merge')
    } finally {
      applying = false
    }
  }

  const handleCancelMerge = () => {
    mergeFile = null
    mergeAnalysis = null
    mergeResult = null
  }

  return {
    // Config / colaborador
    get config() { return config },
    get isColaborador() { return isColaborador },
    get cleaning() { return cleaning },
    set cleaning(v) { cleaning = v },
    get showCleanupConfirm() { return showCleanupConfirm },
    set showCleanupConfirm(v) { showCleanupConfirm = v },
    get patchExported() { return patchExported },
    handleExportPatchYLimpiar,
    handleLimpiarDispositivo,

    // Export
    get exportProfile() { return exportProfile },
    set exportProfile(v) { exportProfile = v },
    get exporting() { return exporting },
    get exportResult() { return exportResult },
    get exportPassphrase() { return exportPassphrase },
    set exportPassphrase(v) { exportPassphrase = v },
    get exportConfirmPassphrase() { return exportConfirmPassphrase },
    set exportConfirmPassphrase(v) { exportConfirmPassphrase = v },
    handleExport,

    // Import working set
    get importingWs() { return importingWs },
    get wsPassphrase() { return wsPassphrase },
    set wsPassphrase(v) { wsPassphrase = v },
    handleWsImport,

    // Merge
    get mergeFile() { return mergeFile },
    get mergeAnalysis() { return mergeAnalysis },
    get analyzing() { return analyzing },
    get applying() { return applying },
    get mergeResult() { return mergeResult },
    get doBackupBefore() { return doBackupBefore },
    set doBackupBefore(v) { doBackupBefore = v },
    get mergePassphrase() { return mergePassphrase },
    set mergePassphrase(v) { mergePassphrase = v },
    get canApply() { return canApply },
    handleMergeFileSelect,
    handleApplyMerge,
    handleCancelMerge,
  }
}
