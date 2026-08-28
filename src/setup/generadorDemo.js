// Generador de datos de prueba para performance testing (SOLO dev).
// Crea personas → socios (con persona_id) → movimientos (con todas las Refs resueltas)
// → asamblea AGO + autoridades de CD/CRC (con cargo_id, persona_id, ejercicio_id, asamblea_id).
// Se invoca desde el setup wizard cuando import.meta.env.DEV es true.
// En prod este módulo se carga via import() dinámico dentro de un guard DEV,
// así que Vite lo separa en un chunk que no se carga en producción.

import { addRecords, applyUserActions, fetchRecords, resolveTableId } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS, addMonths } from '$core/utils/utils'
import { extractRowId } from '$app/modules/comunidad/personas/personasApi.js'
import { generarPeriodosEjercicio } from '$app/modules/tesoreria/shared/tesoreriaCalc.js'
import localidades from '$core/data/localidades-buenos-aires.json'

// ---------------------------------------------------------------------------
// Datos base para generar registros realistas
// ---------------------------------------------------------------------------

const NOMBRES = [
  'Juan', 'María', 'Carlos', 'Ana', 'José', 'Patricia', 'Luis', 'Marta',
  'Pedro', 'Laura', 'Diego', 'Sofía', 'Pablo', 'Valeria', 'Fernando', 'Carla',
  'Roberto', 'Gabriela', 'Javier', 'Daniela', 'Sergio', 'Mónica', 'Andrés',
  'Paula', 'Martín', 'Florencia', 'Alejandro', 'Verónica', 'Ricardo', 'Silvana',
  'Gustavo', 'Romina', 'Hernán', 'Lucía', 'Marcelo', 'Cecilia', 'Fabian', 'Andrea',
  'Cristian', 'Natalia', 'Sebastián', 'Fernanda', 'Mariano', 'Carolina', 'Ezequiel',
  'Daiana', 'Nicolás', 'Mariela', 'Tomás', 'Agustina', 'Bruno', 'Camila',
  'Facundo', 'Julieta', 'Matías', 'Antonella', 'Germán', 'Luciana', 'Walter'
]

const APELLIDOS = [
  'González', 'Rodríguez', 'García', 'Fernández', 'López', 'Martínez', 'Sánchez',
  'Pérez', 'Gómez', 'Romero', 'Díaz', 'Ruiz', 'Álvarez', 'Acevedo', 'Molina',
  'Acosta', 'Benítez', 'Medina', 'Suárez', 'Aguirre', 'Morales', 'Pereyra',
  'Castro', 'Ortiz', 'Silva', 'Nuñez', 'Vargas', 'Ramírez', 'Flores', 'Torres',
  'Rivero', 'Giménez', 'Vega', 'Sosa', 'Herrera', 'Méndez', 'Quintana', 'Acuña',
  'Leiva', 'Villalba', 'Cardozo', 'Domínguez', 'Luna', 'Arias', 'Cabrera',
  'Maidana', 'Bravo', 'Ayarza', 'Barrios', 'Báez', 'Cáceres', 'Chávez', 'Godoy'
]

const CALLES = [
  'San Martín', 'Belgrano', 'Mitre', 'Sarmiento', 'Rivadavia', 'Alvear',
  '9 de Julio', '25 de Mayo', 'Independencia', 'Libertad', 'Colón', 'Junín',
  'Pueyrredón', 'Brown', 'Paso', 'Roca', 'Savio', 'Perú', 'Chile', 'Bolivia'
]

const DETALLES_MOV = [
  'Cuota social mensual', 'Donación de padre', 'Venta de kiosco', 'Compra de útiles',
  'Pago de proveedor', 'Traspaso a banco', 'Ingreso por evento', 'Gasto de mantenimiento',
  'Compra de librería', 'Donación de empresa', 'Cuota social anual', 'Reembolso de gasto',
  'Ingreso por rifas', 'Gasto de papelería', 'Depósito bancario', 'Extracción de cajero',
  'Pago de servicios', 'Compra de materiales', 'Ingreso por tortas', 'Gasto de limpieza'
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {number} min @param {number} max @returns {number} */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
/** @param {any[]} arr @returns {any} */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
/**
 * @param {any[]} arr
 * @param {number} n
 * @returns {any[]}
 */
const pickN = (arr, n) => {
  const out = new Set()
  while (out.size < Math.min(n, arr.length)) out.add(pick(arr))
  return [...out]
}

/** Genera una fecha YYYY-MM-DD */
const genFecha = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/**
 * Filtra períodos (formato 'YYYY-MM') para excluir los futuros al mes actual.
 * El período actual se incluye aunque no esté completo (para pruebas).
 * @param {string[]} periodos
 * @returns {string[]}
 */
const periodosHastaHoy = (periodos) => {
  const hoy = new Date()
  const hoyPeriodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  return periodos.filter((p) => p <= hoyPeriodo)
}

/** Inserta registros en lotes para no exceder el límite de Grist */
const chunkAndInsert = async (tableId, data, batchSize) => {
  for (let i = 0; i < data.length; i += batchSize) {
    await addRecords(tableId, data.slice(i, i + batchSize))
  }
}

/** Construye un mapa de keyField → rowId desde los registros recuperados */
const buildIdMap = (records, keyField) => {
  const map = new Map()
  for (const r of records) {
    if (r[keyField]) map.set(String(r[keyField]), r.id)
  }
  return map
}

/** Elige una entrada del pool que no esté en usedSet; si no hay, elige cualquiera */
const pickUnused = (pool, usedSet) => {
  let entry = pool.find(([k]) => !usedSet.has(k))
  if (!entry) entry = pick(pool)
  return entry
}

const genDni = () => String(rand(10000000, 45000000))

/** @param {string} dni @returns {string} */
const genCuil = (dni) => {
  const base = String(dni).padStart(8, '0')
  const prefixes = ['20', '23', '27']
  const pref = pick(prefixes)
  const cuerpo = `${pref}${base}`
  let suma = 0
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  for (let i = 0; i < 10; i++) suma += Number(cuerpo[i]) * pesos[i]
  const resto = suma % 11
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto
  return `${pref}-${base}-${dv}`
}

const genFechaNacimiento = () => {
  // 2% de probabilidad de generar un menor de edad (nacido en los últimos 18 años).
  const hoy = new Date()
  const limiteMayor = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate())
  if (Math.random() < 0.02) {
    // Menor de edad: nació entre hace 18 años y hoy.
    return genFecha(rand(limiteMayor.getFullYear() + 1, hoy.getFullYear()), rand(1, 12), rand(1, 28))
  }
  // Mayor de edad: nació entre 1950 y hace 18 años.
  return genFecha(rand(1950, limiteMayor.getFullYear()), rand(1, 12), rand(1, 28))
}

