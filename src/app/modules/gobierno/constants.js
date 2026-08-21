/**
 * Constantes de dominio del módulo Gobierno (asambleas, histórico y memorias).
 */

export const ORGANISMOS = ['CD', 'CRC', 'Federacion']

export const ORGANISMO_LABELS = {
  CD: 'Comisión Directiva',
  CRC: 'Comisión Revisora de Cuentas',
  Federacion: 'Federación'
}

export const NIVELES_CARGO = ['Titular', 'Suplente']

export const TIPOS_ASAMBLEA = ['AGO', 'AGE', 'RCD']

export const TIPOS_ASAMBLEA_CORTO = {
  AGO: 'Asamblea Ordinaria',
  AGE: 'Asamblea Extraordinaria',
  RCD: 'Reunión de CD',
}

export const MOTIVOS_CESE = ['Renuncia', 'FinMandato', 'Reemplazo', 'Otro']

/**
 * Construye un mapa de cargo_id → autoridad vigente para un organismo.
 * "Vigente" = activo !== false y sin fecha_cese.
 * Si hay múltiples autoridades para el mismo cargo, la primera encontrada gana.
 *
 * @param {any[]} autoridades - Lista de autoridades
 * @param {string} organismo - Organismo a filtrar ('CD', 'CE', 'CT')
 * @returns {Map<number, any>} Mapa de Number(cargo_id) → autoridad
 */
export const buildVigenteByCargo = (autoridades, organismo) => {
  const map = new Map()
  for (const a of autoridades) {
    if (String(a.organismo) !== String(organismo)) continue
    if (a.activo === false) continue
    if (a.fecha_cese) continue
    const key = Number(a.cargo_id)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, a)
    } else {
      // Si hay multiples activas sin cese para el mismo cargo,
      // la vigente es la de fecha_asuncion mas reciente
      const existingFecha = String(existing.fecha_asuncion || '')
      const newFecha = String(a.fecha_asuncion || '')
      if (newFecha > existingFecha) {
        map.set(key, a)
      }
    }
  }
  return map
}
