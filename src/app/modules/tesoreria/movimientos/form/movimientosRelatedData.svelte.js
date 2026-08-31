import { resolveTableIds, fetchRelated } from '$core/data/dataStore.svelte'
import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { normalize, findEjercicioEnCurso, fechasEjercicio } from '$core/utils/utils.js'

/**
 * Estado y carga de las 7 tablas relacionadas del módulo de movimientos:
 * ejercicios, rubros_pia, subrubros, cuentas, socios, personas, cierres_mensuales.
 *
 * @param {object} deps
 * @param {object} deps.base - Store base (load, error, setError)
 * @returns {{
 *   rubros: any[], subrubros: any[], cuentas: any[], socios: any[],
 *   personas: any[], ejercicios: any[], ejercicio: any | null,
 *   userName: string, cuentaDefaultId: string, modoGestion: string,
 *   cierres: any[],
 *   setCierres: (v: any[]) => void,
 *   loadAll: () => Promise<void>,
 * }}
 */
export function createRelatedData({ base }) {
  let rubros = $state([])
  let subrubros = $state([])
  let cuentas = $state([])
  let socios = $state([])
  let personas = $state([])
  let ejercicios = $state([])
  let ejercicio = $state(null)
  // Ejercicio que el usuario está viendo en el filtro (no necesariamente el
  // en_curso). Se setea desde Movimientos.svelte cuando cambia ejercicioFiltro.
  // Sirve para: (1) defaultear la fecha al crear movimientos nuevos, (2)
  // limitar el date picker al rango del ejercicio visto.
  let ejercicioVisto = $state(null)
  let userName = $state('SPA')
  let cuentaDefaultId = $state('')
  // Modo de gestión activo (para cambiar el flujo de "Nuevo").
  let modoGestion = $state('gestion_integral') // 'gestion_integral' | 'carga_consolidada'
  let periodicidad = $state('mensual') // 'mensual' | 'semanal' | 'trimestral' | 'semestral' | 'anual'
  // Cierres mensuales manuales (para advertencia al cargar detalle en
  // un período que ya tiene un total declarado manualmente — regla "detalle gana").
  let cierres = $state([])
  // Defaults de movimiento (persistidos en config) + override de sesión
  let defaultsMovimiento = $state(null) // { tipo, rubro_id, cuenta_id, detalle }
  let sessionOverride = $state(null) // override en memoria, no persiste

  const setCierres = (v) => { cierres = v }
  const setDefaultsMovimiento = (v) => { defaultsMovimiento = v }
  const setSessionOverride = (v) => { sessionOverride = v }
  const resetSessionOverride = () => { sessionOverride = null }

  const setEjercicio = (ejId) => {
    const found = ejercicios.find((e) => Number(e.id) === Number(ejId)) || null
    if (found) ejercicio = found
  }

  /**
   * Setea el ejercicio que el usuario está viendo en el filtro.
   * Si ejId es null/vacío, cae al ejercicio en_curso.
   */
  const setEjercicioVisto = (ejId) => {
    if (!ejId) {
      ejercicioVisto = ejercicio // en_curso
      return
    }
    ejercicioVisto = ejercicios.find((e) => String(e.id) === String(ejId)) || ejercicio
  }

  /**
   * Devuelve { fechaMin, fechaMax } del ejercicio visto, o null si no hay.
   * Para limitar el date picker y validar la fecha del movimiento.
   */
  const rangoFechasEjercicioVisto = () => {
    const ej = ejercicioVisto
    if (!ej) return null
    const { fechaInicio, fechaFin } = fechasEjercicio(ej)
    if (!fechaInicio || !fechaFin) return null
    return { fechaMin: fechaInicio, fechaMax: fechaFin }
  }

  const loadAll = async () => {
    await base.load()
    if (base.error) return

    try {
      const tIds = await resolveTableIds([
        'ejercicios', 'rubros_pia', 'subrubros', 'cuentas', 'socios', 'personas', 'cierres_mensuales', 'cargas',
      ])

      const data = await fetchRelated(tIds, {
        ejercicios: {},
        rubros_pia: { sort: (a, b) => normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial)) },
        subrubros: {},
        cuentas: { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) },
        socios: { sort: (a, b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)) },
        personas: { sort: (a, b) => normalize(a.apellido || a.razon_social || '').localeCompare(normalize(b.apellido || b.razon_social || '')) },
        cierres_mensuales: {},
      })

      rubros = data.rubros_pia || []
      subrubros = data.subrubros || []
      cuentas = data.cuentas || []
      socios = data.socios || []
      personas = data.personas || []
      ejercicios = data.ejercicios || []
      ejercicio = findEjercicioEnCurso(ejercicios)
      cierres = data.cierres_mensuales || []

      try {
        const config = await loadConfig()
        if (config?.cuenta_default_id) {
          cuentaDefaultId = String(config.cuenta_default_id)
        } else if (cuentas.length > 0) {
          // Fallback: si la config no tiene cuenta_default_id (instalaciones previas al fix),
          // buscar por nombre. Priorizar 'Efectivo', luego la primera cuenta disponible.
          const fallback = cuentas.find((c) => String(c.nombre_cuenta) === 'Efectivo') || cuentas[0]
          cuentaDefaultId = fallback ? String(fallback.id) : ''
        }
        // Detectar modo de gestión para cambiar el flujo de "Nuevo".
        if (config?.modulo_carga_consolidada || config?.modulo_gestion_etapas || config?.modulo_solo_pia) modoGestion = 'carga_consolidada'
        else modoGestion = 'gestion_integral'
        periodicidad = String(config?.periodicidad || 'mensual')
        defaultsMovimiento = config?.defaults_movimiento || null
      } catch { /* config opcional */ }
    } catch (e) {
      base.setError(e?.message || String(e))
    }
  }

  return {
    get rubros() { return rubros },
    get subrubros() { return subrubros },
    get cuentas() { return cuentas },
    get socios() { return socios },
    get personas() { return personas },
    get ejercicios() { return ejercicios },
    get ejercicio() { return ejercicio },
    get ejercicioVisto() { return ejercicioVisto },
    get userName() { return userName },
    get cuentaDefaultId() { return cuentaDefaultId },
    get modoGestion() { return modoGestion },
    get periodicidad() { return periodicidad },
    get cierres() { return cierres },
    get defaultsMovimiento() { return defaultsMovimiento },
    get sessionOverride() { return sessionOverride },
    setCierres,
    setDefaultsMovimiento,
    setSessionOverride,
    resetSessionOverride,
    setEjercicio,
    setEjercicioVisto,
    rangoFechasEjercicioVisto,
    loadAll,
  }
}
