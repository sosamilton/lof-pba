import {
  applyUserActions,
  ensureOneRow,
  fetchRecords,
  gristReady,
  isInGrist,
  resolveTableId,
  subscribeRecords,
} from '$core/grist/grist'
import { normalizeFields, TABLE_PREFERRED_IDS } from '$core/utils/utils'
import { ORGANISMOS, buildVigenteByCargo } from '$app/modules/gobierno/constants.js'
import { loadConfig, saveConfig, crearEjercicioApi } from './cooperadoraApi.js'
import { applyBrandTheme } from '$core/ui/theme'
import { notify } from '$core/ui/notify.svelte'
import { createBaseState } from '$core/grist/stores/gristStore.svelte'
import {
  formatCue,
  formatCuil,
  formatCbu,
  formatTelefono,
  parseCue,
  parseCuil,
  parseCbu,
  normalizeTelefonoForStorage,
} from '$core/format/format.js'

const bs = createBaseState()

/** @type {string | null} */
let tEscuela = $state(null)
/** @type {string | null} */
let tBanco = $state(null)
/** @type {string | null} */
let tKiosco = $state(null)
/** @type {string | null} */
let tEjercicios = $state(null)
/** @type {string | null} */
let tCargos = $state(null)
/** @type {string | null} */
let tAutoridades = $state(null)
/** @type {string | null} */
let tMovimientos = $state(null)

/** @type {Record<string, any>} */
let escuela = $state({})
/** @type {Record<string, any>} */
let banco = $state({})
/** @type {Record<string, any>} */
let kiosco = $state({})

/** @type {any[]} */
let ejercicios = $state([])
let nuevoEj = $state({
  anio_inicio: '', anio_fin: '', mes_inicio: 'Marzo',
  saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0,
})

let organismo = $state('CD')
/** @type {any[]} */
let cargos = $state([])
let nuevoCargo = $state({ nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, cargo_obligatorio: false, activo: true })

/** @type {any[]} */
let autoridades = $state([])
/** @type {Record<string, any> | null} */
let ejercicioEnCurso = $state(null)
let color_primario = $state('#16b378')

// Edición de saldos iniciales de un ejercicio (desde Cooperadora).
// `ejercicioEditando` es una copia del ejercicio que se está editando;
// los inputs del panel/dialog hacen bind sobre sus campos sin tocar el
// registro real hasta que se guarda.
/** @type {Record<string, any> | null} */
let ejercicioEditando = $state(null)

/** @type {(() => void) | null} */
let _unsub = null

const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  if (!isInGrist()) { bs.setLoading(false); return }
  try {
    await gristReady()
    tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
    tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
    tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
    tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
    tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
    tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
    escuela = (await ensureOneRow(tEscuela)) || {}
    banco = (await ensureOneRow(tBanco)) || {}
    kiosco = (await ensureOneRow(tKiosco)) || {}
    // Formateo visual: los datos vienen como dígitos crudos desde Grist.
    escuela.cue = formatCue(escuela.cue || '')
    escuela.cuit = formatCuil(escuela.cuit || '')
    escuela.telefono_cooperadora = formatTelefono(escuela.telefono_cooperadora || '')
    escuela.telefono_escuela = formatTelefono(escuela.telefono_escuela || '')
    banco.cbu = formatCbu(banco.cbu || '')
    ejercicios = await fetchRecords(tEjercicios)
    ejercicioEnCurso = ejercicios.find((e) => e.en_curso === true) || null
    const config = await loadConfig()
    if (config?.color_primario) color_primario = config.color_primario
    await loadCargos()
    await loadAutoridades()
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setLoading(false) }
}

const loadCargos = async () => {
  if (!tCargos) return
  const all = await fetchRecords(tCargos)
  cargos = all
    .filter((c) => String(c.organismo) === organismo)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
}

const loadAutoridades = async () => {
  if (!tAutoridades || !ejercicioEnCurso) { autoridades = []; return }
  autoridades = await fetchRecords(tAutoridades, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicioEnCurso.id),
  })
}

const comisionDirectiva = $derived.by(() => {
  const cargosOrg = cargos
    .filter((c) => c.activo === true || c.cargo_obligatorio === true)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  const vigenteByCargo = buildVigenteByCargo(autoridades, organismo)
  return cargosOrg.map((c) => {
    const a = vigenteByCargo.get(Number(c.id)) || null
    return {
      cargo: c,
      cargoId: c.id,
      cargoNombre: c.nombre_cargo || '(sin nombre)',
      apellido_nombre: a?.apellido_nombre || '',
      cuil: formatCuil(a?.cuil || ''),
      fecha_asuncion: a?.fecha_asuncion || '',
      fecha_vencimiento: a?.fecha_vencimiento || '',
    }
  })
})

const tieneAutoridadesVigentes = $derived(comisionDirectiva.some((f) => f.apellido_nombre))

