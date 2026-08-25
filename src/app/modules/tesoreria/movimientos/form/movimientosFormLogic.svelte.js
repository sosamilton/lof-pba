import { dateToInput, buildMapById, normalize, todayISO } from '$core/utils/utils.js'
import { extractAttachmentIds, toAttachmentCellValue } from '$core/data/dataRepository'

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
    formState.setForm({
      id: null,
      fecha: today,
      tipo_movimiento: 'Entrada',
      rubro_id: '',
      subrubro_id: '',
      detalle: '',
      importe: '',
      cuenta_id: relatedData.cuentaDefaultId || '',
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

  const cancelar = () => {
    formState.setForm(null)
    formState.setSelectedId(null)
  }

  const validate = () => {
    if (!relatedData.ejercicio) return 'No hay ejercicio en curso. Activá uno en "Institucional".'
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
      const fields = {
        ...form,
        ejercicio_id: relatedData.ejercicio.id,
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
    cancelar,
    validate,
    saveMovimiento,
    onTipoChange,
    onRubroChange,
  }
}
