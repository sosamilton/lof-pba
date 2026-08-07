/**
 * Estado UI del formulario de movimientos: selección, form, lista, búsqueda, filtros.
 * Estado puro sin lógica de negocio.
 *
 * @returns {{
 *   selectedId: any, form: any | null, listOpen: boolean,
 *   q: string, tipo: string, filtroCategoria: string,
 *   advertenciaCierreManual: string,
 *   setSelectedId: (v: any) => void, setForm: (v: any) => void,
 *   setListOpen: (v: boolean) => void, setQ: (v: string) => void,
 *   setTipo: (v: string) => void, setFiltroCategoria: (v: string) => void,
 *   setAdvertenciaCierreManual: (v: string) => void,
 * }}
 */
export function createFormState() {
  let selectedId = $state(null)
  let form = $state(null)
  let listOpen = $state(true)
  let q = $state('')
  let tipo = $state('')
  let filtroCategoria = $state('')
  // Advertencia pendiente de mostrar al usuario (no bloquea el guardado).
  let advertenciaCierreManual = $state('')

  return {
    get selectedId() { return selectedId },
    get form() { return form },
    get listOpen() { return listOpen },
    get q() { return q },
    get tipo() { return tipo },
    get filtroCategoria() { return filtroCategoria },
    get advertenciaCierreManual() { return advertenciaCierreManual },
    setSelectedId: (v) => { selectedId = v },
    setForm: (v) => { form = v },
    setListOpen: (v) => { listOpen = v },
    setQ: (v) => { q = v },
    setTipo: (v) => { tipo = v },
    setFiltroCategoria: (v) => { filtroCategoria = v },
    setAdvertenciaCierreManual: (v) => { advertenciaCierreManual = v },
  }
}
