import {
  detectGrist,
  listTables,
  gristReady,
  isInGrist,
  subscribeRecords,
} from '$core/grist/grist'
import { REQUIRED_TABLES } from '$core/grist/schema'
import { getSchemaDiff, ensureSchema } from '$setup/initLof'
import { deduplicatePersonas } from '$setup/migracion'
import { loadConfig, saveConfig, crearEjercicioApi } from '$app/pages/cooperadora/cooperadoraApi.js'
import { notify, withNotify } from '$core/ui/notify.svelte'
import { createBaseState } from '$core/grist/stores/gristStore.svelte'
import { saldosStore } from '$app/modules/tesoreria/resumen/saldosStore.svelte.js'
import { createDashboardStore } from './dashboardStore.svelte.js'

const bs = createBaseState()

let status = $state(null)
let creating = $state(false)
let migrating = $state(false)
let dedupResult = $state(null)
let repairResult = $state(null)
let savingConfig = $state(false)

let showNuevoEjercicio = $state(false)
let nuevoEj = $state({ anio_inicio: '', anio_fin: '', mes_inicio: 'Mayo', saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 })

// Versión instalada (guardada en configuracion al final del setup) vs versión
// actual del bundle que corre (horneada en build time). Si difieren, la app
// instalada en este Grist quedó desactualizada respecto del deploy más reciente.
const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const shaActual = typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'

let _unsub = null

// Sub-store: métricas del dashboard (socios, ejercicio, cargos, tablero de caja)
const dash = createDashboardStore()

const toKey = (s) => String(s || '').toLowerCase()

const findTable = (tables, preferredIds) => {
  const hay = new Set((tables || []).map(toKey))
  return preferredIds.find((id) => hay.has(toKey(id))) || null
}

const check = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  try {
    await gristReady()
    const tables = await listTables()
    const schemaDiff = await getSchemaDiff()
    const resolved = {}
    const missing = []
    for (const t of REQUIRED_TABLES) {
      const hit = findTable(tables, t.preferredIds)
      if (!hit) missing.push(t)
      else resolved[t.key] = hit
    }
    status = { tables, resolved, missing, schemaDiff }
    if (missing.length === 0 && schemaDiff?.missingTables?.length === 0 && schemaDiff?.missingColumns?.length === 0) {
      await dash.loadDashboard()
    }
  } catch (e) {
    bs.setError(e?.message || String(e))
    status = null
  } finally {
    bs.setLoading(false)
  }
}

const crearEjercicio = async () => {
  creating = true
  bs.clearMessages()
  try {
    await crearEjercicioApi(nuevoEj, dash.ejercicioEnCurso ? [dash.ejercicioEnCurso] : [], 'Ejercicio creado desde Inicio')
    notify.success('Ejercicio creado y activado.')
    showNuevoEjercicio = false
    nuevoEj = { anio_inicio: '', anio_fin: '', mes_inicio: 'Mayo', saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 }
    await dash.loadDashboard()
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error(bs.error)
  } finally {
    creating = false
  }
}

const onPeriodosAutoChange = async (v) => {
  if (!dash.periodosAutoLoaded) return
  if (v === dash.generarPeriodosAuto) return
  dash.generarPeriodosAuto = v
  savingConfig = true
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, generar_periodos_automatico: v })
    notify.success(v ? 'Generación automática activada.' : 'Generación automática desactivada.')
  } catch (e) {
    bs.setError(e?.message || String(e))
    dash.generarPeriodosAuto = !v
  } finally { savingConfig = false }
}

/**
 * Cambia la modalidad de gestión entre carga_consolidada y gestion_integral.
 * @param {'carga_consolidada' | 'gestion_integral'} nuevaModalidad
 */
