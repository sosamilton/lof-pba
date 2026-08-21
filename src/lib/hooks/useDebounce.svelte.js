/**
 * Debounce reactivo para búsquedas. Evita que $derived chains pesadas
 * se recalculen en cada keystroke.
 *
 * @param {() => string} getSource - Getter que devuelve el valor a debouncear
 * @param {number} [delay=150] - Delay en ms
 * @returns {{ value: string }}
 */
export function useDebounce(getSource, delay = 150) {
  let _debounced = $state(getSource())
  let _timer = null

  $effect(() => {
    const v = getSource()
    if (_timer) clearTimeout(_timer)
    _timer = setTimeout(() => {
      _debounced = v
    }, delay)
    return () => {
      if (_timer) clearTimeout(_timer)
    }
  })

  return {
    get value() { return _debounced },
  }
}
