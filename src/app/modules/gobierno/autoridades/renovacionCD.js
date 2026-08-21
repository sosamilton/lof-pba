import { addMonths, dateToInput } from '$core/utils/utils.js'

/**
 * Lógica de renovación de la Comisión Directiva por mitades (art. 15
 * Decreto 4767/72).
 *
 * La CD dura 2 años y se renueva por mitades anualmente: los cargos se
 * reparten en dos grupos (A y B) que alternan renovación cada año.
 *
 * En la asamblea constitutiva (primera elección) se sortean los mandatos:
 * un grupo dura 1 año (mandato corto) y el otro 2 años (mandato largo).
 * A partir de ahí, cada grupo dura siempre 2 años y renueva en su turno.
 */

/**
 * Determina si la carga de autoridades corresponde a una constitución
 * (o re-constitución) de la CD: no hay autoridades vigentes de CD.
 *
 * @param {{ CD?: any[] }} vigentesPorOrgano - Autoridades vigentes agrupadas por organismo
 * @returns {boolean}
 */
export const esConstitucionCD = (vigentesPorOrgano) =>
  !vigentesPorOrgano || (vigentesPorOrgano.CD || []).length === 0

/**
 * Dado un grupo ('A' o 'B') y la decisión del sorteo (cuál grupo queda
 * con mandato corto en la constitución), devuelve la duración en meses
 * del mandato para ese grupo.
 *
 * - Constitución: grupo corto → 12 meses, grupo largo → 24 meses.
 * - Renovación: siempre 24 meses (régimen estabilizado).
 *
 * @param {string} grupo - 'A' | 'B' | '' (cargo sin grupo)
 * @param {boolean} constitucion - Si es asamblea constitutiva
 * @param {string} grupoCorto - Grupo que quedó con mandato corto en el sorteo ('A' | 'B')
 * @returns {number} Duración en meses (12 o 24)
 */
export const duracionMandatoGrupo = (grupo, constitucion, grupoCorto) => {
  if (!grupo) return 24
  if (!constitucion) return 24
  return grupo === grupoCorto ? 12 : 24
}

/**
 * Calcula la fecha de vencimiento de un mandato.
 *
 * - CD con grupo: usa duracionMandatoGrupo (constitución vs renovación).
 * - CD sin grupo / CRC / Federación: usa la duración del cargo (siempre
 *   la duración_meses del cargo, típicamente 12 para CRC/Fed, 24 para CD).
 *
 * Si la fila ya tiene fecha_vencimiento_existente y no es una nueva
 * autoridad, se respeta ese valor (el usuario puede haberlo ajustado
 * manualmente).
 *
 * @param {{
 *   organismo?: string,
 *   grupoRenovacion?: string,
 *   duracionMeses?: number | string,
 *   fecha_asuncion?: string,
 *   yaExiste?: boolean,
 *   fecha_vencimiento_existente?: string,
 * }} fila - Fila del draft de cargar autoridades
 * @param {boolean} constitucion - Si es asamblea constitutiva de CD
 * @param {string} grupoCorto - Grupo con mandato corto en constitución ('A' | 'B')
 * @returns {string} Fecha de vencimiento YYYY-MM-DD (vacía si no hay fecha de asunción)
 */
export const calcularVencimiento = (fila, constitucion, grupoCorto) => {
  const fechaAsuncion = fila.fecha_asuncion
  if (!fechaAsuncion) return ''
  // Si la autoridad ya existe y tiene vencimiento, respetarlo.
  if (fila.yaExiste && fila.fecha_vencimiento_existente) return fila.fecha_vencimiento_existente
  const org = String(fila.organismo || '')
  const grupo = String(fila.grupoRenovacion || '')
  let meses
  if (org === 'CD' && grupo) {
    meses = duracionMandatoGrupo(grupo, constitucion, grupoCorto)
  } else {
    meses = Number(fila.duracionMeses) || 12
  }
  return addMonths(fechaAsuncion, meses)
}

/**
 * Determina qué grupo de la CD es el que le toca renovar en la próxima
 * asamblea, en base a las fechas de vencimiento de las autoridades
 * vigentes.
 *
 * El grupo cuyo vencimiento es el más próximo (o ya vencido) es el que
 * toca renovar. Si ambos grupos tienen el mismo vencimiento (caso
 * anómalo), devuelve null.
 *
 * @param {any[]} vigentesCD - Autoridades vigentes de CD (con cargo_id, fecha_vencimiento)
 * @param {any[]} cargos - Lista de cargos (para mapear cargo_id → grupo_renovacion)
 * @returns {'A' | 'B' | null} Grupo que toca renovar, o null si no se puede determinar
 */
export const grupoAVencer = (vigentesCD, cargos) => {
  if (!vigentesCD || vigentesCD.length === 0) return null
  // Mapear cargo_id → grupo_renovacion
  const grupoByCargoId = new Map()
  for (const c of cargos || []) {
    if (String(c.organismo) === 'CD' && c.grupo_renovacion) {
      grupoByCargoId.set(Number(c.id), String(c.grupo_renovacion))
    }
  }
  // Para cada grupo, encontrar el vencimiento mínimo (el más urgente).
  const vencPorGrupo = { A: null, B: null }
  for (const au of vigentesCD) {
    const grupo = grupoByCargoId.get(Number(au.cargo_id))
    if (!grupo) continue
    const venc = dateToInput(au.fecha_vencimiento)
    if (!venc) continue
    if (vencPorGrupo[grupo] === null || venc < vencPorGrupo[grupo]) {
      vencPorGrupo[grupo] = venc
    }
  }
  // Si solo un grupo tiene vencimientos, ese es el que toca.
  if (vencPorGrupo.A && !vencPorGrupo.B) return 'A'
  if (vencPorGrupo.B && !vencPorGrupo.A) return 'B'
  if (!vencPorGrupo.A && !vencPorGrupo.B) return null
  // Ambos tienen: el de vencimiento más próximo (string comparison ISO works).
  return vencPorGrupo.A <= vencPorGrupo.B ? 'A' : 'B'
}
