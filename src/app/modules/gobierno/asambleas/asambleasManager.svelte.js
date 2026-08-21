import { fetchRecords, applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, dateToInput } from '$core/utils/utils.js'
import { extractRowId } from '$app/modules/comunidad/personas/personasApi.js'

/**
 * Gestión de asambleas: CRUD de asambleas + resoluciones.
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTAsambleas - Getter reactivo del tableId de asambleas
 * @param {() => any | null} deps.getTResoluciones - Getter reactivo del tableId de resoluciones
 * @param {() => any | null} deps.getTAutoridades - Getter reactivo del tableId de autoridades
 * @param {() => any | null} deps.getEjercicio - Getter reactivo del ejercicio en curso
 * @param {() => any[]} deps.getAsambleas - Getter reactivo de asambleas
 * @param {() => any[]} deps.getAutoridades - Getter reactivo de autoridades
 * @param {() => Promise<void>} deps.loadAsambleas - Callback para recargar asambleas
 * @param {() => Promise<void>} deps.loadAutoridades - Callback para recargar autoridades
 * @param {object} deps.bs - Base state (setLoading, setError, setNotice, clearMessages, setBusy)
 * @returns {{
 *   selectedAsambleaId: any, asambleaForm: any | null, resoluciones: any[],
 *   editAsamblea: (a: any) => Promise<void>,
 *   newAsamblea: (tipo?: string) => void,
 *   addResolucion: () => void,
 *   removeResolucion: (idx: number) => void,
 *   saveAsamblea: () => Promise<any>,
 *   deleteAsamblea: (asambleaId: any) => Promise<void>,
 *   getLinkedAutoridadesCount: (asambleaId: any) => number,
 * }}
 */
