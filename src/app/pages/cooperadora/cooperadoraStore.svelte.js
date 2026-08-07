import {
  applyUserActions,
  ensureOneRow,
  gristReady,
  isInGrist,
  resolveTableId,
  subscribeRecords,
} from '$core/grist/grist'
import { normalizeFields, TABLE_PREFERRED_IDS } from '$core/utils/utils'
import { loadConfig, saveConfig } from './cooperadoraApi.js'
import { applyBrandTheme } from '$core/ui/theme'
import { notify } from '$core/ui/notify.svelte'
import { createBaseState } from '$core/grist/stores/gristStore.svelte'
import {
  formatCue,
  formatCuil,
  formatCbu,
  formatTelefono,
  parseCue,
  parseCuil,
  parseCbu,
  normalizeTelefonoForStorage,
} from '$core/format/format.js'
import { createEjerciciosStore } from './ejerciciosStore.svelte.js'
import { createCargosStore } from './cargosStore.svelte.js'

const bs = createBaseState()

// --- Table IDs (compartidos) ---
/** @type {string | null} */
let tEscuela = $state(null)
/** @type {string | null} */
let tBanco = $state(null)
/** @type {string | null} */
let tKiosco = $state(null)
/** @type {string | null} */
let tEjercicios = $state(null)
/** @type {string | null} */
let tCargos = $state(null)
/** @type {string | null} */
let tAutoridades = $state(null)
/** @type {string | null} */
let tMovimientos = $state(null)

// --- Configuración (escuela, banco, kiosco) — permanece en el store principal ---
/** @type {Record<string, any>} */
let escuela = $state({})
/** @type {Record<string, any>} */
let banco = $state({})
/** @type {Record<string, any>} */
let kiosco = $state({})
let color_primario = $state('#16b378')

// --- Sub-stores (composición) ---
const ejerciciosMgr = createEjerciciosStore({
  bs,
  getTEjercicios: () => tEjercicios,
  getTMovimientos: () => tMovimientos,
})

const cargosMgr = createCargosStore({
  bs,
  getTCargos: () => tCargos,
  getTAutoridades: () => tAutoridades,
  getEjercicioEnCurso: () => ejerciciosMgr.ejercicioEnCurso,
})

/** @type {(() => void) | null} */
let _unsub = null

const _updateRecord = async (tableId, rec) => {
  const fields = { ...rec }; delete fields.id
  const clean = normalizeFields(fields)
  if (rec.id != null) {
    await applyUserActions([['UpdateRecord', tableId, rec.id, clean]])
  } else {
    await applyUserActions([['AddRecord', tableId, null, clean]])
  }
}

const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  if (!isInGrist()) { bs.setLoading(false); return }
  try {
    await gristReady()
    tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
    tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
    tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
    tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
    tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
    tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
    escuela = (await ensureOneRow(tEscuela)) || {}
    banco = (await ensureOneRow(tBanco)) || {}
    kiosco = (await ensureOneRow(tKiosco)) || {}
    // Formateo visual: los datos vienen como dígitos crudos desde Grist.
    escuela.cue = formatCue(escuela.cue || '')
    escuela.cuit = formatCuil(escuela.cuit || '')
    escuela.telefono_cooperadora = formatTelefono(escuela.telefono_cooperadora || '')
    escuela.telefono_escuela = formatTelefono(escuela.telefono_escuela || '')
    banco.cbu = formatCbu(banco.cbu || '')
    await ejerciciosMgr.reload(tEjercicios)
    const config = await loadConfig()
    if (config?.color_primario) color_primario = config.color_primario
    await cargosMgr.loadCargos()
    await cargosMgr.loadAutoridades()
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setLoading(false) }
}

// --- Configuración: guardar y validar ---
const saveCooperadora = async () => {
  await bs.wrapAsync(async () => {
    if (!tEscuela || !tBanco || !tKiosco) {
      bs.setError('Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.')
      notify.error(bs.error); return
    }
    // Normalizamos a dígitos crudos para guardar en Grist (el formateo es solo visual).
    const escuelaRaw = { ...escuela }
    escuelaRaw.cue = parseCue(escuelaRaw.cue) || ''
    escuelaRaw.cuit = parseCuil(escuelaRaw.cuit) || ''
    escuelaRaw.telefono_cooperadora = normalizeTelefonoForStorage(escuelaRaw.telefono_cooperadora) || ''
    escuelaRaw.telefono_escuela = normalizeTelefonoForStorage(escuelaRaw.telefono_escuela) || ''
    const bancoRaw = { ...banco }
    bancoRaw.cbu = parseCbu(bancoRaw.cbu) || ''
    await _updateRecord(tEscuela, escuelaRaw)
    await _updateRecord(tBanco, bancoRaw)
    await _updateRecord(tKiosco, kiosco)
    const config = await loadConfig()
    await saveConfig({
      ...config,
      cooperadora_nombre: escuela.cooperadora_nombre || '',
      color_primario: color_primario || config?.color_primario || '#16b378',
    })
    bs.setNotice('Datos guardados.'); notify.success(bs.notice)
  })
}

