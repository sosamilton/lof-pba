import { usePersonaSearch } from '$core/usePersonaSearch.svelte.js'

/**
 * Dispatcher central de búsqueda de personas.
 * Comparte una única instancia de usePersonaSearch entre cargarAutoridades
 * y reemplazoAutoridad. Despacha el resultado según searchTarget.
 *
 * @returns {{
 *   query: string, results: any[], searching: boolean, searchTarget: string | null,
 *   doPersonaSearch: (target: string) => void,
 *   linkPersonaSearch: (p: any) => void,
 *   reset: () => void,
 *   onSetDraftPersona: (fn: (idx: number, p: any) => void) => void,
 *   onSetReemplazoPersona: (fn: (p: any) => void) => void,
 * }}
 */
export function createPersonaSearchDispatcher() {
  const ps = usePersonaSearch()
  let searchTarget = $state(null)

  // Callbacks que se conectan después de instanciar los sub-módulos
  let _onSetDraftPersona = null
  let _onSetReemplazoPersona = null

  const doPersonaSearch = (target) => {
    searchTarget = target
    ps.search()
  }

  const linkPersonaSearch = (p) => {
    if (!searchTarget) return
    if (searchTarget.startsWith('cargar:')) {
      const idx = Number(searchTarget.split(':')[1])
      _onSetDraftPersona?.(idx, p)
    } else if (searchTarget === 'reemplazo') {
      _onSetReemplazoPersona?.(p)
    }
  }

  const reset = () => {
    ps.reset()
    searchTarget = null
  }

  return {
    get query() { return ps.query },
    set query(v) { ps.query = v },
    get results() { return ps.results },
    get searching() { return ps.searching },
    get searchTarget() { return searchTarget },
    doPersonaSearch,
    linkPersonaSearch,
    reset,
    onSetDraftPersona: (fn) => { _onSetDraftPersona = fn },
    onSetReemplazoPersona: (fn) => { _onSetReemplazoPersona = fn },
  }
}
