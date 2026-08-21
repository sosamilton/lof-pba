/**
 * Lista reactiva de localidades de la Provincia de Buenos Aires.
 * Se carga con dynamic import para no incluir los ~13 KB en el bundle principal.
 *
 * Uso:
 *   import { localidadesItems } from '$lib/hooks/localidades.svelte.js'
 *   <Combobox items={localidadesItems.current} />
 */

let _items = $state([])

import('$core/data/localidades-buenos-aires.json').then((m) => {
  _items = m.default.map((nombre) => ({ value: nombre, label: nombre }))
})

export const localidadesItems = {
  get current() {
    return _items
  },
}
