import { applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, todayISO } from '$core/utils/utils.js'

/**
 * Cese / renuncia de una autoridad.
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTAutoridades - Getter reactivo del tableId de autoridades
 * @param {() => Promise<void>} deps.loadAutoridades - Callback para recargar autoridades
 * @param {object} deps.bs - Base state
 * @returns {{
 *   ceseTarget: any | null,
 *   openCese: (row: any) => void,
 *   closeCese: () => void,
 *   saveCese: () => Promise<void>,
 * }}
 */
export function createCeseAutoridad({ getTAutoridades, loadAutoridades, bs }) {
  let ceseTarget = $state(null)

  const openCese = (row) => {
    ceseTarget = {
      ...row,
      fecha_cese: row.fecha_cese || todayISO(),
      motivo_cese: row.motivo_cese || 'Renuncia',
      acta_origen_ref: row.acta_origen_ref || '',
      fecha_acta_origen: row.fecha_acta_origen || '',
      asamblea_id: row.asamblea_id || null,
    }
  }

  const closeCese = () => {
    ceseTarget = null
  }

  const saveCese = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      if (!ceseTarget?.id) {
        bs.setError('No hay autoridad seleccionada.')
        return
      }
      const tipoOrigen = ceseTarget.asamblea_id ? 'ReunionCD' : ceseTarget.tipo_origen || 'ReunionCD'
      const fields = normalizeFields({
        fecha_cese: ceseTarget.fecha_cese || '',
        motivo_cese: ceseTarget.motivo_cese || 'Renuncia',
        acta_origen_ref: String(ceseTarget.acta_origen_ref || '').trim(),
        fecha_acta_origen: ceseTarget.fecha_acta_origen || '',
        asamblea_id: ceseTarget.asamblea_id || '',
        tipo_origen: tipoOrigen,
        activo: false,
      })
      const tAutoridades = getTAutoridades()
      await applyUserActions([['UpdateRecord', tAutoridades, ceseTarget.id, fields]])
      bs.setNotice('Cese registrado.')
      await loadAutoridades()
      closeCese()
    } catch (e) {
      bs.setError(e?.message || String(e))
    } finally {
      bs.setBusy(false)
    }
  }

  return {
    get ceseTarget() { return ceseTarget },
    openCese,
    closeCese,
    saveCese,
  }
}
