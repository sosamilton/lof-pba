/**
 * Composable para paginación progresiva (infinite scroll).
 * Devuelve `visible` (slice de items), `hasMore`, `scrollProps` (para bind al contenedor)
 * y `onScroll` (handler). Cuando el contenido no llena el contenedor, carga automáticamente.
 *
 * @param {() => any[]} getItems - Función que devuelve el array reactivo (ej: () => filtered)
 * @param {number} [pageSize=50] - Cantidad de items por página
 */
export function useInfiniteScroll(getItems, pageSize = 50) {
  let visibleCount = $state(pageSize)
  let scrollEl = $state(null)
  let _prevItems = null

  // Reset cuando cambia el array (nueva referencia por $derived)
  $effect(() => {
    const items = getItems()
    if (items !== _prevItems) {
      _prevItems = items
      visibleCount = pageSize
    }
  })

  let visible = $derived.by(() => {
    const items = getItems()
    return items.slice(0, visibleCount)
  })

  let hasMore = $derived.by(() => {
    const items = getItems()
    return visibleCount < items.length
  })

  const loadMore = () => {
    const items = getItems()
    if (visibleCount < items.length) {
      visibleCount += pageSize
    }
  }

  const onScroll = () => {
    if (!scrollEl) return
    if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 300) {
      loadMore()
    }
  }

  // Auto-load cuando el contenido no llena el contenedor (no hay scrollbar)
  $effect(() => {
    if (!scrollEl) return
    // Track visibleCount para re-ejecutar después de loadMore
    visibleCount
    const items = getItems()
    if (visibleCount < items.length && scrollEl.scrollHeight <= scrollEl.clientHeight) {
      loadMore()
    }
  })

  return {
    get visible() { return visible },
    get hasMore() { return hasMore },
    get scrollEl() { return scrollEl },
    set scrollEl(v) { scrollEl = v },
    onScroll,
  }
}
