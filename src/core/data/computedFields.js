/**
 * ComputedFields — equivalente JS de las fórmulas Python de Grist.
 *
 * Las 28 fórmulas de schema.json (isFormula: true) se replican aquí
 * para que el dataRepository pueda devolver records con los campos
 * calculados ya resueltos, sin depender del motor de fórmulas de Grist.
 *
 * Cada fórmula recibe (rec, ctx) donde:
 *   rec  — el record crudo (sin campos calculados)
 *   ctx  — contexto con lookups a tablas relacionadas:
 *          { personas: Map<id, persona>, ... }
 *
 * Uso:
 *   import { applyComputedFields } from '$core/data/computedFields'
 *   const records = await fetchRecords('socios')
 *   const ctx = { personas: personasMap }
 *   const enriched = applyComputedFields('socios', records, ctx)
 */

// --- Helpers ---

const personaLookup = (rec, ctx, field) => {
  if (!rec.persona_id) return null
  const persona = ctx.personas?.get?.(rec.persona_id)
  return persona?.[field] ?? null
}

const apellidoNombre = (rec, ctx) => {
  if (!rec.persona_id) return null
  const p = ctx.personas?.get?.(rec.persona_id)
  if (!p) return null
  if (p.razon_social) return p.razon_social
  const parts = [p.apellido, p.nombre].filter(Boolean)
  return parts.join(' ') || null
}

const daysSince = (dateStr) => {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return Infinity
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

// --- Definición de fórmulas por tabla ---

/** @type {Record<string, Record<string, (rec: any, ctx: any) => any>>} */
const formulas = {
  ejercicios: {
    saldo_inicial_total: (rec) =>
      (rec.saldo_inicial_banco || 0) +
      (rec.saldo_inicial_efectivo || 0) +
      (rec.saldo_inicial_caja_chica || 0),
  },

  socios: {
    dni: (rec, ctx) => personaLookup(rec, ctx, 'dni'),
    cuil: (rec, ctx) => personaLookup(rec, ctx, 'cuil'),
    apellido: (rec, ctx) => personaLookup(rec, ctx, 'apellido'),
    nombre: (rec, ctx) => personaLookup(rec, ctx, 'nombre'),
    domicilio: (rec, ctx) => personaLookup(rec, ctx, 'domicilio'),
    localidad: (rec, ctx) => personaLookup(rec, ctx, 'localidad'),
    telefono: (rec, ctx) => personaLookup(rec, ctx, 'telefono'),
    email: (rec, ctx) => personaLookup(rec, ctx, 'email'),
    fecha_nacimiento: (rec, ctx) => personaLookup(rec, ctx, 'fecha_nacimiento'),
    activo: (rec) => rec.fecha_baja == null,
    habilitado_electoral: (rec) =>
      rec.tipo_socio === 'Activo' &&
      rec.fecha_baja == null &&
      daysSince(rec.fecha_alta) >= 30,
  },

  autoridades: {
    apellido_nombre: (rec, ctx) => apellidoNombre(rec, ctx),
    cuil: (rec, ctx) => personaLookup(rec, ctx, 'cuil'),
    dni: (rec, ctx) => personaLookup(rec, ctx, 'dni'),
    domicilio: (rec, ctx) => personaLookup(rec, ctx, 'domicilio'),
    localidad: (rec, ctx) => personaLookup(rec, ctx, 'localidad'),
  },

  cierres_mensuales: {
    total_ingresos_calc: (rec) =>
      (rec.ingresos_banco || 0) +
      (rec.ingresos_efectivo || 0) +
      (rec.ingresos_caja_chica || 0),
    total_egresos_calc: (rec) =>
      (rec.egresos_banco || 0) +
      (rec.egresos_efectivo || 0) +
      (rec.egresos_caja_chica || 0),
  },

  movimientos: {
    periodo: (rec) => (rec.fecha ? String(rec.fecha).slice(0, 7) : null),
  },

  asesores: {
    apellido_nombre: (rec, ctx) => apellidoNombre(rec, ctx),
    dni: (rec, ctx) => personaLookup(rec, ctx, 'dni'),
    cuil: (rec, ctx) => personaLookup(rec, ctx, 'cuil'),
    domicilio: (rec, ctx) => personaLookup(rec, ctx, 'domicilio'),
    localidad: (rec, ctx) => personaLookup(rec, ctx, 'localidad'),
    email: (rec, ctx) => personaLookup(rec, ctx, 'email'),
    telefono: (rec, ctx) => personaLookup(rec, ctx, 'telefono'),
    activo: (rec) => rec.fecha_cese == null,
  },
}

/**
 * Aplica las fórmulas computadas a un array de records de una tabla.
 * No muta los records originales — devuelve copias con los campos calculados.
 *
 * @param {string} tableKey - Key de la tabla (ej: 'socios', 'autoridades')
 * @param {Record<string, any>[]} records - Records crudos
 * @param {object} ctx - Contexto con lookups ({ personas: Map })
 * @returns {Record<string, any>[]} Records enriquecidos
 */
export const applyComputedFields = (tableKey, records, ctx = {}) => {
  const tableFormulas = formulas[tableKey]
  if (!tableFormulas) return records
  return records.map((rec) => {
    const enriched = { ...rec }
    for (const [field, fn] of Object.entries(tableFormulas)) {
      if (!(field in enriched)) {
        enriched[field] = fn(rec, ctx)
      }
    }
    return enriched
  })
}

/**
 * Aplica las fórmulas a un solo record.
 * @param {string} tableKey
 * @param {Record<string, any>} rec
 * @param {object} ctx
 * @returns {Record<string, any>}
 */
export const applyComputedFieldsOne = (tableKey, rec, ctx = {}) => {
  const tableFormulas = formulas[tableKey]
  if (!tableFormulas) return rec
  const enriched = { ...rec }
  for (const [field, fn] of Object.entries(tableFormulas)) {
    if (!(field in enriched)) {
      enriched[field] = fn(rec, ctx)
    }
  }
  return enriched
}

/**
 * Lista de tablas que tienen fórmulas computadas.
 * Útil para que el repository sepa qué tablas necesitan enriquecimiento.
 * @returns {string[]}
 */
export const getTablesFormulas = () => Object.keys(formulas)
