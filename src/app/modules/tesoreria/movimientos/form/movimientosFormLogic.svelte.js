import { dateToInput, buildMapById, normalize, todayISO, fechasEjercicio } from '$core/utils/utils.js'
import { extractAttachmentIds, toAttachmentCellValue } from '$core/data/dataRepository'

/**
 * Determina el ejercicio_id correcto para un movimiento basándose en su fecha.
 * Busca el ejercicio cuyo rango [fecha_inicio, fecha_fin] contiene la fecha.
 * Si no hay ejercicio que contenga la fecha, cae al ejercicio en_curso.
 * Si no hay ejercicio en_curso, devuelve null.
 *
 * @param {string} fecha - Fecha del movimiento (YYYY-MM-DD)
 * @param {any[]} ejercicios - Lista de ejercicios
 * @returns {number|null}
 */
const resolveEjercicioId = (fecha, ejercicios) => {
  if (!fecha || !Array.isArray(ejercicios) || ejercicios.length === 0) return null
  for (const ej of ejercicios) {
    const { fechaInicio, fechaFin } = fechasEjercicio(ej)
    if (fechaInicio && fechaFin && fecha >= fechaInicio && fecha <= fechaFin) {
      return Number(ej.id)
    }
  }
  // Fallback: ejercicio en_curso
  const enCurso = ejercicios.find((e) => e.en_curso === true)
  return enCurso ? Number(enCurso.id) : null
}

/**
 * Lógica CRUD individual de movimientos: seleccionar, nuevo, validar, guardar,
 * y handlers de cambio de tipo/rubro.
 *
 * @param {object} deps
 * @param {object} deps.formState - Estado UI del formulario
 * @param {object} deps.relatedData - Datos relacionados (rubros, cuentas, ejercicio, etc.)
 * @param {object} deps.base - Store base (records, save, setError, clearMessages)
 * @param {object} deps.cierresService - Servicio de cierres (buscarCierreManual)
 * @returns {{
 *   select: (m: any) => void, nuevo: () => void,
 *   nuevoCuotaSocietaria: () => void, cancelar: () => void,
 *   validate: () => string, saveMovimiento: () => Promise<any>,
 *   onTipoChange: () => void, onRubroChange: () => void,
 * }}
 */
