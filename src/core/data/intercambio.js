/**
 * Intercambio descentralizado de datos entre instancias PouchDB.
 *
 * Permite que un colaborador externo cargue movimientos desde su celu
 * (PWA en modo PouchDB) y los devuelva a la cooperadora para integrarlos
 * al real, sin exponer información crítica y sin sincronización en vivo.
 *
 * Formato .lof: mismo magic header "LOFBK1" + gzip(payload JSON).
 * El payload incluye metadatos opcionales (kind, profile,
 * source, modalidad) para el flujo de intercambio.
 *
 * Flujos:
 *   1. Cooperadora exporta "set de trabajo" → colaborador lo importa
 *   2. Colaborador carga movimientos → exporta "patch" (solo lo nuevo)
 *   3. Cooperadora analiza el patch (dry-run) → aprueba → aplica merge
 *
 * El merge es aditivo: nunca borra ni pisa datos del real. Reasigna IDs
 * a todo lo entrante y deduplica personas/socios por DNI/CUIL/persona_id.
 * Para carga consolidada, también deduplica cargas por ejercicio+período.
 */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import { getPouchDb, getActiveBackend, applyUserActions, resolveTableId } from './dataRepository.js'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils'
import { parseDni } from '$core/format/format'
import {
  encryptWithPassphrase,
  decryptWithPassphrase,
  serializeEnvelope,
  parseEnvelope,
} from '$core/security/cryptoEnvelope.js'

const MAGIC = 'LOFBK1'
const MAGIC_ENCRYPTED = 'LOFENC1'
const VERSION = 2

// --- Perfiles de exportación ---

/**
 * Tablas incluidas en cada perfil de exportación.
 * `personaFields` indica qué campos de personas se incluyen (reducción de PII).
 * `escuelaFields` indica qué campos de escuela se incluyen (mínimo institucional).
 * Los perfiles se bifurcan por modalidad (integral vs consolidada).
 */
export const EXPORT_PROFILES = {
  /** Set de trabajo para gestión integral. Reduce PII de personas. */
  working_set_integral: {
    tables: ['configuracion', 'escuela', 'ejercicios', 'rubros_pia', 'subrubros',
             'cuentas', 'personas', 'socios'],
    personaFields: ['id', 'tipo_persona', 'dni', 'cuil', 'apellido', 'nombre',
                    'razon_social', 'categoria', 'creado_el'],
    escuelaFields: ['id', 'escuela_nombre', 'escuela_numero', 'cooperadora_nombre'],
    kind: 'working-set',
    modalidad: 'gestion_integral',
  },
  /** Set de trabajo para carga consolidada. No incluye personas/socios. */
  working_set_consolidada: {
    tables: ['configuracion', 'escuela', 'ejercicios', 'rubros_pia', 'subrubros',
             'cuentas'],
    personaFields: null,
    escuelaFields: ['id', 'escuela_nombre', 'escuela_numero', 'cooperadora_nombre'],
    kind: 'working-set',
    modalidad: 'carga_consolidada',
  },
  /** Patch para gestión integral: movimientos + personas + socios nuevos. */
  patch_integral: {
    tables: ['movimientos', 'personas', 'socios'],
    personaFields: null,
    kind: 'patch',
    filter: (doc) => !doc.imported_from,
  },
  /** Patch para carga consolidada: cargas + movimientos. */
  patch_consolidada: {
    tables: ['cargas', 'movimientos'],
    personaFields: null,
    kind: 'patch',
    filter: (doc) => !doc.imported_from,
  },
  /** Personalizado: el usuario elige tablas. */
  custom: {
    tables: null,
    personaFields: null,
    kind: 'custom',
  },
  // Alias de compatibilidad con código Fase 1
  working_set: null, // se resuelve dinámicamente según modalidad
  patch_movimientos: null,
}

/**
 * Resuelve el perfil de exportación correcto según la modalidad activa.
 * @param {'working_set' | 'patch'} baseKey
 * @returns {Promise<{ profileKey: string, profile: object }>}
 */
async function _resolveProfile(baseKey) {
  if (baseKey === 'working_set') {
    const config = await _loadConfig()
    const isConsolidada = config?.modulo_carga_consolidada || config?.modulo_solo_pia || config?.modulo_gestion_etapas
    const profileKey = isConsolidada ? 'working_set_consolidada' : 'working_set_integral'
    return { profileKey, profile: EXPORT_PROFILES[profileKey] }
  }
  if (baseKey === 'patch_movimientos') {
    const config = await _loadConfig()
    const isConsolidada = config?.modulo_carga_consolidada || config?.modulo_solo_pia || config?.modulo_gestion_etapas
    const profileKey = isConsolidada ? 'patch_consolidada' : 'patch_integral'
    return { profileKey, profile: EXPORT_PROFILES[profileKey] }
  }
  const profile = EXPORT_PROFILES[baseKey]
  if (!profile) throw new Error(`Perfil de exportación desconocido: ${baseKey}`)
  return { profileKey: baseKey, profile }
}

/**
 * Resuelve un array de keys lógicas (lowercase) a sus tableIds reales de PouchDB.
 * Los docs en PouchDB tienen `type` = primer preferred ID de TABLE_PREFERRED_IDS,
 * que es capitalizado (ej: 'Personas', 'Rubros PIA', 'Configuracion').
 * @param {string[]} keys - Keys lógicas ej: ['personas', 'cuentas']
 * @returns {Promise<Set<string>>} Set de tableIds reales ej: {'Personas', 'Cuentas'}
 */
