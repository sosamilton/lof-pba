import {
  detectGrist,
  listTables,
  gristReady,
  isInGrist,
  subscribeRecords,
  resolveTableId,
  fetchRecords,
  applyUserActions,
} from '$core/grist/grist'
import { REQUIRED_TABLES } from '$core/grist/schema'
import { getSchemaDiff, ensureSchema } from '$setup/initLof'
import { deduplicatePersonas, syncRubrosPia, syncSubrubrosPia, fixRubrosPiaCampoPdf, fixEstatutoColumnType, migrarEstatutoATabla } from '$setup/migracion'
import { loadConfig, saveConfig, crearEjercicioApi } from '$app/pages/cooperadora/cooperadoraApi.js'
import { configStore } from '$core/grist/stores/configStore.svelte'
import { notify, withNotify } from '$core/ui/notify.svelte'
import { createBaseState } from '$core/grist/stores/gristStore.svelte'
import { saldosStore } from '$app/modules/tesoreria/resumen/saldosStore.svelte.js'
import { createDashboardStore } from './dashboardStore.svelte.js'
import { TABLE_PREFERRED_IDS, normalizeFields } from '$core/utils/utils'
import { applyBrandTheme } from '$core/ui/theme'

const bs = createBaseState()

let status = $state(null)
let creating = $state(false)
let migrating = $state(false)
let dedupResult = $state(null)
let repairResult = $state(null)
let savingConfig = $state(false)
let hasMovimientosSinCarga = $state(false)
let migrandoCargas = $state(false)
let migracionResult = $state(null)

// Apariencia y preferencias (editables desde Configuración → General)
let color_primario = $state('#16b378')
let appTitle = $state('')
let cuentaDefaultId = $state('')
let cuentas = $state([])

let showNuevoEjercicio = $state(false)
let nuevoEj = $state({ anio_inicio: '', anio_fin: '', mes_inicio: 'Mayo', saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 })

// Versión instalada (guardada en configuracion al final del setup) vs versión
// actual del bundle que corre (horneada en build time). Si difieren, la app
// instalada en este Grist quedó desactualizada respecto del deploy más reciente.
const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const shaActual = typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'

let _unsub = null

// Guard para sincronizar rubros PIA una sola vez por sesión (page load).
// Evita re-correr el CSV y fetchear rubros en cada `check()` disparado por
// subscribeRecords. La sincronización es idempotente (solo agrega faltantes).
let _rubrosSynced = false

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
      // Sincronizar rubros PIA del seed una sola vez por sesión: agrega a
      // instalaciones existentes los rubros nuevos que aparezcan en
      // public/seeds/rubros_pia.csv (seedIfEmpty solo carga en tablas vacías).
      if (!_rubrosSynced) {
        _rubrosSynced = true
        try {
          const res = await syncRubrosPia()
          // syncSubrubrosPia depende de que los rubros padre ya existan
          // (ej. GP-OTROS), por eso corre siempre después.
          const resSub = await syncSubrubrosPia()
          // fixRubrosPiaCampoPdf corrige el mapeo PDF de rubros GP/OG en
          // instalaciones sembradas con versiones anteriores al fix 2026-08-23.
          const resFix = await fixRubrosPiaCampoPdf()
          // fixEstatutoColumnType repara el tipo de la columna escuela.estatuto
          // en instalaciones donde se creó con el tipo inválido `Attachment`
          // (singular) en lugar de `Attachments`. Bug introducido en e3ee918.
          const resEstatuto = await fixEstatutoColumnType()
          // migrarEstatutoATabla mueve el estatuto del modelo legacy
          // (escuela.estatuto) al nuevo modelo (tabla estatutos + ref).
          const resMigrarEstatuto = await migrarEstatutoATabla()
          const totalAgregados = (res?.added || 0) + (resSub?.added || 0)
          if (totalAgregados > 0) {
            notify.success(`Se agregaron ${totalAgregados} categoría(s) nueva(s) al plan de cuentas.`)
          }
          if (resFix?.fixed > 0) {
            notify.success(`Se corrigió el mapeo PDF de ${resFix.fixed} rubro(s) del plan de cuentas.`)
          }
          if (resEstatuto?.fixed > 0) {
            notify.success('Se corrigió el tipo de la columna del estatuto.')
          }
          if (resMigrarEstatuto?.migrated > 0) {
            notify.success('Se migró el estatuto al nuevo modelo de historial de versiones.')
          }
        } catch (e) {
          // Non-fatal: la sincronización falla silenciosamente, no bloquea Inicio.
          console.warn('[inicioStore] sync de rubros/subrubros falló:', e?.message || e)
        }
      }
      await dash.loadDashboard()
      if (!dash.moduloGestionIntegral) {
        await checkMovimientosSinCarga()
      }
      // Cargar preferencias de apariencia (color, título, cuenta default)
      await loadPreferencias()
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
    if (nuevaModalidad === 'carga_consolidada') {
      await checkMovimientosSinCarga()
    } else {
      hasMovimientosSinCarga = false
      // Reset periodicidad a mensual en modo integral (no aplica)
      if (dash.periodicidad !== 'mensual') {
        await saveConfig({ ...(await loadConfig()), periodicidad: 'mensual' })
        dash.periodicidad = 'mensual'
        saldosStore.setPeriodicidad('mensual')
      }
    }
    notify.success(`Modalidad cambiada a: ${dash.modalidadGestion}`)
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo cambiar la modalidad.')
  } finally { savingConfig = false }
}

