/**
 * Mapeo de datos de la cooperadora → campos AcroForm del PIA oficial.
 *
 * El PIA (PIA_cooperadoras_editable_2025.pdf) tiene 203 campos AcroForm con
 * nombres semánticos (DISTRITO, ESCUELA, CARGO1, CUIL1, INGRESO A, etc.).
 * Este módulo transforma un objeto de datos estructurado en un
 * { fieldName: value } listo para pdfGenerator.
 *
 * Estructura del PIA:
 *   - Encabezado (distrito, escuela, CUE, CUIT, domicilio, contactos)
 *   - Síntesis del acta de asamblea (número, fojas, fecha, decisiones)
 *   - Nómina CD (14 filas: cargo, apellido+nombre, CUIL en 3 sub-campos)
 *   - Nómina CRC (4 roles pre-impresos: apellido+nombre + DNI)
 *   - Federación (titular + suplente: apellido+nombre + DNI)
 *   - Cuadro 8: Recursos y Gastos (rubros PIA vía campo_pdf)
 *   - Datos banco, kiosco, fecha de cierre
 */

/**
 * @typedef {Object} PiaData
 * @property {Record<string,any>} escuela
 * @property {Record<string,any>} banco
 * @property {Record<string,any>} ejercicio
 * @property {any|null} asamblea
 * @property {any[]} autoridadesCD  - autoridades activas del organismo CD, ordenadas por cargo.orden
 * @property {any[]} autoridadesCRC - autoridades activas del organismo CRC, ordenadas por cargo.orden
 * @property {any[]} autoridadesFed - autoridades activas del organismo Federacion
 * @property {any[]} cargosMap      - mapa id → cargo (para resolver nombres)
 * @property {Map<number, number>} totalesPorRubro - rubro_id → total importe
 * @property {any[]} rubros         - rubros PIA con campo_pdf
 * @property {Record<string,any>} kiosco
 * @property {number} totalSocios
 * @property {number} sociosActivos
 * @property {number} sociosHonorarios
 * @property {number} sociosAdherentes
 * @property {number} saldoBanco
 * @property {number} saldoEfectivo
 * @property {number} saldoEjercicioAnterior
 * @property {number} totalEntradas
 * @property {number} totalSalidas
 */

/**
 * Divide un CUIT/CUIL "XX-XXXXXXXX-X" en sus 3 partes.
 * @param {string} cuil
 * @returns {{prefix:string, body:string, suffix:string}}
 */
const splitCuil = (cuil) => {
  const digits = String(cuil || '').replace(/\D/g, '')
  if (digits.length < 10) return { prefix: '', body: '', suffix: '' }
  return {
    prefix: digits.slice(0, 2),
    body: digits.slice(2, 10),
    suffix: digits.slice(10, 11),
  }
}

/**
 * Formatea un importe como string sin símbolo (ej: "1234.50" → "1234,50").
 * pdf-lib setText recibe strings.
 * @param {number} val
 * @returns {string}
 */
const fmtMonto = (val) => {
  const n = Number(val) || 0
  if (n === 0) return ''
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Normaliza una fecha de Grist a un objeto Date.
 * Grist devuelve Date/DateTime como segundos desde epoch (número) o
 * como array encoded ["d", timestamp] / ["D", timestamp, tz].
 * También acepta strings ISO.
 * @param {number|string|Date|Array} raw
 * @returns {Date|null}
 */
const gristToDate = (raw) => {
  if (!raw && raw !== 0) return null
  if (raw instanceof Date) return raw
  // Número: timestamp en segundos desde epoch (formato Grist Date/DateTime)
  if (typeof raw === 'number') {
    const d = new Date(raw * 1000)
    return isNaN(d) ? null : d
  }
  // Array encoded de Grist: ["d", timestamp] o ["D", timestamp, timezone]
  if (Array.isArray(raw) && raw.length >= 2 && typeof raw[1] === 'number') {
    const d = new Date(raw[1] * 1000)
    return isNaN(d) ? null : d
  }
  // String ISO o YYYY-MM-DD
  const s = String(raw)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return isNaN(d) ? null : d
  }
  // String numérico (timestamp en segundos)
  const n = Number(s)
  if (Number.isFinite(n) && n > 0) {
    const d = new Date(n * 1000)
    return isNaN(d) ? null : d
  }
  return null
}

/**
 * Formatea una fecha de Grist como DD/MM/YYYY.
 * @param {number|string|Date|Array} fecha
 * @returns {string}
 */
