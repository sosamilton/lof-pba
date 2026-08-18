import { applyUserActions, fetchRecords } from '$core/grist/grist'
import { normalizeFields, fechasEjercicio } from '$core/utils/utils'
import { crearEjercicioApi } from './cooperadoraApi.js'
import { notify } from '$core/ui/notify.svelte'

/**
 * Factory: sub-store para gestión de ejercicios y saldos iniciales.
 * @param {object} deps
 * @param {ReturnType<typeof import('$core/grist/stores/gristStore.svelte').createBaseState>} deps.bs
 * @param {() => string | null} deps.getTEjercicios
 * @param {() => string | null} deps.getTMovimientos
 * @returns {{
 *   ejercicios: any[], ejercicioEnCurso: any | null, nuevoEj: any, ejercicioEditando: any | null,
 *   createEjercicio: () => Promise<void>, setEjercicioEnCurso: (id: number) => Promise<void>,
 *   setEditandoEjercicio: (e: any) => void, cancelarEdicionEjercicio: () => void,
 *   tieneMovimientos: (id: number) => Promise<boolean>,
 *   saveEjercicio: () => Promise<void>, deleteEjercicio: (id: number) => Promise<void>,
 *   setOnSaldosChanged: (fn: (e: any) => void) => void,
 *   reload: (tEjercicios?: string) => Promise<void>,
 * }}
 */