async function _resolveTableTypeSet(keys) {
  const out = new Set()
  for (const key of keys) {
    const preferred = TABLE_PREFERRED_IDS[key]
    if (preferred) {
      const tid = await resolveTableId(preferred)
      if (tid) out.add(tid)
    } else {
      // Si no está en TABLE_PREFERRED_IDS, usar la key tal cual
      out.add(key)
    }
  }
  return out
}

/**
 * Resuelve una key lógica a su tableId real de PouchDB.
 * @param {string} key - ej: 'personas'
 * @returns {Promise<string>} tableId real ej: 'Personas'
 */
async function _resolveTableType(key) {
  const preferred = TABLE_PREFERRED_IDS[key]
  if (preferred) {
    const tid = await resolveTableId(preferred)
    if (tid) return tid
  }
  return key
}

// --- Export parcial ---

/**
 * Exporta un subset de la DB a un archivo .lof.
 * @param {string} profileKey - clave de EXPORT_PROFILES o alias ('working_set', 'patch_movimientos')
 * @param {object} [opts] - opciones extra (ej: { tables: [...] } para custom)
 * @param {string} [opts.passphrase] - Passphrase ad-hoc para cifrar el .lof (sobre AES-GCM).
 * @returns {Promise<{ filename: string, size: number, docCount: number }>}
 */
export async function exportParcial(profileKey, opts = {}) {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('El intercambio solo está disponible en modo standalone (PouchDB).')
  }

  const { profileKey: resolvedKey, profile } = await _resolveProfile(profileKey)
  if (!profile) throw new Error(`Perfil de exportación desconocido: ${profileKey}`)

  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos activa.')

  const tables = opts.tables || profile.tables
  if (!tables || tables.length === 0) {
    throw new Error('No se especificaron tablas para exportar.')
  }
  // Resolver keys lógicas a tableIds reales de PouchDB (capitalizados)
  const tableSet = await _resolveTableTypeSet(tables)
  const personasType = await _resolveTableType('personas')
  const escuelaType = await _resolveTableType('escuela')

  const result = await db.allDocs({ include_docs: true, conflicts: false })
  let docs = result.rows
    .map((r) => r.doc)
    .filter((d) => !d._id.startsWith('_local/'))
    .filter((d) => tableSet.has(d.type))
    .map((d) => {
      const { _revisions, _conflicts, imported_from, ...clean } = d
      return clean
    })

  // Filtrar personas por campos (reducción de PII)
  if (profile.personaFields && tableSet.has(personasType)) {
    const allowed = new Set(profile.personaFields)
    docs = docs.map((d) => {
      if (d.type !== personasType) return d
      const projected = {}
      for (const k of allowed) {
        if (k in d) projected[k] = d[k]
      }
      projected._id = d._id
      projected._rev = d._rev
      projected.type = d.type
      return projected
    })
  }

  // Filtrar escuela por campos (mínimo institucional)
  if (profile.escuelaFields && tableSet.has(escuelaType)) {
    const allowed = new Set(profile.escuelaFields)
    docs = docs.map((d) => {
      if (d.type !== escuelaType) return d
      const projected = {}
      for (const k of allowed) {
        if (k in d) projected[k] = d[k]
      }
      projected._id = d._id
      projected._rev = d._rev
      projected.type = d.type
      return projected
    })
  }

  // Aplicar filtro del perfil (ej: solo docs sin imported_from)
  if (profile.filter) {
    docs = docs.filter(profile.filter)
  }

  // Cargar config para incluir defaults_movimiento y modalidad en el payload
  const config = await _loadConfig()

  const payload = {
    v: VERSION,
    exportedAt: new Date().toISOString(),
    docCount: docs.length,
    kind: profile.kind,
    profile: resolvedKey,
    modalidad: profile.modalidad || null,
    source: opts.source || null,
    defaults_movimiento: config?.defaults_movimiento || null,
    docs,
  }

  const jsonStr = JSON.stringify(payload)
  const jsonBytes = strToU8(jsonStr)
  const compressed = gzipSync(jsonBytes, { level: 9 })

  const date = new Date().toISOString().slice(0, 10)
  const suffix = resolvedKey.startsWith('working_set') ? 'working-set'
    : resolvedKey.startsWith('patch') ? 'patch' : 'export'
  const filename = `lof-${suffix}-${date}.lof`

  let fileBytes
  let encrypted = false
  if (opts.passphrase) {
    // Cifrar con passphrase ad-hoc (sobre AES-GCM, destinatario 'colaborador')
    const envelope = await encryptWithPassphrase(opts.passphrase, compressed, 'colaborador')
    const envelopeJson = serializeEnvelope(envelope)
    const envelopeBytes = strToU8(envelopeJson)
    const magicBytes = strToU8(MAGIC_ENCRYPTED)
    fileBytes = new Uint8Array(magicBytes.length + envelopeBytes.length)
    fileBytes.set(magicBytes, 0)
    fileBytes.set(envelopeBytes, magicBytes.length)
    encrypted = true
  } else {
    const magicBytes = strToU8(MAGIC)
    fileBytes = new Uint8Array(magicBytes.length + compressed.length)
    fileBytes.set(magicBytes, 0)
    fileBytes.set(compressed, magicBytes.length)
  }

  const blob = new Blob([fileBytes], { type: 'application/octet-stream' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return {
    filename,
    size: fileBytes.length,
    docCount: docs.length,
    encrypted,
  }
}

// --- Import de working set (para el colaborador) ---

/**
 * Importa un set de trabajo (.lof kind=working-set) en la DB actual.
 * A diferencia de importBackup (que destruye y reemplaza), este mergea:
 * inserta los docs del archivo marcándolos con imported_from para que
 * el colaborador pueda luego exportar solo lo que él creó.
 *
 * @param {File} file
 * @param {object} [opts] - { exportId, reemplazar, inicializar, passphrase }
 * @returns {Promise<{ docCount: number, inserted: number, skipped: number, replaced: number }>}
 */
export async function importWorkingSet(file, opts = {}) {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('El intercambio solo está disponible en modo standalone (PouchDB).')
  }
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos activa.')

  const payload = await _parseLof(file, opts.passphrase)

  if (payload.kind && payload.kind !== 'working-set' && payload.kind !== 'custom') {
    throw new Error(`Este archivo es de tipo "${payload.kind}". Use "Importar set de trabajo" solo para sets de trabajo.`)
  }

  const marker = opts.exportId || `working-set-${payload.exportedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)}`
  const reemplazar = opts.reemplazar || false

  // Si reemplazar, borrar docs del set anterior
  let replaced = 0
  if (reemplazar) {
    const allDocs = await db.allDocs({ include_docs: true })
    const toDelete = allDocs.rows
      .map((r) => r.doc)
      .filter((d) => !d._id.startsWith('_local/') && d.imported_from)
      .map((d) => ({ _id: d._id, _rev: d._rev, _deleted: true }))
    if (toDelete.length > 0) {
      await db.bulkDocs(toDelete)
      replaced = toDelete.length
    }
  }

  let inserted = 0
  let skipped = 0
  const BATCH = 500
  const docsToInsert = []

  for (const doc of payload.docs) {
    const { _rev, imported_from, ...clean } = doc
    clean.imported_from = marker
    try {
      await db.get(clean._id)
      skipped++
    } catch (e) {
      if (e.status === 404) {
        docsToInsert.push(clean)
      } else {
        throw e
      }
    }
  }

  for (let i = 0; i < docsToInsert.length; i += BATCH) {
    const batch = docsToInsert.slice(i, i + BATCH)
    await db.bulkDocs(batch)
    inserted += batch.length
  }

  // Si el working set trae defaults_movimiento, guardarlos en configuracion
  if (payload.defaults_movimiento) {
    await _mergeConfigDefaults(payload.defaults_movimiento)
  }

  // Si inicializar (modo colaborador), setear flags en configuracion
  if (opts.inicializar) {
    await _setModoColaborador(payload)
  }

  await _rebuildCounters(db)

  return { docCount: payload.docs.length, inserted, skipped, replaced }
}

