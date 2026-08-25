import { applyUserActions } from '$core/data/dataRepository'
import { normalizeFields, dateToInput, todayISO } from '$core/utils/utils.js'

/**
 * Registro de hechos relevantes para la Memoria anual.
 *
 * Cada hecho es un evento/actividad/decisión del ejercicio que después
 * se compila en el borrador de la Memoria. La Memoria en Buenos Aires
 * es "un simple texto escrito" (FAQ DGCyE), así que las categorías son
 * sugeridas pero no obligatorias.
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTHechos - Getter del tableId de hechos_relevantes
 * @param {() => any | null} deps.getEjercicio - Getter del ejercicio en curso
 * @param {() => Promise<void>} deps.loadHechos - Callback para recargar hechos
 * @param {object} deps.bs - Base state
 */
export function createHechosRelevantesManager({ getTHechos, getEjercicio, loadHechos, bs }) {
  let hechos = $state([])
  let hechoForm = $state(null)
  let editingId = $state(null)

  const CATEGORIAS = [
    'Evento',
    'Infraestructura',
    'Equipamiento',
    'Beneficios',
    'Actividades',
    'Proyecto educativo',
    'Otro',
  ]

  const newHecho = () => {
    const ej = getEjercicio()
    hechoForm = {
      fecha: todayISO(),
      categoria: 'Evento',
      descripcion: '',
      monto: '',
      documento_ref: '',
      ejercicio_id: ej?.id || null,
      asamblea_id: null,
    }
    editingId = null
  }

  const editHecho = (h) => {
    hechoForm = {
      id: h.id,
      fecha: dateToInput(h.fecha) || todayISO(),
      categoria: h.categoria || 'Otro',
      descripcion: h.descripcion || '',
      monto: h.monto ?? '',
      documento_ref: h.documento_ref || '',
      ejercicio_id: h.ejercicio_id || null,
      asamblea_id: h.asamblea_id || null,
    }
    editingId = h.id
  }

  const closeForm = () => {
    hechoForm = null
    editingId = null
  }

  const saveHecho = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      if (!hechoForm) return false
      if (!String(hechoForm.descripcion || '').trim()) {
        bs.setError('La descripción es obligatoria.')
        return false
      }
      const tHechos = getTHechos()
      if (!tHechos) {
        bs.setError('No se encontró la tabla de hechos relevantes.')
        return false
      }
      const fields = normalizeFields({
        fecha: hechoForm.fecha || '',
        categoria: hechoForm.categoria || 'Otro',
        descripcion: String(hechoForm.descripcion).trim(),
        monto: hechoForm.monto !== '' && hechoForm.monto != null ? Number(hechoForm.monto) : '',
        documento_ref: String(hechoForm.documento_ref || '').trim(),
        ejercicio_id: hechoForm.ejercicio_id || '',
        asamblea_id: hechoForm.asamblea_id || '',
      })
      if (editingId) {
        await applyUserActions([['UpdateRecord', tHechos, editingId, fields]])
        bs.setNotice('Hecho actualizado.')
      } else {
        await applyUserActions([['AddRecord', tHechos, null, fields]])
        bs.setNotice('Hecho registrado.')
      }
      await loadHechos()
      closeForm()
      return true
    } catch (e) {
      bs.setError(e?.message || String(e))
      return false
    } finally {
      bs.setBusy(false)
    }
  }

  const deleteHecho = async (id) => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      const tHechos = getTHechos()
      await applyUserActions([['RemoveRecord', tHechos, id]])
      bs.setNotice('Hecho eliminado.')
      await loadHechos()
    } catch (e) {
      bs.setError(e?.message || String(e))
    } finally {
      bs.setBusy(false)
    }
  }

  return {
    get hechos() { return hechos },
    set hechos(v) { hechos = v },
    get hechoForm() { return hechoForm },
    get editingId() { return editingId },
    get CATEGORIAS() { return CATEGORIAS },
    newHecho,
    editHecho,
    closeForm,
    saveHecho,
    deleteHecho,
  }
}