const fmtFecha = (fecha) => {
  const d = gristToDate(fecha)
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Reparte una lista de subrubros (ya ordenados desc por monto) entre N pares
 * de campos desc|monto de un rubro "Otros" del PIA (ver `distribuirEnSlots`
 * en el comentario del cuadro 8, más abajo, para el formato de `campo_pdf`).
 *
 * Regla de reparto:
 *   - Sin subrubros con monto: si el rubro tiene un total igualmente (carga
 *     hecha sin elegir subrubro), va como "Varios" en el primer slot.
 *   - Hasta N subrubros con monto: uno por slot, en orden (mayor primero),
 *     sin agrupar — cada uno con su nombre y monto real.
 *   - Más de N subrubros: los primeros (N-1) van cada uno en su propio slot;
 *     el resto se agrupa en el ÚLTIMO slot como "Varios" (suma de los
 *     montos restantes).
 *
 * @param {Array<[string,string]>} pares - [[descField, montoField], ...] en orden
 * @param {Array<{nombre:string, monto:number}>} subrubroTotales - ordenados desc por monto
 * @param {number} totalRubro - total del rubro (fallback si no hay subrubros con monto)
 * @returns {Array<{descField:string, montoField:string, nombre:string, monto:number}>}
 */
export const distribuirEnSlots = (pares, subrubroTotales, totalRubro) => {
  const n = pares.length
  if (n === 0) return []

  if (subrubroTotales.length === 0) {
    if (totalRubro <= 0) return []
    const [descField, montoField] = pares[0]
    return [{ descField, montoField, nombre: 'Varios', monto: totalRubro }]
  }

  if (subrubroTotales.length <= n) {
    return subrubroTotales.map((s, i) => ({
      descField: pares[i][0],
      montoField: pares[i][1],
      nombre: s.nombre,
      monto: s.monto,
    }))
  }

  // Más subrubros que slots: top (n-1) individuales + resto agrupado en el último slot.
  const individuales = subrubroTotales.slice(0, n - 1)
  const resto = subrubroTotales.slice(n - 1)
  const sumaResto = resto.reduce((acc, s) => acc + s.monto, 0)

  const out = individuales.map((s, i) => ({
    descField: pares[i][0],
    montoField: pares[i][1],
    nombre: s.nombre,
    monto: s.monto,
  }))
  const [descField, montoField] = pares[n - 1]
  out.push({ descField, montoField, nombre: 'Varios', monto: sumaResto })
  return out
}

/**
 * Construye el mapa { fieldName: value } para el PIA.
 * @param {PiaData} data
 * @returns {Record<string, string>}
 */
export const buildPiaFieldMap = (data) => {
  /** @type {Record<string, string>} */
  const fields = {}
  const { escuela, banco, ejercicio, asamblea } = data

  // --- Encabezado ---
  fields['DISTRITO'] = escuela.distrito || ''
  fields['ESCUELA'] = escuela.escuela_nombre || ''
  fields['CUE'] = escuela.cue || ''

  const cuit = splitCuil(escuela.cuit)
  fields['CUIT1'] = cuit.prefix
  fields['CUIT2'] = cuit.body
  fields['CUIT3'] = cuit.suffix

  fields['DOMICILIO'] = escuela.domicilio || ''
  fields['BARRIO'] = escuela.barrio_paraje || ''
  fields['LOCALIDAD'] = escuela.localidad || ''

  // Email/teléfono del asesor (izquierda) — desde el asesor activo, no de la escuela
  // Se llenan más abajo cuando ya tenemos el asesor cargado
  // Email/teléfono de la cooperadora (derecha)
  fields['EMAIL2'] = escuela.email_cooperadora || ''
  fields['TELÉFONO2'] = escuela.telefono_cooperadora || ''

  // --- Socios ---
  fields['nro'] = String(data.totalSocios || '')
  fields['activos'] = String(data.sociosActivos || '')
  fields['honorarios'] = String(data.sociosHonorarios || '')
  fields['adherentes'] = String(data.sociosAdherentes || '')

  // --- Síntesis del acta ---
  if (asamblea) {
    fields['acta'] = String(asamblea.acta_numero || '')
    fields['foja'] = String(asamblea.acta_fojas || '')
    const fecha = gristToDate(asamblea.fecha)
    if (fecha) {
      fields['dia'] = String(fecha.getDate())
      fields['mes'] = String(fecha.getMonth() + 1)
      fields['año'] = String(fecha.getFullYear())
    }
    fields['asistieron'] = String(asamblea.socios_presentes_cantidad || '')
  }

  // --- Decisiones del orden del día ---
  // Las decisiones vienen en data.resoluciones (array de {numero, texto})
  if (data.resoluciones) {
    for (let i = 0; i < 5 && i < data.resoluciones.length; i++) {
      const key = `${i + 1}DECISIÓN ADOPTADA`
      fields[key] = data.resoluciones[i].texto || ''
    }
  }

  // 6° Cuota social
  if (asamblea) {
    fields['6'] = asamblea.cuota_social_importe ? fmtMonto(asamblea.cuota_social_importe) : ''
    // Check Box35 (X=519) = Mensual, Check Box34 (X=562) = Anual
    if (asamblea.cuota_social_modalidad === 'Mensual') {
      fields['Check Box35'] = 'Yes'
    } else if (asamblea.cuota_social_modalidad === 'Anual') {
      fields['Check Box34'] = 'Yes'
    }
  }

  // 7° Caja chica
  if (asamblea) {
    fields['7'] = asamblea.caja_chica_importe ? fmtMonto(asamblea.caja_chica_importe) : ''
  }

  // --- Nómina CD (14 filas) ---
  const cd = data.autoridadesCD || []
  for (let i = 0; i < 14; i++) {
    const a = cd[i]
    const idx = i + 1
    fields[`CARGO${idx}`] = a?._cargoNombre || ''
    fields[`NOMBRE Y APELLIDO${idx}`] = a?.apellido_nombre || ''
    // CUIL: 3 sub-campos por fila (prefijo, cuerpo, sufijo)
    // CUIL1-14 = prefijos, CUIL15-28 = cuerpos, CUIL29-42 = sufijos
    const cuil = splitCuil(a?.cuil)
    fields[`CUIL${idx}`] = cuil.prefix
    fields[`CUIL${idx + 14}`] = cuil.body
    fields[`CUIL${idx + 28}`] = cuil.suffix
    // Vencimiento del mandato: Texto4-Texto17 (una por fila)
    fields[`Texto${idx + 3}`] = a?.fecha_vencimiento ? fmtFecha(a.fecha_vencimiento) : ''
  }

  // --- Nómina CRC (3 roles pre-impresos: Titular Docente, Titular, Suplente) ---
  const crc = data.autoridadesCRC || []
  const crcFields = ['TITULAR DOCENTE', 'TITULAR', 'SUPLENTE']
  const crcDniFields = ['DNI1', 'DNI2', 'DNI3']
  for (let i = 0; i < 3; i++) {
    const a = crc[i]
    fields[crcFields[i]] = a?.apellido_nombre || ''
    fields[crcDniFields[i]] = a?.dni || ''
  }

  // --- Asesor/a (función institucional, NO es cargo electivo del CRC) ---
  // Deriva de la Dirección del establecimiento (Decreto 4767/72 art. 18).
  // Se carga desde la tabla `asesores`, no desde `autoridades`.
  const asesor = data.asesor
  fields['ASESOR/A'] = asesor?.apellido_nombre || ''
  fields['DNI4'] = asesor?.dni || ''
  // Email/teléfono del asesor (campos izquierdos de la sección de contacto)
  fields['EMAIL'] = asesor?.email || ''
  fields['TELÉFONO'] = asesor?.telefono || ''

  // --- Federación (Titular + Suplente) ---
  const fed = data.autoridadesFed || []
  fields['TITULAR 2'] = fed[0]?.apellido_nombre || ''
  fields['SUPLENTE 2'] = fed[1]?.apellido_nombre || ''
  fields['DNI5'] = fed[0]?.dni || ''
  fields['DNI6'] = fed[1]?.dni || ''

  // --- Cuadro 8: Recursos y Gastos ---
  // Los rubros tienen campo_pdf que indica qué campo(s) del PDF recibirán el total.
  //
  // Formatos soportados:
  //   - Un solo campo ("Texto47"): rubro fijo, recibe el monto total.
  //   - Un par "descField|montoField": rubro "Otros" con UN slot libre en el
  //     PDF. descField (ancho > 100) recibe el NOMBRE del subrubro (o
  //     "Varios" si agrupa), montoField recibe el MONTO.
  //   - Varios pares separados por ";" ("descA|montoA;descB|montoB"): rubro
  //     "Otros" con N slots libres (ej. Gastos Alumno tiene 2 líneas libres
  //     en el PIA: "GASTOS F|Texto33;GASTOS G|Texto34"). Se reparten según
  //     `distribuirEnSlots` (ver abajo).
  const totales = data.totalesPorRubro || new Map()
  const totalesPorSubrubro = data.totalesPorSubrubro || new Map()
  const subrubros = data.subrubros || []
  const rubros = data.rubros || []

  // Mapear subrubros por rubro_id para acceso rápido
  /** @type {Map<number, any[]>} */
  const subrubrosPorRubro = new Map()
  for (const sr of subrubros) {
    const rid = Number(sr.rubro_id)
    if (!subrubrosPorRubro.has(rid)) subrubrosPorRubro.set(rid, [])
    subrubrosPorRubro.get(rid).push(sr)
  }

  for (const rubro of rubros) {
    const campoPdf = rubro.campo_pdf
    if (!campoPdf) continue
    const rubroId = Number(rubro.id)
    const totalRubro = totales.get(rubroId) || 0

    // Cada slot es un grupo separado por ";"; cada grupo puede ser un campo
    // único (rubro fijo) o un par "desc|monto" (slot de rubro "Otros").
    const slots = String(campoPdf).split(';').map((s) => s.trim()).filter(Boolean)
    const pares = slots
      .map((s) => s.split('|').map((p) => p.trim()).filter(Boolean))
      .filter((partes) => partes.length === 2)

    if (pares.length > 0 && pares.length === slots.length) {
      // Todos los slots son pares desc|monto: rubro "Otros" con N slots.
      const subsDelRubro = subrubrosPorRubro.get(rubroId) || []
      const subrubroTotales = subsDelRubro
        .map((sr) => ({
          nombre: sr.nombre_subrubro || 'S/N',
          monto: totalesPorSubrubro.get(Number(sr.id)) || 0,
        }))
        .filter((s) => s.monto > 0)
        .sort((a, b) => b.monto - a.monto) // mayores primero

      for (const item of distribuirEnSlots(pares, subrubroTotales, totalRubro)) {
        fields[item.descField] = item.nombre
        fields[item.montoField] = fmtMonto(item.monto)
      }
    } else {
      // Rubro fijo: uno o más campos simples, todos reciben el monto total.
      const val = fmtMonto(totalRubro)
      for (const campo of slots) {
        if (campo) fields[campo] = val
      }
    }
  }

  // Totales (campos del cuadro principal)
  fields['TOTAL ENTRADAS'] = fmtMonto(data.totalEntradas)
  fields['TOTAL SALIDAS'] = fmtMonto(data.totalSalidas)

  // Saldos (sección "A- En Banco" / "A- En Caja Chica")
  fields['CC'] = fmtMonto(data.saldoBanco)
  fields['EFECTIVO'] = fmtMonto(data.saldoEfectivo)

  // --- Resumen Anual (Texto44-48, columna izquierda) ---
  // Estos campos NO son rubros: son los totales del resumen que replica
  // TOTAL ENTRADAS, SALDO ANTERIOR, TOTAL GENERAL, TOTAL SALIDAS y SALDO PROXIMO.
  // Antes estaban mapeados incorrectamente como rubros GP (bug corregido 2026-08-23).
  const saldoAnt = data.saldoEjercicioAnterior || 0
  const totalGeneral = data.totalEntradas + saldoAnt
  const saldoProximo = totalGeneral - data.totalSalidas
  fields['Texto44'] = fmtMonto(data.totalEntradas)
  fields['Texto45'] = fmtMonto(saldoAnt)
  fields['Texto46'] = fmtMonto(totalGeneral)
  fields['Texto47'] = fmtMonto(data.totalSalidas)
  fields['Texto48'] = fmtMonto(saldoProximo)

  // --- Datos banco ---
  if (banco) {
    fields['DATOS BANCO'] = banco.entidad || ''
    fields['SUCURSAL'] = banco.sucursal || ''
    fields['CUENTA CORRIENTE'] = banco.cuenta_corriente || ''
    fields['CBU'] = banco.cbu || ''
  }

  // --- Kiosco ---
  // Check Box194 (X=219) = Sí, Check Box195 (X=262) = No
  if (data.kiosco?.posee === true) {
    fields['Check Box194'] = 'Yes'
  } else {
    fields['Check Box195'] = 'Yes'
  }
  // Modalidad: Check Box196 (X=471) = Propio, Check Box197 (X=534) = Licitado
  if (data.kiosco?.modalidad === 'Propio') fields['Check Box196'] = 'Yes'
  else if (data.kiosco?.modalidad === 'Licitado') fields['Check Box197'] = 'Yes'

  // --- Fecha de cierre del ejercicio ---
  if (ejercicio?.fecha_fin) {
    const fin = new Date(ejercicio.fecha_fin)
    if (!isNaN(fin)) {
      fields['DIA 2'] = String(fin.getDate())
      fields['MES 2'] = String(fin.getMonth() + 1)
      fields['AÑO 2'] = String(fin.getFullYear())
    }
  }

  // Años del ejercicio (readOnly fields, pero los llenamos igual por si acaso)
  if (ejercicio?.anio_inicio) fields['AÑO 1'] = String(ejercicio.anio_inicio)
  if (ejercicio?.anio_fin) fields['año 2'] = String(ejercicio.anio_fin)

  // Foja de tesorería (cuadro 7)
  if (data.fojaTesoreria) {
    fields['NRO FOJA'] = String(data.fojaTesoreria)
  }

  return fields
}