const _updateRecord = async (tableId, rec) => {
  const fields = { ...rec }; delete fields.id
  const clean = normalizeFields(fields)
  if (rec.id != null) {
    await applyUserActions([['UpdateRecord', tableId, rec.id, clean]])
  } else {
    await applyUserActions([['AddRecord', tableId, null, clean]])
  }
}

const saveCooperadora = async () => {
  await bs.wrapAsync(async () => {
    if (!tEscuela || !tBanco || !tKiosco) {
      bs.setError('Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.')
      notify.error(bs.error); return
    }
    // Normalizamos a dígitos crudos para guardar en Grist (el formateo es solo visual).
    const escuelaRaw = { ...escuela }
    escuelaRaw.cue = parseCue(escuelaRaw.cue) || ''
    escuelaRaw.cuit = parseCuil(escuelaRaw.cuit) || ''
    escuelaRaw.telefono_cooperadora = normalizeTelefonoForStorage(escuelaRaw.telefono_cooperadora) || ''
    escuelaRaw.telefono_escuela = normalizeTelefonoForStorage(escuelaRaw.telefono_escuela) || ''
    const bancoRaw = { ...banco }
    bancoRaw.cbu = parseCbu(bancoRaw.cbu) || ''
    await _updateRecord(tEscuela, escuelaRaw)
    await _updateRecord(tBanco, bancoRaw)
    await _updateRecord(tKiosco, kiosco)
    const config = await loadConfig()
    await saveConfig({
      ...config,
      cooperadora_nombre: escuela.cooperadora_nombre || '',
      color_primario: color_primario || config?.color_primario || '#16b378',
    })
    bs.setNotice('Datos guardados.'); notify.success(bs.notice)
  })
}

const validarDatos = async () => {
  await bs.wrapAsync(async () => {
    if (!tEscuela) { bs.setError('No se encontró la tabla escuela.'); return }
    await applyUserActions([['UpdateRecord', tEscuela, escuela.id, { datos_validados: true }]])
    escuela.datos_validados = true
    bs.setNotice('Datos validados y bloqueados.'); notify.success(bs.notice)
  })
}

const validarBanco = async () => {
  await bs.wrapAsync(async () => {
    if (!tBanco) { bs.setError('No se encontró la tabla datos_banco.'); return }
    await applyUserActions([['UpdateRecord', tBanco, banco.id, { banco_validado: true }]])
    banco.banco_validado = true
    bs.setNotice('Datos bancarios validados y bloqueados.'); notify.success(bs.notice)
  })
}

const createEjercicio = async () => {
  await bs.wrapAsync(async () => {
    if (!tEjercicios) { bs.setError('No se encontró la tabla ejercicios.'); return }
    ejercicios = await crearEjercicioApi(nuevoEj, ejercicios)
    bs.setNotice('Ejercicio creado.'); notify.success(bs.notice)
    nuevoEj = {
      anio_inicio: '', anio_fin: '', mes_inicio: nuevoEj.mes_inicio || 'Marzo',
      saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0,
    }
  })
}

const setEjercicioEnCurso = async (id) => {
  await bs.wrapAsync(async () => {
    const actions = ejercicios.map((e) => ['UpdateRecord', tEjercicios, e.id, { en_curso: e.id === id }])
    await applyUserActions(actions)
    ejercicios = await fetchRecords(tEjercicios)
    bs.setNotice('Ejercicio actualizado.'); notify.success(bs.notice)
  })
}

// --- Edición de saldos iniciales de un ejercicio ---

// Fix F5: callback que se ejecuta después de guardar saldos iniciales,
// para que stores derivados (saldosStore, resumenStore) puedan recargar.
// Se setea desde los componentes que usan esos stores (ej: Inicio, Resumen).
let _onSaldosChanged = null
const setOnSaldosChanged = (fn) => { _onSaldosChanged = fn }

// Clona el ejercicio a editar para que los inputs del dialog operen sobre
// una copia y no sobre el registro real hasta que se confirme el guardado.
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
// Usa limit:1 para no cargar todos los registros. Evita importar
// movimientosStore desde aquí (no acoplar módulos).
const tieneMovimientos = async (ejercicioId) => {
  if (!tMovimientos || ejercicioId == null) return false
  try {
    const rows = await fetchRecords(tMovimientos, {
      filter: (m) => Number(m.ejercicio_id) === Number(ejercicioId),
      limit: 1,
    })
    return rows.length > 0
  } catch { return false }
}