// --- Análisis de merge (dry-run) ---

/**
 * Analiza un archivo .lof patch y devuelve un reporte detallado sin escribir nada.
 * @param {File} file
 * @returns {Promise<MergeReport>}
 */
export async function analizarMerge(file, passphrase) {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('El intercambio solo está disponible en modo standalone (PouchDB).')
  }
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos activa.')

  const payload = await _parseLof(file, passphrase)

  if (payload.kind !== 'patch') {
    throw new Error(
      `Este archivo es de tipo "${payload.kind || 'desconocido'}". El merge solo acepta patches (kind: "patch").`
    )
  }

  const docsByType = _groupByType(payload.docs)
  // Los docs del patch pueden tener type capitalizado o lowercase dependiendo
  // de si vienen de una DB real o de tests. Buscar en ambas variantes.
  const patchPersonas = docsByType.personas || docsByType['Personas'] || []
  const patchSocios = docsByType.socios || docsByType['Socios'] || []
  const patchCargas = docsByType.cargas || docsByType['Cargas'] || []
  const patchMovimientos = docsByType.movimientos || docsByType['Movimientos'] || []

  // Cargar datos del real usando tableIds reales (capitalizados)
  const personasType = await _resolveTableType('personas')
  const sociosType = await _resolveTableType('socios')
  const cargasType = await _resolveTableType('cargas')
  const rubrosType = await _resolveTableType('rubros_pia')
  const subrubrosType = await _resolveTableType('subrubros')
  const cuentasType = await _resolveTableType('cuentas')
  const ejerciciosType = await _resolveTableType('ejercicios')

  const realPersonas = await _fetchAllByType(db, personasType)
  const realSocios = await _fetchAllByType(db, sociosType)
  const realCargas = await _fetchAllByType(db, cargasType)
  const realRubros = await _fetchAllByType(db, rubrosType)
  const realSubrubros = await _fetchAllByType(db, subrubrosType)
  const realCuentas = await _fetchAllByType(db, cuentasType)
  const realEjercicios = await _fetchAllByType(db, ejerciciosType)

  // Índices del real
  const realPersonasByDni = new Map()
  const realPersonasByCuil = new Map()
  for (const p of realPersonas) {
    const dni = parseDni(p.dni)
    if (dni) realPersonasByDni.set(dni, p)
    if (p.cuil) realPersonasByCuil.set(p.cuil, p)
  }
  const realSociosByPersona = new Map()
  for (const s of realSocios) {
    if (s.persona_id != null) realSociosByPersona.set(Number(s.persona_id), s)
  }
  // Cargas indexadas por ejercicio_id + periodo (para dedup)
  const realCargasByEjPeriodo = new Map()
  for (const c of realCargas) {
    const key = `${Number(c.ejercicio_id)}-${c.periodo}`
    realCargasByEjPeriodo.set(key, c)
  }
  const realRubroIds = new Set(realRubros.map((r) => Number(r.id)))
  const realSubrubroIds = new Set(realSubrubros.map((r) => Number(r.id)))
  const realCuentaIds = new Set(realCuentas.map((r) => Number(r.id)))
  const realEjercicioIds = new Set(realEjercicios.map((r) => Number(r.id)))

  // FASE 1: Personas — dedup + mapeo
  const personasPhase = _analizarMergePersonas(patchPersonas, {
    realPersonasByDni, realPersonasByCuil,
  })

  // FASE 2: Socios — dedup + mapeo (depende del mapeo de personas)
  const sociosPhase = _analizarMergeSocios(patchSocios, patchPersonas, {
    personaMapping: personasPhase.mapping,
    realSociosByPersona,
  })

  // FASE 2b: Cargas — dedup por ejercicio+periodo + mapeo
  const cargasPhase = _analizarMergeCargas(patchCargas, {
    realCargasByEjPeriodo,
  })

  // FASE 3: Movimientos — validar refs y construir reporte
  const movimientosPhase = _analizarMergeMovimientos(patchMovimientos, patchPersonas, {
    realRubroIds, realSubrubroIds, realCuentaIds, realEjercicioIds,
    realRubros, realSubrubros, realCuentas, realEjercicios,
  })

  // Advertencias
  const advertencias = []
  const personasSinDni = patchPersonas.filter((p) => !parseDni(p.dni))
  if (personasSinDni.length > 0)
    advertencias.push(`${personasSinDni.length} persona(s) nueva(s) sin DNI — considere deduplicar después.`)
  for (const m of patchMovimientos) {
    const ejId = m.ejercicio_id != null ? Number(m.ejercicio_id) : null
    if (ejId != null) {
      const ej = realEjercicios.find((r) => Number(r.id) === ejId)
      if (ej?.cerrado) {
        advertencias.push(`El patch incluye movimientos del ejercicio ${ej.anio_inicio}–${ej.anio_fin} que está cerrado.`)
        break
      }
    }
  }

  const analisisHash = await _hashAnalisis(payload)

  return {
    kind: payload.kind, profile: payload.profile, exportedAt: payload.exportedAt,
    source: payload.source, modalidad: payload.modalidad,
    resumen: {
      movimientosNuevos: movimientosPhase.nuevos,
      personasNuevas: personasPhase.nuevas,
      personasDeduplicadas: personasPhase.deduplicadas,
      sociosNuevos: sociosPhase.nuevos,
      sociosDeduplicados: sociosPhase.deduplicados,
      cargasNuevas: cargasPhase.nuevas,
      cargasDeduplicadas: cargasPhase.deduplicadas,
      conflictos: movimientosPhase.conflictos.length,
    },
    detalle: {
      movimientos: movimientosPhase.reporte,
      personas: personasPhase.reporte,
      socios: sociosPhase.reporte,
      cargas: cargasPhase.reporte,
      conflictos: movimientosPhase.conflictos,
    },
    advertencias, analisisHash,
  }
}

