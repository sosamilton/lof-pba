// Generador de datos de prueba para performance testing (SOLO dev).
// Crea personas → socios (con persona_id) → movimientos (con todas las Refs resueltas)
// → asamblea AGO + autoridades de CD/CRC (con cargo_id, persona_id, ejercicio_id, asamblea_id).
// Se invoca desde el setup wizard cuando import.meta.env.DEV es true.
// En prod este módulo se carga via import() dinámico dentro de un guard DEV,
// así que Vite lo separa en un chunk que no se carga en producción.

import { addRecords, applyUserActions, fetchRecords, resolveTableId } from '$core/grist'
import { TABLE_PREFERRED_IDS, addMonths } from '$core/utils'
import { extractRowId } from '$core/personas'
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
    const year = rand(limiteMayor.getFullYear() + 1, hoy.getFullYear())
    const month = String(rand(1, 12)).padStart(2, '0')
    const day = String(rand(1, 28)).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  // Mayor de edad: nació entre 1950 y hace 18 años.
  const year = rand(1950, limiteMayor.getFullYear())
  const month = String(rand(1, 12)).padStart(2, '0')
  const day = String(rand(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** @param {number} anioInicio @returns {string} */
const genFechaAlta = (anioInicio) => {
  const year = anioInicio + rand(0, 1)
  const month = String(rand(1, 12)).padStart(2, '0')
  const day = String(rand(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{personas: number, socios: number, movimientos: number, asamblea: boolean, autoridades: number}>}
 */
export const generarDatosPrueba = async ({
  cantPersonas = 500,
  cantSocios = 400,
  cantMovimientos = 2000,
  batchSize = 100,
  onProgress = () => {},
} = {}) => {
  const log = onProgress || (() => {})
  const results = { personas: 0, socios: 0, movimientos: 0, asamblea: false, autoridades: 0 }

  // --- Resolver tablas ---
  const tPersonas = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
  const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
  const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
  const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
  const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
  const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
  const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
  const tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)

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
      categoria: pick(CATEGORIAS),
      creado_el: new Date().toISOString(),
    })
  }

  for (let i = 0; i < personasData.length; i += batchSize) {
    await addRecords(tPersonas, personasData.slice(i, i + batchSize))
  }
  log('Personas cargadas, recuperando IDs...')

  // Recuperar IDs asignados por Grist (mapeo por dni que es único).
  // Solo necesitamos id y dni para resolver las Refs persona_id.
  const personasRecs = await fetchRecords(tPersonas, { columns: ['id', 'dni'] })
  const dniToPersonaId = new Map()
  for (const r of personasRecs) {
    if (r.dni) dniToPersonaId.set(String(r.dni), r.id)
  }
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
  if (tEjercicios) {
    try {
      const ejRecs = await fetchRecords(tEjercicios, { columns: ['id', 'anio_inicio'] })
      if (ejRecs.length > 0 && ejRecs[0].anio_inicio) {
        anioInicio = Number(ejRecs[0].anio_inicio) || anioInicio
      }
    } catch { /* fallback al current year */ }
  }

  for (let i = 0; i < cantSocios; i++) {
    // Elegir una persona del pool. Se priorizan personas no usadas aún;
    // si hay más socios que personas, se permite reusar.
    let entry = personasPool.find(([dni]) => !personasUsadas.has(dni))
    if (!entry) entry = pick(personasPool)
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

  for (let i = 0; i < sociosData.length; i += batchSize) {
    await addRecords(tSocios, sociosData.slice(i, i + batchSize))
  }
  log('Socios cargados, recuperando IDs...')

  // Recuperar IDs de socios (mapeo por dni)
  const sociosRecs = await fetchRecords(tSocios, { columns: ['id', 'dni'] })
  const dniToSocioId = new Map()
  for (const r of sociosRecs) {
    if (r.dni) dniToSocioId.set(String(r.dni), r.id)
  }
  results.socios = sociosData.length

  // --- 3. Movimientos (con todas las Refs resueltas) ---
  log(`Generando ${cantMovimientos} movimientos...`)

  // Mapear rubros por nombre y tipo
  let rubrosEntrada = []
  let rubrosSalida = []
  if (tRubros) {
    try {
      const rubrosRecs = await fetchRecords(tRubros, { columns: ['id', 'nombre_oficial', 'tipo_rubro'] })
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
  if (tEjercicios) {
    try {
      const ejRecs = await fetchRecords(tEjercicios, { columns: ['id'] })
      if (ejRecs.length > 0) ejercicioId = ejRecs[0].id
    } catch { /* sin ejercicio */ }
  }

  // DNIs de personas para asociar movimientos a socios/personas
  const dnisSocios = [...dniToSocioId.keys()]
  const dnisPersonas = [...dniToPersonaId.keys()]

  const movimientosData = []
  for (let i = 0; i < cantMovimientos; i++) {
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

    // Asociar a socio/persona ~40% de las veces
    let socioId = null
    let personaId = null
    if (dnisSocios.length > 0 && Math.random() < 0.4) {
      const dni = pick(dnisSocios)
      socioId = dniToSocioId.get(dni)
      personaId = dniToPersonaId.get(dni) || null
    } else if (dnisPersonas.length > 0 && Math.random() < 0.2) {
      personaId = dniToPersonaId.get(pick(dnisPersonas))
    }

    // Fecha dentro del ejercicio
    const month = String(rand(1, 12)).padStart(2, '0')
    const day = String(rand(1, 28)).padStart(2, '0')
    const fecha = `${anioInicio}-${month}-${day}`

    movimientosData.push({
      fecha,
      ejercicio_id: ejercicioId,
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

  for (let i = 0; i < movimientosData.length; i += batchSize) {
    await addRecords(tMovimientos, movimientosData.slice(i, i + batchSize))
  }
  results.movimientos = movimientosData.length

  // --- 4. Asamblea AGO + autoridades de CD y CRC ---
  // Solo si existen las tablas necesarias y hay ejercicio + cargos definidos.
  if (tAsambleas && tAutoridades && tCargos && ejercicioId) {
    log('Creando asamblea AGO y designando autoridades...')

    // Cargar cargos activos agrupados por organismo
    /** @type {Record<string, any>[]} */
    let cargosRecs = []
    try {
      cargosRecs = await fetchRecords(tCargos, {
        filter: (/** @type {Record<string, any>} */ c) => c.activo === true || c.cargo_obligatorio === true,
      })
    } catch { /* sin cargos */ }

    if (cargosRecs.length > 0 && personasRecs.length > 0) {
      // Crear asamblea AGO
      const fechaAsamblea = `${anioInicio}-03-15`
      const asambleaFields = {
        fecha: fechaAsamblea,
        tipo_asamblea: 'AGO',
        acta_numero: `001/${anioInicio}`,
        acta_fojas: '1',
        ejercicio_id: ejercicioId,
        socios_presentes_cantidad: Math.min(sociosData.length, rand(50, 150)),
        cuota_social_importe: Number((Math.random() * 5000 + 1000).toFixed(2)),
        cuota_social_modalidad: 'Mensual',
        caja_chica_importe: Number((Math.random() * 10000 + 2000).toFixed(2)),
      }
      const asambleaRes = await applyUserActions([['AddRecord', tAsambleas, null, asambleaFields]])
      const asambleaId = extractRowId(asambleaRes)
      results.asamblea = asambleaId != null

      // Designar autoridades: para cada cargo activo de CD y CRC, asignar una persona aleatoria
      const organismosTarget = ['CD', 'CRC']
      const personasPool = personasRecs.filter((p) => p.id != null)
      const personasUsadas = new Set()
      const autoridadesData = []

      for (const org of organismosTarget) {
        const cargosOrg = cargosRecs
          .filter((c) => String(c.organismo) === org)
          .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

        for (const cargo of cargosOrg) {
          // Buscar persona no usada aún; si se agotan, reusar
          let persona = personasPool.find((p) => !personasUsadas.has(p.id))
          if (!persona) persona = pick(personasPool)
          if (!persona) continue
          personasUsadas.add(persona.id)

          const duracionMeses = Number(cargo.duracion_meses) || 12
          const fechaAsuncion = fechaAsamblea
          const fechaVenc = addMonths(fechaAsuncion, duracionMeses)

          // apellido_nombre, cuil, dni, domicilio, localidad son columnas formula
          // en Grist (pull de $persona_id). No se guardan en autoridades.
          autoridadesData.push({
            organismo: org,
            cargo_id: cargo.id,
            persona_id: persona.id,
            fecha_asuncion: fechaAsuncion,
            fecha_vencimiento: fechaVenc,
            tipo_origen: 'Asamblea',
            asamblea_id: asambleaId || null,
            activo: true,
            ejercicio_id: ejercicioId,
          })
        }
      }

      if (autoridadesData.length > 0) {
        for (let i = 0; i < autoridadesData.length; i += batchSize) {
          await addRecords(tAutoridades, autoridadesData.slice(i, i + batchSize))
        }
        results.autoridades = autoridadesData.length
      }
    }
  }

  log(
    `Listo: ${results.personas} personas, ${results.socios} socios, ` +
    `${results.movimientos} movimientos` +
    (results.asamblea ? `, 1 asamblea AGO, ${results.autoridades} autoridades` : '') +
    '.'
  )

  return results
}
