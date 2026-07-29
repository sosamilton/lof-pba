<script>
  import { onMount } from 'svelte'
  import { ensureOneRow, fetchRecords, gristReady, isInGrist, resolveTableId, applyUserActions, subscribeRecords, getWidgetOptions, setWidgetOption } from '../grist'
  import { normalizeFields, ORGANISMOS, ORGANISMO_LABELS, NIVELES_CARGO, MESES, TABLE_PREFERRED_IDS } from '../utils'
  import MessageBanner from '../components/MessageBanner.svelte'
  import '../shared.css'

  let loading = $state(true)
  let error = $state('')
  let notice = $state('')
  let busy = $state(false)

  let tEscuela = $state()
  let tBanco = $state()
  let tKiosco = $state()
  let tEjercicios = $state()
  let tCargos = $state()

  let escuela = $state({})
  let banco = $state({})
  let kiosco = $state({})

  let ejercicios = $state([])
  let nuevoEj = $state({
    anio_inicio: '',
    anio_fin: '',
    mes_inicio: 'Marzo',
    saldo_inicial_banco: 0,
    saldo_inicial_efectivo: 0,
    saldo_inicial_caja_chica: 0
  })

  let organismo = $state('CD')
  let cargos = $state([])
  let userName = $state('')
  let nuevoCargo = $state({ nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, cargo_obligatorio: false, activo: true })

  const load = async () => {
    loading = true
    error = ''
    notice = ''

    if (!isInGrist()) {
      loading = false
      return
    }

    try {
      await gristReady()

      tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
      tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
      tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
      tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
      tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)

      escuela = (await ensureOneRow(tEscuela)) || {}
      banco = (await ensureOneRow(tBanco)) || {}
      kiosco = (await ensureOneRow(tKiosco)) || {}

      ejercicios = await fetchRecords(tEjercicios)
      const opts = await getWidgetOptions()
      if (opts?.userName) userName = opts.userName
      await loadCargos()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const loadCargos = async () => {
    const all = await fetchRecords(tCargos)
    cargos = all
      .filter((c) => String(c.organismo) === organismo)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  }

  const updateRecord = async (tableId, rec) => {
    const fields = { ...rec }
    delete fields.id
    await applyUserActions([['UpdateRecord', tableId, rec.id, normalizeFields(fields)]])
  }

  const saveSetup = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tEscuela || !tBanco || !tKiosco) {
        error = 'Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      await updateRecord(tEscuela, escuela)
      await updateRecord(tBanco, banco)
      await updateRecord(tKiosco, kiosco)
      if (userName) await setWidgetOption('userName', userName.trim())
      notice = 'Datos guardados.'
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const createEjercicio = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tEjercicios) {
        error = 'No se encontró la tabla ejercicios. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      const fields = normalizeFields({
        anio_inicio: nuevoEj.anio_inicio ? Number(nuevoEj.anio_inicio) : null,
        anio_fin: nuevoEj.anio_fin ? Number(nuevoEj.anio_fin) : null,
        mes_inicio: nuevoEj.mes_inicio,
        saldo_inicial_banco: Number(nuevoEj.saldo_inicial_banco || 0),
        saldo_inicial_efectivo: Number(nuevoEj.saldo_inicial_efectivo || 0),
        saldo_inicial_caja_chica: Number(nuevoEj.saldo_inicial_caja_chica || 0),
        en_curso: true
      })

      const toDeactivate = ejercicios.filter((e) => e.en_curso === true).map((e) => e.id)
      const actions = [
        ...toDeactivate.map((id) => ['UpdateRecord', tEjercicios, id, { en_curso: false }]),
        ['AddRecord', tEjercicios, null, fields]
      ]
      await applyUserActions(actions)
      ejercicios = await fetchRecords(tEjercicios)
      notice = 'Ejercicio creado.'
      nuevoEj = {
        anio_inicio: '',
        anio_fin: '',
        mes_inicio: nuevoEj.mes_inicio || 'Marzo',
        saldo_inicial_banco: 0,
        saldo_inicial_efectivo: 0,
        saldo_inicial_caja_chica: 0
      }
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const setEjercicioEnCurso = async (id) => {
    notice = ''
    error = ''
    busy = true
    try {
      const actions = ejercicios.map((e) => ['UpdateRecord', tEjercicios, e.id, { en_curso: e.id === id }])
      await applyUserActions(actions)
      ejercicios = await fetchRecords(tEjercicios)
      notice = 'Ejercicio actualizado.'
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const saveCargo = async (c) => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tCargos) {
        error = 'No se encontró la tabla cargos. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      const fields = normalizeFields({
        organismo: c.organismo,
        nombre_cargo: c.nombre_cargo,
        nivel: c.nivel,
        orden: Number(c.orden || 0),
        duracion_meses: c.duracion_meses === '' ? '' : Number(c.duracion_meses || 0),
        cargo_obligatorio: Boolean(c.cargo_obligatorio),
        activo: Boolean(c.activo)
      })
      if (c.cargo_obligatorio) fields.activo = true
      await applyUserActions([['UpdateRecord', tCargos, c.id, fields]])
      await loadCargos()
      notice = 'Cargo guardado.'
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const addCargo = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tCargos) {
        error = 'No se encontró la tabla cargos. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      if (!String(nuevoCargo.nombre_cargo || '').trim()) {
        error = 'Completá el nombre del cargo.'
        return
      }
      const fields = normalizeFields({
        organismo,
        nombre_cargo: String(nuevoCargo.nombre_cargo).trim(),
        nivel: nuevoCargo.nivel,
        orden: Number(nuevoCargo.orden || 0),
        duracion_meses: nuevoCargo.duracion_meses === '' ? '' : Number(nuevoCargo.duracion_meses || 0),
        cargo_obligatorio: Boolean(nuevoCargo.cargo_obligatorio),
        activo: Boolean(nuevoCargo.activo)
      })
      if (fields.cargo_obligatorio) fields.activo = true
      await applyUserActions([['AddRecord', tCargos, null, fields]])
      nuevoCargo = {
        nombre_cargo: '',
        nivel: nuevoCargo.nivel || 'Titular',
        orden: Number(nuevoCargo.orden || 10) + 1,
        duracion_meses: Number(nuevoCargo.duracion_meses || 12),
        cargo_obligatorio: false,
        activo: true
      }
      await loadCargos()
      notice = 'Cargo agregado.'
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  onMount(() => {
    const unsub = subscribeRecords(() => {
      if (!busy && !loading) load()
    })
    load()
    return unsub
  })