export function createFormLogic({ formState, relatedData, base, cierresService }) {
  const select = (m) => {
    formState.setSelectedId(m?.id || null)
    formState.setListOpen(true)
    formState.setForm({
      id: m?.id || null,
      ejercicio_id: m?.ejercicio_id ?? null,
      fecha: dateToInput(m?.fecha),
      tipo_movimiento: m?.tipo_movimiento || 'Entrada',
      rubro_id: m?.rubro_id ?? '',
      subrubro_id: m?.subrubro_id ?? '',
      detalle: m?.detalle || '',
      importe: m?.importe ?? '',
      cuenta_id: m?.cuenta_id ?? '',
      destino_bancario: m?.destino_bancario || '',
      cuenta_destino_id: m?.cuenta_destino_id ?? '',
      socio_id: m?.socio_id ?? '',
      persona_id: m?.persona_id ?? '',
      comprobante: extractAttachmentIds(m?.comprobante),
    })
  }

  const nuevo = () => {
    formState.setSelectedId(null)
    formState.setListOpen(true)
    const today = todayISO()
    // Default de fecha: si el ejercicio visto tiene rango de fechas y today
    // cae fuera, usar el último día del ejercicio (si es viejo) o el primer
    // día (si es futuro). Así el usuario no crea accidentalmente un movimiento
    // con fecha de hoy en un ejercicio cerrado.
    let fechaDefault = today
    const rango = relatedData.rangoFechasEjercicioVisto?.()
    if (rango) {
      if (today < rango.fechaMin) fechaDefault = rango.fechaMin
      else if (today > rango.fechaMax) fechaDefault = rango.fechaMax
    }
    // Defaults: override de sesión → defaults persistidos → valores hardcodeados
    const d = relatedData.sessionOverride || relatedData.defaultsMovimiento || {}
    formState.setForm({
      id: null,
      fecha: fechaDefault,
      tipo_movimiento: d.tipo || 'Entrada',
      rubro_id: d.rubro_id || '',
      subrubro_id: '',
      detalle: d.detalle || '',
      importe: '',
      cuenta_id: d.cuenta_id || relatedData.cuentaDefaultId || '',
      destino_bancario: '',
      cuenta_destino_id: '',
      socio_id: '',
      persona_id: '',
      comprobante: [],
    })
  }

  // Atajo: formulario pre-cargado para cargar una cuota societaria
  const nuevoCuotaSocietaria = () => {
    const rubroCuota = relatedData.rubros.find((r) => {
      const nombre = normalize(r.nombre_oficial || '')
      return nombre.includes('cuota') || nombre.includes('socio') || nombre.includes('societ') || nombre.includes('aporte socio')
    })
    nuevo()
    if (rubroCuota) {
      formState.form.rubro_id = String(rubroCuota.id)
      formState.form.detalle = 'Cuota societaria'
    }
  }

  // Atajo genérico: formulario pre-cargado con un preset de campos.
  // Usado por las acciones personalizadas de atajos configurables.
  const nuevoConPreset = (preset = {}) => {
    nuevo()
    if (preset.tipo_movimiento) formState.form.tipo_movimiento = preset.tipo_movimiento
    if (preset.rubro_id) formState.form.rubro_id = String(preset.rubro_id)
    if (preset.subrubro_id) formState.form.subrubro_id = String(preset.subrubro_id)
    if (preset.detalle) formState.form.detalle = preset.detalle
    if (preset.importe) formState.form.importe = String(preset.importe)
    if (preset.cuenta_id) formState.form.cuenta_id = String(preset.cuenta_id)
    if (preset.socio_id) formState.form.socio_id = String(preset.socio_id)
    if (preset.persona_id) formState.form.persona_id = String(preset.persona_id)
  }

  const cancelar = () => {
    formState.setForm(null)
    formState.setSelectedId(null)
  }

  const validate = () => {
    if (!relatedData.ejercicio && (!relatedData.ejercicios || relatedData.ejercicios.length === 0)) {
      return 'No hay ejercicio en curso. Activá uno en "Institucional".'
    }
    if (!formState.form?.fecha) return 'Completá la fecha.'
    // No se pueden cargar movimientos con fecha futura.
    const fechaMov = new Date(formState.form.fecha + 'T00:00:00')
    const hoy = new Date()
    hoy.setHours(23, 59, 59, 999)
    if (fechaMov > hoy) return 'No se pueden cargar movimientos con fecha futura.'
    if (!formState.form?.tipo_movimiento) return 'Elegí el tipo de movimiento.'
    if (!formState.form?.importe || Number(formState.form.importe) <= 0) return 'Completá el importe (mayor a 0).'
    if (!formState.form?.cuenta_id) return 'Elegí la caja/cuenta.'
    if (formState.form.tipo_movimiento !== 'Traspaso') {
      if (!formState.form?.rubro_id) return 'Elegí el rubro.'
    }
    if (formState.form.tipo_movimiento === 'Traspaso') {
      if (!formState.form?.cuenta_destino_id) return 'Elegí la cuenta destino.'
      if (Number(formState.form.cuenta_destino_id) === Number(formState.form.cuenta_id)) return 'La cuenta destino no puede ser la misma.'
    }
    return ''
  }

  const saveMovimiento = async () => {
    base.clearMessages()
    formState.setAdvertenciaCierreManual('')
    const v = validate()
    if (v) {
      base.setError(v)
      return null
    }

    try {
      const cuentaById = buildMapById(relatedData.cuentas)
      const cuenta = cuentaById.get(Number(formState.form.cuenta_id))
      const isBanco = String(cuenta?.nombre_cuenta || '') === 'Banco'

      // Fix F-H3: advertencia si el período del movimiento tiene un total
      // declarado manualmente. No bloquea el guardado — solo informa que el
      // total manual dejará de usarse (regla "detalle gana").
      const periodoMov = String(formState.form.fecha || '').slice(0, 7) // YYYY-MM
      const cierreManual = cierresService.buscarCierreManual(periodoMov)
      if (cierreManual) {
        formState.setAdvertenciaCierreManual(
          'Este período tenía un total declarado manualmente. Al cargar este movimiento, ese total se dejará de usar y el período se calculará desde el detalle.'
        )
      }

      const form = formState.form
      // Determinar ejercicio_id:
      // - Edición de existente: mantener el ejercicio_id original (no pisarlo).
      // - Nuevo movimiento: resolver desde la fecha (qué ejercicio contiene
      //   esa fecha). Fallback al en_curso si no hay match.
      const ejercicioId = form.id
        ? (form.ejercicio_id || resolveEjercicioId(form.fecha, relatedData.ejercicios))
        : resolveEjercicioId(form.fecha, relatedData.ejercicios)
      const fields = {
        ...form,
        ejercicio_id: ejercicioId,
        importe: Number(form.importe),
        rubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.rubro_id || ''),
        subrubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.subrubro_id || ''),
        destino_bancario: isBanco ? (form.destino_bancario || '') : '',
        cuenta_destino_id: form.tipo_movimiento === 'Traspaso' ? (form.cuenta_destino_id || '') : '',
        socio_id: form.tipo_movimiento === 'Entrada' ? (form.socio_id || '') : '',
        persona_id: form.tipo_movimiento !== 'Traspaso' ? (form.persona_id || '') : '',
        creado_por: relatedData.userName,
        creado_el: new Date().toISOString(),
        comprobante: toAttachmentCellValue(form.comprobante || []),
      }

      delete fields.id

      const record = { ...form, ...fields }
      const result = await base.save(record)

      if (form.id) {
        const updated = base.records.find((m) => m.id === form.id)
        if (updated) select(updated)
      } else {
        formState.setForm(null)
      }
      return result
    } catch (e) {
      base.setError(e?.message || String(e))
      return null
    }
  }

  const onTipoChange = () => {
    formState.form.rubro_id = ''
    formState.form.subrubro_id = ''
    formState.form.socio_id = ''
    formState.form.persona_id = ''
    formState.setFiltroCategoria('')
  }

  const onRubroChange = () => {
    const subrubrosByRubro = new Map()
    for (const s of relatedData.subrubros) {
      const k = Number(s.rubro_id)
      if (!subrubrosByRubro.has(k)) subrubrosByRubro.set(k, [])
      subrubrosByRubro.get(k).push(s)
    }
    const list = subrubrosByRubro.get(Number(formState.form.rubro_id)) || []
    if (list.length === 0) {
      formState.form.subrubro_id = ''
    } else {
      const exists = list.some((s) => Number(s.id) === Number(formState.form.subrubro_id))
      if (!exists) formState.form.subrubro_id = ''
    }
    // Limpiar persona/socio seleccionado y filtro porque puede cambiar el tipo de filtro
    formState.form.socio_id = ''
    formState.form.persona_id = ''
    formState.setFiltroCategoria('')
  }

  return {
    select,
    nuevo,
    nuevoCuotaSocietaria,
    nuevoConPreset,
    cancelar,
    validate,
    saveMovimiento,
    onTipoChange,
    onRubroChange,
  }
}