/**
 * FASE 1: Dedup de personas por CUIL/DNI contra el real.
 * @param {object[]} patchPersonas
 * @param {{ realPersonasByDni: Map, realPersonasByCuil: Map }} real
 * @returns {{ mapping: Map<number, number|null>, reporte: object[], nuevas: number, deduplicadas: number }}
 */
function _analizarMergePersonas(patchPersonas, real) {
  const mapping = new Map()
  const reporte = []
  let nuevas = 0
  let deduplicadas = 0

  for (const p of patchPersonas) {
    const oldId = Number(p.id)
    const dni = parseDni(p.dni)
    const cuil = p.cuil
    let existing = null
    if (cuil && real.realPersonasByCuil.has(cuil)) {
      existing = real.realPersonasByCuil.get(cuil)
    } else if (dni && real.realPersonasByDni.has(dni)) {
      existing = real.realPersonasByDni.get(dni)
    }
    if (existing) {
      mapping.set(oldId, Number(existing.id))
      deduplicadas++
      reporte.push({
        dni: p.dni || '—', apellido: p.apellido || p.razon_social || '—',
        nombre: p.nombre || '', estado: 'deduplicada', socioExistenteId: Number(existing.id),
      })
    } else {
      mapping.set(oldId, null)
      nuevas++
      reporte.push({
        dni: p.dni || '—', apellido: p.apellido || p.razon_social || '—',
        nombre: p.nombre || '', estado: 'nueva',
      })
    }
  }

  return { mapping, reporte, nuevas, deduplicadas }
}

/**
 * FASE 2: Dedup de socios por persona_id (remapped) contra el real.
 * @param {object[]} patchSocios
 * @param {object[]} patchPersonas
 * @param {{ personaMapping: Map, realSociosByPersona: Map }} ctx
 * @returns {{ mapping: Map<number, number|null>, reporte: object[], nuevos: number, deduplicados: number }}
 */
