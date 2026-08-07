import {
  detectGrist,
  fetchRecords,
  gristReady,
  isInGrist,
  listTables,
  resolveTableId,
  subscribeRecords,
} from '$core/grist/grist'
import { REQUIRED_TABLES } from '$core/grist/schema'
import { getSchemaDiff, ensureSchema } from '$setup/initLof'
import { deduplicatePersonas } from '$setup/migracion'
import { TABLE_PREFERRED_IDS, MESES, getModalidadGestion } from '$core/utils/utils'
import { loadConfig, saveConfig, crearEjercicioApi } from '$app/pages/cooperadora/cooperadoraApi.js'
import { notify, withNotify } from '$core/ui/notify.svelte'
import { createBaseState } from '$core/grist/stores/gristStore.svelte'
import { saldosStore } from '$app/modules/tesoreria/resumen/saldosStore.svelte.js'

const bs = createBaseState()

let status = $state(null)
let creating = $state(false)
let migrating = $state(false)
let dedupResult = $state(null)
let repairResult = $state(null)

let generarPeriodosAuto = $state(false)
let savingConfig = $state(false)
let periodosAutoLoaded = $state(false)

let dashLoading = $state(false)
let moduloGestionIntegral = $state(false)
let modalidadGestion = $state('No configurado')
let moduloKiosco = $state(false)
let tableroError = $state('') // Fix F6: avisa si falla la carga del tablero de caja.
let sociosActivos = $state(0)
let altasUltimoAnio = $state(0)
let bajasUltimoAnio = $state(0)
let ejercicioEnCurso = $state(null)
let cargosObligatorios = $state(0)
let cargosCubiertos = $state(0)
let vencimientosProximos = $state([])
let alertaAsamblea = $state(false)

let showNuevoEjercicio = $state(false)
let nuevoEj = $state({ anio_inicio: '', anio_fin: '', mes_inicio: 'Marzo', saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 })
let ejercicioProximoVencer = $state(false)

// Versión instalada (guardada en configuracion al final del setup) vs versión
// actual del bundle que corre (horneada en build time). Si difieren, la app
// instalada en este Grist quedó desactualizada respecto del deploy más reciente.
let versionInstalada = $state(null)
let shaInstalado = $state(null)
const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const shaActual = typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'

let _unsub = null

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
      await loadDashboard()
    }
  } catch (e) {
    bs.setError(e?.message || String(e))
    status = null
  } finally {
    bs.setLoading(false)
  }
}

const loadSociosMetrics = async (tSocios) => {
  if (!tSocios) return
  const allSocios = await fetchRecords(tSocios)
  sociosActivos = allSocios.filter((s) => !s.fecha_baja).length
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  altasUltimoAnio = allSocios.filter((s) => s.fecha_alta && new Date(s.fecha_alta) >= oneYearAgo).length
  bajasUltimoAnio = allSocios.filter((s) => s.fecha_baja && new Date(s.fecha_baja) >= oneYearAgo).length
}

const loadEjercicioEnCurso = async (tEjercicios) => {
  if (!tEjercicios) return
  const allEj = await fetchRecords(tEjercicios)
  ejercicioEnCurso = allEj.find((e) => e.en_curso === true) || null
  if (ejercicioEnCurso) {
    const now = new Date()
    const finAnio = Number(ejercicioEnCurso.anio_fin || 0)
    const finMes = MESES.indexOf(ejercicioEnCurso.mes_inicio || 'Marzo')
    if (finAnio > 0) {
      const finDate = new Date(finAnio, finMes + 2, 1)
      const diffDays = Math.ceil((finDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      ejercicioProximoVencer = diffDays > 0 && diffDays <= 90
    }
  }
}

const loadTableroCaja = async (config) => {
  tableroError = ''
  if (!config?.modulo_gestion_integral) return
  const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
  const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
  let cuentasData = []
  let movimientosData = []
  // Fix F6: capturar errores para mostrar aviso en lugar de silenciar.
  if (tCuentas) {
    try { cuentasData = await fetchRecords(tCuentas) }
    catch (e) { tableroError = `No se pudieron cargar las cuentas: ${e?.message || e}` }
  }
  if (tMovimientos) {
    try { movimientosData = await fetchRecords(tMovimientos) }
    catch (e) { tableroError = `No se pudieron cargar los movimientos: ${e?.message || e}` }
  }
  saldosStore.loadFromData({
    movimientos: movimientosData,
    ejercicio: ejercicioEnCurso,
    cuentas: cuentasData,
  })
}

const loadCargosAutoridades = async (tCargos, tAutoridades) => {
  if (!tCargos || !tAutoridades || !ejercicioEnCurso) return
  const allCargos = await fetchRecords(tCargos)
  const obligatorios = allCargos.filter((c) => c.cargo_obligatorio === true && c.activo !== false)
  cargosObligatorios = obligatorios.length
  const allAuth = await fetchRecords(tAutoridades, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicioEnCurso.id) && a.activo !== false && !a.fecha_cese,
  })
  const cargosConAuth = new Set(allAuth.map((a) => Number(a.cargo_id)))
  cargosCubiertos = obligatorios.filter((c) => cargosConAuth.has(Number(c.id))).length
  const now = new Date()
  const limit = new Date()
  limit.setDate(limit.getDate() + 60)
  vencimientosProximos = allAuth.filter((a) => {
    if (!a.fecha_vencimiento) return false
    const v = new Date(a.fecha_vencimiento)
    return v >= now && v <= limit
  })
}