/** @param {number} anioInicio @returns {string} */
const genFechaAlta = (anioInicio) =>
  genFecha(anioInicio + rand(0, 1), rand(1, 12), rand(1, 28))

/** @param {string|null} fechaAlta @returns {string|null} */
const genFechaBaja = (fechaAlta) => {
  if (!fechaAlta) return null
  if (Math.random() > 0.15) return null // ~85% activos
  const [y, m] = fechaAlta.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  d.setMonth(d.getMonth() + rand(3, 24))
  return d.toISOString().slice(0, 10)
}

const MOTIVOS_BAJA = ['Renuncia', 'Falta de pago', 'Fallecimiento', 'CambioEscuela', 'Otro']
const TIPOS_SOCIO = ['Activo', 'Honorario', 'Adherente']
const CATEGORIAS = ['Socio', 'Docente', 'Directivo', 'Proveedor', 'Donante']
const TIPOS_MOV = ['Entrada', 'Salida', 'Traspaso']

// Mapa nombre de mes → número (1-12). Duplicado local para no acoplar setup → tesoreria.
const MES_NUMERO = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
}

const MES_NOMBRE = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]


// ---------------------------------------------------------------------------
// Generador principal encadenado
// ---------------------------------------------------------------------------

/**
 * Genera datos de prueba en Grist. Encadena personas → socios → movimientos
 * resolviendo las Refs (persona_id, socio_id, rubro_id, cuenta_id, ejercicio_id).
 *
 * @param {object} [opts]
 * @param {number} [opts.cantPersonas=500]
 * @param {number} [opts.cantSocios=400]
 * @param {number} [opts.cantMovimientos=2000]
 * @param {number} [opts.batchSize=100]
 * @param {boolean} [opts.gestionIntegral=true] - Reservado para compatibilidad. Las asambleas/autoridades se generan si existen las tablas.
 * @param {boolean} [opts.cargaConsolidada=false] - Si true, movimientos PIA-style (1 por rubro/cuenta/período) y autoridades = socios + directivos/docentes.
 * @param {number} [opts.cantAsambleas=1] - Cantidad de asambleas por ejercicio (para probar cierre de período dentro de un ejercicio).
 * @param {number} [opts.cantEjercicios=1] - Cantidad total de ejercicios a generar (incluye el actual). Crea ejercicios anteriores con sus propias asambleas y autoridades.
 * @param {number} [opts.cantHechos=10] - Cantidad de hechos relevantes por ejercicio (para alimentar la Memoria anual).
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{personas: number, socios: number, movimientos: number, asamblea: boolean, autoridades: number, planillas: number, hechos: number, memorias: number}>}
 */