const saveEjercicio = async () => {
  await bs.wrapAsync(async () => {
    if (!tEjercicios) { bs.setError('No se encontró la tabla ejercicios.'); return }
    if (!ejercicioEditando) return
    const fields = normalizeFields({
      anio_inicio: Number(ejercicioEditando.anio_inicio) || null,
      anio_fin: Number(ejercicioEditando.anio_fin) || null,
      mes_inicio: ejercicioEditando.mes_inicio || 'Marzo',
      fecha_inicio: ejercicioEditando.fecha_inicio || null,
      fecha_fin: ejercicioEditando.fecha_fin || null,
      observaciones: ejercicioEditando.observaciones || '',
      saldo_inicial_banco: Number(ejercicioEditando.saldo_inicial_banco) || 0,
      saldo_inicial_efectivo: Number(ejercicioEditando.saldo_inicial_efectivo) || 0,
      saldo_inicial_caja_chica: Number(ejercicioEditando.saldo_inicial_caja_chica) || 0,
    })
    await applyUserActions([['UpdateRecord', tEjercicios, ejercicioEditando.id, fields]])
    ejercicios = await fetchRecords(tEjercicios)
    ejercicioEnCurso = ejercicios.find((e) => e.en_curso === true) || null
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
    if (!tEjercicios) { bs.setError('No se encontró la tabla ejercicios.'); return }
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
    await applyUserActions([['RemoveRecord', tEjercicios, id]])
    ejercicios = await fetchRecords(tEjercicios)
    bs.setNotice('Ejercicio eliminado.'); notify.success(bs.notice)
  })
}

const saveCargo = async (c) => {
  await bs.wrapAsync(async () => {
    if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
    const fields = normalizeFields({
      organismo: c.organismo, nombre_cargo: c.nombre_cargo, nivel: c.nivel,
      orden: Number(c.orden || 0),
      duracion_meses: c.duracion_meses === '' ? '' : Number(c.duracion_meses || 0),
      cargo_obligatorio: Boolean(c.cargo_obligatorio), activo: Boolean(c.activo),
    })
    if (c.cargo_obligatorio) fields.activo = true
    await applyUserActions([['UpdateRecord', tCargos, c.id, fields]])
    await loadCargos()
    bs.setNotice('Cargo guardado.'); notify.success(bs.notice)
  })
}

const addCargo = async () => {
  await bs.wrapAsync(async () => {
    if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
    if (!String(nuevoCargo.nombre_cargo || '').trim()) { bs.setError('Completá el nombre del cargo.'); return }
    const fields = normalizeFields({
      organismo, nombre_cargo: String(nuevoCargo.nombre_cargo).trim(),
      nivel: nuevoCargo.nivel, orden: Number(nuevoCargo.orden || 0),
      duracion_meses: nuevoCargo.duracion_meses === '' ? '' : Number(nuevoCargo.duracion_meses || 0),
      cargo_obligatorio: Boolean(nuevoCargo.cargo_obligatorio), activo: Boolean(nuevoCargo.activo),
    })
    if (fields.cargo_obligatorio) fields.activo = true
    await applyUserActions([['AddRecord', tCargos, null, fields]])
    nuevoCargo = {
      nombre_cargo: '', nivel: nuevoCargo.nivel || 'Titular',
      orden: Number(nuevoCargo.orden || 10) + 1,
      duracion_meses: Number(nuevoCargo.duracion_meses || 12),
      cargo_obligatorio: false, activo: true,
    }
    await loadCargos()
    bs.setNotice('Cargo agregado.'); notify.success(bs.notice)
  })
}

const setOrganismo = (v) => {
  organismo = v
  loadCargos()
}

// Re-formateo en vivo mientras el usuario tipea. Los datos se guardan crudos.
const onCueInput = () => { escuela.cue = formatCue(escuela.cue) }
const onCuitInput = () => { escuela.cuit = formatCuil(escuela.cuit) }
const onCbuInput = () => { banco.cbu = formatCbu(banco.cbu) }
const onTelefonoInput = () => { escuela.telefono_cooperadora = formatTelefono(escuela.telefono_cooperadora) }
const onTelefonoEscuelaInput = () => { escuela.telefono_escuela = formatTelefono(escuela.telefono_escuela) }

const subscribe = () => {
  if (_unsub) _unsub()
  _unsub = subscribeRecords(() => { if (!bs.busy && !bs.loading) load() })
  return () => { if (_unsub) _unsub(); _unsub = null }
}

export const cooperadoraStore = {
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  get escuela() { return escuela },
  get banco() { return banco },
  get kiosco() { return kiosco },
  get ejercicios() { return ejercicios },
  get nuevoEj() { return nuevoEj },
  get nuevoCargo() { return nuevoCargo },
  get organismo() { return organismo },
  get cargos() { return cargos },
  get comisionDirectiva() { return comisionDirectiva },
  get tieneAutoridadesVigentes() { return tieneAutoridadesVigentes },
  get ejercicioEnCurso() { return ejercicioEnCurso },
  get ejercicioEditando() { return ejercicioEditando },
  get color_primario() { return color_primario },
  setColor_primario: (v) => { color_primario = v; applyBrandTheme(v) },
  setOrganismo,
  onCueInput,
  onCuitInput,
  onCbuInput,
  onTelefonoInput,
  onTelefonoEscuelaInput,
  load,
  loadCargos,
  saveCooperadora,
  validarDatos,
  validarBanco,
  createEjercicio,
  setEjercicioEnCurso,
  saveCargo,
  addCargo,
  setEditandoEjercicio,
  cancelarEdicionEjercicio,
  tieneMovimientos,
  saveEjercicio,
  deleteEjercicio,
  setOnSaldosChanged,
  subscribe,
}
