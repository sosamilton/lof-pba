import { normalize } from '$core/utils.js'

/**
 * Derivados de personas/socios para el formulario de movimientos.
 * Centraliza `isRubroPagoSocietario` (antes duplicado) y las listas
 * seleccionables según tipo de movimiento y rubro.
 *
 * @param {object} deps
 * @param {object} deps.relatedData - Datos relacionados (rubros, socios, personas)
 * @param {object} deps.formState - Estado del formulario (form, filtroCategoria)
 * @returns {{
 *   sociosActivos: any[], personasTodas: any[], categoriasDisponibles: string[],
 *   personasFiltradas: any[], personasSeleccionables: { tipo: string, items: any[], label: string, filtroCategoria: boolean },
 *   isRubroPagoSocietario: (rubroId: any) => boolean,
 * }}
 */
export function createPersonasSelector({ relatedData, formState }) {
  const personaLabel = (p) =>
    p.razon_social || `${p.apellido || ''}, ${p.nombre || ''}`.replace(/^,\s*/, '') || '(sin nombre)'

  // Construye un item de Combobox con badges de tipo y categoría
  const personaToItem = (p) => ({
    value: p.id,
    label: personaLabel(p),
    categoria: p.categoria || '',
    badges: [
      p.tipo_persona === 'Juridica' ? 'Jurídica' : 'Física',
      ...(p.categoria ? [p.categoria] : []),
    ],
  })

  // Detectar si el rubro seleccionado es "pago societario" / cuota social
  const isRubroPagoSocietario = (rubroId) => {
    const r = relatedData.rubros.find((x) => Number(x.id) === Number(rubroId))
    if (!r) return false
    const nombre = normalize(r.nombre_oficial || '')
    return nombre.includes('cuota') || nombre.includes('socio') || nombre.includes('societ') || nombre.includes('aporte socio')
  }

  // Socios activos (sin fecha_baja) — solo para pago societario
  const sociosActivos = $derived(
    relatedData.socios
      .filter((s) => !s.fecha_baja)
      .map((s) => ({ value: s.id, label: `${s.apellido}, ${s.nombre} · DNI ${s.dni || '-'}` }))
  )

  // Todas las personas con badges de tipo (Física/Jurídica) y categoría
  const personasTodas = $derived(
    relatedData.personas
      .map(personaToItem)
      .sort((a, b) => normalize(a.label).localeCompare(normalize(b.label)))
  )

  // Categorías disponibles para filtrar
  const categoriasDisponibles = $derived(
    [...new Set(relatedData.personas.map((p) => p.categoria).filter(Boolean))].sort()
  )

  // Personas filtradas por categoría
  const personasFiltradas = $derived(
    formState.filtroCategoria
      ? personasTodas.filter((p) => p.categoria === formState.filtroCategoria)
      : personasTodas
  )

  // Lista de personas/socios según tipo de movimiento y rubro
  const personasSeleccionables = $derived.by(() => {
    if (!formState.form) return { tipo: 'none', items: [], label: '', filtroCategoria: false }
    if (formState.form.tipo_movimiento === 'Traspaso') {
      return { tipo: 'none', items: [], label: '', filtroCategoria: false }
    }
    // Pago societario → solo socios activos
    if (formState.form.tipo_movimiento === 'Entrada' && isRubroPagoSocietario(formState.form.rubro_id)) {
      return { tipo: 'socio', items: sociosActivos, label: 'Socio', filtroCategoria: false }
    }
    // Entrada o Salida → todas las personas con filtro por categoría
    return {
      tipo: 'persona',
      items: personasFiltradas,
      label: formState.form.tipo_movimiento === 'Entrada' ? 'Persona (ingreso)' : 'Persona (egreso)',
      filtroCategoria: true,
    }
  })

  return {
    get sociosActivos() { return sociosActivos },
    get personasTodas() { return personasTodas },
    get categoriasDisponibles() { return categoriasDisponibles },
    get personasFiltradas() { return personasFiltradas },
    get personasSeleccionables() { return personasSeleccionables },
    isRubroPagoSocietario,
  }
}
