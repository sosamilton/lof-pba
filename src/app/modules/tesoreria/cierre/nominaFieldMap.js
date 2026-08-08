/**
 * Mapeo de datos de autoridades → campos AcroForm de la Nómina oficial.
 *
 * La Nómina (Nomina_comision_directiva_editable.pdf) tiene 102 campos AcroForm
 * con nombres genéricos (text_1zzii, text_2waid, ...). Los campos no tienen
 * nombres semánticos, pero su posición (Rect) define su rol.
 *
 * Estructura reconstruida por posición:
 *   - Encabezado: AÑO, DISTRITO, ESCUELA, ASOCIACIÓN
 *   - Tabla con 6 columnas (por rango X):
 *       CARGO (x40-141), APELLIDO Y NOMBRE (x146-344), DOCUMENTO (x351-435),
 *       DOMICILIO (x439-602), LOCALIDAD (x606-743), VENCIMIENTO (x749-836)
 *   - Filas de autoridades (~17 filas, agrupadas por Y)
 *
 * El mapeo se generó inspeccionando las posiciones de los widgets con pypdf.
 */

// --- Encabezado ---
const HEADER = {
  año: 'text_1zzii',
  distrito: 'text_2waid',
  escuela: 'text_3gqed',
  asociacion: 'text_4ulwg',
}

// --- Filas de la tabla ---
// Cada fila tiene 6 campos en este orden de columna:
//   [0]=CARGO, [1]=APELLIDO Y NOMBRE, [2]=DOCUMENTO, [3]=DOMICILIO, [4]=LOCALIDAD, [5]=VENCIMIENTO
// Las filas se ordenan de arriba (Y alta) a abajo (Y baja).
// Las últimas 4 filas (y=128,104,80,56) no tienen columna CARGO (cargo pre-impreso).
const TABLE_ROWS = [
  // y=448 (fila 1)
  ['text_5gnqf', 'text_6odby', 'text_7llzz', 'text_8nbmm', 'text_9efsq', 'text_10hvyf'],
  // y=424 (fila 2)
  ['text_11gukb', 'text_12nliv', 'text_13akhj', 'text_14djll', 'text_15axie', 'text_16lgxa'],
  // y=400 (fila 3)
  ['text_17cebc', 'text_18nejc', 'text_19btlx', 'text_20pwmq', 'text_21pwnm', 'text_22zumy'],
  // y=376 (fila 4)
  ['text_23zykq', 'text_24ogyd', 'text_25oucb', 'text_26rqws', 'text_27yzhc', 'text_28nufr'],
  // y=352 (fila 5)
  ['text_29psbu', 'text_30nxed', 'text_31paum', 'text_32suuq', 'text_33tlbi', 'text_34vrea'],
  // y=328 (fila 6)
  ['text_35myfl', 'text_36mjrw', 'text_37ipdu', 'text_38rhty', 'text_39qchc', 'text_40poyn'],
  // y=304 (fila 7)
  ['text_41yphz', 'text_42teqi', 'text_43qwzs', 'text_44wems', 'text_45muob', 'text_46spmw'],
  // y=280 (fila 8)
  ['text_47sfez', 'text_48ctlt', 'text_49opwc', 'text_50gzcx', 'text_51kecs', 'text_52hywj'],
  // y=256 (fila 9)
  ['text_53cnj', 'text_54bjjz', 'text_55lwyr', 'text_56omwm', 'text_57ljqz', 'text_58uuyd'],
  // y=232 (fila 10) — 5 campos (sin VENCIMIENTO en esta fila, va en y=224)
  ['text_59naey', 'text_60zmdh', 'text_61pyap', 'text_62pskf', 'text_63yrjo', 'text_64pqpe'],
  // y=200 (fila 11)
  ['text_65bagf', 'text_66hngt', 'text_67hevm', 'text_68fydv', 'text_69jiuq', 'text_70vxsw'],
  // y=176 (fila 12)
  ['text_71snzl', 'text_72kceb', 'text_73e', 'text_74zwjd', 'text_75limj', 'text_76cgtx'],
  // y=152 (fila 13)
  ['text_77tmhn', 'text_78jzat', 'text_79aiay', 'text_80pprz', 'text_81awss', 'text_82vftz'],
  // y=128 (fila 14 — sin CARGO, cargo pre-impreso "Rev. de Cuentas Doc.")
  [null, 'text_83cab', 'text_84cezg', 'text_85kayc', 'text_86twpd', 'text_87rqvo'],
  // y=104 (fila 15 — "Rev. de Cuentas Tit.")
  [null, 'text_88uesl', 'text_89ujab', 'text_90cfno', 'text_91zpdu', 'text_92irca'],
  // y=80 (fila 16 — "Rev. de Cuentas Sup.")
  [null, 'text_93bevv', 'text_94dvbv', 'text_95nbih', 'text_96svzl', 'text_97dsdz'],
  // y=56 (fila 17 — "Asesor")
  [null, 'text_98cxwg', 'text_99sdun', 'text_100oibp', 'text_101uaxu', 'text_102vpos'],
]

