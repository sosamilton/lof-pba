<script>
  import { onMount } from 'svelte'
  import { ensureOneRow, fetchRecords, gristReady, isInGrist, resolveTableId, applyUserActions } from '../grist'

  let loading = true
  let error = ''
  let notice = ''

  let tEscuela
  let tBanco
  let tKiosco
  let tEjercicios
  let tCargos

  let escuela = {}
  let banco = {}
  let kiosco = {}

  let ejercicios = []
  let nuevoEj = {
    anio_inicio: '',
    anio_fin: '',
    mes_inicio: 'Marzo',
    saldo_inicial_banco: 0,
    saldo_inicial_efectivo: 0,
    saldo_inicial_caja_chica: 0
  }

  let organismo = 'CD'
  let cargos = []
  let nuevoCargo = { nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, cargo_obligatorio: false, activo: true }

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

      tEscuela = await resolveTableId(['Escuela', 'escuela'])
      tBanco = await resolveTableId(['Datos_banco', 'datos_banco'])
      tKiosco = await resolveTableId(['Kiosco_libreria', 'kiosco_libreria'])
      tEjercicios = await resolveTableId(['Ejercicios', 'ejercicios'])
      tCargos = await resolveTableId(['Cargos', 'cargos'])

      escuela = (await ensureOneRow(tEscuela)) || {}
      banco = (await ensureOneRow(tBanco)) || {}
      kiosco = (await ensureOneRow(tKiosco)) || {}

      ejercicios = await fetchRecords(tEjercicios)
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

  const normalizeFields = (obj) => {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
      if (v === '') continue
      out[k] = v
    }
    return out
  }

  const saveSetup = async () => {
    notice = ''
    error = ''
    try {
      if (!tEscuela || !tBanco || !tKiosco) {
        error = 'Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      await updateRecord(tEscuela, escuela)
      await updateRecord(tBanco, banco)
      await updateRecord(tKiosco, kiosco)
      notice = 'Datos guardados.'
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const createEjercicio = async () => {
    notice = ''
    error = ''
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
    }
  }

  const setEjercicioEnCurso = async (id) => {
    notice = ''
    error = ''
    try {
      const actions = ejercicios.map((e) => ['UpdateRecord', tEjercicios, e.id, { en_curso: e.id === id }])
      await applyUserActions(actions)
      ejercicios = await fetchRecords(tEjercicios)
      notice = 'Ejercicio actualizado.'
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const saveCargo = async (c) => {
    notice = ''
    error = ''
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
    }
  }

  const addCargo = async () => {
    notice = ''
    error = ''
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
    }
  }

  onMount(load)
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
          <label>Distrito</label>
          <input bind:value={escuela.distrito} />
        </div>
        <div class="row">
          <label>Escuela</label>
          <input bind:value={escuela.escuela_nombre} />
        </div>
        <div class="row">
          <label>Número</label>
          <input bind:value={escuela.escuela_numero} />
        </div>
        <div class="row">
          <label>CUE</label>
          <input bind:value={escuela.cue} />
        </div>
        <div class="row">
          <label>CUIT</label>
          <input bind:value={escuela.cuit} />
        </div>
        <div class="row">
          <label>Cooperadora</label>
          <input bind:value={escuela.cooperadora_nombre} />
        </div>
        <div class="row">
          <label>Domicilio</label>
          <input bind:value={escuela.domicilio} />
        </div>
        <div class="row">
          <label>Localidad</label>
          <input bind:value={escuela.localidad} />
        </div>
        <div class="row">
          <label>Email</label>
          <input bind:value={escuela.email_cooperadora} />
        </div>
        <div class="row">
          <label>Teléfono</label>
          <input bind:value={escuela.telefono_cooperadora} />
        </div>
      </div>

      <h2>Banco</h2>
      <div class="form">
        <div class="row">
          <label>Entidad</label>
          <input bind:value={banco.entidad} />
        </div>
        <div class="row">
          <label>CBU</label>
          <input bind:value={banco.cbu} />
        </div>
        <div class="row">
          <label>Cuenta</label>
          <input bind:value={banco.cuenta_corriente} />
        </div>
      </div>

      <h2>Kiosco</h2>
      <div class="form">
        <div class="row">
          <label>Posee</label>
          <select bind:value={kiosco.posee}>
            <option value={true}>Sí</option>
            <option value={false}>No</option>
          </select>
        </div>
        <div class="row">
          <label>Modalidad</label>
          <select bind:value={kiosco.modalidad}>
            <option value="">(sin)</option>
            <option value="Propio">Propio</option>
            <option value="Licitado">Licitado</option>
          </select>
        </div>
      </div>

      <div class="actions">
        <button class="btn" on:click={saveSetup}>Guardar datos</button>
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
              <button class="btn secondary" disabled={e.en_curso} on:click={() => setEjercicioEnCurso(e.id)}>Activar</button>
            </div>
          </div>
        {/each}
      </div>

      <h2>Nuevo ejercicio</h2>
      <div class="form">
        <div class="row">
          <label>Año desde</label>
          <input type="number" bind:value={nuevoEj.anio_inicio} />
        </div>
        <div class="row">
          <label>Año hasta</label>
          <input type="number" bind:value={nuevoEj.anio_fin} />
        </div>
        <div class="row">
          <label>Mes inicio</label>
          <select bind:value={nuevoEj.mes_inicio}>
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
          </select>
        </div>
        <div class="row">
          <label>Saldo banco</label>
          <input type="number" bind:value={nuevoEj.saldo_inicial_banco} />
        </div>
        <div class="row">
          <label>Saldo efectivo</label>
          <input type="number" bind:value={nuevoEj.saldo_inicial_efectivo} />
        </div>
        <div class="row">
          <label>Saldo caja chica</label>
          <input type="number" bind:value={nuevoEj.saldo_inicial_caja_chica} />
        </div>
      </div>
      <div class="actions">
        <button class="btn" on:click={createEjercicio}>Crear y activar</button>
      </div>

      <h1 style="margin-top:18px">Cargos (base)</h1>
      <div class="tabs">
        <button class:tabActive={organismo === 'CD'} on:click={() => { organismo = 'CD'; loadCargos() }}>Comisión Directiva</button>
        <button class:tabActive={organismo === 'CRC'} on:click={() => { organismo = 'CRC'; loadCargos() }}>Comisión Revisora de Cuentas</button>
        <button class:tabActive={organismo === 'Federacion'} on:click={() => { organismo = 'Federacion'; loadCargos() }}>Federación</button>
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
            <div><button class="btn secondary" on:click={() => saveCargo(c)}>Guardar</button></div>
          </div>
        {/each}
      </div>

      <h2>Agregar cargo</h2>
      <div class="form">
        <div class="row">
          <label>Nombre</label>
          <input bind:value={nuevoCargo.nombre_cargo} />
        </div>
        <div class="row">
          <label>Duración (meses)</label>
          <input type="number" bind:value={nuevoCargo.duracion_meses} />
        </div>
        <div class="row">
          <label>Nivel</label>
          <select bind:value={nuevoCargo.nivel}>
            <option value="Titular">Titular</option>
            <option value="Suplente">Suplente</option>
          </select>
        </div>
        <div class="row">
          <label>Orden</label>
          <input type="number" bind:value={nuevoCargo.orden} />
        </div>
        <div class="row">
          <label>Obligatorio</label>
          <input type="checkbox" bind:checked={nuevoCargo.cargo_obligatorio} />
        </div>
        <div class="row">
          <label>Activo</label>
          <input type="checkbox" bind:checked={nuevoCargo.activo} disabled={nuevoCargo.cargo_obligatorio} />
        </div>
      </div>
      <div class="actions">
        <button class="btn" on:click={addCargo}>Agregar</button>
      </div>
    </section>
  </div>

  {#if error}
    <div class="msg error">{error}</div>
  {/if}
  {#if notice}
    <div class="msg notice">{notice}</div>
  {/if}
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
  .card {
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.06);
  }
  .form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
  }
  .row label {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 5px;
  }
  input,
  select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--grist-theme-input-bg, rgba(255, 255, 255, 0.85));
    color: inherit;
  }
  .actions {
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .btn {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 700;
    background: rgba(22, 179, 120, 0.9);
    color: #fff;
  }
  .btn.secondary {
    background: rgba(128, 128, 128, 0.18);
    color: inherit;
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
  .tabs {
    display: flex;
    gap: 8px;
    margin: 8px 0 8px 0;
  }
  .tabs button {
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(128, 128, 128, 0.28);
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    color: inherit;
  }
  .tabs button.tabActive {
    border-color: rgba(22, 179, 120, 0.45);
    background: rgba(22, 179, 120, 0.14);
    font-weight: 800;
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
  .msg {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(128, 128, 128, 0.22);
  }
  .msg.error {
    border-color: rgba(176, 0, 32, 0.55);
    background: rgba(176, 0, 32, 0.08);
  }
  .msg.notice {
    border-color: rgba(22, 179, 120, 0.45);
    background: rgba(22, 179, 120, 0.12);
  }
  @media (max-width: 1100px) {
    .form {
      grid-template-columns: 1fr;
    }
    .thead,
    .trow {
      grid-template-columns: 56px minmax(180px, 1fr) 96px 110px 96px 70px 96px;
    }
  }
</style>
