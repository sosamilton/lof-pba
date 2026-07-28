<script>
  import { onMount } from 'svelte'
  import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId } from '../grist'

  let loading = true
  let error = ''
  let notice = ''

  let tableId
  let socios = []

  let q = ''
  let estado = 'activos'
  let tipo = ''

  let selected = null
  let form = null
  let showBaja = false

  const normalize = (s) => String(s || '').toLowerCase().trim()

  const isActivo = (s) => !s.fecha_baja

  const matches = (s, query) => {
    const t = normalize(query)
    if (!t) return true
    const hay = [
      s.apellido,
      s.nombre,
      s.dni,
      s.cuil,
      s.email,
      s.telefono,
      s.localidad,
      s.domicilio
    ]
      .map((v) => normalize(v))
      .join(' ')
    return hay.includes(t)
  }

  $: filtered = socios
    .filter((s) => {
      if (estado === 'activos') return isActivo(s)
      if (estado === 'bajas') return !isActivo(s)
      return true
    })
    .filter((s) => (tipo ? String(s.tipo_socio || '') === tipo : true))
    .filter((s) => matches(s, q))
    .sort((a, b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)))

  const load = async () => {
    loading = true
    error = ''
    notice = ''
    selected = null
    form = null

    if (!isInGrist()) {
      loading = false
      return
    }

    try {
      await gristReady()
      tableId = await resolveTableId(['Socios', 'socios'])
      socios = await fetchRecords(tableId)
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const select = (s) => {
    selected = s
    showBaja = Boolean(s.fecha_baja)
    form = {
      id: s.id,
      dni: s.dni || '',
      cuil: s.cuil || '',
      apellido: s.apellido || '',
      nombre: s.nombre || '',
      domicilio: s.domicilio || '',
      localidad: s.localidad || '',
      telefono: s.telefono || '',
      email: s.email || '',
      tipo_socio: s.tipo_socio || 'Activo',
      fecha_alta: s.fecha_alta ? String(s.fecha_alta).slice(0, 10) : '',
      fecha_baja: s.fecha_baja ? String(s.fecha_baja).slice(0, 10) : '',
      motivo_baja: s.motivo_baja || ''
    }
  }

  const nuevo = () => {
    selected = null
    showBaja = false
    form = {
      dni: '',
      cuil: '',
      apellido: '',
      nombre: '',
      domicilio: '',
      localidad: '',
      telefono: '',
      email: '',
      tipo_socio: 'Activo',
      fecha_alta: new Date().toISOString().slice(0, 10),
      fecha_baja: '',
      motivo_baja: ''
    }
  }

  const save = async () => {
    notice = ''
    error = ''

    try {
      const fields = { ...form }
      delete fields.id
      Object.keys(fields).forEach((k) => {
        if (fields[k] === '') delete fields[k]
      })
      if (!showBaja) {
        delete fields.fecha_baja
        delete fields.motivo_baja
      } else if (!form.fecha_baja) {
        delete fields.motivo_baja
      }

      if (form.id) {
        await applyUserActions([['UpdateRecord', tableId, form.id, fields]])
        notice = 'Socio actualizado.'
      } else {
        await applyUserActions([['AddRecord', tableId, null, fields]])
        notice = 'Socio creado.'
      }
      socios = await fetchRecords(tableId)
      if (form.id) {
        const updated = socios.find((s) => s.id === form.id)
        if (updated) select(updated)
      } else {
        form = null
      }
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  onMount(load)
</script>

{#if !isInGrist()}
  <h1>Socios</h1>
  <p>Esta pantalla solo funciona dentro de Grist.</p>
{:else if loading}
  <p>Cargando…</p>
{:else}
  <div class="top">
    <div class="filters">
      <input placeholder="Buscar (apellido, nombre, DNI, CUIL, email, teléfono…)" bind:value={q} />
      <select bind:value={estado}>
        <option value="activos">Activos</option>
        <option value="bajas">Bajas</option>
        <option value="todos">Todos</option>
      </select>
      <select bind:value={tipo}>
        <option value="">Todos los tipos</option>
        <option value="Activo">Activo</option>
        <option value="Honorario">Honorario</option>
        <option value="Adherente">Adherente</option>
      </select>
      <button class="btn" on:click={nuevo}>Nuevo socio</button>
      <button class="btn secondary" on:click={load}>Recargar</button>
    </div>
    <div class="muted">{filtered.length} socios</div>
  </div>

  <div class="grid">
    <div class="list">
      {#each filtered as s (s.id)}
        <button class:selected={form?.id === s.id} on:click={() => select(s)}>
          <div class="name">{s.apellido}, {s.nombre}</div>
          <div class="sub">{isActivo(s) ? 'Activo' : 'Baja'} · DNI {s.dni || '-'} · {s.localidad || ''}</div>
        </button>
      {/each}
    </div>

    <div class="editor">
      {#if form}
        <h2>{form.id ? 'Editar socio' : 'Nuevo socio'}</h2>
        {#if form.id}
          <div class="toolbar">
            <button class="btn secondary" on:click={() => (showBaja = !showBaja)}>{showBaja ? 'Ocultar baja' : 'Dar de baja'}</button>
          </div>
        {/if}
        <div class="form">
          <div>
            <label>DNI</label>
            <input bind:value={form.dni} />
          </div>
          <div>
            <label>CUIL</label>
            <input bind:value={form.cuil} />
          </div>
          <div>
            <label>Apellido</label>
            <input bind:value={form.apellido} />
          </div>
          <div>
            <label>Nombre</label>
            <input bind:value={form.nombre} />
          </div>
          <div>
            <label>Tipo</label>
            <select bind:value={form.tipo_socio}>
              <option value="Activo">Activo</option>
              <option value="Honorario">Honorario</option>
              <option value="Adherente">Adherente</option>
            </select>
          </div>
          <div>
            <label>Fecha alta</label>
            <input type="date" bind:value={form.fecha_alta} />
          </div>
          <div>
            <label>Domicilio</label>
            <input bind:value={form.domicilio} />
          </div>
          <div>
            <label>Localidad</label>
            <input bind:value={form.localidad} />
          </div>
          <div>
            <label>Teléfono</label>
            <input bind:value={form.telefono} />
          </div>
          <div>
            <label>Email</label>
            <input type="email" bind:value={form.email} />
          </div>
          {#if form.id && showBaja}
            <div>
              <label>Fecha baja</label>
              <input type="date" bind:value={form.fecha_baja} />
            </div>
            <div>
              <label>Motivo baja</label>
              <input bind:value={form.motivo_baja} disabled={!form.fecha_baja} />
            </div>
          {/if}
        </div>
        <div class="actions">
          <button class="btn" on:click={save}>Guardar</button>
        </div>
      {:else}
        <div class="muted">Seleccioná un socio o creá uno nuevo.</div>
      {/if}
    </div>
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
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .filters {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  input,
  select {
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--grist-theme-input-bg, rgba(255, 255, 255, 0.85));
    color: inherit;
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
  .muted {
    opacity: 0.7;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: 420px 1fr;
    gap: 12px;
  }
  .list {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    overflow: hidden;
    background: rgba(128, 128, 128, 0.06);
  }
  .list button {
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 10px 12px;
    cursor: pointer;
    border-top: 1px solid rgba(128, 128, 128, 0.15);
    color: inherit;
  }
  .list button:first-child {
    border-top: 0;
  }
  .list button:hover {
    background: rgba(22, 179, 120, 0.1);
  }
  .list button.selected {
    background: rgba(22, 179, 120, 0.16);
  }
  .name {
    font-weight: 800;
    font-size: 14px;
  }
  .sub {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 2px;
  }
  .editor {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.06);
  }
  .editor h2 {
    margin: 0 0 12px 0;
    font-size: 16px;
  }
  .toolbar {
    display: flex;
    justify-content: flex-end;
    margin: -2px 0 10px 0;
  }
  .form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
  }
  .form label {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 5px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
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
    .grid {
      grid-template-columns: 1fr;
    }
    .form {
      grid-template-columns: 1fr;
    }
  }
</style>