export const generarDatosPrueba = async ({
  cantPersonas = 500,
  cantSocios = 400,
  cantMovimientos = 2000,
  batchSize = 100,
  gestionIntegral = true,
  cargaConsolidada = false,
  cantAsambleas = 1,
  cantEjercicios = 1,
  cantHechos = 10,
  onProgress = () => {},
} = {}) => {
  const log = onProgress || (() => {})
  const results = { personas: 0, socios: 0, movimientos: 0, cargas: 0, cargasFirmadas: 0, asamblea: false, autoridades: 0, asesores: 0, planillas: 0, hechos: 0, memorias: 0 }

  // --- Resolver tablas ---
  const tPersonas = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
  const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
  const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
  const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
  const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
  const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
  const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
  const tAsesores = await resolveTableId(TABLE_PREFERRED_IDS.asesores)
  const tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)
  const tCargas = await resolveTableId(TABLE_PREFERRED_IDS.cargas)
  const tCierres = await resolveTableId(TABLE_PREFERRED_IDS.cierres_mensuales)

  // Tablas opcionales (pueden no existir si el usuario no corrió "Actualizar schema")
  let tHechos = null
  try { tHechos = await resolveTableId(TABLE_PREFERRED_IDS.hechos_relevantes) } catch { /* sin tabla */ }

  if (!tPersonas || !tSocios || !tMovimientos) {
    throw new Error('Faltan tablas base (personas, socios o movimientos). Ejecutá el setup primero.')
  }

  // --- 1. Personas ---
  log(`Generando ${cantPersonas} personas...`)
  const personasData = []
  const dnisUsados = new Set()
  for (let i = 0; i < cantPersonas; i++) {
    let dni = genDni()
    while (dnisUsados.has(dni)) dni = genDni()
    dnisUsados.add(dni)
    const apellido = pick(APELLIDOS)
    const nombre = pick(NOMBRES)
    personasData.push({
      tipo_persona: 'Fisica',
      dni,
      cuil: genCuil(dni),
      apellido,
      nombre,
      razon_social: '',
      domicilio: `${pick(CALLES)} ${rand(100, 9999)}`,
      localidad: pick(localidades),
      telefono: `11${rand(1000, 9999)}${rand(1000, 9999)}`,
      email: `${nombre.toLowerCase()}.${apellido.toLowerCase()}${rand(1, 99)}@example.com`,
      fecha_nacimiento: genFechaNacimiento(),
      // En carga_consolidada, garantizar suficientes Directivos/Docentes
      // para autoridades de CD. Primeras 5 personas = Directivo/Docente.
      categoria: (cargaConsolidada && i < 5)
        ? (i < 3 ? 'Directivo' : 'Docente')
        : pick(CATEGORIAS),
      creado_el: new Date().toISOString(),
    })
  }

  await chunkAndInsert(tPersonas, personasData, batchSize)
  log('Personas cargadas, recuperando IDs...')

  // Recuperar IDs asignados por Grist (mapeo por dni que es único).
  // Solo necesitamos id y dni para resolver las Refs persona_id.
  const personasRecs = await fetchRecords(tPersonas, { columns: ['id', 'dni'] })
  const dniToPersonaId = buildIdMap(personasRecs, 'dni')
  results.personas = personasData.length

  // --- 2. Socios (con persona_id resuelto) ---
  log(`Generando ${cantSocios} socios...`)
  const sociosData = []
  // Pool de personas disponibles para vincular como socios.
  // Cada socio se vincula a una persona existente (persona_id), ya que
  // dni/cuil/apellido/nombre/etc. son columnas fórmula en socios que pull
  // de $persona_id. Si persona_id es null, el socio queda sin datos.
  const personasPool = [...dniToPersonaId.entries()] // [[dni, personaId], ...]
  const personasUsadas = new Set()
  // Determinar año del ejercicio para fechas de alta
  let anioInicio = new Date().getFullYear()
  /** @type {Record<string, any> | null} */
  let ejercicioRec = null
  if (tEjercicios) {
    try {
      const ejRecs = await fetchRecords(tEjercicios, { columns: ['id', 'anio_inicio', 'anio_fin', 'mes_inicio'] })
      if (ejRecs.length > 0) {
        ejercicioRec = ejRecs[0]
        if (ejRecs[0].anio_inicio) {
          anioInicio = Number(ejRecs[0].anio_inicio) || anioInicio
        }
      }
    } catch { /* fallback al current year */ }
  }

  for (let i = 0; i < cantSocios; i++) {
    // Elegir una persona del pool. Se priorizan personas no usadas aún;
    // si hay más socios que personas, se permite reusar.
    const entry = pickUnused(personasPool, personasUsadas)
    if (!entry) continue
    personasUsadas.add(entry[0])
    const personaId = entry[1]

    const fechaAlta = genFechaAlta(anioInicio - rand(0, 3))
    const fechaBaja = genFechaBaja(fechaAlta)

    // dni, cuil, apellido, nombre, domicilio, localidad, telefono, email
    // son columnas formula en Grist (pull de $persona_id). No se guardan en socios.
    sociosData.push({
      persona_id: personaId,
      tipo_socio: pick(TIPOS_SOCIO),
      fecha_alta: fechaAlta,
      fecha_baja: fechaBaja || null,
      motivo_baja: fechaBaja ? pick(MOTIVOS_BAJA) : null,
    })
  }

  await chunkAndInsert(tSocios, sociosData, batchSize)
  log('Socios cargados, recuperando IDs...')

  // Recuperar IDs de socios (mapeo por dni)
  const sociosRecs = await fetchRecords(tSocios, { columns: ['id', 'dni'] })
  const dniToSocioId = buildIdMap(sociosRecs, 'dni')
  results.socios = sociosData.length

  // --- 3. Movimientos (con todas las Refs resueltas) ---
  // Mapear rubros por nombre y tipo
  let rubrosEntrada = []
  let rubrosSalida = []
  /** @type {Record<string, any>[]} */
  let rubrosRecs = []
  if (tRubros) {
    try {
      rubrosRecs = await fetchRecords(tRubros, { columns: ['id', 'nombre_oficial', 'tipo_rubro', 'grupo_rubro'] })
      for (const r of rubrosRecs) {
        if (r.tipo_rubro === 'Entrada') rubrosEntrada.push(r.id)
        else if (r.tipo_rubro === 'Salida') rubrosSalida.push(r.id)
      }
    } catch { /* sin rubros */ }
  }

  // Mapear cuentas por nombre
  let cuentaIds = []
  /** @type {Record<string, any>[]} */
  let cuentasRecsLocal = []
  if (tCuentas) {
    try {
      cuentasRecsLocal = await fetchRecords(tCuentas, { columns: ['id', 'nombre_cuenta'] })
      cuentaIds = cuentasRecsLocal.map((r) => r.id)
    } catch { /* sin cuentas */ }
  }

  // Encontrar el rubro de Cuota Social (entrada) para generar movimientos realistas
  let rubroCuotaSocialId = null
  for (const r of rubrosRecs) {
    const nombre = String(r.nombre_oficial || '').toLowerCase()
    if (r.tipo_rubro === 'Entrada' && nombre.includes('cuota social')) {
      rubroCuotaSocialId = r.id
      break
    }
  }

  // Encontrar la cuenta de Efectivo (preferida para cuota social)
  let cuentaEfectivoId = cuentaIds[0] || null
  for (const c of cuentasRecsLocal) {
    const nombre = String(c.nombre_cuenta || '').toLowerCase()
    if (nombre.includes('efectivo')) {
      cuentaEfectivoId = c.id
      break
    }
  }

  // Mapear ejercicio
  let ejercicioId = null
  if (ejercicioRec) {
    ejercicioId = ejercicioRec.id
  } else if (tEjercicios) {
    try {
      const ejRecs = await fetchRecords(tEjercicios, { columns: ['id'] })
      if (ejRecs.length > 0) ejercicioId = ejRecs[0].id
    } catch { /* sin ejercicio */ }
  }

  // DNIs de personas para asociar movimientos a socios/personas
  const dnisSocios = [...dniToSocioId.keys()]
  const dnisPersonas = [...dniToPersonaId.keys()]

  const movimientosData = []

  // Balance acumulado de entradas/salidas por ejercicio. Las cooperadoras
  // reales no suelen gastar más de lo que ingresan: se usa para acotar la
  // generación de movimientos de tipo Salida y mantener un saldo realista.
  /** @type {Map<number, {entradas: number, salidas: number}>} */
  const balanceEjercicio = new Map()
  const getBalance = (ejId) => {
    if (!balanceEjercicio.has(ejId)) balanceEjercicio.set(ejId, { entradas: 0, salidas: 0 })
    return balanceEjercicio.get(ejId)
  }

  /**
   * Genera movimientos + cargas para un ejercicio en modo consolidada.
   * @param {number} ejId - ID del ejercicio en Grist
   * @param {any} ejRec - Registro del ejercicio (anio_inicio, anio_fin, mes_inicio)
   * @param {boolean} esUltimoEjercicio - Si es el ejercicio en curso
   * @returns {Promise<{cargas: number, cargasFirmadas: number}>}
   */
  const generarMovimientosConsolidada = async (ejId, ejRec, esUltimoEjercicio) => {
    const periodos = periodosHastaHoy(generarPeriodosEjercicio(ejRec))
    const todosRubros = rubrosRecs.filter((r) => r.tipo_rubro === 'Entrada' || r.tipo_rubro === 'Salida')
    log(`Generando cargas y movimientos: ${todosRubros.length} rubros × ${cuentaIds.length} cuentas × ${periodos.length} períodos...`)

    // Los primeros ~70% de períodos quedan firmados (historial),
    // el resto en borrador (para probar edición).
    const firmarHastaIdx = Math.floor(periodos.length * 0.7)
    /** @type {{id: number, periodo: string, firmado: boolean}[]} */
    const cargasCreadas = []

    for (let pIdx = 0; pIdx < periodos.length; pIdx++) {
      const periodo = periodos[pIdx]
      const [year, month] = periodo.split('-').map(Number)
      const esFirmada = pIdx < firmarHastaIdx

      // Crear la carga en Grist
      let cargaId = null
      if (tCargas) {
        try {
          const cargaFields = {
            ejercicio_id: ejId,
            periodo: periodo,
            estado: esFirmada ? 'firmado' : 'borrador',
            fecha_creacion: new Date().toISOString(),
            creado_por: 'demo',
            observaciones: esFirmada ? 'Carga demo firmada' : 'Carga demo en borrador',
            version: 1,
            ...(esFirmada ? {
              fecha_firma: new Date().toISOString(),
              firmado_por: 'demo',
            } : {}),
          }
          const cargaRes = await applyUserActions([['AddRecord', tCargas, null, cargaFields]])
          cargaId = extractRowId(cargaRes)
          if (cargaId != null) {
            cargasCreadas.push({ id: cargaId, periodo, firmado: esFirmada })
          }
        } catch (e1) {
          console.warn('[demo] No se pudo crear carga para', periodo, ':', e1?.message || e1)
        }
      }

      // Generar movimientos para esta carga
      for (const rubro of todosRubros) {
        for (const cuentaId of cuentaIds) {
          if (Math.random() < 0.3) continue // 30% de celdas vacías
          const tipo = rubro.tipo_rubro === 'Entrada' ? 'Entrada' : 'Salida'
          // Distribuir movimientos en diferentes días del mes para que
          // el resumen semanal muestre múltiples semanas.
          const dia = rand(1, 28)
          const fecha = genFecha(year, month, dia)
          movimientosData.push({
            fecha,
            ejercicio_id: ejId,
            tipo_movimiento: tipo,
            rubro_id: rubro.id,
            subrubro_id: null,
            detalle: pick(DETALLES_MOV),
            importe: Number((Math.random() * 50000 + 100).toFixed(2)),
            cuenta_id: cuentaId,
            destino_bancario: null,
            cuenta_destino_id: null,
            socio_id: null,
            persona_id: null,
            carga_id: cargaId,
            creado_por: 'demo',
            creado_el: new Date().toISOString(),
          })
        }
      }
    }

    // Crear cierres_mensuales firmados para los períodos firmados
    if (tCierres) {
      const cierresActions = []
      for (const carga of cargasCreadas) {
        if (!carga.firmado) continue
        cierresActions.push(['AddRecord', tCierres, null, {
          periodo: carga.periodo,
          ejercicio_id: ejId,
          firmado: true,
          firmado_por: 'demo',
          firmado_el: new Date().toISOString(),
          es_carga_manual: false,
        }])
      }
      if (cierresActions.length > 0) {
        try { await applyUserActions(cierresActions) } catch (e2) { console.warn('[demo] No se pudieron crear cierres:', e2) }
      }
    }

    return {
      cargas: cargasCreadas.length,
      cargasFirmadas: cargasCreadas.filter((c) => c.firmado).length,
    }
  }

  /**
   * Genera movimientos aleatorios para un ejercicio en modo integral.
   * @param {number} ejId - ID del ejercicio en Grist
   * @param {number} anioEj - Año de inicio del ejercicio
   * @param {number} cantidad - Cantidad de movimientos extra a generar
   * @param {any} [ejRec] - Registro del ejercicio (para respetar mes_inicio)
   */
  const generarMovimientosIntegral = (ejId, anioEj, cantidad, ejRec) => {
    // Generar fechas solo dentro del rango del ejercicio (mes_inicio → mes_inicio-1 del año siguiente)
    // y solo hasta el mes actual (sin movimientos futuros)
    const periodos = ejRec ? periodosHastaHoy(generarPeriodosEjercicio(ejRec)) : []
    const bal = getBalance(ejId)
    // Techo de gastos del ejercicio: no superar el 80% de lo ingresado
    // (cuota social + lo que ya se generó como entrada), para que el saldo
    // quede siempre positivo como en una cooperadora real.
    const techoSalidas = bal.entradas * 0.8
    for (let i = 0; i < cantidad; i++) {
      let tipo = pick(TIPOS_MOV)
      // Si ya se alcanzó el techo de gastos del ejercicio, esta "salida"
      // se convierte en un ingreso extra (donación, evento, etc.).
      if (tipo === 'Salida' && bal.salidas >= techoSalidas) tipo = 'Entrada'
      let rubroId = null
      if (tipo === 'Entrada' && rubrosEntrada.length > 0) rubroId = pick(rubrosEntrada)
      else if (tipo === 'Salida' && rubrosSalida.length > 0) rubroId = pick(rubrosSalida)
      else if (rubrosEntrada.length > 0 || rubrosSalida.length > 0) {
        rubroId = pick([...rubrosEntrada, ...rubrosSalida])
      }

      const cuentaId = cuentaIds.length > 0 ? pick(cuentaIds) : null
      let cuentaDestinoId = null
      if (tipo === 'Traspaso' && cuentaIds.length > 1) {
        cuentaDestinoId = pick(cuentaIds.filter((c) => c !== cuentaId))
      }

      let socioId = null
      let personaId = null
      if (dnisSocios.length > 0 && Math.random() < 0.4) {
        const dni = pick(dnisSocios)
        socioId = dniToSocioId.get(dni)
        personaId = dniToPersonaId.get(dni) || null
      } else if (dnisPersonas.length > 0 && Math.random() < 0.2) {
        personaId = dniToPersonaId.get(pick(dnisPersonas))
      }

      let fecha
      if (periodos.length > 0) {
        const p = pick(periodos)
        const [y, m] = p.split('-').map(Number)
        fecha = genFecha(y, m, rand(1, 28))
      } else {
        // Sin períodos válidos (ejercicio futuro) — saltear este movimiento
        continue
      }

      let importe = Number((Math.random() * 50000 + 100).toFixed(2))
      if (tipo === 'Salida') {
        // No dejar que esta salida sola perfore el techo de gastos.
        const disponible = Math.max(100, techoSalidas - bal.salidas)
        importe = Math.min(importe, disponible)
      }

      movimientosData.push({
        fecha,
        ejercicio_id: ejId,
        tipo_movimiento: tipo,
        rubro_id: rubroId,
        subrubro_id: null,
        detalle: pick(DETALLES_MOV),
        importe,
        cuenta_id: cuentaId,
        destino_bancario: tipo === 'Traspaso' ? 'CuentaCorriente' : null,
        cuenta_destino_id: cuentaDestinoId,
        socio_id: socioId,
        persona_id: personaId,
        creado_por: 'demo',
        creado_el: new Date().toISOString(),
      })

      if (tipo === 'Entrada') bal.entradas += importe
      else if (tipo === 'Salida') bal.salidas += importe
    }
  }

  /**
   * Genera movimientos de cuota social mensual para cada socio activo
   * a lo largo de todos los períodos del ejercicio.
   * @param {number} ejId - ID del ejercicio en Grist
   * @param {any} ejRec - Registro del ejercicio (anio_inicio, anio_fin, mes_inicio)
   * @param {number} cuotaImporte - Importe mensual de la cuota social
   */
  const generarCuotaSocialMensual = (ejId, ejRec, cuotaImporte) => {
    if (!rubroCuotaSocialId || cuentaIds.length === 0) return
    const periodos = periodosHastaHoy(generarPeriodosEjercicio(ejRec))

    // Solo socios activos (sin fecha_baja) pagan cuota social
    const sociosActivosData = sociosData.filter((s) => !s.fecha_baja)
    // Mapear socio → persona_id para vincular el movimiento
    const socioToPersona = new Map()
    for (const s of sociosActivosData) {
      const socioRec = sociosRecs.find((sr) => {
        const pid = dniToPersonaId.get(String(sr.dni))
        return pid === s.persona_id
      })
      if (socioRec) socioToPersona.set(socioRec.id, s.persona_id)
    }

    for (const periodo of periodos) {
      const [year, month] = periodo.split('-').map(Number)
      for (const [socioId, personaId] of socioToPersona) {
        // 90% de los socios pagan cada mes (10% morosidad natural)
        if (Math.random() < 0.10) continue
        const dia = rand(1, 28)
        movimientosData.push({
          fecha: genFecha(year, month, dia),
          ejercicio_id: ejId,
          tipo_movimiento: 'Entrada',
          rubro_id: rubroCuotaSocialId,
          subrubro_id: null,
          detalle: `Cuota social ${periodo}`,
          importe: cuotaImporte,
          cuenta_id: cuentaEfectivoId,
          destino_bancario: null,
          cuenta_destino_id: null,
          socio_id: socioId,
          persona_id: personaId,
          creado_por: 'demo',
          creado_el: new Date().toISOString(),
        })
        getBalance(ejId).entradas += cuotaImporte
      }
    }
  }

  // --- 3. Generar movimientos para el ejercicio principal ---
  if (cargaConsolidada) {
    // --- Modo carga consolidada: cargas + movimientos por rubro/cuenta/período ---
    const res = await generarMovimientosConsolidada(ejercicioId, ejercicioRec, true)
    results.cargas = res.cargas
    results.cargasFirmadas = res.cargasFirmadas
  } else {
    // --- Modo gestion_integral: cuota social mensual por socio + movimientos extra ---
    const cuotaImporte = rand(1500, 5000) // cuota social realista
    const sociosActivosCount = sociosData.filter((s) => !s.fecha_baja).length
    const periodosCount = generarPeriodosEjercicio(ejercicioRec).length
    const cuotaSocialEstimada = Math.floor(sociosActivosCount * periodosCount * 0.9)
    log(`Generando cuota social mensual (${sociosActivosCount} socios activos × ${periodosCount} períodos, ~${cuotaSocialEstimada} movimientos)...`)
    generarCuotaSocialMensual(ejercicioId, ejercicioRec, cuotaImporte)
    log(`Generando ${cantMovimientos} movimientos extra...`)
    generarMovimientosIntegral(ejercicioId, anioInicio, cantMovimientos, ejercicioRec)
  }

  await chunkAndInsert(tMovimientos, movimientosData, batchSize)
  results.movimientos = movimientosData.length

  // --- 4. Ejercicios adicionales + asambleas + autoridades ---
  // cantEjercicios > 1 crea ejercicios anteriores (cada uno con sus asambleas
  // y autoridades) para probar el histórico multi-ejercicio.
  // cantAsambleas > 1 genera múltiples asambleas dentro de cada ejercicio.
  if (tAsambleas && tAutoridades && tCargos && ejercicioId) {
    log(`Creando asambleas y autoridades para ${cantEjercicios} ejercicio(s)...`)

    // Cargar cargos activos agrupados por organismo
    /** @type {Record<string, any>[]} */
    let cargosRecs = []
    try {
      cargosRecs = await fetchRecords(tCargos, {
        filter: (/** @type {Record<string, any>} */ c) => c.activo === true || c.cargo_obligatorio === true,
      })
    } catch { /* sin cargos */ }

    if (cargosRecs.length > 0 && personasRecs.length > 0) {
      // Pool de personas para autoridades:
      // - Socios: personas vinculadas a socios (la mayoría de las autoridades)
      // - Directivos/Docentes: 2-3 personas con esa categoría (para CD)
      const sociosPersonas = new Set(
        sociosRecs.map((s) => dniToPersonaId.get(String(s.dni))).filter(Boolean)
      )
      const personasPoolSocios = personasRecs.filter((p) => sociosPersonas.has(p.id))
      const personasPoolDirectivos = personasData
        .filter((pd) => pd.categoria === 'Directivo' || pd.categoria === 'Docente')
        .map((pd) => personasRecs.find((p) => String(p.dni) === String(pd.dni)))
        .filter(Boolean)

      const organismosTarget = ['CD', 'CRC']

      // Construir lista de ejercicios: el actual + (cantEjercicios - 1) anteriores.
      // Cada ejercicio anterior dura 1 año menos y NO está en_curso.
      /** @type {{id: number, anio_inicio: number, anio_fin: number, mes_inicio: string, en_curso: boolean}[]} */
      const ejerciciosParaGenerar = []
      if (ejercicioRec) {
        ejerciciosParaGenerar.push({ ...ejercicioRec })
        const anioBase = Number(ejercicioRec.anio_inicio) || anioInicio
        const mesInicio = ejercicioRec.mes_inicio || 'Mayo'
        for (let e = 1; e < cantEjercicios; e++) {
          const anioInicioEj = anioBase - e
          // Crear ejercicio anterior en Grist
          try {
            const ejRes = await applyUserActions([['AddRecord', tEjercicios, null, {
              anio_inicio: anioInicioEj,
              anio_fin: anioInicioEj + 1,
              mes_inicio: mesInicio,
              saldo_inicial_banco: 0,
              saldo_inicial_efectivo: 0,
              saldo_inicial_caja_chica: 0,
              en_curso: false,
              cerrado: true,
              fecha_cierre: genFecha(anioInicioEj + 1, Number(MES_NUMERO[mesInicio] || 5) - 1, 30),
              observaciones: `Ejercicio demo ${anioInicioEj}-${anioInicioEj + 1} (cerrado)`,
            }]])
            const ejId = extractRowId(ejRes)
            if (ejId != null) {
              ejerciciosParaGenerar.unshift({
                id: ejId,
                anio_inicio: anioInicioEj,
                anio_fin: anioInicioEj + 1,
                mes_inicio: mesInicio,
                en_curso: false,
              })
            }
          } catch (e2) {
            console.warn('[demo] No se pudo crear ejercicio anterior:', e2?.message || e2)
          }
        }
      }

      let asambleasCreadas = 0
      const todasAutoridades = []
      const todosAsesores = []
      const todasPlanillas = []
      // Mapa cargo_id → persona_id del ejercicio anterior, para continuidad
      /** @type {Map<number, number>} */
      let autoridadesEjAnterior = new Map()

      // Generar asambleas + autoridades (y movimientos para ejercicios
      // anteriores) para cada ejercicio.
      // Los ejercicios anteriores se procesan primero (orden cronológico).
      ejerciciosParaGenerar.sort((a, b) => Number(a.anio_inicio) - Number(b.anio_inicio))

      for (let eIdx = 0; eIdx < ejerciciosParaGenerar.length; eIdx++) {
        const ej = ejerciciosParaGenerar[eIdx]
        const esUltimoEjercicio = eIdx === ejerciciosParaGenerar.length - 1
        const periodos = generarPeriodosEjercicio(ej)
        const totalAsambleas = Math.min(cantAsambleas, periodos.length || 1)
        const ejAnioInicio = Number(ej.anio_inicio) || anioInicio

        // Generar movimientos para ejercicios anteriores (el último ya
        // tuvo sus movimientos generados en la sección 3).
        if (!esUltimoEjercicio) {
          if (cargaConsolidada) {
            log(`Generando cargas y movimientos para ejercicio ${ejAnioInicio}-${ej.anio_fin}...`)
            const res = await generarMovimientosConsolidada(ej.id, ej, false)
            results.cargas += res.cargas
            results.cargasFirmadas += res.cargasFirmadas
          } else {
            // Cuota social mensual para ejercicios anteriores también
            const cuotaImporteAnt = rand(1000, 3000) // cuota social histórica (menor)
            log(`Generando cuota social + movimientos extra para ejercicio ${ejAnioInicio}-${ej.anio_fin}...`)
            generarCuotaSocialMensual(ej.id, ej, cuotaImporteAnt)
            const cantEj = Math.floor(cantMovimientos / cantEjercicios)
            generarMovimientosIntegral(ej.id, ejAnioInicio, cantEj, ej)
          }
          // Insertar los movimientos de este ejercicio en Grist
          const movsEj = movimientosData.filter((m) => Number(m.ejercicio_id) === Number(ej.id))
          if (movsEj.length > 0) {
            await chunkAndInsert(tMovimientos, movsEj, batchSize)
            results.movimientos += movsEj.length
          }
        }

        for (let aIdx = 0; aIdx < totalAsambleas; aIdx++) {
          const periodo = periodos.length > 0
            ? periodos[Math.floor((aIdx / totalAsambleas) * periodos.length)]
            : `${ejAnioInicio}-03`
          const [asYear, asMonth] = periodo.split('-').map(Number)
          const fechaAsamblea = genFecha(asYear, asMonth, 15)
          const tipoAsamblea = aIdx === 0 ? 'AGO' : 'AGE'
          const actaNum = String(aIdx + 1).padStart(3, '0')

          const asambleaFields = {
            fecha: fechaAsamblea,
            tipo_asamblea: tipoAsamblea,
            acta_numero: `${actaNum}/${asYear}`,
            acta_fojas: String(aIdx + 1),
            ejercicio_id: ej.id,
            socios_presentes_cantidad: Math.min(sociosData.length, rand(50, 150)),
            cuota_social_importe: rand(1500, 5000),
            cuota_social_modalidad: 'Mensual',
            caja_chica_importe: rand(5000, 15000),
          }
          const asambleaRes = await applyUserActions([['AddRecord', tAsambleas, null, asambleaFields]])
          const asambleaId = extractRowId(asambleaRes)
          if (asambleaId != null) asambleasCreadas++
          results.asamblea = results.asamblea || asambleaId != null

          // Designar autoridades para esta asamblea.
          const personasUsadasAuth = new Set()
          const poolPrincipal = cargaConsolidada && personasPoolSocios.length > 0
            ? personasPoolSocios
            : personasRecs.filter((p) => p.id != null)

          // Mapa cargo_id → persona_id para este ejercicio (se actualiza al designar)
          /** @type {Map<number, number>} */
          const autoridadesEjActual = new Map()

          for (const org of organismosTarget) {
            const cargosOrg = cargosRecs
              .filter((c) => String(c.organismo) === org)
              .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

            for (let ci = 0; ci < cargosOrg.length; ci++) {
              const cargo = cargosOrg[ci]
              let persona = null

              // Continuidad: si no es el primer ejercicio y es la primera asamblea
              // del ejercicio, ~60% de probabilidad de que la misma persona continúe.
              const esPrimeraAsambleaEj = aIdx === 0
              const puedeContinuar = esPrimeraAsambleaEj && autoridadesEjAnterior.has(cargo.id)
              if (puedeContinuar && Math.random() < 0.6) {
                const personaIdAnt = autoridadesEjAnterior.get(cargo.id)
                persona = personasRecs.find((p) => Number(p.id) === Number(personaIdAnt)) || null
                if (persona && personasUsadasAuth.has(persona.id)) {
                  // Si la persona ya fue usada en este ejercicio para otro cargo,
                  // no puede continuar en dos cargos a la vez → buscar otra
                  persona = null
                }
              }

              if (!persona && cargaConsolidada && org === 'CD' && ci < 3 && personasPoolDirectivos.length > 0) {
                persona = personasPoolDirectivos.find((p) => !personasUsadasAuth.has(p.id))
                if (!persona) persona = pick(personasPoolDirectivos)
              }
              if (!persona) {
                persona = poolPrincipal.find((p) => !personasUsadasAuth.has(p.id))
                if (!persona) persona = pick(poolPrincipal)
              }
              if (!persona) continue
              personasUsadasAuth.add(persona.id)
              autoridadesEjActual.set(cargo.id, persona.id)

              const duracionMeses = Number(cargo.duracion_meses) || 12
              const fechaAsuncion = fechaAsamblea
              const fechaVenc = addMonths(fechaAsuncion, duracionMeses)

              // Solo las autoridades de la ÚLTIMA asamblea del ÚLTIMO ejercicio
              // quedan vigentes (activo=true, sin fecha_cese). Las demás quedan
              // cesadas (activo=false + fecha_cese).
              const esUltimaAsamblea = aIdx === totalAsambleas - 1
              const esVigente = esUltimoEjercicio && esUltimaAsamblea

              todasAutoridades.push({
                organismo: org,
                cargo_id: cargo.id,
                persona_id: persona.id,
                fecha_asuncion: fechaAsuncion,
                fecha_vencimiento: fechaVenc,
                tipo_origen: 'Asamblea',
                asamblea_id: asambleaId || null,
                activo: esVigente,
                ejercicio_id: ej.id,
                ...(esVigente ? {} : { fecha_cese: fechaAsamblea }),
              })
            }
          }

          // Al final de la última asamblea del ejercicio, guardar las autoridades
          // para que el siguiente ejercicio pueda tener continuidad
          if (aIdx === totalAsambleas - 1) {
            autoridadesEjAnterior = autoridadesEjActual
          }
        }

        // Planillas por ejercicio
        const tiposPlanilla = ['PIA', 'Nomina']
        for (const tipo of tiposPlanilla) {
          todasPlanillas.push({
            tipo_planilla: tipo,
            ejercicio_id: ej.id,
            fecha_generacion: new Date().toISOString(),
            generado_por: 'demo',
            version_formulario: '2024',
          })
        }

        // --- Hechos relevantes del ejercicio ---
        // Genera cantHechos hechos distribuidos en el ejercicio para alimentar
        // el borrador de la Memoria anual.
        if (tHechos && cantHechos > 0) {
          const hechosEj = []
          const hechosPlantilla = [
            { cat: 'Evento', desc: 'Festival solidario a beneficio de la cooperadora, con presentación de grupos folclóricos y venta de tortas.' },
            { cat: 'Evento', desc: 'Organización del acto del Día del Maestro, con refrigerio para docentes y alumnos.' },
            { cat: 'Evento', desc: 'Cena anual de la cooperadora, con rifa a beneficio y participación de familias.' },
            { cat: 'Infraestructura', desc: 'Pintura general del edificio escolar: aulas, pasillos y salón de actos.' },
            { cat: 'Infraestructura', desc: 'Reparación de baños del ala norte: cambio de sanitarios y cañerías.' },
            { cat: 'Infraestructura', desc: 'Desmalezamiento y parquización del patio, con plantación de árboles donados.' },
            { cat: 'Infraestructura', desc: 'Reparación de instalaciones eléctricas en sala de informática.' },
            { cat: 'Equipamiento', desc: 'Compra de 5 netbooks para el laboratorio de informática.' },
            { cat: 'Equipamiento', desc: 'Adquisición de equipo de audio y proyector para el salón de actos.' },
            { cat: 'Equipamiento', desc: 'Compra de armarios metálicos para archivo de la cooperadora.' },
            { cat: 'Beneficios', desc: 'Otorgamiento de 12 becas a alumnos con dificultades económicas para compra de útiles.' },
            { cat: 'Beneficios', desc: 'Donación de uniformes escolares a 8 familias de la comunidad.' },
            { cat: 'Actividades', desc: 'Financiamiento del viaje de estudios de 7° grado a Tandil.' },
            { cat: 'Actividades', desc: 'Apoyo económico para la feria de ciencias del establecimiento.' },
            { cat: 'Actividades', desc: 'Organización de la fiesta de fin de año lectivo, con entrega de diplomas.' },
            { cat: 'Proyecto educativo', desc: 'Financiamiento del proyecto "Lectores del Bicentenario": compra de libros para biblioteca de aula.' },
            { cat: 'Proyecto educativo', desc: 'Aporte para el proyecto de huerta escolar: herramientas, semillas y materiales.' },
            { cat: 'Otro', desc: 'Pago de seguro de responsabilidad civil de la cooperadora.' },
            { cat: 'Otro', desc: 'Compra de insumos de limpieza para todo el año lectivo.' },
          ]
          const cantHechosEj = Math.max(0, Math.min(cantHechos, hechosPlantilla.length))
          const hechosSeleccionados = pickN(hechosPlantilla, cantHechosEj)
          for (let hIdx = 0; hIdx < hechosSeleccionados.length; hIdx++) {
            const h = hechosSeleccionados[hIdx]
            // Distribuir hechos a lo largo del ejercicio
            const periodoHecho = periodos.length > 0
              ? periodos[Math.floor((hIdx / cantHechos) * periodos.length)]
              : `${ejAnioInicio}-0${rand(1, 9)}`
            const [hYear, hMonth] = periodoHecho.split('-').map(Number)
            hechosEj.push({
              fecha: genFecha(hYear, hMonth, rand(1, 28)),
              categoria: h.cat,
              descripcion: h.desc,
              monto: Math.random() < 0.6 ? rand(5000, 250000) : '',
              documento_ref: '',
              ejercicio_id: ej.id,
              asamblea_id: null,
            })
          }
          if (hechosEj.length > 0) {
            try {
              await chunkAndInsert(tHechos, hechosEj, batchSize)
              results.hechos += hechosEj.length
            } catch { /* sin tabla hechos */ }
          }

          // --- Memoria anual del ejercicio ---
          // Genera un texto de Memoria en markdown para el ejercicio.
          // Los ejercicios anteriores quedan "aprobados"; el ejercicio
          // en curso queda "borrador" (para que el usuario pueda probar el editor).
          const mesInicioNum = MES_NUMERO[String(ej.mes_inicio || 'Mayo')] || 5
          const mesFinNum = mesInicioNum === 1 ? 12 : mesInicioNum - 1
          const mesFinNombre = MES_NOMBRE[mesFinNum] || 'abril'
          const lineasMemoria = []
          lineasMemoria.push(`# Memoria Anual — Ejercicio ${ej.anio_inicio}-${ej.anio_fin}`)
          lineasMemoria.push('')
          lineasMemoria.push(`**Período:** 1° de ${MES_NOMBRE[mesInicioNum - 1] || 'mayo'} de ${ej.anio_inicio} al 30 de ${mesFinNombre} de ${ej.anio_fin}`)
          lineasMemoria.push('')
          lineasMemoria.push('En cumplimiento con las disposiciones legales y estatutarias vigentes, la Comisión Directiva pone a consideración de la Asamblea General Ordinaria lo actuado durante el ejercicio.')
          lineasMemoria.push('')
          lineasMemoria.push('## Actividades y hechos relevantes')
          lineasMemoria.push('')
          // Agrupar por categoría
          const porCat = {}
          for (const h of hechosEj) {
            const cat = h.categoria || 'Otro'
            if (!porCat[cat]) porCat[cat] = []
            porCat[cat].push(h)
          }
          const catLabels = {
            'Evento': 'Eventos',
            'Infraestructura': 'Obras de mantenimiento e infraestructura',
            'Equipamiento': 'Equipamiento',
            'Beneficios': 'Beneficios obtenidos',
            'Actividades': 'Actividades',
            'Proyecto educativo': 'Financiamiento de proyectos educativos',
            'Otro': 'Otros',
          }
          for (const cat of ['Evento', 'Infraestructura', 'Equipamiento', 'Beneficios', 'Actividades', 'Proyecto educativo', 'Otro']) {
            if (!porCat[cat]) continue
            lineasMemoria.push(`### ${catLabels[cat] || cat}`)
            for (const h of porCat[cat]) {
              const monto = h.monto !== '' && h.monto != null ? ` ($${Number(h.monto).toLocaleString('es-AR')})` : ''
              lineasMemoria.push(`- ${h.descripcion}${monto}`)
            }
            lineasMemoria.push('')
          }
          lineasMemoria.push('## Síntesis económica')
          lineasMemoria.push('')
          lineasMemoria.push(`**Saldo inicial del ejercicio:** $${Number(ej.saldo_inicial_total || 0).toLocaleString('es-AR')}`)
          lineasMemoria.push('')
          lineasMemoria.push('El detalle de ingresos, egresos y saldo final se encuentra en el Balance (estado de recursos y gastos) que se presenta junto con esta Memoria.')
          lineasMemoria.push('')
          lineasMemoria.push('---')
          lineasMemoria.push('')
          lineasMemoria.push('Se invita a los socios a revisar la documentación completa (Balance, Inventario, Informe de la Comisión Revisora de Cuentas) que se acompaña a la presente Memoria.')
          lineasMemoria.push('')
          lineasMemoria.push('**Comisión Directiva**')

          const memoriaTexto = lineasMemoria.join('\n')
          const memoriaEstado = esUltimoEjercicio ? 'borrador' : 'aprobada'
          try {
            await applyUserActions([['UpdateRecord', tEjercicios, ej.id, {
              memoria_texto: memoriaTexto,
              memoria_estado: memoriaEstado,
              memoria_fecha_generacion: new Date().toISOString(),
            }]])
            results.memorias += 1
          } catch { /* sin campos memoria en schema */ }
        }

        // --- Asesor del ejercicio ---
        // El asesor es una función institucional derivada de la Dirección del
        // establecimiento (Decreto 4767/72 art. 18-20).
        //   - Primer ejercicio: tipo_origen='Director', persona con categoría 'Directivo'
        //   - Ejercicios siguientes: puede ser 'Delegacion' (el Director delega
        //     en un Docente, art. 18) o 'DesignacionCoopEscolar' (la Dirección
        //     de Cooperación Escolar designa otro docente, art. 20).
        if (tAsesores && personasPoolDirectivos.length > 0) {
          const fechaAsuncionAsesor = genFecha(ejAnioInicio, 3, 1)
          const esUltimoEj = esUltimoEjercicio
          const esPrimerEjercicio = eIdx === 0

          if (esPrimerEjercicio) {
            // Primer ejercicio: el Director del establecimiento es el asesor
            const directorPersona = personasPoolDirectivos[0]
            todosAsesores.push({
              persona_id: directorPersona.id,
              tipo_origen: 'Director',
              fecha_asuncion: fechaAsuncionAsesor,
              ejercicio_id: ej.id,
              ...(esUltimoEj
                ? {}
                : { fecha_cese: genFecha(Number(ej.anio_fin) || ejAnioInicio + 1, 2, 28), motivo_cese: 'CeseDireccion' }),
            })
          } else {
            // Ejercicios siguientes: el Director puede delegar (art. 18) o la
            // Dirección de Cooperación Escolar puede designar a otro docente (art. 20).
            const directorPersona = personasPoolDirectivos[0]
            const esDelegacion = Math.random() < 0.5
            // Para delegación/designación se usa una persona Docente
            const personasPoolDocentes = personasData
              .filter((pd) => pd.categoria === 'Docente')
              .map((pd) => personasRecs.find((p) => String(p.dni) === String(pd.dni)))
              .filter(Boolean)
            const asesorDesignado = personasPoolDocentes.length > 0
              ? pick(personasPoolDocentes)
              : personasPoolDirectivos.find((p) => p.id !== directorPersona.id) || directorPersona

            todosAsesores.push({
              persona_id: asesorDesignado.id,
              tipo_origen: esDelegacion ? 'Delegacion' : 'DesignacionCoopEscolar',
              persona_delegante_id: esDelegacion ? directorPersona.id : null,
              fecha_asuncion: fechaAsuncionAsesor,
              ejercicio_id: ej.id,
              observaciones: esDelegacion
                ? 'Delegación del Director/a del establecimiento (art. 18 Dec. 4767/72)'
                : 'Designación por la Dirección de Cooperación Escolar (art. 20 Dec. 4767/72)',
              ...(esUltimoEj
                ? {}
                : { fecha_cese: genFecha(Number(ej.anio_fin) || ejAnioInicio + 1, 2, 28), motivo_cese: esDelegacion ? 'FinDelegacion' : 'CeseDireccion' }),
            })
          }
        }
      }

      if (todasAutoridades.length > 0) {
        await chunkAndInsert(tAutoridades, todasAutoridades, batchSize)
        results.autoridades = todasAutoridades.length
      }
      results.asamblea = asambleasCreadas > 0

      // --- 4b. Asesores ---
      if (tAsesores && todosAsesores.length > 0) {
        log(`Generando ${todosAsesores.length} asesor(es)...`)
        try {
          await chunkAndInsert(tAsesores, todosAsesores, batchSize)
          results.asesores = todosAsesores.length
        } catch { /* sin tabla asesores */ }
      }
      results.asambleasCreadas = asambleasCreadas

      // --- 5. Planillas generadas ---
      const tPlanillas = await resolveTableId(TABLE_PREFERRED_IDS.planillas_generadas)
      if (tPlanillas && todasPlanillas.length > 0) {
        log('Generando planillas generadas...')
        try {
          await addRecords(tPlanillas, todasPlanillas)
          results.planillas = todasPlanillas.length
        } catch { /* sin tabla planillas */ }
      }
    }
  }

  log(
    `Listo: ${results.personas} personas, ${results.socios} socios, ` +
    `${results.movimientos} movimientos` +
    (results.cargas ? `, ${results.cargas} cargas (${results.cargasFirmadas} firmadas)` : '') +
    (results.asamblea ? `, ${results.asambleasCreadas || 1} asamblea(s), ${results.autoridades} autoridades` : '') +
    (results.asesores ? `, ${results.asesores} asesor(es)` : '') +
    (results.planillas ? `, ${results.planillas} planillas` : '') +
    (results.hechos ? `, ${results.hechos} hechos relevantes` : '') +
    (results.memorias ? `, ${results.memorias} memoria(s)` : '') +
    '.'
  )

  return results
}