/**
 * Cambia la periodicidad de carga (mensual, semanal, trimestral, etc.).
 * @param {string} nuevaPeriodicidad
 */
const onPeriodicidadChange = async (nuevaPeriodicidad) => {
  if (!nuevaPeriodicidad || nuevaPeriodicidad === dash.periodicidad) return
  savingConfig = true
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, periodicidad: nuevaPeriodicidad })
    dash.periodicidad = nuevaPeriodicidad
    saldosStore.setPeriodicidad(nuevaPeriodicidad)
    notify.success(`Periodicidad cambiada a: ${nuevaPeriodicidad}`)
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo cambiar la periodicidad.')
  } finally { savingConfig = false }
}

/**
 * Verifica si hay movimientos sin carga_id en el ejercicio en curso.
 * Solo relevante en modo carga_consolidada.
 */
const checkMovimientosSinCarga = async () => {
  hasMovimientosSinCarga = false
  if (!dash.ejercicioEnCurso) return
  try {
    const tMov = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
    if (!tMov) return
    const ejId = Number(dash.ejercicioEnCurso.id)
    const movs = await fetchRecords(tMov, {
      filter: (m) => Number(m.ejercicio_id) === ejId && !m.carga_id,
    })
    hasMovimientosSinCarga = movs.length > 0
  } catch { /* non-fatal */ }
}

/**
 * Migra movimientos sin carga a cargas consolidadas automáticamente.
 * Crea una carga por período para los movimientos no vinculados.
 */
const migrarMovimientosLegacy = async () => {
  if (!dash.ejercicioEnCurso) return
  migrandoCargas = true
  migracionResult = null
  bs.clearMessages()
  try {
    const tMov = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
    const tCargas = await resolveTableId(TABLE_PREFERRED_IDS.cargas)
    if (!tMov || !tCargas) { bs.setError('No se encontraron las tablas necesarias.'); return }
    const ejId = Number(dash.ejercicioEnCurso.id)

    const allMovs = await fetchRecords(tMov, {
      filter: (m) => Number(m.ejercicio_id) === ejId && !m.carga_id,
    })
    if (allMovs.length === 0) {
      hasMovimientosSinCarga = false
      notify.success('No hay movimientos para migrar.')
      return
    }

    const porPeriodo = new Map()
    for (const m of allMovs) {
      const p = String(m.periodo || '')
      if (!p) continue
      if (!porPeriodo.has(p)) porPeriodo.set(p, [])
      porPeriodo.get(p).push(m)
    }

    const cargasExistentes = await fetchRecords(tCargas, {
      filter: (c) => Number(c.ejercicio_id) === ejId,
    })
    const periodosConCarga = new Set(cargasExistentes.map((c) => String(c.periodo || '')))

    const actions = []
    let cargasCreadas = 0
    let movimientosVinculados = 0
    const nuevasCargasIds = new Map()

    for (const [periodo, movs] of porPeriodo) {
      if (periodosConCarga.has(periodo)) {
        const cargaExistente = cargasExistentes.find((c) => String(c.periodo) === periodo)
        if (cargaExistente) {
          for (const m of movs) {
            actions.push(['UpdateRecord', tMov, Number(m.id), { carga_id: Number(cargaExistente.id) }])
            movimientosVinculados++
          }
        }
        continue
      }
      const cargaFields = normalizeFields({
        ejercicio_id: ejId,
        periodo: periodo,
        estado: 'borrador',
        fecha_creacion: new Date().toISOString(),
        creado_por: 'SPA',
        observaciones: 'Migración automática',
        version: 1,
      })
      actions.push(['AddRecord', tCargas, null, cargaFields])
      cargasCreadas++
      nuevasCargasIds.set(periodo, actions.length - 1)
      movimientosVinculados += movs.length
    }

    if (actions.length > 0) {
      const res = await applyUserActions(actions)
      if (res?.retValues && nuevasCargasIds.size > 0) {
        const vincularActions = []
        for (const [periodo, idxInActions] of nuevasCargasIds) {
          const cargaId = res.retValues[idxInActions]
          if (cargaId) {
            const movs = porPeriodo.get(periodo)
            for (const m of movs) {
              vincularActions.push(['UpdateRecord', tMov, Number(m.id), { carga_id: Number(cargaId) }])
            }
          }
        }
        if (vincularActions.length > 0) {
          await applyUserActions(vincularActions)
        }
      }
    }

    migracionResult = { cargasCreadas, movimientosVinculados }
    hasMovimientosSinCarga = false
    notify.success(`Migración completada: ${cargasCreadas} cargas creadas, ${movimientosVinculados} movimientos vinculados.`)
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo completar la migración.')
  } finally {
    migrandoCargas = false
  }
}

