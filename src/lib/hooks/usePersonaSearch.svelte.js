import { searchPersonas } from '$app/modules/comunidad/personas/personasApi.js'

/**
 * Composable reutilizable para búsqueda de personas con debounce.
 * Unifica la lógica de búsqueda de personas en sociosStore y asambleasAutoridadesStore.
 *
 * @param {object} opts
 * @param {number} opts.minChars - Mínimo de caracteres para buscar (default 2)
 * @param {number} opts.debounceMs - Ms de debounce (default 300)
 * @returns {object} { query, results, searching, search, reset }
 */
export function usePersonaSearch({ minChars = 2, debounceMs = 300 } = {}) {
  let query = $state('')
  let results = $state([])
  let searching = $state(false)
  let _timer = null

  const search = () => {
    clearTimeout(_timer)
    if (!query || query.length < minChars) {
      results = []
      return
    }
    _timer = setTimeout(async () => {
      searching = true
      try {
        results = await searchPersonas(query)
      } catch {
        results = []
      } finally {
        searching = false
      }
    }, debounceMs)
  }

  const reset = () => {
    clearTimeout(_timer)
    query = ''
    results = []
    searching = false
  }

  return {
    get query() { return query },
    set query(v) { query = v },
    get results() { return results },
    get searching() { return searching },
    search,
    reset,
  }
}
