import {
  applyUserActions,
  ensureOneRow,
  fetchRecords,
  gristReady,
  isInGrist,
  resolveTableId,
  subscribeRecords,
  getWidgetOptions,
  setWidgetOption,
} from '$core/grist'
import { normalizeFields, TABLE_PREFERRED_IDS } from '$core/utils'
import { loadConfig, saveConfig } from '$core/configuracion'
import { notify } from '$core/notify.svelte'
import { createBaseState } from '$core/stores/gristStore.svelte'

const bs = createBaseState()

let tEscuela = $state(null)
let tBanco = $state(null)
let tKiosco = $state(null)
let tEjercicios = $state(null)
let tCargos = $state(null)
let tCuentas = $state(null)

let escuela = $state({})
let banco = $state({})
let kiosco = $state({})
let cuentas = $state([])
let cuentaDefaultId = $state('')

let ejercicios = $state([])
let nuevoEj = $state({
  anio_inicio: '', anio_fin: '', mes_inicio: 'Marzo',
  saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0,
})

let organismo = $state('CD')
let cargos = $state([])
let userName = $state('')
let nuevoCargo = $state({ nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, cargo_obligatorio: false, activo: true })

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
    tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
    escuela = (await ensureOneRow(tEscuela)) || {}
    banco = (await ensureOneRow(tBanco)) || {}
    kiosco = (await ensureOneRow(tKiosco)) || {}
    ejercicios = await fetchRecords(tEjercicios)
    if (tCuentas) cuentas = await fetchRecords(tCuentas, { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) })
    const config = await loadConfig()
    cuentaDefaultId = config?.cuenta_default_id ? String(config.cuenta_default_id) : ''
    const opts = await getWidgetOptions()
    if (opts?.userName) userName = opts.userName
    await loadCargos()
  } catch (e) { bs.setError(e?.message || String(e)) } finally { bs.setLoading(false) }
}

const loadCargos = async () => {
  if (!tCargos) return
  const all = await fetchRecords(tCargos)
  cargos = all
    .filter((c) => String(c.organismo) === organismo)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
}

const _updateRecord = async (tableId, rec) => {
  const fields = { ...rec }; delete fields.id
  await applyUserActions([['UpdateRecord', tableId, rec.id, normalizeFields(fields)]])
}

const saveCooperadora = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tEscuela || !tBanco || !tKiosco) {
      bs.setError('Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.')
      notify.error(bs.error); return
    }
    await _updateRecord(tEscuela, escuela)
    await _updateRecord(tBanco, banco)
    await _updateRecord(tKiosco, kiosco)
    if (userName) await setWidgetOption('userName', userName.trim())
    if (cuentaDefaultId) await saveConfig({ cuenta_default_id: cuentaDefaultId })
    bs.setNotice('Datos guardados.'); notify.success(bs.notice)
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
  get userName() { return userName },
  get cuentas() { return cuentas },
  get cuentaDefaultId() { return cuentaDefaultId },
  setUserName: (v) => { userName = v },
  setCuentaDefaultId: (v) => { cuentaDefaultId = v },
  setOrganismo,
  load,
  loadCargos,
  saveCooperadora,
  createEjercicio,
  setEjercicioEnCurso,
  saveCargo,
  addCargo,
  subscribe,
}
