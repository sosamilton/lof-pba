import { loadSeedCsv } from './initLof'
import { parseCsv, csvToObjects, normalizeSeedValue } from '$core/utils/csv'

/**
 * Gestión de cargos de gobierno: CRUD, reordenamiento, federación.
 * Funciones puras que reciban el store (this) como parámetro.
 * @param {any} s - Instancia del store
 */

export function cargosPorOrganismo(s, org) {
  return s.cargos
    .filter((c) => c.organismo === org)
    .sort((a, b) => a.orden - b.orden)
}

export function reordenar(s, org, index, dir) {
  const grupo = cargosPorOrganismo(s, org)
  const newIndex = index + dir
  if (newIndex < 0 || newIndex >= grupo.length) return
  const a = grupo[index]
  const b = grupo[newIndex]
  const tmpOrden = a.orden
  a.orden = b.orden
  b.orden = tmpOrden
  s.cargos = [...s.cargos]
}

export function addCargo(s, org) {
  const grupo = cargosPorOrganismo(s, org)
  const nuevo = {
    _uid: ++s.cargoUid,
    organismo: org,
    nombre_cargo: '',
    orden: grupo.length + 1,
    duracion_meses: 12,
    cargo_obligatorio: false,
    nivel: 'Titular',
    activo: true
  }
  s.cargos = [...s.cargos, nuevo]
}

export function removeCargo(s, uid) {
  const removed = s.cargos.find((c) => c._uid === uid)
  if (!removed || removed.cargo_obligatorio) return
  const grupo = cargosPorOrganismo(s, removed.organismo)
  const idx = grupo.findIndex((c) => c._uid === uid)
  grupo.slice(idx + 1).forEach((c) => (c.orden -= 1))
  s.cargos = s.cargos.filter((c) => c._uid !== uid)
}

// Oculta/muestra un cargo no obligatorio (toggle de `activo`).
// Los cargos ocultos no aparecen en el módulo gobierno pero se guardan en Grist
// para que la PIA pueda informarlos como nulo/sin designar.
export function toggleCargoActivo(s, uid) {
  s.cargos = s.cargos.map((c) =>
    c._uid === uid && !c.cargo_obligatorio ? { ...c, activo: !c.activo } : c
  )
}

// Sincroniza el estado `activo` de los cargos de Federación según la adhesión.
export function syncFederacionCargos(s) {
  s.cargos = s.cargos.map((c) =>
    c.organismo === 'Federacion'
      ? { ...c, activo: s.federacionAdherida }
      : c
  )
}

export function toggleFederacion(s) {
  s.federacionAdherida = !s.federacionAdherida
  syncFederacionCargos(s)
}

export async function loadDefaultCargos(s) {
  try {
    const csv = await loadSeedCsv('cargos')
    const rows = parseCsv(csv)
    const objs = csvToObjects(rows).map((o) => {
      /** @type {Record<string, any>} */
      const out = {}
      for (const [k, v] of Object.entries(o)) {
        const nv = normalizeSeedValue(v)
        if (nv === undefined) continue
        out[k] = nv
      }
      return out
    })
    s.cargos = objs.map((c) => ({
      _uid: ++s.cargoUid,
      organismo: c.organismo || 'CD',
      nombre_cargo: c.nombre_cargo || '',
      orden: Number(c.orden) || 0,
      duracion_meses: Number(c.duracion_meses) || 12,
      cargo_obligatorio: Boolean(c.cargo_obligatorio),
      nivel: c.nivel || '',
      activo: c.activo !== false
    }))
  } catch (e) {
    // Mínimo del Estatuto Modelo (Decreto 4767/72) + cargos opcionales del PIA.
    s.cargos = [
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Presidente/a', orden: 1, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Vicepresidente/a', orden: 2, duracion_meses: 12, cargo_obligatorio: false, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Secretario/a', orden: 3, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Prosecretario/a', orden: 4, duracion_meses: 12, cargo_obligatorio: false, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Tesorero/a', orden: 5, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Protesorero/a', orden: 6, duracion_meses: 12, cargo_obligatorio: false, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Titular 1', orden: 7, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Titular 2', orden: 8, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Titular 3', orden: 9, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Suplente 1', orden: 10, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Suplente', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Suplente 2', orden: 11, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Suplente', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CRC', nombre_cargo: 'Revisor/a Titular Docente', orden: 1, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CRC', nombre_cargo: 'Revisor/a Titular Socio', orden: 2, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CRC', nombre_cargo: 'Revisor/a Suplente', orden: 3, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Suplente', activo: true },
      { _uid: ++s.cargoUid, organismo: 'CRC', nombre_cargo: 'Asesor/a', orden: 4, duracion_meses: 12, cargo_obligatorio: false, nivel: '', activo: true },
    ]
  }
}