const loadDashboard = async () => {
  dashLoading = true
  try {
    const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
    const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
    const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)

    await loadSociosMetrics(tSocios)
    await loadEjercicioEnCurso(tEjercicios)

    const config = await loadConfig()
    await loadTableroCaja(config)
    await loadCargosAutoridades(tCargos, tAutoridades)

    const now = new Date()
    alertaAsamblea = now.getMonth() === 4 && now.getDate() >= 15

    generarPeriodosAuto = Boolean(config?.generar_periodos_automatico)
    moduloGestionIntegral = Boolean(config?.modulo_gestion_integral)
    modalidadGestion = getModalidadGestion(config)
    moduloKiosco = Boolean(config?.modulo_kiosco)
    periodosAutoLoaded = true
    versionInstalada = config?.version_instalada || null
    shaInstalado = config?.sha_instalado || null
  } catch {
    // Dashboard errors are non-fatal
  } finally {
    dashLoading = false
  }
}

const crearEjercicio = async () => {
  creating = true
  bs.clearMessages()
  try {
    await crearEjercicioApi(nuevoEj, ejercicioEnCurso ? [ejercicioEnCurso] : [], 'Ejercicio creado desde Inicio')
    notify.success('Ejercicio creado y activado.')
    showNuevoEjercicio = false
    nuevoEj = { anio_inicio: '', anio_fin: '', mes_inicio: 'Marzo', saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 }
    await loadDashboard()
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error(bs.error)
  } finally {
    creating = false
  }
}

const onPeriodosAutoChange = async (v) => {
  if (!periodosAutoLoaded) return
  if (v === generarPeriodosAuto) return
  generarPeriodosAuto = v
  savingConfig = true
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, generar_periodos_automatico: v })
    notify.success(v ? 'Generación automática activada.' : 'Generación automática desactivada.')
  } catch (e) {
    bs.setError(e?.message || String(e))
    generarPeriodosAuto = !v
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
  get generarPeriodosAuto() { return generarPeriodosAuto },
  set generarPeriodosAuto(v) { generarPeriodosAuto = v },
  get dashLoading() { return dashLoading },
  get moduloGestionIntegral() { return moduloGestionIntegral },
  get modalidadGestion() { return modalidadGestion },
  get moduloKiosco() { return moduloKiosco },
  get tableroError() { return tableroError },
  get sociosActivos() { return sociosActivos },
  get altasUltimoAnio() { return altasUltimoAnio },
  get bajasUltimoAnio() { return bajasUltimoAnio },
  get ejercicioEnCurso() { return ejercicioEnCurso },
  get cargosObligatorios() { return cargosObligatorios },
  get cargosCubiertos() { return cargosCubiertos },
  get vencimientosProximos() { return vencimientosProximos },
  get alertaAsamblea() { return alertaAsamblea },
  get showNuevoEjercicio() { return showNuevoEjercicio },
  get nuevoEj() { return nuevoEj },
  get ejercicioProximoVencer() { return ejercicioProximoVencer },
  get versionInstalada() { return versionInstalada },
  get shaInstalado() { return shaInstalado },
  get versionActual() { return versionActual },
  get shaActual() { return shaActual },
  get versionActualizada() { return Boolean(versionInstalada) && versionInstalada === versionActual },
  get saldos() { return saldosStore },
  onPeriodosAutoChange,
  setShowNuevoEjercicio,
  init,
  check,
  crearEjercicio,
  doDedup,
  repairSchema,
}
