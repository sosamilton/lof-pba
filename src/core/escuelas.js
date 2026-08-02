import { parseCue, normalizeCueForLookup, isValidCue } from './format.js'

/**
 * Índice de establecimientos educativos oficiales de PBA.
 * Fuente: mapaescolar.abc.gob.ar (ver scripts/COOPERADORAS.md).
 * Estructura: { meta, escuelas: { <CUE 8 dígitos>: ficha } }
 *
 * El índice es pesado (~3.7 MB) por lo que se carga con dynamic import
 * (code-split) solo cuando se necesita, no en el bundle principal.
 */

let _index = null
let _indexPromise = null

/**
 * Carga el índice de escuelas (dynamic import, cacheado).
 * Llamar al iniciar el flujo de setup para que esté disponible cuando
 * el usuario llegue al paso de carga de CUE.
 *
 * @returns {Promise<object>} el índice completo { meta, escuelas }
 */
export const loadEscuelasIndex = async () => {
  if (_index) return _index
  if (!_indexPromise) {
    _indexPromise = import('./data/cooperadoras.json').then((m) => {
      _index = m.default
      return _index
    })
  }
  return _indexPromise
}

/**
 * ¿El índice ya está cargado en memoria?
 */
export const isIndexLoaded = () => _index !== null

const _meta = () => _index?.meta || {}
const _escuelas = () => _index?.escuelas || {}

/**
 * Fecha de descarga del dataset oficial (formato DD-MM-YYYY), para mostrar
 * en mensajes de "no registrado a la fecha".
 */
export const fechaDescargaOficial = () => _meta().fecha_descarga || ''

/**
 * Cantidad de establecimientos indexados (solo activos).
 */
export const totalEscuelasIndexadas = () => _meta().indexadas || Object.keys(_escuelas()).length

/**
 * Busca una escuela en el índice oficial por CUE.
 * Acepta CUE de 8 o 9 dígitos; normaliza antes de buscar.
 * Requiere que el índice esté cargado (loadEscuelasIndex).
 *
 * @param {string} cue - CUE crudo (con o sin formato)
 * @returns {object|null} ficha de la escuela o null si no se encuentra
 */
export const findEscuelaByCue = (cue) => {
  if (!_index) return null
  const c = parseCue(cue)
  if (!c) return null
  const key = normalizeCueForLookup(c)
  return _escuelas()[key] || null
}

/**
 * Mapea una ficha del índice oficial a los campos de schoolData del setup.
 * Solo incluye campos que el dataset oficial provee.
 *
 * @param {object} ficha - ficha devuelta por findEscuelaByCue
 * @returns {object} campos para precargar en schoolData
 */
export const buildPrefillFromFicha = (ficha) => {
  if (!ficha) return {}
  const domicilio = [ficha.calle, ficha.nro_calle]
    .filter(Boolean)
    .join(' ')
    .trim()
  return {
    escuela_nombre: ficha.nombre || '',
    escuela_numero: ficha.numero || '',
    distrito: ficha.distrito || '',
    localidad: (ficha.localidad || '').trim(),
    domicilio,
  }
}

/**
 * Estado de búsqueda del CUE.
 *   'idle'       - vacío o menos de 4 dígitos
 *   'typing'     - 4+ dígitos pero CUE incompleto
 *   'found'      - CUE completo y encontrado en el índice oficial
 *   'not_found'  - CUE completo pero no encontrado (o anexo no registrado)
 *   'loading'    - índice aún no cargado
 *
 * @param {string} cue
 * @returns {'idle'|'typing'|'found'|'not_found'|'loading'}
 */
export const cueSearchState = (cue) => {
  if (!_index) return 'loading'
  const c = parseCue(cue)
  if (c.length < 4) return 'idle'
  if (!isValidCue(c)) return 'typing'
  return findEscuelaByCue(c) ? 'found' : 'not_found'
}