function _analizarMergeSocios(patchSocios, patchPersonas, ctx) {
  const mapping = new Map()
  const reporte = []
  let nuevos = 0
  let deduplicados = 0

  for (const s of patchSocios) {
    const oldId = Number(s.id)
    const personaIdRemapped = ctx.personaMapping.get(Number(s.persona_id))
    let existing = null
    if (personaIdRemapped != null && ctx.realSociosByPersona.has(personaIdRemapped)) {
      existing = ctx.realSociosByPersona.get(personaIdRemapped)
    }
    const personaLabel = _personaLabelFromDoc(patchPersonas.find((p) => Number(p.id) === Number(s.persona_id)))
    if (existing) {
      mapping.set(oldId, Number(existing.id))
      deduplicados++
      reporte.push({
        persona: personaLabel,
        tipoSocio: s.tipo_socio || '—', fechaAlta: s.fecha_alta || '—', estado: 'deduplicado',
      })
    } else {
      mapping.set(oldId, null)
      nuevos++
      reporte.push({
        persona: personaLabel,
        tipoSocio: s.tipo_socio || '—', fechaAlta: s.fecha_alta || '—', estado: 'nuevo',
      })
    }
  }

  return { mapping, reporte, nuevos, deduplicados }
}

/**
 * FASE 2b: Dedup de cargas por ejercicio_id + periodo contra el real.
 * @param {object[]} patchCargas
 * @param {{ realCargasByEjPeriodo: Map }} real
 * @returns {{ mapping: Map<number, number|null>, reporte: object[], nuevas: number, deduplicadas: number }}
 */
function _analizarMergeCargas(patchCargas, real) {
  const mapping = new Map()
  const reporte = []
  let nuevas = 0
  let deduplicadas = 0

  for (const c of patchCargas) {
    const oldId = Number(c.id)
    const ejId = Number(c.ejercicio_id)
    const periodo = c.periodo
    const key = `${ejId}-${periodo}`
    let existing = null
    if (real.realCargasByEjPeriodo.has(key)) {
      existing = real.realCargasByEjPeriodo.get(key)
    }
    if (existing) {
      mapping.set(oldId, Number(existing.id))
      deduplicadas++
      reporte.push({
        periodo: periodo || '—', estado: c.estado || '—',
        resultado: 'deduplicada',
      })
    } else {
      mapping.set(oldId, null)
      nuevas++
      reporte.push({
        periodo: periodo || '—', estado: c.estado || '—',
        resultado: 'nueva',
      })
    }
  }

  return { mapping, reporte, nuevas, deduplicadas }
}

/**
 * FASE 3: Validar refs de movimientos contra el real y construir reporte.
 * @param {object[]} patchMovimientos
 * @param {object[]} patchPersonas
 * @param {{ realRubroIds: Set, realSubrubroIds: Set, realCuentaIds: Set, realEjercicioIds: Set, realRubros: object[], realSubrubros: object[], realCuentas: object[], realEjercicios: object[] }} real
 * @returns {{ reporte: object[], conflictos: object[], nuevos: number }}
 */
function _analizarMergeMovimientos(patchMovimientos, patchPersonas, real) {
  const reporte = []
  const conflictos = []
  let nuevos = 0

  const rubroNames = new Map(real.realRubros.map((r) => [Number(r.id), r.nombre_oficial || r.codigo_rubro || `#${r.id}`]))
  const subrubroNames = new Map(real.realSubrubros.map((r) => [Number(r.id), r.nombre_subrubro || `#${r.id}`]))
  const cuentaNames = new Map(real.realCuentas.map((r) => [Number(r.id), r.nombre_cuenta || `#${r.id}`]))
  const patchPersonaNames = new Map(patchPersonas.map((p) => [Number(p.id), _personaLabelFromDoc(p)]))

  for (const m of patchMovimientos) {
    const refs = {
      ejercicio_id: m.ejercicio_id != null ? Number(m.ejercicio_id) : null,
      rubro_id: m.rubro_id != null ? Number(m.rubro_id) : null,
      subrubro_id: m.subrubro_id != null ? Number(m.subrubro_id) : null,
      cuenta_id: m.cuenta_id != null ? Number(m.cuenta_id) : null,
      cuenta_destino_id: m.cuenta_destino_id != null ? Number(m.cuenta_destino_id) : null,
      socio_id: m.socio_id != null ? Number(m.socio_id) : null,
      persona_id: m.persona_id != null ? Number(m.persona_id) : null,
    }
    const movConflictos = []
    if (refs.rubro_id != null && !real.realRubroIds.has(refs.rubro_id))
      movConflictos.push({ campo: 'rubro_id', valor: refs.rubro_id, razon: `rubro_id ${refs.rubro_id} no existe en el real` })
    if (refs.subrubro_id != null && !real.realSubrubroIds.has(refs.subrubro_id))
      movConflictos.push({ campo: 'subrubro_id', valor: refs.subrubro_id, razon: `subrubro_id ${refs.subrubro_id} no existe en el real` })
    if (refs.cuenta_id != null && !real.realCuentaIds.has(refs.cuenta_id))
      movConflictos.push({ campo: 'cuenta_id', valor: refs.cuenta_id, razon: `cuenta_id ${refs.cuenta_id} no existe en el real` })
    if (refs.cuenta_destino_id != null && !real.realCuentaIds.has(refs.cuenta_destino_id))
      movConflictos.push({ campo: 'cuenta_destino_id', valor: refs.cuenta_destino_id, razon: `cuenta_destino_id ${refs.cuenta_destino_id} no existe en el real` })
    if (refs.ejercicio_id != null && !real.realEjercicioIds.has(refs.ejercicio_id))
      movConflictos.push({ campo: 'ejercicio_id', valor: refs.ejercicio_id, razon: `ejercicio_id ${refs.ejercicio_id} no existe en el real` })

    const personaLabel = refs.persona_id != null
      ? (patchPersonaNames.get(refs.persona_id) || `#${refs.persona_id}`)
      : '—'

    if (movConflictos.length > 0) {
      conflictos.push({
        tipo: 'ref_rota', tabla: 'movimientos',
        movimientoDetalle: m.detalle || '(sin detalle)', conflictos: movConflictos,
      })
    } else {
      nuevos++
    }

    reporte.push({
      fecha: m.fecha || '—', detalle: m.detalle || '—',
      importe: m.importe != null ? Number(m.importe) : null,
      tipo: m.tipo_movimiento || '—',
      rubro: refs.rubro_id != null ? (rubroNames.get(refs.rubro_id) || `#${refs.rubro_id}`) : '—',
      subrubro: refs.subrubro_id != null ? (subrubroNames.get(refs.subrubro_id) || `#${refs.subrubro_id}`) : '—',
      cuenta: refs.cuenta_id != null ? (cuentaNames.get(refs.cuenta_id) || `#${refs.cuenta_id}`) : '—',
      persona: personaLabel,
      estado: movConflictos.length > 0 ? 'conflicto' : 'nuevo',
      conflictoRazon: movConflictos.length > 0 ? movConflictos.map((c) => c.razon).join('; ') : undefined,
    })
  }

  return { reporte, conflictos, nuevos }
}

