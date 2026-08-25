import { resolveTableIds } from '$core/data/dataStore.svelte'
import { fetchRecords, applyUserActions } from '$core/data/dataRepository'
import { normalizeFields } from '$core/utils/utils.js'
import { generarPeriodosEjercicio, periodoActualKey, agruparPeriodo } from '../shared/tesoreriaCalc.js'

/**
 * Servicio CRUD para la entidad `cargas` (cargas consolidadas).
 * Una carga agrupa un conjunto de movimientos consolidados por rubro para
 * un período dado. Puede estar en estado 'borrador' o 'firmado'.
 *
 * @param {object} deps
 * @param {object} deps.relatedData - Datos relacionados (ejercicio, userName)
 * @param {object} deps.base - Store base (load, setError, clearMessages, setNotice)
 * @returns {{
 *   loadCargas: () => Promise<any[]>,
 *   crearCarga: (periodo: string, observaciones?: string) => Promise<any | null>,
 *   firmarCarga: (cargaId: number) => Promise<boolean>,
 *   reabrirCarga: (cargaId: number, motivo: string) => Promise<boolean>,
 *   eliminarCarga: (cargaId: number) => Promise<boolean>,
 *   getCarga: (cargaId: number) => any | null,
 * }}
 */
export function createCargasService({ relatedData, base }) {
  let cargas = $state([])

  /**
   * Carga todas las cargas del ejercicio en curso.
   * @returns {Promise<any[]>}
   */
  const loadCargas = async () => {
    if (!relatedData.ejercicio) { cargas = []; return [] }
    const tIds = await resolveTableIds(['cargas'])
    const tableId = tIds.cargas
    if (!tableId) { cargas = []; return [] }
    const ejId = Number(relatedData.ejercicio.id)
    const recs = await fetchRecords(tableId, {
      filter: (c) => Number(c.ejercicio_id) === ejId,
      sort: (a, b) => String(b.periodo || '').localeCompare(String(a.periodo || '')),
    })
    cargas = recs
    return recs
  }

  /**
   * Crea una nueva carga para un período.
   * @param {string} periodo - 'YYYY-MM'
   * @param {string} [observaciones]
   * @returns {Promise<any | null>} La carga creada o null si falló
   */
  const crearCarga = async (periodo, observaciones = '') => {
    base.clearMessages()
    if (!relatedData.ejercicio) { base.setError('No hay ejercicio en curso.'); return null }
    if (!periodo) { base.setError('Faltó el período.'); return null }

    // No se pueden crear cargas para períodos futuros.
    const per = relatedData.periodicidad || 'mensual'
    const periodosEj = generarPeriodosEjercicio(relatedData.ejercicio, per)
    const idxSolicitado = periodosEj.indexOf(String(periodo))
    const periodoHoy = periodoActualKey(per, relatedData.ejercicio)
    const idxHoy = periodosEj.indexOf(periodoHoy)
    if (idxSolicitado >= 0 && idxHoy >= 0 && idxSolicitado > idxHoy) {
      base.setError('No se pueden crear cargas para períodos futuros.')
      return null
    }

    try {
      const tIds = await resolveTableIds(['cargas'])
      const tableId = tIds.cargas
      if (!tableId) { base.setError('No se encontró la tabla cargas.'); return null }

      const fields = normalizeFields({
        ejercicio_id: Number(relatedData.ejercicio.id),
        periodo: String(periodo),
        estado: 'borrador',
        fecha_creacion: new Date().toISOString(),
        creado_por: relatedData.userName,
        observaciones: observaciones || '',
        version: 1,
      })
      const res = await applyUserActions([['AddRecord', tableId, null, fields]])
      const rowId = res?.retValues?.[0] ?? null
      const nueva = { id: rowId, ...fields }
      cargas = [nueva, ...cargas]
      base.setNotice(`Carga creada para ${periodo}.`)
      return nueva
    } catch (e) {
      base.setError(e?.message || String(e))
      return null
    }
  }

  /**
   * Firma una carga: cambia estado a 'firmado' y registra fecha/usuario.
   * @param {number} cargaId
   * @returns {Promise<boolean>}
   */
  const firmarCarga = async (cargaId) => {
    base.clearMessages()
    try {
      const tIds = await resolveTableIds(['cargas'])
      const tableId = tIds.cargas
      if (!tableId) { base.setError('No se encontró la tabla cargas.'); return false }

      await applyUserActions([['UpdateRecord', tableId, Number(cargaId), normalizeFields({
        estado: 'firmado',
        fecha_firma: new Date().toISOString(),
        firmado_por: relatedData.userName,
      })]])
      cargas = cargas.map((c) =>
        Number(c.id) === Number(cargaId)
          ? { ...c, estado: 'firmado', fecha_firma: new Date().toISOString(), firmado_por: relatedData.userName }
          : c
      )
      base.setNotice('Carga firmada.')
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return false
    }
  }

  /**
   * Reabre una carga firmada: vuelve a 'borrador' con motivo.
   * @param {number} cargaId
   * @param {string} motivo
   * @returns {Promise<boolean>}
   */
  const reabrirCarga = async (cargaId, motivo) => {
    base.clearMessages()
    try {
      const tIds = await resolveTableIds(['cargas'])
      const tableId = tIds.cargas
      if (!tableId) { base.setError('No se encontró la tabla cargas.'); return false }

      await applyUserActions([['UpdateRecord', tableId, Number(cargaId), normalizeFields({
        estado: 'borrador',
        observaciones: motivo,
      })]])
      cargas = cargas.map((c) =>
        Number(c.id) === Number(cargaId)
          ? { ...c, estado: 'borrador', observaciones: motivo }
          : c
      )
      base.setNotice('Carga reabierta.')
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return false
    }
  }

  /**
   * Elimina una carga y todos sus movimientos asociados.
   * @param {number} cargaId
   * @returns {Promise<boolean>}
   */
  const eliminarCarga = async (cargaId) => {
    base.clearMessages()
    try {
      const tIds = await resolveTableIds(['cargas', 'movimientos'])
      const tCargas = tIds.cargas
      const tMov = tIds.movimientos
      if (!tCargas) { base.setError('No se encontró la tabla cargas.'); return false }

      // Borrar los movimientos asociados a esta carga
      const actions = []
      if (tMov) {
        const movs = await fetchRecords(tMov, {
          filter: (m) => Number(m.carga_id) === Number(cargaId),
        })
        for (const m of movs) {
          actions.push(['RemoveRecord', tMov, Number(m.id)])
        }
      }
      // Borrar la carga
      actions.push(['RemoveRecord', tCargas, Number(cargaId)])
      await applyUserActions(actions)
      cargas = cargas.filter((c) => Number(c.id) !== Number(cargaId))
      base.setNotice('Carga eliminada.')
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return false
    }
  }

  /**
   * Obtiene una carga del cache local por ID.
   * @param {number} cargaId
   * @returns {any | null}
   */
  const getCarga = (cargaId) => {
    return cargas.find((c) => Number(c.id) === Number(cargaId)) || null
  }

  /**
   * Migra movimientos existentes sin carga_id: agrupa por período y crea
   * una carga por cada grupo. Solo procesa movimientos del ejercicio en curso.
   * @returns {Promise<{ cargasCreadas: number, movimientosVinculados: number }>}
   */
  const migrarCargasLegacy = async () => {
    if (!relatedData.ejercicio) return { cargasCreadas: 0, movimientosVinculados: 0 }
    try {
      const tIds = await resolveTableIds(['cargas', 'movimientos'])
      const tCargas = tIds.cargas
      const tMov = tIds.movimientos
      if (!tCargas || !tMov) return { cargasCreadas: 0, movimientosVinculados: 0 }

      const ejId = Number(relatedData.ejercicio.id)
      // Buscar movimientos del ejercicio sin carga_id
      const allMovs = await fetchRecords(tMov, {
        filter: (m) => Number(m.ejercicio_id) === ejId && !m.carga_id,
      })
      if (allMovs.length === 0) return { cargasCreadas: 0, movimientosVinculados: 0 }

      // Agrupar por período
      const porPeriodo = new Map()
      for (const m of allMovs) {
        const p = String(m.periodo || '')
        if (!p) continue
        if (!porPeriodo.has(p)) porPeriodo.set(p, [])
        porPeriodo.get(p).push(m)
      }

      // Verificar qué períodos ya tienen cargas (para no duplicar)
      const cargasExistentes = await fetchRecords(tCargas, {
        filter: (c) => Number(c.ejercicio_id) === ejId,
      })
      const periodosConCarga = new Set(cargasExistentes.map((c) => String(c.periodo || '')))

      const actions = []
      let cargasCreadas = 0
      let movimientosVinculados = 0
      const nuevasCargasIds = new Map() // periodo → cargaId

      for (const [periodo, movs] of porPeriodo) {
        if (periodosConCarga.has(periodo)) {
          // Ya existe una carga para este período: vincular los movimientos a esa carga
          const cargaExistente = cargasExistentes.find((c) => String(c.periodo) === periodo)
          if (cargaExistente) {
            for (const m of movs) {
              actions.push(['UpdateRecord', tMov, Number(m.id), { carga_id: Number(cargaExistente.id) }])
              movimientosVinculados++
            }
          }
          continue
        }
        // Crear una carga nueva para este período
        const cargaFields = normalizeFields({
          ejercicio_id: ejId,
          periodo: periodo,
          estado: 'borrador',
          fecha_creacion: new Date().toISOString(),
          creado_por: relatedData.userName,
          observaciones: 'Migración automática',
          version: 1,
        })
        actions.push(['AddRecord', tCargas, null, cargaFields])
        cargasCreadas++
        // Los movimientos se vincularán después de saber el ID de la carga
        nuevasCargasIds.set(periodo, actions.length - 1) // índice en actions
        movimientosVinculados += movs.length
      }

      if (actions.length > 0) {
        const res = await applyUserActions(actions)
        // Vincular los movimientos a las cargas recién creadas
        if (res?.retValues && nuevasCargasIds.size > 0) {
          const vincularActions = []
          let actionIdx = 0
          for (const [periodo, idxInActions] of nuevasCargasIds) {
            // El retValues corresponde al orden de las acciones AddRecord
            // Necesitamos encontrar el retValue correcto
            const cargaId = res.retValues[idxInActions]
            if (cargaId) {
              const movs = porPeriodo.get(periodo)
              for (const m of movs) {
                vincularActions.push(['UpdateRecord', tMov, Number(m.id), { carga_id: Number(cargaId) }])
              }
            }
          }
          if (vincularActions.length > 0) {
            await applyUserActions(vincularActions)
          }
        }
      }

      await loadCargas()
      return { cargasCreadas, movimientosVinculados }
    } catch (e) {
      base.setError(e?.message || String(e))
      return { cargasCreadas: 0, movimientosVinculados: 0 }
    }
  }

  // Helper: filtra cargas del ejercicio cuyo período mapea al periodoKey agrupado.
  const cargasDelBloque = (periodoKey) => {
    const ejId = Number(relatedData.ejercicio.id)
    const periodicidad = relatedData.periodicidad || 'mensual'
    const ej = relatedData.ejercicio
    return cargas.filter((c) => {
      if (Number(c.ejercicio_id) !== ejId) return false
      const rawP = String(c.periodo || '')
      if (!rawP) return false
      const p = (periodicidad !== 'mensual' && periodicidad !== 'semanal' && ej)
        ? agruparPeriodo(rawP, periodicidad, ej)
        : rawP
      return p === String(periodoKey)
    })
  }

  /**
   * Cierra un período: firma todas las cargas en borrador de ese período y
   * crea/actualiza el cierre_mensuales con firmado=true. Después de esto,
   * no se pueden crear cargas nuevas ni editar movimientos para ese período.
   * @param {string} periodoKey - 'YYYY-MM' (o agrupado según periodicidad)
   * @returns {Promise<boolean>}
   */
  const cerrarPeriodo = async (periodoKey) => {
    base.clearMessages()
    if (!relatedData.ejercicio) { base.setError('No hay ejercicio en curso.'); return false }
    if (!periodoKey) { base.setError('Faltó el período.'); return false }
    try {
      const tIds = await resolveTableIds(['cargas', 'cierres_mensuales'])
      const tCargas = tIds.cargas
      const tCierres = tIds.cierres_mensuales
      if (!tCargas) { base.setError('No se encontró la tabla cargas.'); return false }

      const ejId = Number(relatedData.ejercicio.id)
      const now = new Date().toISOString()

      // 1. Firmar todas las cargas en borrador del período (agrupado)
      const cargasPeriodo = cargasDelBloque(periodoKey)
      const actions = []
      for (const c of cargasPeriodo) {
        if (c.estado !== 'firmado') {
          actions.push(['UpdateRecord', tCargas, Number(c.id), normalizeFields({
            estado: 'firmado',
            fecha_firma: now,
            firmado_por: relatedData.userName,
          })])
        }
      }

      // 2. Crear o actualizar cierre_mensuales con firmado=true
      if (tCierres) {
        const cierresExistentes = await fetchRecords(tCierres, {
          filter: (cl) => Number(cl.ejercicio_id) === ejId && String(cl.periodo || '') === String(periodoKey),
        })
        const cierreFields = normalizeFields({
          periodo: String(periodoKey),
          ejercicio_id: ejId,
          firmado: true,
          firmado_por: relatedData.userName,
          firmado_el: now,
        })
        if (cierresExistentes.length > 0) {
          actions.push(['UpdateRecord', tCierres, Number(cierresExistentes[0].id), cierreFields])
        } else {
          actions.push(['AddRecord', tCierres, null, cierreFields])
        }
      }

      if (actions.length > 0) await applyUserActions(actions)

      // Actualizar estado local (todas las cargas del bloque)
      const idsBloque = new Set(cargasPeriodo.map((c) => Number(c.id)))
      cargas = cargas.map((c) =>
        idsBloque.has(Number(c.id))
          ? { ...c, estado: 'firmado', fecha_firma: now, firmado_por: relatedData.userName }
          : c
      )

      // Crear automáticamente una carga en borrador para el próximo período
      // del ejercicio, si existe y no tiene ya una carga creada.
      const periodosEj = generarPeriodosEjercicio(relatedData.ejercicio, relatedData.periodicidad || 'mensual')
      const idxActual = periodosEj.indexOf(String(periodoKey))
      if (idxActual >= 0 && idxActual < periodosEj.length - 1) {
        const proximoPeriodo = periodosEj[idxActual + 1]
        const yaTieneCarga = cargas.some(
          (c) => Number(c.ejercicio_id) === ejId && String(c.periodo || '') === proximoPeriodo
        )
        if (!yaTieneCarga) {
          const fieldsProximo = normalizeFields({
            ejercicio_id: ejId,
            periodo: proximoPeriodo,
            estado: 'borrador',
            fecha_creacion: now,
            creado_por: relatedData.userName,
          })
          await applyUserActions([['AddRecord', tCargas, null, fieldsProximo]])
          // Recargar cargas para incluir la nueva
          const recs = await fetchRecords(tCargas, {
            filter: (c) => Number(c.ejercicio_id) === ejId,
            sort: (a, b) => String(b.periodo || '').localeCompare(String(a.periodo || '')),
          })
          cargas = recs
          base.setNotice(`Período ${periodoKey} firmado y cerrado. Se creó la carga del período ${proximoPeriodo}.`)
        } else {
          base.setNotice(`Período ${periodoKey} firmado y cerrado.`)
        }
      } else {
        base.setNotice(`Período ${periodoKey} firmado y cerrado. Es el último período del ejercicio.`)
      }
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return false
    }
  }

  /**
   * Reabre un período firmado: pasa todas sus cargas a borrador y marca
   * el cierre_mensuales como no firmado.
   * @param {string} periodoKey - 'YYYY-MM' (o agrupado según periodicidad)
   * @param {string} motivo - Motivo de la reapertura
   * @returns {Promise<boolean>}
   */
  const reabrirPeriodo = async (periodoKey, motivo) => {
    base.clearMessages()
    if (!relatedData.ejercicio) { base.setError('No hay ejercicio en curso.'); return false }
    if (!periodoKey) { base.setError('Faltó el período.'); return false }
    try {
      const tIds = await resolveTableIds(['cargas', 'cierres_mensuales'])
      const tCargas = tIds.cargas
      const tCierres = tIds.cierres_mensuales
      if (!tCargas) { base.setError('No se encontró la tabla cargas.'); return false }

      const ejId = Number(relatedData.ejercicio.id)
      const now = new Date().toISOString()

      // 1. Pasar todas las cargas firmadas del período (agrupado) a borrador
      const cargasPeriodo = cargasDelBloque(periodoKey)
      const actions = []
      for (const c of cargasPeriodo) {
        if (c.estado === 'firmado') {
          actions.push(['UpdateRecord', tCargas, Number(c.id), normalizeFields({
            estado: 'borrador',
            observaciones: motivo || 'Reabierto',
          })])
        }
      }

      // 2. Marcar cierre_mensuales como no firmado
      if (tCierres) {
        const cierresExistentes = await fetchRecords(tCierres, {
          filter: (cl) => Number(cl.ejercicio_id) === ejId && String(cl.periodo || '') === String(periodoKey),
        })
        for (const cl of cierresExistentes) {
          if (cl.firmado === true) {
            actions.push(['UpdateRecord', tCierres, Number(cl.id), normalizeFields({
              firmado: false,
              motivo_reapertura: motivo || '',
              reabierto_por: relatedData.userName,
              fecha_reapertura: now,
            })])
          }
        }
      }

      if (actions.length > 0) await applyUserActions(actions)

      // Actualizar estado local (todas las cargas del bloque)
      const idsBloque = new Set(cargasPeriodo.map((c) => Number(c.id)))
      cargas = cargas.map((c) =>
        idsBloque.has(Number(c.id))
          ? { ...c, estado: 'borrador', observaciones: motivo || 'Reabierto' }
          : c
      )
      base.setNotice(`Período ${periodoKey} reabierto.`)
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return false
    }
  }

  /**
   * Verifica si un período está firmado (cierre_mensuales.firmado = true).
   * Consulta el cache local de cargas: si todas las cargas del período
   * están firmadas, el período está cerrado.
   * @param {string} periodoKey - 'YYYY-MM'
   * @returns {boolean}
   */
  const periodoFirmado = (periodoKey) => {
    if (!relatedData.ejercicio) return false
    const cargasPeriodo = cargasDelBloque(periodoKey)
    if (cargasPeriodo.length === 0) return false
    return cargasPeriodo.every((c) => c.estado === 'firmado')
  }

  return {
    get cargas() { return cargas },
    loadCargas,
    crearCarga,
    firmarCarga,
    reabrirCarga,
    eliminarCarga,
    getCarga,
    migrarCargasLegacy,
    cerrarPeriodo,
    reabrirPeriodo,
    periodoFirmado,
  }
}