const validarDatos = async () => {
  await bs.wrapAsync(async () => {
    if (!tEscuela) { bs.setError('No se encontró la tabla escuela.'); return }
    await applyUserActions([['UpdateRecord', tEscuela, escuela.id, { datos_validados: true }]])
    escuela.datos_validados = true
    bs.setNotice('Datos validados y bloqueados.'); notify.success(bs.notice)
  })
}

const validarBanco = async () => {
  await bs.wrapAsync(async () => {
    if (!tBanco) { bs.setError('No se encontró la tabla datos_banco.'); return }
    await applyUserActions([['UpdateRecord', tBanco, banco.id, { banco_validado: true }]])
    banco.banco_validado = true
    bs.setNotice('Datos bancarios validados y bloqueados.'); notify.success(bs.notice)
  })
}

// Re-formateo en vivo mientras el usuario tipea. Los datos se guardan crudos.
const onCueInput = () => { escuela.cue = formatCue(escuela.cue) }
const onCuitInput = () => { escuela.cuit = formatCuil(escuela.cuit) }
const onCbuInput = () => { banco.cbu = formatCbu(banco.cbu) }
const onTelefonoInput = () => { escuela.telefono_cooperadora = formatTelefono(escuela.telefono_cooperadora) }
const onTelefonoEscuelaInput = () => { escuela.telefono_escuela = formatTelefono(escuela.telefono_escuela) }

const subscribe = () => {
  if (_unsub) _unsub()
  _unsub = subscribeRecords(() => { if (!bs.busy && !bs.loading) load() })
  return () => { if (_unsub) _unsub(); _unsub = null }
}

export const cooperadoraStore = {
  // Estado base
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  // Configuración
  get escuela() { return escuela },
  get banco() { return banco },
  get kiosco() { return kiosco },
  get color_primario() { return color_primario },
  setColor_primario: (v) => { color_primario = v; applyBrandTheme(v) },
  onCueInput,
  onCuitInput,
  onCbuInput,
  onTelefonoInput,
  onTelefonoEscuelaInput,
  saveCooperadora,
  validarDatos,
  validarBanco,
  // Ejercicios (delegado a sub-store)
  get ejercicios() { return ejerciciosMgr.ejercicios },
  get nuevoEj() { return ejerciciosMgr.nuevoEj },
  get ejercicioEnCurso() { return ejerciciosMgr.ejercicioEnCurso },
  get ejercicioEditando() { return ejerciciosMgr.ejercicioEditando },
  createEjercicio: ejerciciosMgr.createEjercicio,
  setEjercicioEnCurso: ejerciciosMgr.setEjercicioEnCurso,
  setEditandoEjercicio: ejerciciosMgr.setEditandoEjercicio,
  cancelarEdicionEjercicio: ejerciciosMgr.cancelarEdicionEjercicio,
  tieneMovimientos: ejerciciosMgr.tieneMovimientos,
  saveEjercicio: ejerciciosMgr.saveEjercicio,
  deleteEjercicio: ejerciciosMgr.deleteEjercicio,
  setOnSaldosChanged: ejerciciosMgr.setOnSaldosChanged,
  // Cargos (delegado a sub-store)
  get organismo() { return cargosMgr.organismo },
  get cargos() { return cargosMgr.cargos },
  get nuevoCargo() { return cargosMgr.nuevoCargo },
  get comisionDirectiva() { return cargosMgr.comisionDirectiva },
  get tieneAutoridadesVigentes() { return cargosMgr.tieneAutoridadesVigentes },
  setOrganismo: cargosMgr.setOrganismo,
  loadCargos: cargosMgr.loadCargos,
  saveCargo: cargosMgr.saveCargo,
  addCargo: cargosMgr.addCargo,
  // Lifecycle
  load,
  subscribe,
}