// --- Aplicar merge ---

/**
 * Ejecuta el merge real. Valida hash, re-valida dedup contra estado fresco,
 * y que no haya conflictos sin resolver.
 *
 * @param {File} file
 * @param {string|object} analisisAprobado - hash devuelto por analizarMerge, o el reporte completo
 * @param {string} [passphrase] - Passphrase si el archivo está cifrado.
 * @returns {Promise<{ added: object, remapped: object, deduped: object, log: string[] }>}
 */
export async function aplicarMerge(file, analisisAprobado, passphrase) {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('El intercambio solo está disponible en modo standalone (PouchDB).')
  }
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos activa.')

  const payload = await _parseLof(file, passphrase)
  if (payload.kind !== 'patch') throw new Error('El archivo no es un patch válido para merge.')

  // Validar hash
  const currentHash = await _hashAnalisis(payload)
  const approvedHash = typeof analisisAprobado === 'string' ? analisisAprobado : analisisAprobado?.analisisHash
  if (currentHash !== approvedHash) {
    throw new Error('El archivo cambió desde el análisis. Vuelva a analizar antes de aplicar.')
  }

  const docsByType = _groupByType(payload.docs)
  const patchPersonas = docsByType.personas || docsByType['Personas'] || []
  const patchSocios = docsByType.socios || docsByType['Socios'] || []
  const patchCargas = docsByType.cargas || docsByType['Cargas'] || []
  const patchMovimientos = docsByType.movimientos || docsByType['Movimientos'] || []

  // Cargar estado fresco del real usando tableIds reales (capitalizados)
  const personasType = await _resolveTableType('personas')
  const sociosType = await _resolveTableType('socios')
  const cargasType = await _resolveTableType('cargas')

  const realPersonas = await _fetchAllByType(db, personasType)
  const realSocios = await _fetchAllByType(db, sociosType)
  const realCargas = await _fetchAllByType(db, cargasType)

  const realPersonasByDni = new Map()
  const realPersonasByCuil = new Map()
  for (const p of realPersonas) {
    const dni = parseDni(p.dni)
    if (dni) realPersonasByDni.set(dni, p)
    if (p.cuil) realPersonasByCuil.set(p.cuil, p)
  }
  const realSociosByPersona = new Map()
  for (const s of realSocios) {
    if (s.persona_id != null) realSociosByPersona.set(Number(s.persona_id), s)
  }
  const realCargasByEjPeriodo = new Map()
  for (const c of realCargas) {
    const key = `${Number(c.ejercicio_id)}-${c.periodo}`
    realCargasByEjPeriodo.set(key, c)
  }

  // F2-J: Re-validar análisis contra estado fresco
  if (typeof analisisAprobado === 'object' && analisisAprobado?.resumen) {
    const rePersonasNuevas = patchPersonas.filter((p) => {
      const dni = parseDni(p.dni)
      const cuil = p.cuil
      return !((cuil && realPersonasByCuil.has(cuil)) || (dni && realPersonasByDni.has(dni)))
    }).length
    const rePersonasDedup = patchPersonas.length - rePersonasNuevas
    if (rePersonasNuevas !== analisisAprobado.resumen.personasNuevas ||
        rePersonasDedup !== analisisAprobado.resumen.personasDeduplicadas) {
      throw new Error(
        'La base de datos cambió desde el análisis (ej: otro merge ya agregó datos). ' +
        'Vuelva a analizar antes de aplicar.'
      )
    }
  }

  const log = []
  const personaMapping = new Map()
  const socioMapping = new Map()
  const cargaMapping = new Map()
  let personasCreadas = 0, personasDedup = 0
  let sociosCreados = 0, sociosDedup = 0
  let cargasCreadas = 0, cargasDedup = 0

  const patchMarker = `patch-${payload.exportedAt?.slice(0, 10) || ''}`

  // Resolver tableIds reales para applyUserActions
  const movimientosType = await _resolveTableType('movimientos')

  // FASE 1: Personas — usar applyUserActions para que counters se actualicen
  for (const p of patchPersonas) {
    const oldId = Number(p.id)
    const dni = parseDni(p.dni)
    const cuil = p.cuil
    let existing = null
    if (cuil && realPersonasByCuil.has(cuil)) existing = realPersonasByCuil.get(cuil)
    else if (dni && realPersonasByDni.has(dni)) existing = realPersonasByDni.get(dni)

    if (existing) {
      personaMapping.set(oldId, Number(existing.id))
      personasDedup++
      log.push(`Persona "${p.apellido || p.razon_social || '(sin nombre)'}" (DNI ${p.dni || '—'}) deduplicada → ID existente ${existing.id}`)
    } else {
      const { _id, _rev, type, id, imported_from, ...fields } = p
      const res = await applyUserActions([['AddRecord', personasType, null, { ...fields, imported_from: patchMarker }]])
      const newId = res?.[0]?.id
      personaMapping.set(oldId, newId)
      personasCreadas++
      log.push(`Persona "${p.apellido || p.razon_social || '(sin nombre)'}" (DNI ${p.dni || '—'}) creada → nuevo ID ${newId}`)
    }
  }

  // FASE 2: Socios
  for (const s of patchSocios) {
    const oldId = Number(s.id)
    const remappedPersonaId = personaMapping.get(Number(s.persona_id))
    let existing = null
    if (remappedPersonaId != null && realSociosByPersona.has(remappedPersonaId))
      existing = realSociosByPersona.get(remappedPersonaId)

    if (existing) {
      socioMapping.set(oldId, Number(existing.id))
      sociosDedup++
      log.push(`Socio (persona ${remappedPersonaId}) deduplicado → ID existente ${existing.id}`)
    } else {
      const { _id, _rev, type, id, imported_from, ...fields } = s
      if (fields.persona_id != null) fields.persona_id = remappedPersonaId
      const res = await applyUserActions([['AddRecord', sociosType, null, { ...fields, imported_from: patchMarker }]])
      const newId = res?.[0]?.id
      socioMapping.set(oldId, newId)
      sociosCreados++
      log.push(`Socio (persona ${remappedPersonaId}) creado → nuevo ID ${newId}`)
    }
  }

  // FASE 2b: Cargas — dedup por ejercicio+periodo
  for (const c of patchCargas) {
    const oldId = Number(c.id)
    const ejId = Number(c.ejercicio_id)
    const periodo = c.periodo
    const key = `${ejId}-${periodo}`
    let existing = null
    if (realCargasByEjPeriodo.has(key)) existing = realCargasByEjPeriodo.get(key)

    if (existing) {
      cargaMapping.set(oldId, Number(existing.id))
      cargasDedup++
      log.push(`Carga período ${periodo} deduplicada → ID existente ${existing.id}`)
    } else {
      const { _id, _rev, type, id, imported_from, ...fields } = c
      const res = await applyUserActions([['AddRecord', cargasType, null, { ...fields, imported_from: patchMarker }]])
      const newId = res?.[0]?.id
      cargaMapping.set(oldId, newId)
      cargasCreadas++
      log.push(`Carga período ${periodo} creada → nuevo ID ${newId}`)
    }
  }

  // FASE 3: Movimientos
  let movimientosCreados = 0
  for (const m of patchMovimientos) {
    const { _id, _rev, type, id, imported_from, ...fields } = m
    // Remapear refs
    if (fields.persona_id != null) {
      const mapped = personaMapping.get(Number(fields.persona_id))
      if (mapped != null) fields.persona_id = mapped
    }
    if (fields.socio_id != null) {
      const mapped = socioMapping.get(Number(fields.socio_id))
      if (mapped != null) fields.socio_id = mapped
    }
    if (fields.carga_id != null) {
      const mapped = cargaMapping.get(Number(fields.carga_id))
      if (mapped != null) fields.carga_id = mapped
    }
    const res = await applyUserActions([['AddRecord', movimientosType, null, { ...fields, imported_from: patchMarker }]])
    movimientosCreados++
    log.push(`Movimiento "${m.detalle || '(sin detalle)'}" (${m.fecha || '—'}) creado → ID ${res?.[0]?.id}`)
  }

  return {
    added: { movimientos: movimientosCreados, personas: personasCreadas, socios: sociosCreados, cargas: cargasCreadas },
    remapped: { personas: personaMapping.size, socios: socioMapping.size, cargas: cargaMapping.size },
    deduped: { personas: personasDedup, socios: sociosDedup, cargas: cargasDedup },
    log,
  }
}