const onModalidadChange = async (nuevaModalidad) => {
  savingConfig = true
  try {
    const config = await loadConfig()
    const updates = {}
    if (nuevaModalidad === 'carga_consolidada') {
      updates.modulo_gestion_integral = false
      updates.modulo_carga_consolidada = true
      // Limpiar flags legacy si existieran
      updates.modulo_solo_pia = false
      updates.modulo_gestion_etapas = false
    } else {
      updates.modulo_gestion_integral = true
      updates.modulo_carga_consolidada = false
      updates.modulo_solo_pia = false
      updates.modulo_gestion_etapas = false
    }
    await saveConfig({ ...config, ...updates })
    // Actualizar el estado del dashboard sin recargar todo
    dash.modalidadGestion = nuevaModalidad === 'carga_consolidada' ? 'Carga consolidada' : 'Gestión integral'
    dash.moduloGestionIntegral = nuevaModalidad === 'gestion_integral'
    notify.success(`Modalidad cambiada a: ${dash.modalidadGestion}`)
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo cambiar la modalidad.')
  } finally { savingConfig = false }
}

const doDedup = async () => {
  if (!confirm('Se buscarán y fusionarán personas con DNI duplicado. ¿Continuar?')) return
  migrating = true
  bs.clearMessages()
  dedupResult = null
  try {
    await withNotify('Deduplicando personas…', async () => {
      dedupResult = await deduplicatePersonas()
    }, { success: 'Deduplicación completada', error: 'Error en deduplicación' })
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    migrating = false
  }
}

const repairSchema = async () => {
  creating = true
  bs.clearMessages()
  repairResult = null
  try {
    await withNotify('Reparando schema…', async () => {
      repairResult = await ensureSchema()
    }, { success: 'Schema reparado', error: 'Error al reparar' })
    await check()
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    creating = false
  }
}

const init = async () => {
  const gristStatus = await detectGrist()
  if (gristStatus !== 'ready') return
  _unsub = subscribeRecords(() => {
    if (!creating && !migrating) check()
  })
  await check()
  return () => { if (_unsub) _unsub(); _unsub = null }
}

const setShowNuevoEjercicio = (v) => { showNuevoEjercicio = v }

export const inicioStore = {
  get loading() { return bs.loading },
  get error() { return bs.error },
  get status() { return status },
  get creating() { return creating },
  get migrating() { return migrating },
  get dedupResult() { return dedupResult },
  get repairResult() { return repairResult },
  get savingConfig() { return savingConfig },
  // Dashboard (delegado a sub-store)
  get dashLoading() { return dash.dashLoading },
  get moduloGestionIntegral() { return dash.moduloGestionIntegral },
  get modalidadGestion() { return dash.modalidadGestion },
  get moduloKiosco() { return dash.moduloKiosco },
  get tableroError() { return dash.tableroError },
  get sociosActivos() { return dash.sociosActivos },
  get altasUltimoAnio() { return dash.altasUltimoAnio },
  get bajasUltimoAnio() { return dash.bajasUltimoAnio },
  get ejercicioEnCurso() { return dash.ejercicioEnCurso },
  get cargosObligatorios() { return dash.cargosObligatorios },
  get cargosCubiertos() { return dash.cargosCubiertos },
  get vencimientosProximos() { return dash.vencimientosProximos },
  get alertaAsamblea() { return dash.alertaAsamblea },
  get ejercicioProximoVencer() { return dash.ejercicioProximoVencer },
  get generarPeriodosAuto() { return dash.generarPeriodosAuto },
  set generarPeriodosAuto(v) { dash.generarPeriodosAuto = v },
  get versionInstalada() { return dash.versionInstalada },
  get shaInstalado() { return dash.shaInstalado },
  get versionActual() { return versionActual },
  get shaActual() { return shaActual },
  get versionActualizada() { return Boolean(dash.versionInstalada) && dash.versionInstalada === versionActual },
  get morosidadPct() { return dash.morosidadPct },
  get mayorGasto() { return dash.mayorGasto },
  get ultimaCarga() { return dash.ultimaCarga },
  get periodoActual() { return dash.periodoActual },
  get movimientosMes() { return dash.movimientosMes },
  get saldos() { return saldosStore },
  // Estado local
  get showNuevoEjercicio() { return showNuevoEjercicio },
  get nuevoEj() { return nuevoEj },
  // Acciones
  onPeriodosAutoChange,
  onModalidadChange,
  setShowNuevoEjercicio,
  init,
  check,
  crearEjercicio,
  doDedup,
  repairSchema,
}
