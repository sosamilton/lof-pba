// Generador de datos de prueba para performance testing (SOLO dev).
// Crea personas → socios (con persona_id) → movimientos (con todas las Refs resueltas)
// → asamblea AGO + autoridades de CD/CRC (con cargo_id, persona_id, ejercicio_id, asamblea_id).
// Se invoca desde el setup wizard cuando import.meta.env.DEV es true.
// En prod este módulo se carga via import() dinámico dentro de un guard DEV,
// así que Vite lo separa en un chunk que no se carga en producción.

import { addRecords, applyUserActions, fetchRecords, resolveTableId } from '$core/grist/grist'
import { TABLE_PREFERRED_IDS, addMonths } from '$core/utils/utils'
import { extractRowId } from '$app/modules/comunidad/personas/personasApi.js'
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

/**
 * Genera todos los períodos (YYYY-MM) de un ejercicio, desde el mes de inicio
 * del año de inicio hasta el mes anterior al mes de inicio del año de fin.
 * @param {Record<string, any> | null} ejercicio
 * @returns {string[]}
 */
const generarPeriodosEjercicioLocal = (ejercicio) => {
  if (!ejercicio) return []
  const anioInicio = Number(ejercicio.anio_inicio)
  const anioFin = Number(ejercicio.anio_fin)
  const mesInicioNum = MES_NUMERO[String(ejercicio.mes_inicio || 'Enero')] || 1
  if (!anioInicio || !anioFin) return []
  const periodos = []
  let anio = anioInicio
  let mes = mesInicioNum
  const finMes = mesInicioNum - 1
  const finReal = finMes < 1 ? { anio: anioFin - 1, mes: 12 } : { anio: anioFin, mes: finMes }
  while (anio < finReal.anio || (anio === finReal.anio && mes <= finReal.mes)) {
    periodos.push(`${anio}-${String(mes).padStart(2, '0')}`)
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }
  return periodos
}

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
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{personas: number, socios: number, movimientos: number, asamblea: boolean, autoridades: number, planillas: number}>}
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
  onProgress = () => {},
} = {}) => {
  const log = onProgress || (() => {})
  const results = { personas: 0, socios: 0, movimientos: 0, cargas: 0, cargasFirmadas: 0, asamblea: false, autoridades: 0, asesores: 0, planillas: 0 }

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
  if (tCuentas) {
    try {
      const cuentasRecs = await fetchRecords(tCuentas, { columns: ['id', 'nombre_cuenta'] })
      cuentaIds = cuentasRecs.map((r) => r.id)
    } catch { /* sin cuentas */ }
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

  /**
   * Genera movimientos + cargas para un ejercicio en modo consolidada.
   * @param {number} ejId - ID del ejercicio en Grist
   * @param {any} ejRec - Registro del ejercicio (anio_inicio, anio_fin, mes_inicio)
   * @param {boolean} esUltimoEjercicio - Si es el ejercicio en curso
   * @returns {Promise<{cargas: number, cargasFirmadas: number}>}
   */
  const generarMovimientosConsolidada = async (ejId, ejRec, esUltimoEjercicio) => {
    const periodos = generarPeriodosEjercicioLocal(ejRec)
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
            fuera_de_termino: false,
            periodo_cerrado: esFirmada,
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
   * @param {number} cantidad - Cantidad de movimientos a generar
   */
  const generarMovimientosIntegral = (ejId, anioEj, cantidad) => {
    for (let i = 0; i < cantidad; i++) {
      const tipo = pick(TIPOS_MOV)
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

      const fecha = genFecha(anioEj, rand(1, 12), rand(1, 28))

      movimientosData.push({
        fecha,
        ejercicio_id: ejId,
        tipo_movimiento: tipo,
        rubro_id: rubroId,
        subrubro_id: null,
        detalle: pick(DETALLES_MOV),
        importe: Number((Math.random() * 50000 + 100).toFixed(2)),
        cuenta_id: cuentaId,
        destino_bancario: tipo === 'Traspaso' ? 'CuentaCorriente' : null,
        cuenta_destino_id: cuentaDestinoId,
        socio_id: socioId,
        persona_id: personaId,
        fuera_de_termino: Math.random() < 0.1,
        periodo_cerrado: false,
        creado_por: 'demo',
        creado_el: new Date().toISOString(),
      })
    }
  }

  // --- 3. Generar movimientos para el ejercicio principal ---
  if (cargaConsolidada) {
    // --- Modo carga consolidada: cargas + movimientos por rubro/cuenta/período ---
    const res = await generarMovimientosConsolidada(ejercicioId, ejercicioRec, true)
    results.cargas = res.cargas
    results.cargasFirmadas = res.cargasFirmadas
  } else {
    // --- Modo gestion_integral: movimientos aleatorios ---
    log(`Generando ${cantMovimientos} movimientos...`)
    generarMovimientosIntegral(ejercicioId, anioInicio, cantMovimientos)
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
              observaciones: `Ejercicio demo ${anioInicioEj}-${anioInicioEj + 1}`,
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

      // Generar asambleas + autoridades (y movimientos para ejercicios
      // anteriores) para cada ejercicio.
      // Los ejercicios anteriores se procesan primero (orden cronológico).
      ejerciciosParaGenerar.sort((a, b) => Number(a.anio_inicio) - Number(b.anio_inicio))

      for (let eIdx = 0; eIdx < ejerciciosParaGenerar.length; eIdx++) {
        const ej = ejerciciosParaGenerar[eIdx]
        const esUltimoEjercicio = eIdx === ejerciciosParaGenerar.length - 1
        const periodos = generarPeriodosEjercicioLocal(ej)
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
            const cantEj = Math.floor(cantMovimientos / cantEjercicios)
            log(`Generando ${cantEj} movimientos para ejercicio ${ejAnioInicio}-${ej.anio_fin}...`)
            generarMovimientosIntegral(ej.id, ejAnioInicio, cantEj)
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
            cuota_social_importe: Number((Math.random() * 5000 + 1000).toFixed(2)),
            cuota_social_modalidad: 'Mensual',
            caja_chica_importe: Number((Math.random() * 10000 + 2000).toFixed(2)),
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

          for (const org of organismosTarget) {
            const cargosOrg = cargosRecs
              .filter((c) => String(c.organismo) === org)
              .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

            for (let ci = 0; ci < cargosOrg.length; ci++) {
              const cargo = cargosOrg[ci]
              let persona = null

              if (cargaConsolidada && org === 'CD' && ci < 3 && personasPoolDirectivos.length > 0) {
                persona = personasPoolDirectivos.find((p) => !personasUsadasAuth.has(p.id))
                if (!persona) persona = pick(personasPoolDirectivos)
              }
              if (!persona) {
                persona = poolPrincipal.find((p) => !personasUsadasAuth.has(p.id))
                if (!persona) persona = pick(poolPrincipal)
              }
              if (!persona) continue
              personasUsadasAuth.add(persona.id)

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
    '.'
  )

  return results
}