const ejecutarDedup = async () => {
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

/**
 * Carga las preferencias de apariencia desde config + tabla cuentas.
 * Color, título de la app y cuenta por defecto para movimientos.
 */
const loadPreferencias = async () => {
  try {
    const config = await loadConfig()
    if (config?.color_primario) {
      color_primario = config.color_primario
      applyBrandTheme(config.color_primario)
    }
    if (config?.cooperadora_nombre) appTitle = config.cooperadora_nombre
    if (config?.cuenta_default_id) cuentaDefaultId = String(config.cuenta_default_id)

    const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
    if (tCuentas) {
      const recs = await fetchRecords(tCuentas, {
        sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0),
      })
      cuentas = recs
      // Fallback: si no hay cuenta_default_id en config, inferir por nombre
      if (!cuentaDefaultId && recs.length > 0) {
        const fallback = recs.find((c) => String(c.nombre_cuenta) === 'Efectivo') || recs[0]
        cuentaDefaultId = fallback ? String(fallback.id) : ''
      }
    }
  } catch { /* non-fatal */ }
}

/**
 * Guarda el color de marca en config y lo aplica en vivo.
 * @param {string} hex
 */
const onColorChange = async (hex) => {
  color_primario = hex
  applyBrandTheme(hex)
  savingConfig = true
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, color_primario: hex })
    await configStore.load() // refresca cache reactivo para AppShell
    notify.success('Color de marca actualizado.')
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo guardar el color.')
  } finally { savingConfig = false }
}

/**
 * Guarda el título de la app (cooperadora_nombre) en config y sincroniza
 * la tabla escuela (fuente de verdad) para que ambas queden consistentes.
 * @param {string} nombre
 */
const onAppTitleChange = async (nombre) => {
  appTitle = nombre
  savingConfig = true
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, cooperadora_nombre: nombre })
    await configStore.load() // refresca cache reactivo para AppShell
    // Sincronizar fuente de verdad: tabla escuela
    const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
    if (tEscuela) {
      const escRecs = await fetchRecords(tEscuela)
      if (escRecs.length > 0) {
        await applyUserActions([['UpdateRecord', tEscuela, escRecs[0].id, { cooperadora_nombre: nombre }]])
      }
    }
    notify.success('Título actualizado.')
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo guardar el título.')
  } finally { savingConfig = false }
}

/**
 * Guarda la cuenta por defecto para nuevos movimientos.
 * @param {string} cuentaId
 */
const onCuentaDefaultChange = async (cuentaId) => {
  cuentaDefaultId = String(cuentaId || '')
  savingConfig = true
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, cuenta_default_id: cuentaDefaultId })
    await configStore.load() // refresca cache reactivo
    notify.success('Cuenta por defecto actualizada.')
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error('No se pudo guardar la cuenta por defecto.')
  } finally { savingConfig = false }
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
  get hasMovimientosSinCarga() { return hasMovimientosSinCarga },
  get migrandoCargas() { return migrandoCargas },
  get migracionResult() { return migracionResult },
  // Dashboard (delegado a sub-store)
  get dashLoading() { return dash.dashLoading },
  get moduloGestionIntegral() { return dash.moduloGestionIntegral },
  get modalidadGestion() { return dash.modalidadGestion },
  get periodicidad() { return dash.periodicidad },
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
  // Apariencia y preferencias
  get color_primario() { return color_primario },
  get appTitle() { return appTitle },
  get cuentaDefaultId() { return cuentaDefaultId },
  get cuentas() { return cuentas },
  // Acciones
  onPeriodosAutoChange,
  onModalidadChange,
  onPeriodicidadChange,
  migrarMovimientosLegacy,
  checkMovimientosSinCarga,
  setShowNuevoEjercicio,
  onColorChange,
  onAppTitleChange,
  onCuentaDefaultChange,
  init,
  check,
  crearEjercicio,
  doDedup: ejecutarDedup,
  repairSchema,
}