</script>

{#if !isInGrist()}
  <h1>Cooperadora</h1>
  <p>Esta pantalla solo funciona dentro de Grist.</p>
{:else if loading}
  <p>Cargando…</p>
{:else}
  <div class="grid2">
    <section class="card">
      <h1>Cooperadora</h1>
      <div class="form">
        <div class="row">
          <label>Distrito<input bind:value={escuela.distrito} /></label>
        </div>
        <div class="row">
          <label>Escuela<input bind:value={escuela.escuela_nombre} /></label>
        </div>
        <div class="row">
          <label>Número<input bind:value={escuela.escuela_numero} /></label>
        </div>
        <div class="row">
          <label>CUE<input bind:value={escuela.cue} /></label>
        </div>
        <div class="row">
          <label>CUIT<input bind:value={escuela.cuit} /></label>
        </div>
        <div class="row">
          <label>Cooperadora<input bind:value={escuela.cooperadora_nombre} /></label>
        </div>
        <div class="row">
          <label>Domicilio<input bind:value={escuela.domicilio} /></label>
        </div>
        <div class="row">
          <label>Localidad<input bind:value={escuela.localidad} /></label>
        </div>
        <div class="row">
          <label>Email<input bind:value={escuela.email_cooperadora} /></label>
        </div>
        <div class="row">
          <label>Teléfono<input bind:value={escuela.telefono_cooperadora} /></label>
        </div>
      </div>

      <h2>Banco</h2>
      <div class="form">
        <div class="row">
          <label>Entidad<input bind:value={banco.entidad} /></label>
        </div>
        <div class="row">
          <label>CBU<input bind:value={banco.cbu} /></label>
        </div>
        <div class="row">
          <label>Cuenta<input bind:value={banco.cuenta_corriente} /></label>
        </div>
      </div>

      <h2>Kiosco</h2>
      <div class="form">
        <div class="row">
          <label>Posee<select bind:value={kiosco.posee}>
            <option value={true}>Sí</option>
            <option value={false}>No</option>
          </select></label>
        </div>
        <div class="row">
          <label>Modalidad<select bind:value={kiosco.modalidad}>
            <option value="">(sin)</option>
            <option value="Propio">Propio</option>
            <option value="Licitado">Licitado</option>
          </select></label>
        </div>
      </div>

      <h2>Usuario</h2>
      <div class="form">
        <div class="row">
          <label>Nombre de usuario (para registros)<input bind:value={userName} placeholder="Ej: Juan Pérez" /></label>
        </div>
      </div>

      <div class="actions">
        <button class="btn" onclick={saveSetup}>Guardar datos</button>
      </div>
    </section>

    <section class="card">
      <h1>Ejercicio y comisión</h1>
      <div class="list">
        {#each ejercicios as e (e.id)}
          <div class="item">
            <div class="item-main">
              <div class="item-title">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
              <div class="item-sub">{e.en_curso ? 'En curso' : 'Inactivo'}</div>
            </div>
            <div class="item-actions">
              <button class="btn secondary" disabled={e.en_curso} onclick={() => setEjercicioEnCurso(e.id)}>Activar</button>
            </div>
          </div>
        {/each}
      </div>

      <h2>Nuevo ejercicio</h2>
      <div class="form">
        <div class="row">
          <label>Año desde<input type="number" bind:value={nuevoEj.anio_inicio} /></label>
        </div>
        <div class="row">
          <label>Año hasta<input type="number" bind:value={nuevoEj.anio_fin} /></label>
        </div>
        <div class="row">
          <label>Mes inicio<select bind:value={nuevoEj.mes_inicio}>
            <option>Enero</option>
            <option>Febrero</option>
            <option>Marzo</option>
            <option>Abril</option>
            <option>Mayo</option>
            <option>Junio</option>
            <option>Julio</option>
            <option>Agosto</option>
            <option>Septiembre</option>
            <option>Octubre</option>
            <option>Noviembre</option>
            <option>Diciembre</option>
          </select></label>
        </div>
        <div class="row">
          <label>Saldo banco<input type="number" bind:value={nuevoEj.saldo_inicial_banco} /></label>
        </div>
        <div class="row">
          <label>Saldo efectivo<input type="number" bind:value={nuevoEj.saldo_inicial_efectivo} /></label>
        </div>
        <div class="row">
          <label>Saldo caja chica<input type="number" bind:value={nuevoEj.saldo_inicial_caja_chica} /></label>
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick={createEjercicio}>Crear y activar</button>
      </div>

      <h1 style="margin-top:18px">Cargos (base)</h1>
      <div class="tabs">
        <button class:tabActive={organismo === 'CD'} onclick={() => { organismo = 'CD'; loadCargos() }}>Comisión Directiva</button>
        <button class:tabActive={organismo === 'CRC'} onclick={() => { organismo = 'CRC'; loadCargos() }}>Comisión Revisora de Cuentas</button>
        <button class:tabActive={organismo === 'Federacion'} onclick={() => { organismo = 'Federacion'; loadCargos() }}>Federación</button>
      </div>
      <div class="table">
        <div class="thead">
          <div>Orden</div>
          <div>Cargo</div>
          <div>Duración</div>
          <div>Nivel</div>
          <div>Obligatorio</div>
          <div>Activo</div>
          <div></div>
        </div>
        {#each cargos as c (c.id)}
          <div class="trow">
            <div><input type="number" bind:value={c.orden} /></div>
            <div><input bind:value={c.nombre_cargo} /></div>
            <div><input type="number" bind:value={c.duracion_meses} /></div>
            <div>
              <select bind:value={c.nivel}>
                <option value="Titular">Titular</option>
                <option value="Suplente">Suplente</option>
              </select>
            </div>
            <div><input type="checkbox" bind:checked={c.cargo_obligatorio} /></div>
            <div><input type="checkbox" bind:checked={c.activo} disabled={c.cargo_obligatorio} /></div>
            <div><button class="btn secondary" onclick={() => saveCargo(c)}>Guardar</button></div>
          </div>
        {/each}
      </div>

      <h2>Agregar cargo</h2>
      <div class="form">
        <div class="row">
          <label>Nombre<input bind:value={nuevoCargo.nombre_cargo} /></label>
        </div>
        <div class="row">
          <label>Duración (meses)<input type="number" bind:value={nuevoCargo.duracion_meses} /></label>
        </div>
        <div class="row">
          <label>Nivel<select bind:value={nuevoCargo.nivel}>
            <option value="Titular">Titular</option>
            <option value="Suplente">Suplente</option>
          </select></label>
        </div>
        <div class="row">
          <label>Orden<input type="number" bind:value={nuevoCargo.orden} /></label>
        </div>
        <div class="row">
          <label>Obligatorio<input type="checkbox" bind:checked={nuevoCargo.cargo_obligatorio} /></label>
        </div>
        <div class="row">
          <label>Activo<input type="checkbox" bind:checked={nuevoCargo.activo} disabled={nuevoCargo.cargo_obligatorio} /></label>
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick={addCargo}>Agregar</button>
      </div>
    </section>
  </div>

  <MessageBanner {error} {notice} />
{/if}

<style>
  h1 {
    margin: 0 0 10px 0;
    font-size: 18px;
  }
  h2 {
    margin: 14px 0 8px 0;
    font-size: 14px;
    opacity: 0.9;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
  }
  .item-title {
    font-weight: 700;
    font-size: 13px;
  }
  .item-sub {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 2px;
  }
  .table {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 12px;
    overflow: hidden;
    overflow-x: auto;
  }
  .thead,
  .trow {
    display: grid;
    grid-template-columns: 64px minmax(220px, 1fr) 110px 130px 110px 80px 96px;
    gap: 8px;
    align-items: center;
    padding: 10px;
  }
  .thead,
  .trow {
    min-width: 850px;
  }
  .thead {
    background: rgba(128, 128, 128, 0.12);
    font-size: 12px;
    font-weight: 800;
  }
  .trow {
    border-top: 1px solid rgba(128, 128, 128, 0.18);
  }
  .trow input[type='checkbox'] {
    width: 16px;
    height: 16px;
  }
  @media (max-width: 1100px) {
    .thead,
    .trow {
      grid-template-columns: 56px minmax(180px, 1fr) 96px 110px 96px 70px 96px;
    }
  }
</style>
