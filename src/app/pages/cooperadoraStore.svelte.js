import {
  applyUserActions,
  ensureOneRow,
  fetchRecords,
  gristReady,
  isInGrist,
  resolveTableId,
  subscribeRecords,
} from '$core/grist'
import { normalizeFields, TABLE_PREFERRED_IDS, ORGANISMOS, buildVigenteByCargo } from '$core/utils'
import { loadConfig, saveConfig } from '$core/configuracion'
import { applyBrandTheme } from '$core/theme'
import { notify } from '$core/notify.svelte'
import { createBaseState } from '$core/stores/gristStore.svelte'
import {
  formatCue,
  formatCuil,
  formatCbu,
  formatTelefono,
  parseCue,
  parseCuil,
  parseCbu,
  normalizeTelefonoForStorage,
} from '$core/format.js'

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
    escuela = (await ensureOneRow(tEscuela)) || {}
    banco = (await ensureOneRow(tBanco)) || {}
    kiosco = (await ensureOneRow(tKiosco)) || {}
    // Formateo visual: los datos vienen como dígitos crudos desde Grist.
    escuela.cue = formatCue(escuela.cue || '')
    escuela.cuit = formatCuil(escuela.cuit || '')
    escuela.telefono_cooperadora = formatTelefono(escuela.telefono_cooperadora || '')
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
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tEscuela || !tBanco || !tKiosco) {
      bs.setError('Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.')
      notify.error(bs.error); return
    }
    // Normalizamos a dígitos crudos para guardar en Grist (el formateo es solo visual).
    const escuelaRaw = { ...escuela }
    escuelaRaw.cue = parseCue(escuelaRaw.cue) || ''
    escuelaRaw.cuit = parseCuil(escuelaRaw.cuit) || ''
    escuelaRaw.telefono_cooperadora = normalizeTelefonoForStorage(escuelaRaw.telefono_cooperadora) || ''
    const bancoRaw = { ...banco }
    bancoRaw.cbu = parseCbu(bancoRaw.cbu) || ''
    await _updateRecord(tEscuela, escuelaRaw)
    await _updateRecord(tBanco, bancoRaw)
    await _updateRecord(tKiosco, kiosco)
    const config = await loadConfig()
    await saveConfig({
      ...config,
      cooperadora_nombre: escuela.cooperadora_nombre || '',
      email: escuela.email_cooperadora || '',
      telefono: normalizeTelefonoForStorage(escuela.telefono_cooperadora) || '',
      color_primario: color_primario || config?.color_primario || '#16b378',
    })
    bs.setNotice('Datos guardados.'); notify.success(bs.notice)
  } catch (e) { bs.setError(e?.message || String(e)); notify.error(bs.error) } finally { bs.setBusy(false) }
}

const validarDatos = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tEscuela) { bs.setError('No se encontró la tabla escuela.'); return }
    await applyUserActions([['UpdateRecord', tEscuela, escuela.id, { datos_validados: true }]])
    escuela.datos_validados = true
    bs.setNotice('Datos validados y bloqueados.'); notify.success(bs.notice)
  } catch (e) { bs.setError(e?.message || String(e)); notify.error(bs.error) } finally { bs.setBusy(false) }
}

const validarBanco = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tBanco) { bs.setError('No se encontró la tabla datos_banco.'); return }
    await applyUserActions([['UpdateRecord', tBanco, banco.id, { banco_validado: true }]])
    banco.banco_validado = true
    bs.setNotice('Datos bancarios validados y bloqueados.'); notify.success(bs.notice)
  } catch (e) { bs.setError(e?.message || String(e)); notify.error(bs.error) } finally { bs.setBusy(false) }
}

const createEjercicio = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tEjercicios) { bs.setError('No se encontró la tabla ejercicios.'); return }
    const fields = normalizeFields({
      anio_inicio: nuevoEj.anio_inicio ? Number(nuevoEj.anio_inicio) : null,
      anio_fin: nuevoEj.anio_fin ? Number(nuevoEj.anio_fin) : null,
      mes_inicio: nuevoEj.mes_inicio,
      saldo_inicial_banco: Number(nuevoEj.saldo_inicial_banco || 0),
      saldo_inicial_efectivo: Number(nuevoEj.saldo_inicial_efectivo || 0),
      saldo_inicial_caja_chica: Number(nuevoEj.saldo_inicial_caja_chica || 0),
      en_curso: true,
    })
    const toDeactivate = ejercicios.filter((e) => e.en_curso === true).map((e) => e.id)
    const actions = [
      ...toDeactivate.map((id) => ['UpdateRecord', tEjercicios, id, { en_curso: false }]),
      ['AddRecord', tEjercicios, null, fields],
    ]
    await applyUserActions(actions)
    ejercicios = await fetchRecords(tEjercicios)
    bs.setNotice('Ejercicio creado.'); notify.success(bs.notice)
    nuevoEj = {
      anio_inicio: '', anio_fin: '', mes_inicio: nuevoEj.mes_inicio || 'Marzo',
      saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0,
    }
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setBusy(false) }
}

const setEjercicioEnCurso = async (id) => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    const actions = ejercicios.map((e) => ['UpdateRecord', tEjercicios, e.id, { en_curso: e.id === id }])
    await applyUserActions(actions)
    ejercicios = await fetchRecords(tEjercicios)
    bs.setNotice('Ejercicio actualizado.'); notify.success(bs.notice)
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setBusy(false) }
}

const saveCargo = async (c) => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
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
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setBusy(false) }
}

const addCargo = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
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
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setBusy(false) }
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
  get color_primario() { return color_primario },
  setColor_primario: (v) => { color_primario = v; applyBrandTheme(v) },
  setOrganismo,
  onCueInput,
  onCuitInput,
  onCbuInput,
  onTelefonoInput,
  load,
  loadCargos,
  saveCooperadora,
  validarDatos,
  validarBanco,
  createEjercicio,
  setEjercicioEnCurso,
  saveCargo,
  addCargo,
  subscribe,
}