export function createAsambleasManager({ getTAsambleas, getTResoluciones, getTAutoridades, getEjercicio, getAsambleas, getAutoridades, loadAsambleas, loadAutoridades, bs, onReformaEstatuto }) {
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
      motivo_convocatoria: a?.motivo_convocatoria || '',
      orden_del_dia: a?.orden_del_dia || '',
      convocatoria_origen: a?.convocatoria_origen || '',
      verificada: Boolean(a?.verificada),
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
      motivo_convocatoria: '',
      orden_del_dia: '',
      convocatoria_origen: '',
      verificada: false,
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

  const saveAsamblea = async (opts = {}) => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      const tAsambleas = getTAsambleas()
      if (!tAsambleas) {
        bs.setError('No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.')
        return null
      }
      const ejercicio = getEjercicio()
      if (!ejercicio || !ejercicio.id) {
        bs.setError('No hay ejercicio activo. Configurá el ejercicio en la pantalla de Inicio.')
        return null
      }
      const f = asambleaForm || {}

      // Validar: no permitir modificar una asamblea verificada (irreversible)
      if (f.id && f.verificada && !opts.verificar) {
        bs.setError('Esta asamblea está verificada y no se puede modificar. Para corregirla, eliminála y creála de nuevo.')
        return null
      }

      // Validar: solo 1 AGO por año calendario
      if (f.tipo_asamblea === 'AGO' && f.fecha) {
        const year = String(f.fecha).slice(0, 4)
        const asambleas = getAsambleas()
        const existeAgoEseAnio = asambleas.find(
          (a) =>
            a.tipo_asamblea === 'AGO' &&
            String(a.fecha).slice(0, 4) === year &&
            Number(a.id) !== Number(f.id),
        )
        if (existeAgoEseAnio) {
          bs.setError(`Ya existe una Asamblea Ordinaria en ${year} (fecha ${existeAgoEseAnio.fecha}). Solo puede haber una por año.`)
          return null
        }
      }

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
        motivo_convocatoria: f.motivo_convocatoria || '',
        orden_del_dia: f.orden_del_dia || '',
        convocatoria_origen: f.convocatoria_origen || '',
        verificada: Boolean(f.verificada),
      })

      let asambleaId = f.id
      if (f.id) {
        await applyUserActions([['UpdateRecord', tAsambleas, f.id, fields]])
        bs.setNotice('Reunión guardada.')
      } else {
        const res = await applyUserActions([['AddRecord', tAsambleas, null, fields]])
        asambleaId = extractRowId(res)
        asambleaForm = { ...asambleaForm, id: asambleaId }
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
      // Si es una AGE con motivo "Reforma estatuto", desbloquear la edición
      // de los cargos del estatuto en Institucional (baja el flag
      // cargos_validados de la configuración).
      if (f.tipo_asamblea === 'AGE' && f.motivo_convocatoria === 'Reforma estatuto' && onReformaEstatuto) {
        try { await onReformaEstatuto() } catch (e) { console.warn('[asamblea] No se pudo desbloquear cargos:', e?.message || e) }
      }
      if (!f.id && !opts.keepForm) asambleaForm = null
      return asambleaId
    } catch (e) {
      bs.setError(e?.message || String(e))
      return null
    } finally {
      bs.setBusy(false)
    }
  }

  // Verificar asamblea: valida que tenga acta_numero Y autoridades cargadas,
  // luego marca verificada=true (irreversible — bloquea edición futura).
  const verificarAsamblea = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      const f = asambleaForm || {}
      if (!f.id) {
        bs.setError('Guardá la asamblea antes de verificarla.')
        return null
      }
      // Validar acta_numero
      if (!String(f.acta_numero || '').trim()) {
        bs.setError('Para verificar la asamblea debe tener número de acta cargado.')
        return null
      }
      // Validar autoridades vinculadas
      const linkedCount = getLinkedAutoridadesCount(f.id)
      if (linkedCount === 0) {
        bs.setError('Para verificar la asamblea debe tener autoridades cargadas.')
        return null
      }
      const tAsambleas = getTAsambleas()
      await applyUserActions([['UpdateRecord', tAsambleas, f.id, normalizeFields({
        verificada: true,
      })]])
      asambleaForm = { ...asambleaForm, verificada: true }
      bs.setNotice('Asamblea verificada. La edición quedó bloqueada.')
      await loadAsambleas()
      return f.id
    } catch (e) {
      bs.setError(e?.message || String(e))
      return null
    } finally {
      bs.setBusy(false)
    }
  }

  const getLinkedAutoridadesCount = (asambleaId) => {
    const autoridades = getAutoridades()
    return autoridades.filter(
      (au) => Number(au.asamblea_id) === Number(asambleaId),
    ).length
  }

  const deleteAsamblea = async (asambleaId) => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      // No permitir eliminar una asamblea verificada
      const asambleas = getAsambleas()
      const target = asambleas.find((a) => Number(a.id) === Number(asambleaId))
      if (target?.verificada) {
        bs.setError('Esta asamblea está verificada y no se puede eliminar.')
        return
      }
      const tAsambleas = getTAsambleas()
      const tResoluciones = getTResoluciones()
      const tAutoridades = getTAutoridades()
      if (!tAsambleas) {
        bs.setError('No se encontró la tabla asambleas.')
        return
      }

      const actions = []

      // Eliminar resoluciones vinculadas
      if (tResoluciones) {
        const resol = await fetchRecords(tResoluciones, {
          filter: (r) => Number(r.asamblea_id) === Number(asambleaId),
        })
        for (const r of resol) {
          actions.push(['RemoveRecord', tResoluciones, r.id])
        }
      }

      // Eliminar autoridades vinculadas
      if (tAutoridades) {
        const auths = await fetchRecords(tAutoridades, {
          filter: (au) => Number(au.asamblea_id) === Number(asambleaId),
        })
        for (const au of auths) {
          actions.push(['RemoveRecord', tAutoridades, au.id])
        }
      }

      // Eliminar la asamblea
      actions.push(['RemoveRecord', tAsambleas, asambleaId])

      await applyUserActions(actions)
      bs.setNotice('Reunión eliminada.')
      asambleaForm = null
      selectedAsambleaId = null
      await loadAsambleas()
      if (loadAutoridades) await loadAutoridades()
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
    verificarAsamblea,
    deleteAsamblea,
    getLinkedAutoridadesCount,
  }
}
