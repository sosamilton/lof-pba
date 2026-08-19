import { resolveTableIds, fetchRelated } from '$core/grist/stores/gristStore.svelte.js'
import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { normalize } from '$core/utils/utils.js'

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
  let userName = $state('SPA')
  let cuentaDefaultId = $state('')
  // Modo de gestión activo (para cambiar el flujo de "Nuevo").
  let modoGestion = $state('gestion_integral') // 'gestion_integral' | 'carga_consolidada'
  let periodicidad = $state('mensual') // 'mensual' | 'semanal' | 'trimestral' | 'semestral' | 'anual'
  // Cierres mensuales manuales (para advertencia al cargar detalle en
  // un período que ya tiene un total declarado manualmente — regla "detalle gana").
  let cierres = $state([])

  const setCierres = (v) => { cierres = v }

  const setEjercicio = (ejId) => {
    const found = ejercicios.find((e) => Number(e.id) === Number(ejId)) || null
    if (found) ejercicio = found
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
      ejercicio = ejercicios.find((e) => e.en_curso === true) || null
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
    get userName() { return userName },
    get cuentaDefaultId() { return cuentaDefaultId },
    get modoGestion() { return modoGestion },
    get periodicidad() { return periodicidad },
    get cierres() { return cierres },
    setCierres,
    setEjercicio,
    loadAll,
  }
}
