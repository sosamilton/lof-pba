import { fetchRecords, resolveTableId } from '$core/grist/grist.js'
import { TABLE_PREFERRED_IDS, buildMapById } from '$core/utils/utils.js'

/**
 * Servicio de recolección de datos para el cierre de ejercicio.
 *
 * Reúne todos los datos necesarios para rellenar el PIA y la Nómina:
 *   - escuela, banco, kiosco
 *   - ejercicio seleccionado
 *   - asamblea AGO del ejercicio + resoluciones
 *   - autoridades activas del ejercicio (CD, CRC, Federacion)
 *   - cargos (para resolver nombres y orden)
 *   - socios (conteo por tipo)
 *   - movimientos del ejercicio agrupados por rubro
 *   - rubros PIA (con campo_pdf)
 *   - saldos finales (banco, efectivo)
 *
 * Todo se obtiene con fetchRecords (read-only). No modifica datos.
 */

/**
 * @typedef {Object} CierreData
 * @property {Record<string,any>} escuela
 * @property {Record<string,any>} banco
 * @property {Record<string,any>} kiosco
 * @property {Record<string,any>} ejercicio
 * @property {any|null} asamblea
 * @property {any[]} resoluciones
 * @property {any[]} autoridades
 * @property {any[]} autoridadesCD
 * @property {any[]} autoridadesCRC
 * @property {any[]} autoridadesFed
 * @property {Map<number,any>} cargosMap
 * @property {number} totalSocios
 * @property {number} sociosActivos
 * @property {number} sociosHonorarios
 * @property {number} sociosAdherentes
 * @property {Map<number, number>} totalesPorRubro
 * @property {any[]} rubros
 * @property {number} totalEntradas
 * @property {number} totalSalidas
 * @property {number} saldoBanco
 * @property {number} saldoEfectivo
 */

/**
 * Carga todos los datos necesarios para el cierre de un ejercicio.
 * @param {number} ejercicioId
 * @returns {Promise<CierreData|null>}
 */