export function createEjerciciosStore({ bs, getTEjercicios, getTMovimientos }) {
  /** @type {any[]} */
  let ejercicios = $state([])
  /** @type {Record<string, any> | null} */
  let ejercicioEnCurso = $state(null)
  let nuevoEj = $state({
    anio_inicio: '', anio_fin: '', mes_inicio: 'Mayo',
    saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0,
  })

  // Edición de saldos iniciales: copia del ejercicio que se edita.
  // Los inputs del dialog hacen bind sobre sus campos sin tocar el
  // registro real hasta que se guarda.
  /** @type {Record<string, any> | null} */
  let ejercicioEditando = $state(null)

  // Fix F5: callback que se ejecuta después de guardar saldos iniciales,
  // para que stores derivados (saldosStore, resumenStore) puedan recargar.
  /** @type {((e: any) => void) | null} */
  let _onSaldosChanged = null
  const setOnSaldosChanged = (fn) => { _onSaldosChanged = fn }

  const reload = async (tEj) => {
    const tid = tEj || getTEjercicios()
    if (!tid) return
    ejercicios = await fetchRecords(tid)
    ejercicioEnCurso = ejercicios.find((e) => e.en_curso === true) || null
  }

  const createEjercicio = async () => {
    await bs.wrapAsync(async () => {
      if (!getTEjercicios()) { bs.setError('No se encontró la tabla ejercicios.'); return }
      ejercicios = await crearEjercicioApi(nuevoEj, ejercicios)
      ejercicioEnCurso = ejercicios.find((e) => e.en_curso === true) || null
      bs.setNotice('Ejercicio creado.'); notify.success(bs.notice)
      nuevoEj = {
        anio_inicio: '', anio_fin: '', mes_inicio: nuevoEj.mes_inicio || 'Mayo',
        saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0,
      }
    })
  }

  const setEjercicioEnCurso = async (id) => {
    await bs.wrapAsync(async () => {
      const tEj = getTEjercicios()
      const actions = ejercicios.map((e) => ['UpdateRecord', tEj, e.id, { en_curso: e.id === id }])
      await applyUserActions(actions)
      await reload(tEj)
      bs.setNotice('Ejercicio actualizado.'); notify.success(bs.notice)
    })
  }

  const setEditandoEjercicio = (e) => {
    ejercicioEditando = e ? {
      id: e.id,
      anio_inicio: e.anio_inicio,
      anio_fin: e.anio_fin,
      mes_inicio: e.mes_inicio,
      fecha_inicio: e.fecha_inicio || '',
      fecha_fin: e.fecha_fin || '',
      observaciones: e.observaciones || '',
      saldo_inicial_banco: Number(e.saldo_inicial_banco) || 0,
      saldo_inicial_efectivo: Number(e.saldo_inicial_efectivo) || 0,
      saldo_inicial_caja_chica: Number(e.saldo_inicial_caja_chica) || 0,
    } : null
  }

  const cancelarEdicionEjercicio = () => { ejercicioEditando = null }

  // Verifica si un ejercicio tiene al menos un movimiento detallado.
  // Usa limit:1 para no cargar todos los registros.
  const tieneMovimientos = async (ejercicioId) => {
    const tMov = getTMovimientos()
    if (!tMov || ejercicioId == null) return false
    try {
      const rows = await fetchRecords(tMov, {
        filter: (m) => Number(m.ejercicio_id) === Number(ejercicioId),
        limit: 1,
      })
      return rows.length > 0
    } catch { return false }
  }

  const saveEjercicio = async () => {
    await bs.wrapAsync(async () => {
      const tEj = getTEjercicios()
      if (!tEj) { bs.setError('No se encontró la tabla ejercicios.'); return }
      if (!ejercicioEditando) return
      // Autocalcular fecha_inicio/fecha_fin si no vienen provistos explícitamente.
      const { fechaInicio, fechaFin } = fechasEjercicio(ejercicioEditando)
      const fields = normalizeFields({
        anio_inicio: Number(ejercicioEditando.anio_inicio) || null,
        anio_fin: Number(ejercicioEditando.anio_fin) || null,
        mes_inicio: ejercicioEditando.mes_inicio || 'Mayo',
        fecha_inicio: ejercicioEditando.fecha_inicio || fechaInicio || null,
        fecha_fin: ejercicioEditando.fecha_fin || fechaFin || null,
        observaciones: ejercicioEditando.observaciones || '',
        saldo_inicial_banco: Number(ejercicioEditando.saldo_inicial_banco) || 0,
        saldo_inicial_efectivo: Number(ejercicioEditando.saldo_inicial_efectivo) || 0,
        saldo_inicial_caja_chica: Number(ejercicioEditando.saldo_inicial_caja_chica) || 0,
      })
      await applyUserActions([['UpdateRecord', tEj, ejercicioEditando.id, fields]])
      await reload(tEj)
      const ejercicioGuardado = ejercicioEnCurso
      ejercicioEditando = null
      // Fix F5: notificar a stores derivados para que recarguen.
      if (typeof _onSaldosChanged === 'function') {
        try { await _onSaldosChanged(ejercicioGuardado) } catch { /* no-op */ }
      }
      bs.setNotice('Ejercicio guardado.'); notify.success(bs.notice)
    })
  }

  const deleteEjercicio = async (id) => {
    await bs.wrapAsync(async () => {
      const tEj = getTEjercicios()
      if (!tEj) { bs.setError('No se encontró la tabla ejercicios.'); return }
      if (id == null) return
      const tiene = await tieneMovimientos(id)
      if (tiene) {
        bs.setError('No se puede eliminar un ejercicio con movimientos asociados.')
        notify.error(bs.error); return
      }
      const ej = ejercicios.find((e) => Number(e.id) === Number(id))
      if (ej?.en_curso) {
        bs.setError('No se puede eliminar el ejercicio en curso. Activá otro primero.')
        notify.error(bs.error); return
      }
      await applyUserActions([['RemoveRecord', tEj, id]])
      await reload(tEj)
      bs.setNotice('Ejercicio eliminado.'); notify.success(bs.notice)
    })
  }

  return {
    get ejercicios() { return ejercicios },
    get ejercicioEnCurso() { return ejercicioEnCurso },
    get nuevoEj() { return nuevoEj },
    set nuevoEj(v) { nuevoEj = v },
    get ejercicioEditando() { return ejercicioEditando },
    createEjercicio,
    setEjercicioEnCurso,
    setEditandoEjercicio,
    cancelarEdicionEjercicio,
    tieneMovimientos,
    saveEjercicio,
    deleteEjercicio,
    setOnSaldosChanged,
    reload,
  }
}