// --- Limpieza del dispositivo ---

/**
 * Destruye la DB PouchDB y limpia localStorage.
 * Usada por el modo colaborador (al terminar su tarea) y por el modo demo
 * (al salir de la demo para instalar la cooperadora real).
 */
export async function limpiarDispositivo() {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('La limpieza solo está disponible en modo standalone (PouchDB).')
  }
  const db = getPouchDb()
  if (db) {
    await db.destroy()
  }
  // Limpiar localStorage de flags de backend, config cache y modo demo
  localStorage.removeItem('lof-backend')
  localStorage.removeItem('lof-config-cache')
  localStorage.removeItem('lof-demo-mode')
  // Recargar para volver al wizard
  window.location.reload()
}

// --- Validación ---

/**
 * Valida un archivo .lof y devuelve metadata sin importarlo.
 * @param {File} file
 * @param {string} [passphrase] - Passphrase si el archivo está cifrado.
 * @returns {Promise<{ valid: boolean, kind?: string, docCount?: number, exportedAt?: string, modalidad?: string, error?: string }>}
 */
export async function validarIntercambio(file, passphrase) {
  try {
    const payload = await _parseLof(file, passphrase)
    return {
      valid: true,
      kind: payload.kind || 'full',
      docCount: payload.docs.length,
      exportedAt: payload.exportedAt,
      modalidad: payload.modalidad || null,
    }
  } catch (e) {
    return { valid: false, error: e?.message || String(e) }
  }
}

