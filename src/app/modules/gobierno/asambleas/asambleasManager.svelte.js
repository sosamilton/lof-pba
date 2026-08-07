import { fetchRecords, applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, dateToInput } from '$core/utils/utils.js'
import { extractRowId } from '$app/modules/comunidad/personas/personasApi.js'

/**
 * Gestión de asambleas: CRUD de asambleas + resoluciones.
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTAsambleas - Getter reactivo del tableId de asambleas
 * @param {() => any | null} deps.getTResoluciones - Getter reactivo del tableId de resoluciones
 * @param {() => any | null} deps.getEjercicio - Getter reactivo del ejercicio en curso
 * @param {() => any[]} deps.getAsambleas - Getter reactivo de asambleas
 * @param {() => Promise<void>} deps.loadAsambleas - Callback para recargar asambleas
 * @param {object} deps.bs - Base state (setLoading, setError, setNotice, clearMessages, setBusy)
 * @returns {{
 *   selectedAsambleaId: any, asambleaForm: any | null, resoluciones: any[],
 *   editAsamblea: (a: any) => Promise<void>,
 *   newAsamblea: (tipo?: string) => void,
 *   addResolucion: () => void,
 *   removeResolucion: (idx: number) => void,
 *   saveAsamblea: () => Promise<void>,
 * }}
 */
export function createAsambleasManager({ getTAsambleas, getTResoluciones, getEjercicio, getAsambleas, loadAsambleas, bs }) {
  let selectedAsambleaId = $state(null)
  let asambleaForm = $state(null)
  let resoluciones = $state([])

  const editAsamblea = async (a) => {
    selectedAsambleaId = a?.id || null
    asambleaForm = {
      id: a?.id || null,
      fecha: dateToInput(a?.fecha),
      tipo_asamblea: a?.tipo_asamblea || 'AGO',
      acta_numero: a?.acta_numero || '',
      acta_fojas: a?.acta_fojas || '',
      socios_presentes_cantidad: a?.socios_presentes_cantidad ?? '',
      cuota_social_importe: a?.cuota_social_importe ?? '',
      cuota_social_modalidad: a?.cuota_social_modalidad || 'Mensual',
      caja_chica_importe: a?.caja_chica_importe ?? '',
    }
    const tResoluciones = getTResoluciones()
    if (a?.id && tResoluciones) {
      const recs = await fetchRecords(tResoluciones, {
        filter: (r) => Number(r.asamblea_id) === Number(a.id),
        sort: (x, y) => Number(x.numero || 0) - Number(y.numero || 0),
      })
      resoluciones = recs.map((r) => ({ id: r.id, numero: r.numero ?? '', texto: r.texto || '' }))
    } else {
      resoluciones = []
    }
  }

  const newAsamblea = (tipo = 'AGO') => {
    selectedAsambleaId = null
    asambleaForm = {
      id: null,
      fecha: new Date().toISOString().slice(0, 10),
      tipo_asamblea: tipo,
      acta_numero: '',
      acta_fojas: '',
      socios_presentes_cantidad: '',
      cuota_social_importe: '',
      cuota_social_modalidad: 'Mensual',
      caja_chica_importe: '',
    }
    resoluciones = []
  }

  const addResolucion = () => {
    const nextNum = resoluciones.length + 1
    resoluciones = [...resoluciones, { id: null, numero: nextNum, texto: '' }]
  }

  const removeResolucion = (idx) => {
    resoluciones = resoluciones
      .filter((_, i) => i !== idx)
      .map((r, i) => ({ ...r, numero: i + 1 }))
  }

  const saveAsamblea = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      const tAsambleas = getTAsambleas()
      if (!tAsambleas) {
        bs.setError('No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.')
        return
      }
      const ejercicio = getEjercicio()
      const f = asambleaForm || {}
      const fields = normalizeFields({
        fecha: f.fecha || '',
        tipo_asamblea: f.tipo_asamblea || '',
        acta_numero: String(f.acta_numero || '').trim(),
        acta_fojas: String(f.acta_fojas || '').trim(),
        ejercicio_id: ejercicio.id,
        socios_presentes_cantidad: f.socios_presentes_cantidad === '' ? '' : Number(f.socios_presentes_cantidad),
        cuota_social_importe: f.cuota_social_importe === '' ? '' : Number(f.cuota_social_importe),
        cuota_social_modalidad: f.cuota_social_modalidad || '',
        caja_chica_importe: f.caja_chica_importe === '' ? '' : Number(f.caja_chica_importe),
      })

      let asambleaId = f.id
      if (f.id) {
        await applyUserActions([['UpdateRecord', tAsambleas, f.id, fields]])
        bs.setNotice('Reunión guardada.')
      } else {
        const res = await applyUserActions([['AddRecord', tAsambleas, null, fields]])
        asambleaId = extractRowId(res)
        bs.setNotice('Reunión creada.')
      }

      const tResoluciones = getTResoluciones()
      if (asambleaId != null && tResoluciones) {
        const existing = await fetchRecords(tResoluciones, {
          filter: (r) => Number(r.asamblea_id) === Number(asambleaId),
        })
        const toRemove = existing
          .filter((r) => !resoluciones.some((nr) => nr.id === r.id))
          .map((r) => ['RemoveRecord', tResoluciones, r.id])
        const toUpdate = resoluciones
          .filter((r) => r.id != null && String(r.texto || '').trim())
          .map((r) => ['UpdateRecord', tResoluciones, r.id, {
            numero: Number(r.numero || 0),
            texto: String(r.texto).trim(),
          }])
        const toAdd = resoluciones
          .filter((r) => r.id == null && String(r.texto || '').trim())
          .map((r) => ['AddRecord', tResoluciones, null, {
            asamblea_id: asambleaId,
            numero: Number(r.numero || 0),
            texto: String(r.texto).trim(),
          }])
        const actions = [...toRemove, ...toUpdate, ...toAdd]
        if (actions.length > 0) await applyUserActions(actions)
      }

      await loadAsambleas()
      if (!f.id) asambleaForm = null
    } catch (e) {
      bs.setError(e?.message || String(e))
    } finally {
      bs.setBusy(false)
    }
  }

  return {
    get selectedAsambleaId() { return selectedAsambleaId },
    get asambleaForm() { return asambleaForm },
    get resoluciones() { return resoluciones },
    editAsamblea,
    newAsamblea,
    addResolucion,
    removeResolucion,
    saveAsamblea,
  }
}