export const loadCierreData = async (ejercicioId) => {
  if (ejercicioId == null) return null

  const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
  const tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
  const tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
  const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
  const tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)
  const tResoluciones = await resolveTableId(TABLE_PREFERRED_IDS.resoluciones)
  const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
  const tAsesores = await resolveTableId(TABLE_PREFERRED_IDS.asesores)
  const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
  const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
  const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
  const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
  const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
  const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)

  // --- Configuración (1 fila) ---
  const escuela = tEscuela ? (await fetchRecords(tEscuela))[0] || {} : {}
  const banco = tBanco ? (await fetchRecords(tBanco))[0] || {} : {}
  const kiosco = tKiosco ? (await fetchRecords(tKiosco))[0] || {} : {}

  // --- Ejercicio seleccionado ---
  const ejercicios = tEjercicios ? await fetchRecords(tEjercicios) : []
  const ejercicio = ejercicios.find((e) => Number(e.id) === Number(ejercicioId)) || null
  if (!ejercicio) return null

  // --- Asamblea AGO del ejercicio ---
  const asambleas = tAsambleas
    ? await fetchRecords(tAsambleas, {
        filter: (a) =>
          Number(a.ejercicio_id) === Number(ejercicioId) &&
          String(a.tipo_asamblea) === 'AGO',
      })
    : []
  const asamblea = asambleas[0] || null

  // --- Resoluciones del orden del día ---
  let resoluciones = []
  if (asamblea && tResoluciones) {
    const allRes = await fetchRecords(tResoluciones, {
      filter: (r) => Number(r.asamblea_id) === Number(asamblea.id),
    })
    resoluciones = allRes
      .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0))
      .slice(0, 7) // 7 puntos del orden del día
  }

  // --- Cargos ---
  const cargos = tCargos ? await fetchRecords(tCargos) : []
  const cargosMap = buildMapById(cargos)

  // --- Autoridades activas del ejercicio ---
  const autoridadesRaw = tAutoridades
    ? await fetchRecords(tAutoridades, {
        filter: (a) =>
          Number(a.ejercicio_id) === Number(ejercicioId) &&
          a.activo !== false,
      })
    : []

  // Enriquecer autoridades con datos del cargo
  const autoridades = autoridadesRaw.map((a) => {
    const cargo = cargosMap.get(Number(a.cargo_id))
    return {
      ...a,
      _cargoNombre: cargo?.nombre_cargo || '',
      _cargoOrden: Number(cargo?.orden || 99),
      _organismo: cargo?.organismo || a.organismo || '',
    }
  })

  const autoridadesCD = autoridades
    .filter((a) => a._organismo === 'CD')
    .sort((a, b) => a._cargoOrden - b._cargoOrden)
  const autoridadesCRC = autoridades
    .filter((a) => a._organismo === 'CRC')
    .sort((a, b) => a._cargoOrden - b._cargoOrden)
  const autoridadesFed = autoridades
    .filter((a) => a._organismo === 'Federacion')
    .sort((a, b) => a._cargoOrden - b._cargoOrden)

  // --- Asesor activo del ejercicio (función institucional, no cargo electivo) ---
  // Deriva de la Dirección del establecimiento (Decreto 4767/72 art. 18).
  // Se carga desde la tabla `asesores`, no desde `autoridades`.
  let asesor = null
  if (tAsesores) {
    const todosAsesores = await fetchRecords(tAsesores)
    // Filtrar activos (activo === true o sin fecha_cese)
    const activos = todosAsesores.filter((a) =>
      a.activo === true || a.activo === 1 || (!a.fecha_cese && a.activo !== false && a.activo !== 0)
    )
    // Preferir el que tenga ejercicio_id matching; si no, el activo sin ejercicio
    asesor = activos.find((a) => Number(a.ejercicio_id) === Number(ejercicioId)) || activos[0] || null
  }

  // --- Socios: conteo por tipo ---
  const socios = tSocios ? await fetchRecords(tSocios) : []
  const sociosActivos = socios.filter((s) => s.activo !== false && s.tipo_socio === 'Activo').length
  const sociosHonorarios = socios.filter((s) => s.activo !== false && s.tipo_socio === 'Honorario').length
  const sociosAdherentes = socios.filter((s) => s.activo !== false && s.tipo_socio === 'Adherente').length
  const totalSocios = sociosActivos + sociosHonorarios + sociosAdherentes

  // --- Movimientos del ejercicio, agrupados por rubro ---
  const movimientos = tMovimientos
    ? await fetchRecords(tMovimientos, {
        filter: (m) => Number(m.ejercicio_id) === Number(ejercicioId),
      })
    : []

  /** @type {Map<number, number>} */
  const totalesPorRubro = new Map()
  /** @type {Map<number, number>} */
  const totalesPorSubrubro = new Map()
  let totalEntradas = 0
  let totalSalidas = 0
  for (const m of movimientos) {
    const rubroId = Number(m.rubro_id)
    const subrubroId = Number(m.subrubro_id)
    const importe = Number(m.importe) || 0
    if (!rubroId || importe === 0) continue
    const prev = totalesPorRubro.get(rubroId) || 0
    totalesPorRubro.set(rubroId, prev + importe)
    if (subrubroId) {
      const prevSr = totalesPorSubrubro.get(subrubroId) || 0
      totalesPorSubrubro.set(subrubroId, prevSr + importe)
    }
    if (m.tipo_movimiento === 'Entrada') totalEntradas += importe
    else if (m.tipo_movimiento === 'Salida') totalSalidas += importe
  }

  // --- Rubros PIA y Subrubros ---
  const rubros = tRubros ? await fetchRecords(tRubros) : []
  const subrubros = tSubrubros ? await fetchRecords(tSubrubros) : []

  // Fixup: corregir campo_pdf de rubros PIA que tenían mapeos incorrectos
  // (campos desplazados por una posición, rubros fijos mapeados a campos de
  // descripción, etc.). Se aplica en runtime keyed por codigo_rubro para que
  // cada rubro reciba su campo correcto sin importar qué versión del CSV se sembró.
  const CAMPO_PDF_CORRECTO = {
    'RP-CUOTA': 'Texto18',
    'RP-DONACION': 'Texto19',
    'RP-RIFAS': 'Texto20',
    'RP-FESTIVALES': 'Texto21',
    'RP-KIOSCO': 'Texto22',
    'RP-INTERESES': 'Texto23',
    'RP-REINTEGROS': 'Texto24',
    'RO-SUBSIDIO': 'Texto25',
    'OI-OTROS': 'INGRESO A|Texto26',
    'GA-ROPA': 'Texto28',
    'GA-LIBROS': 'Texto29',
    'GA-EXCURSIONES': 'Texto30',
    'GA-EMERGENCIAS': 'Texto31',
    'GA-GOLOSINAS': 'Texto32',
    'GA-OTROS': 'GASTOS F|Texto33',
    'GE-MATDIDACTICO': 'Texto35',
    'GE-MANTSUBSIDIO': 'Texto36',
    'GE-MANTPROPIOS': 'Texto37',
    'GE-LIMPIEZA': 'Texto38',
    'GE-COMBUSTIBLE': 'Texto39',
    'GE-LIBRERIA': 'Texto40',
    'GE-MOBILIARIO': 'Texto41',
    'GE-OTROS': 'GASTOS H|Texto42',
    'GP-ORGRIFAS': 'Texto44',
    'GP-ORGFESTIVALES': 'Texto45',
    'GP-KIOSCO': 'Texto46',
    'GP-OTROS': 'Texto47',
    'OG-OTROS': 'GASTOS D|Texto54',
  }
  for (const r of rubros) {
    const correcto = CAMPO_PDF_CORRECTO[r.codigo_rubro]
    if (correcto && r.campo_pdf !== correcto) {
      r.campo_pdf = correcto
    }
  }

  // --- Saldos finales ---
  // Saldo banco = saldo_inicial_banco + (entradas a banco) - (salidas de banco)
  // Simplificación MVP: usamos el saldo_inicial + totalEntradas - totalSalidas
  // (asumiendo cuenta única; refinable con cuentas reales después)
  const saldoInicialBanco = Number(ejercicio.saldo_inicial_banco) || 0
  const saldoInicialEfectivo = Number(ejercicio.saldo_inicial_efectivo) || 0
  const saldoBanco = saldoInicialBanco + totalEntradas - totalSalidas
  const saldoEfectivo = saldoInicialEfectivo

  return {
    escuela,
    banco,
    kiosco,
    ejercicio,
    asamblea,
    resoluciones,
    autoridades,
    autoridadesCD,
    autoridadesCRC,
    autoridadesFed,
    asesor,
    cargosMap,
    totalSocios,
    sociosActivos,
    sociosHonorarios,
    sociosAdherentes,
    totalesPorRubro,
    totalesPorSubrubro,
    rubros,
    subrubros,
    totalEntradas,
    totalSalidas,
    saldoBanco,
    saldoEfectivo,
  }
}