/**
 * Formatea una fecha ISO a DD/MM/YYYY.
 * @param {string|Date} fecha
 * @returns {string}
 */
const fmtFecha = (fecha) => {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d)) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Construye el mapa { fieldName: value } para la Nómina.
 * @param {Object} data
 * @param {Record<string,any>} data.escuela
 * @param {Record<string,any>} data.ejercicio
 * @param {any[]} data.autoridades - todas las autoridades activas (CD + CRC + Federacion)
 * @param {Map<number,any>} data.cargosMap - cargo_id → cargo record
 * @returns {Record<string, string>}
 */
export const buildNominaFieldMap = (data) => {
  /** @type {Record<string, string>} */
  const fields = {}

  // --- Encabezado ---
  const { escuela, ejercicio } = data
  fields[HEADER.año] = ejercicio?.anio_inicio ? String(ejercicio.anio_inicio) : ''
  fields[HEADER.distrito] = escuela?.distrito || ''
  fields[HEADER.escuela] = escuela?.escuela_nombre
    ? `${escuela.escuela_nombre} ${escuela.escuela_numero || ''}`.trim()
    : ''
  fields[HEADER.asociacion] = escuela?.cooperadora_nombre || ''

  // --- Filas de autoridades ---
  // Ordenar: primero CD (por cargo.orden), luego CRC (por cargo.orden), luego Federacion
  // La última fila (índice 16) es "Asesor" — se carga desde data.asesor, no de autoridades
  const autoridades = [...(data.autoridades || [])].sort((a, b) => {
    const orgOrder = { CD: 0, CRC: 1, Federacion: 2 }
    const oa = orgOrder[a._organismo] ?? 9
    const ob = orgOrder[b._organismo] ?? 9
    if (oa !== ob) return oa - ob
    return (a._cargoOrden ?? 99) - (b._cargoOrden ?? 99)
  })

  // Las primeras 16 filas son autoridades electivas (CD + CRC + Federacion)
  for (let i = 0; i < 16 && i < autoridades.length; i++) {
    const a = autoridades[i]
    const row = TABLE_ROWS[i]

    // [0] CARGO
    if (row[0]) {
      fields[row[0]] = a?._cargoNombre || ''
    }
    // [1] APELLIDO Y NOMBRE
    fields[row[1]] = a?.apellido_nombre || ''
    // [2] DOCUMENTO (DNI)
    fields[row[2]] = a?.dni || ''
    // [3] DOMICILIO
    fields[row[3]] = a?.domicilio || ''
    // [4] LOCALIDAD
    fields[row[4]] = a?.localidad || ''
    // [5] VENCIMIENTO (fecha_vencimiento o fin de mandato)
    fields[row[5]] = a?.fecha_vencimiento ? fmtFecha(a.fecha_vencimiento) : ''
  }

  // --- Fila 17 (índice 16): Asesor/a ---
  // Función institucional derivada de la Dirección del establecimiento.
  // Cargo pre-impreso "Asesor" en el PDF (row[0] = null).
  const asesor = data.asesor
  const asesorRow = TABLE_ROWS[16]
  if (asesorRow && asesor) {
    // [0] CARGO es null (pre-impreso "Asesor")
    fields[asesorRow[1]] = asesor.apellido_nombre || ''
    fields[asesorRow[2]] = asesor.dni || ''
    fields[asesorRow[3]] = asesor.domicilio || ''
    fields[asesorRow[4]] = asesor.localidad || ''
    // El asesor no tiene fecha de vencimiento (su vigencia deriva de la Dirección)
    fields[asesorRow[5]] = ''
  }

  return fields
}
