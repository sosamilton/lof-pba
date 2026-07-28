<script>
  import { onMount } from 'svelte'
  import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId } from '../grist'
  import { findOrCreatePersona, isValidDni, normalizeCuil, normalizeDni, personaLabel, searchPersonas } from '../personas'

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
  let listOpen = true

  let personaSearch = ''
  let personaResults = []
  let personaSearching = false
  let linkedPersona = null
  let dniWarning = ''

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

  $: showList = listOpen && filtered.length > 0

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
    listOpen = true
    linkedPersona = null
    dniWarning = ''
    personaSearch = ''
    personaResults = []
    form = {
      id: s.id,
      persona_id: s.persona_id || null,
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
    listOpen = false
    linkedPersona = null
    personaSearch = ''
    personaResults = []
    dniWarning = ''
    form = {
      persona_id: null,
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

  const doPersonaSearch = async () => {
    if (!personaSearch || personaSearch.length < 2) {
      personaResults = []
      return
    }
    personaSearching = true
    try {
      personaResults = await searchPersonas(personaSearch)
    } catch (e) {
      error = e?.message || String(e)
      personaResults = []
    } finally {
      personaSearching = false
    }
  }

  const selectPersona = (p) => {
    linkedPersona = p
    personaResults = []
    personaSearch = ''
    dniWarning = ''
    form.persona_id = p.id
    form.dni = p.dni || form.dni
    form.cuil = p.cuil || form.cuil
    form.apellido = p.apellido || form.apellido
    form.nombre = p.nombre || form.nombre
    form.domicilio = p.domicilio || form.domicilio
    form.localidad = p.localidad || form.localidad
    form.telefono = p.telefono || form.telefono
    form.email = p.email || form.email
  }

  const unlinkPersona = () => {
    linkedPersona = null
    form.persona_id = null
  }

  const onDniInput = () => {
    const d = normalizeDni(form.dni)
    if (d && !isValidDni(d)) {
      dniWarning = 'DNI inválido (debe tener 7 u 8 dígitos)'
    } else {
      dniWarning = ''
    }
  }

  const save = async () => {
    notice = ''
    error = ''

    if (dniWarning) {
      error = 'Corregí el DNI antes de guardar.'
      return
    }

    try {
      const personaData = {
        dni: normalizeDni(form.dni) || null,
        cuil: normalizeCuil(form.cuil) || null,
        apellido: form.apellido || null,
        nombre: form.nombre || null,
        domicilio: form.domicilio || null,
        localidad: form.localidad || null,
        telefono: form.telefono || null,
        email: form.email || null
      }

      let personaId = form.persona_id

      if (!personaId && (personaData.dni || personaData.apellido || personaData.nombre)) {
        const persona = await findOrCreatePersona(personaData)
        personaId = persona?.id || null
        linkedPersona = persona
      }

      const fields = { ...form }
      delete fields.id
      fields.persona_id = personaId || null

      fields.dni = normalizeDni(form.dni) || null
      fields.cuil = normalizeCuil(form.cuil) || null

      Object.keys(fields).forEach((k) => {
        if (fields[k] === '' || fields[k] === null) delete fields[k]
      })
      if (!showBaja) {
        delete fields.fecha_baja
        delete fields.motivo_baja
      } else if (!form.fecha_baja) {
        delete fields.motivo_baja
      }

      if (!tableId) {
        error = 'No se encontró la tabla socios. Ejecutá "Actualizar schema" en Inicio.'
        return
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

  <div class:singlePane={!showList} class="grid">
    {#if showList}
      <div class="list">
        {#each filtered as s (s.id)}
          <button class:selected={form?.id === s.id} on:click={() => select(s)}>
            <div class="name">{s.apellido}, {s.nombre}</div>
            <div class="sub">{isActivo(s) ? 'Activo' : 'Baja'} · DNI {s.dni || '-'} · {s.localidad || ''}</div>
          </button>
        {/each}
      </div>
    {/if}

    <div class="editor">
      {#if form}
        <h2>{form.id ? 'Editar socio' : 'Nuevo socio'}</h2>

        <div class="personaBox">
          {#if linkedPersona}
            <div class="personaLinked">
              <span class="badgePersona">Persona vinculada: {personaLabel(linkedPersona)}</span>
              <button class="btn secondary small" on:click={unlinkPersona}>Desvincular</button>
            </div>
          {:else}
            <label class="personaLabel">Buscar persona existente (DNI, apellido o nombre)</label>
            <div class="personaSearchRow">
              <input
                placeholder="Escribí DNI, apellido o nombre…"
                bind:value={personaSearch}
                on:input={doPersonaSearch}
              />
              {#if personaSearching}
                <span class="muted">buscando…</span>
              {/if}
            </div>
            {#if personaResults.length > 0}
              <div class="personaResults">
                {#each personaResults as p (p.id)}
                  <button class="personaResult" on:click={() => selectPersona(p)}>
                    <strong>{personaLabel(p)}</strong>
                    <span class="muted"> · DNI {p.dni || '-'} · {p.localidad || ''}</span>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>

        {#if form.id}
          <div class="toolbar">
            <button class="btn secondary" on:click={() => (showBaja = !showBaja)}>{showBaja ? 'Ocultar baja' : 'Dar de baja'}</button>
            {#if showList}
              <button class="btn secondary" on:click={() => (listOpen = false)}>Ocultar lista</button>
            {/if}
          </div>
        {:else}
          <div class="toolbar">
            <button class="btn secondary" on:click={() => (listOpen = true)} disabled={filtered.length === 0}>Ver lista</button>
          </div>
        {/if}
        <div class="form">
          <div>
            <label>DNI</label>
            <input bind:value={form.dni} on:input={onDniInput} />
            {#if dniWarning}
              <div class="fieldWarn">{dniWarning}</div>
            {/if}
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
        {#if filtered.length === 0}
          <div class="empty">
            <div class="emptyTitle">Todavía no hay socios</div>
            <div class="emptySub">Creá el primer socio para empezar.</div>
            <div class="emptyActions">
              <button class="btn" on:click={nuevo}>Nuevo socio</button>
            </div>
          </div>
        {:else}
          <div class="muted">Seleccioná un socio o creá uno nuevo.</div>
        {/if}
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
  .btn.small {
    padding: 5px 8px;
    font-size: 12px;
    font-weight: 700;
  }
  .muted {
    opacity: 0.7;
    font-size: 13px;
  }
  .personaBox {
    border: 1px solid rgba(22, 179, 120, 0.25);
    border-radius: 12px;
    padding: 10px 12px;
    margin-bottom: 12px;
    background: rgba(22, 179, 120, 0.06);
  }
  .personaLabel {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 5px;
  }
  .personaSearchRow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .personaSearchRow input {
    flex: 1;
  }
  .personaResults {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .personaResult {
    text-align: left;
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    font-size: 13px;
  }
  .personaResult:hover {
    background: rgba(22, 179, 120, 0.12);
  }
  .personaLinked {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .badgePersona {
    font-size: 13px;
    font-weight: 700;
  }
  .fieldWarn {
    font-size: 11px;
    color: rgba(176, 0, 32, 0.8);
    margin-top: 3px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(280px, 420px) 1fr;
    gap: 12px;
    align-items: start;
  }
  .grid.singlePane {
    grid-template-columns: 1fr;
  }
  .list {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    overflow: hidden;
    background: rgba(128, 128, 128, 0.06);
    max-height: calc(100vh - 200px);
    overflow-y: auto;
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
    gap: 8px;
    margin: -2px 0 10px 0;
    flex-wrap: wrap;
  }
  .empty {
    border: 1px dashed rgba(128, 128, 128, 0.3);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.04);
  }
  .emptyTitle {
    font-weight: 900;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .emptySub {
    opacity: 0.75;
    font-size: 13px;
    margin-bottom: 12px;
  }
  .emptyActions {
    display: flex;
    justify-content: flex-end;
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