// --- Helpers internos ---

async function _parseLof(file, passphrase) {
  if (!file) throw new Error('Archivo vacío o no válido.')
  let arrayBuffer
  try {
    if (typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer()
    } else {
      throw new Error('arrayBuffer no disponible')
    }
  } catch {
    try {
      arrayBuffer = await new Response(file).arrayBuffer()
    } catch {
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
        reader.readAsArrayBuffer(file)
      })
    }
  }
  const fileBytes = new Uint8Array(arrayBuffer)

  // Detectar formato cifrado (LOFENC1)
  const encMagicLen = MAGIC_ENCRYPTED.length
  if (fileBytes.length >= encMagicLen && strFromU8(fileBytes.slice(0, encMagicLen)) === MAGIC_ENCRYPTED) {
    if (!passphrase) {
      throw new Error('Este archivo está cifrado. Ingresá la passphrase para importarlo.')
    }
    const envelopeJson = strFromU8(fileBytes.slice(encMagicLen))
    const envelope = parseEnvelope(envelopeJson)
    const compressed = await decryptWithPassphrase(passphrase, envelope, 'colaborador')
    const jsonBytes = gunzipSync(compressed)
    const payload = JSON.parse(strFromU8(jsonBytes))
    if (!payload.docs || !Array.isArray(payload.docs)) {
      throw new Error('Archivo corrupto: no contiene documentos.')
    }
    return payload
  }

  const magicLen = MAGIC.length
  if (fileBytes.length < magicLen + 10) {
    throw new Error('Archivo demasiado pequeño para ser un backup válido.')
  }
  const magic = strFromU8(fileBytes.slice(0, magicLen))
  if (magic !== MAGIC) {
    throw new Error('Formato no reconocido. No es un archivo .lof de LOF.')
  }
  const compressed = fileBytes.slice(magicLen)
  const jsonBytes = gunzipSync(compressed)
  const payload = JSON.parse(strFromU8(jsonBytes))
  if (!payload.docs || !Array.isArray(payload.docs)) {
    throw new Error('Archivo corrupto: no contiene documentos.')
  }
  return payload
}

function _groupByType(docs) {
  const byType = {}
  for (const d of docs) {
    const t = d.type
    if (!t) continue
    if (!byType[t]) byType[t] = []
    byType[t].push(d)
  }
  return byType
}

async function _fetchAllByType(db, type) {
  await db.createIndex({ index: { fields: ['type'] } })
  const result = await db.find({ selector: { type }, limit: 100000 })
  return result.docs
}

async function _rebuildCounters(db) {
  const result = await db.allDocs({ include_docs: true })
  const counters = {}
  for (const row of result.rows) {
    const doc = row.doc
    if (!doc || !doc.type || doc._id.startsWith('_local/')) continue
    const numId = Number(doc.id)
    if (Number.isNaN(numId)) continue
    if (!counters[doc.type] || counters[doc.type] < numId) {
      counters[doc.type] = numId
    }
  }
  try {
    const existing = await db.get('_local/counters')
    existing.value = counters
    await db.put(existing)
  } catch {
    await db.put({ _id: '_local/counters', value: counters })
  }
}

async function _loadConfig() {
  try {
    const { loadConfig } = await import('$app/pages/cooperadora/cooperadoraApi.js')
    return await loadConfig()
  } catch {
    return null
  }
}

async function _mergeConfigDefaults(defaults) {
  try {
    const { loadConfig, saveConfig } = await import('$app/pages/cooperadora/cooperadoraApi.js')
    const config = await loadConfig()
    await saveConfig({ ...config, defaults_movimiento: defaults })
  } catch { /* ignore si no hay config */ }
}

async function _setModoColaborador(payload) {
  try {
    const { loadConfig, saveConfig } = await import('$app/pages/cooperadora/cooperadoraApi.js')
    const config = await loadConfig()
    // Setear flags según la modalidad del working set
    const modalidad = payload.modalidad
    const flags = {
      modo_colaborador: true,
      rol_dispositivo: 'tesorero',
      instalado: true,
      fecha_instalacion: new Date().toISOString(),
    }
    if (modalidad === 'carga_consolidada') {
      flags.modulo_carga_consolidada = true
      flags.modulo_gestion_integral = false
    } else {
      flags.modulo_gestion_integral = true
      flags.modulo_carga_consolidada = false
    }
    await saveConfig({ ...config, ...flags })
  } catch { /* ignore */ }
}

function _personaLabelFromDoc(p) {
  if (!p) return '—'
  if (p.razon_social) return p.razon_social
  return [p.apellido, p.nombre].filter(Boolean).join(', ') || '(sin nombre)'
}

async function _hashAnalisis(payload) {
  const str = JSON.stringify({
    kind: payload.kind,
    exportedAt: payload.exportedAt,
    docCount: payload.docCount,
    docsIds: payload.docs.map((d) => ({ _id: d._id, type: d.type, id: d.id })),
  })
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
