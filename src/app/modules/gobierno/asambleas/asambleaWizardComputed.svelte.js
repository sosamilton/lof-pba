import { MESES, MES_NUMERO } from '$core/utils/utils.js'

/**
 * Valores derivados de negocio para AsambleaWizard.
 *
 * Extrae los `$derived` que vivían inline en el componente para:
 * - Centralizar la lógica de validación normativa (AGO fuera de término).
 * - Centralizar las transformaciones de datos para la vista de revisión.
 * - Hacer el componente una vista más pura.
 *
 * @param {object} store - El store combinado asambleasAutoridadesStore
 * @returns {{
 *   isAge: boolean, isRcd: boolean, isAgo: boolean, isVerificada: boolean,
 *   puedeVerificar: boolean,
 *   autoridadesAsamblea: any[],
 *   autoridadesPorOrganismo: [string, any[]][],
 *   cargoNombreMap: Record<string, string>,
 *   mesEsperadoAgo: number, mesEsperadoAgoNombre: string,
 *   esEjercicioNormativo: boolean, agoFueraDeTermino: boolean,
 *   filasPorOrganismo: [string, { fila: any, globalIdx: number }[]][],
 *   cargosSeleccionadosCount: number,
 *   assignedPersonaIds: any[],
 * }}
 */
export function createAsambleaWizardComputed(store) {
  const isAge = $derived(store.asambleaForm?.tipo_asamblea === 'AGE')
  const isRcd = $derived(store.asambleaForm?.tipo_asamblea === 'RCD')
  const isAgo = $derived(store.asambleaForm?.tipo_asamblea === 'AGO')
  const isVerificada = $derived(Boolean(store.asambleaForm?.verificada))

  // Condiciones para poder verificar: acta_numero + autoridades cargadas
  const puedeVerificar = $derived.by(() => {
    if (!store.asambleaForm?.id) return false
    if (!String(store.asambleaForm?.acta_numero || '').trim()) return false
    return store.getLinkedAutoridadesCount(store.asambleaForm.id) > 0
  })

  // Autoridades vinculadas a esta asamblea (para vista de revisión)
  const autoridadesAsamblea = $derived.by(() => {
    if (!store.asambleaForm?.id) return []
    return store.autoridades.filter(
      (au) => Number(au.asamblea_id) === Number(store.asambleaForm.id),
    )
  })

  // Autoridades agrupadas por organismo para la vista de revisión
  const autoridadesPorOrganismo = $derived.by(() => {
    const groups = {}
    for (const au of autoridadesAsamblea) {
      const org = au.organismo || 'CD'
      if (!groups[org]) groups[org] = []
      groups[org].push(au)
    }
    return Object.entries(groups)
  })

  // Mapa cargo_id → nombre_cargo para la vista de revisión
  const cargoNombreMap = $derived.by(() => {
    const map = {}
    for (const c of (store.cargos || [])) {
      map[String(c.id)] = c.nombre_cargo || ''
    }
    return map
  })

  // Art. 10 Decreto 4767/72: la Asamblea Ordinaria debe realizarse en la
  // segunda quincena del mes siguiente al cierre del ejercicio. Como el
  // cierre es el mes anterior a mes_inicio, el mes esperado de la AGO
  // coincide con mes_inicio (régimen estándar: Mayo). Advertencia (no
  // bloqueante) si la fecha de la AGO no cae en ese período.
  const mesEsperadoAgo = $derived.by(() => {
    const mesInicio = String(store.ejercicio?.mes_inicio || '')
    return MES_NUMERO[mesInicio] || 5 // default: régimen normativo (Mayo)
  })
  const mesEsperadoAgoNombre = $derived(MESES[mesEsperadoAgo - 1] || 'mayo')
  const esEjercicioNormativo = $derived(mesEsperadoAgo === 5)
  const agoFueraDeTermino = $derived.by(() => {
    if (!isAgo) return false
    const f = String(store.asambleaForm?.fecha || '')
    const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return false
    const mes = Number(m[2])
    const dia = Number(m[3])
    return mes !== mesEsperadoAgo || dia < 15
  })

  // Helper: agrupar filas por organismo con índice global
  const filasPorOrganismo = $derived.by(() => {
    if (!store.cargarDraft) return []
    const groups = {}
    const filas = store.cargarDraft.filas
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]
      const org = f.organismo || 'CD'
      if (!groups[org]) groups[org] = []
      groups[org].push({ fila: f, globalIdx: i })
    }
    return Object.entries(groups)
  })

  const cargosSeleccionadosCount = $derived(
    store.cargarDraft ? store.cargarDraft.cargosSeleccionados.size : 0,
  )

  // IDs de personas ya asignadas a otros cargos (para excluirlas de la búsqueda)
  const assignedPersonaIds = $derived.by(() => {
    if (!store.cargarDraft) return []
    return store.cargarDraft.filas
      .filter((f) => f.persona_id)
      .map((f) => f.persona_id)
  })

  return {
    get isAge() { return isAge },
    get isRcd() { return isRcd },
    get isAgo() { return isAgo },
    get isVerificada() { return isVerificada },
    get puedeVerificar() { return puedeVerificar },
    get autoridadesAsamblea() { return autoridadesAsamblea },
    get autoridadesPorOrganismo() { return autoridadesPorOrganismo },
    get cargoNombreMap() { return cargoNombreMap },
    get mesEsperadoAgo() { return mesEsperadoAgo },
    get mesEsperadoAgoNombre() { return mesEsperadoAgoNombre },
    get esEjercicioNormativo() { return esEjercicioNormativo },
    get agoFueraDeTermino() { return agoFueraDeTermino },
    get filasPorOrganismo() { return filasPorOrganismo },
    get cargosSeleccionadosCount() { return cargosSeleccionadosCount },
    get assignedPersonaIds() { return assignedPersonaIds },
  }
}
