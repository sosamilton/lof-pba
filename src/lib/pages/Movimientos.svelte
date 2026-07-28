<script>
  import { onMount } from 'svelte'
  import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId } from '../grist'

  let loading = true
  let error = ''
  let notice = ''
  let tableId
  let tEjercicios
  let tRubros
  let tSubrubros
  let tCuentas
  let tSocios
  let movimientos = []
  let ejercicios = []
  let ejercicio = null
  let rubros = []
  let subrubros = []
  let cuentas = []
  let socios = []

  let selectedId = null
  let form = null
  let listOpen = true

  let q = ''
  let tipo = ''

  const normalize = (s) => String(s || '').toLowerCase().trim()

  $: filtered = movimientos
    .filter((m) => (tipo ? String(m.tipo_movimiento || '') === tipo : true))
    .filter((m) => {
      const t = normalize(q)
      if (!t) return true
      return normalize(m.detalle).includes(t)
    })
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))

  $: showList = listOpen && filtered.length > 0

  $: rubroById = new Map(rubros.map((r) => [Number(r.id), r]))
  $: subrubrosByRubro = (() => {
    const map = new Map()
    for (const s of subrubros) {
      const k = Number(s.rubro_id)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(s)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => normalize(a.nombre_subrubro).localeCompare(normalize(b.nombre_subrubro)))
    }
    return map
  })()

  $: cuentaById = new Map(cuentas.map((c) => [Number(c.id), c]))

  const monthKey = (iso) => String(iso || '').slice(0, 7)

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
      tableId = await resolveTableId(['Movimientos', 'movimientos'])
      tEjercicios = await resolveTableId(['Ejercicios', 'ejercicios'])
      tRubros = await resolveTableId(['Rubros PIA', 'rubros_pia'])
      tSubrubros = await resolveTableId(['Subrubros', 'subrubros'])
      tCuentas = await resolveTableId(['Cuentas', 'cuentas'])
      tSocios = await resolveTableId(['Socios', 'socios'])

      movimientos = await fetchRecords(tableId)
      ejercicios = await fetchRecords(tEjercicios)
      ejercicio = ejercicios.find((e) => e.en_curso === true) || null

      rubros = await fetchRecords(tRubros)
      rubros.sort((a, b) => normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial)))

      subrubros = await fetchRecords(tSubrubros)
      cuentas = await fetchRecords(tCuentas)
      cuentas.sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

      socios = await fetchRecords(tSocios)
      socios.sort((a, b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)))
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const select = (m) => {
    selectedId = m?.id || null
    listOpen = true
    form = {
      id: m?.id || null,
      fecha: m?.fecha ? String(m.fecha).slice(0, 10) : '',
      tipo_movimiento: m?.tipo_movimiento || 'Entrada',
      rubro_id: m?.rubro_id ?? '',
      subrubro_id: m?.subrubro_id ?? '',
      detalle: m?.detalle || '',
      importe: m?.importe ?? '',
      cuenta_id: m?.cuenta_id ?? '',
      destino_bancario: m?.destino_bancario || '',
      cuenta_destino_id: m?.cuenta_destino_id ?? '',
      socio_id: m?.socio_id ?? ''
    }
  }

  const nuevo = () => {
    selectedId = null
    listOpen = false
    const today = new Date().toISOString().slice(0, 10)
    form = {
      id: null,
      fecha: today,
      tipo_movimiento: 'Entrada',
      rubro_id: '',
      subrubro_id: '',
      detalle: '',
      importe: '',
      cuenta_id: '',
      destino_bancario: '',
      cuenta_destino_id: '',
      socio_id: ''
    }
  }

  const validate = () => {
    if (!ejercicio) return 'No hay ejercicio en curso. Activá uno en “Cooperadora”.'
    if (!form?.fecha) return 'Completá la fecha.'
    if (!form?.tipo_movimiento) return 'Elegí el tipo de movimiento.'
    if (!form?.importe || Number(form.importe) <= 0) return 'Completá el importe (mayor a 0).'
    if (!form?.cuenta_id) return 'Elegí la caja/cuenta.'
    if (form.tipo_movimiento !== 'Traspaso') {
      if (!form?.rubro_id) return 'Elegí el rubro.'
    }
    if (form.tipo_movimiento === 'Traspaso') {
      if (!form?.cuenta_destino_id) return 'Elegí la cuenta destino.'
      if (Number(form.cuenta_destino_id) === Number(form.cuenta_id)) return 'La cuenta destino no puede ser la misma.'
    }
    return ''
  }

  const save = async () => {
    notice = ''
    error = ''
    const v = validate()
    if (v) {
      error = v
      return
    }

    try {
      const cuenta = cuentaById.get(Number(form.cuenta_id))
      const isBanco = String(cuenta?.nombre_cuenta || '') === 'Banco'

      const fields = {
        fecha: form.fecha,
        ejercicio_id: ejercicio.id,
        tipo_movimiento: form.tipo_movimiento,
        rubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.rubro_id || ''),
        subrubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.subrubro_id || ''),
        detalle: String(form.detalle || '').trim(),
        importe: Number(form.importe),
        cuenta_id: form.cuenta_id,
        destino_bancario: isBanco ? (form.destino_bancario || '') : '',
        cuenta_destino_id: form.tipo_movimiento === 'Traspaso' ? (form.cuenta_destino_id || '') : '',
        socio_id: form.socio_id || '',
        creado_por: 'SPA',
        creado_el: new Date().toISOString()
      }

      Object.keys(fields).forEach((k) => {
        if (fields[k] === '') delete fields[k]
      })

      if (form.id) {
        await applyUserActions([['UpdateRecord', tableId, form.id, fields]])
        notice = 'Movimiento actualizado.'
      } else {
        await applyUserActions([['AddRecord', tableId, null, fields]])
        notice = 'Movimiento creado.'
      }
      movimientos = await fetchRecords(tableId)
      if (form.id) {
        const updated = movimientos.find((m) => m.id === form.id)
        if (updated) select(updated)
      } else {
        form = null
        listOpen = true
      }
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const onRubroChange = () => {
    const list = subrubrosByRubro.get(Number(form.rubro_id)) || []
    if (list.length === 0) {
      form.subrubro_id = ''
      return
    }
    const exists = list.some((s) => Number(s.id) === Number(form.subrubro_id))
    if (!exists) form.subrubro_id = ''
  }

  onMount(load)
</script>

{#if !isInGrist()}
  <h1>Movimientos</h1>
  <p>Esta pantalla solo funciona dentro de Grist.</p>
{:else if loading}
  <p>Cargando…</p>
{:else}
  <div class="top">
    <div class="filters">
      <input placeholder="Buscar en detalle" bind:value={q} />
      <select bind:value={tipo}>
        <option value="">Todos</option>
        <option value="Entrada">Entrada</option>
        <option value="Salida">Salida</option>
        <option value="Traspaso">Traspaso</option>
      </select>
      <button class="btn" on:click={nuevo}>Nuevo movimiento</button>
      <button class="btn secondary" on:click={load}>Recargar</button>
    </div>
    <div class="muted">{filtered.length} movimientos</div>
  </div>

  {#if !ejercicio}
    <div class="empty">
      <div class="emptyTitle">No hay ejercicio en curso</div>
      <div class="emptySub">Activá un ejercicio en “Cooperadora” para registrar movimientos.</div>
    </div>
  {:else}
    <div class:grid={true} class:singlePane={!showList}>
      {#if showList}
        <div class="list">
          {#if filtered.length === 0}
            <div class="empty">
              <div class="emptyTitle">No hay movimientos</div>
              <div class="emptySub">Creá el primer movimiento para empezar.</div>
            </div>
          {:else}
            {#each filtered as m (m.id)}
              <button class:selected={m.id === selectedId} on:click={() => select(m)}>
                <div class="title">{m.fecha} · {m.tipo_movimiento} · ${m.importe}</div>
                <div class="sub">
                  {#if m.tipo_movimiento === 'Traspaso'}
                    {cuentaById.get(Number(m.cuenta_id))?.nombre_cuenta || ''} → {cuentaById.get(Number(m.cuenta_destino_id))?.nombre_cuenta || ''}
                  {:else}
                    {rubroById.get(Number(m.rubro_id))?.codigo_rubro || ''} · {m.detalle || ''}
                  {/if}
                </div>
              </button>
            {/each}
          {/if}
        </div>
      {/if}

      <div class="editor">
        {#if form}
          <div class="editorHead">
            <h2>{form.id ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
            <div class="actions">
              {#if showList}
                <button class="btn secondary" on:click={() => (listOpen = false)}>Ocultar lista</button>
              {/if}
              <button class="btn" on:click={save}>Guardar</button>
            </div>
          </div>

          <div class="form">
            <div class="row">
              <label>Fecha</label>
              <input type="date" bind:value={form.fecha} />
            </div>
            <div class="row">
              <label>Tipo</label>
              <select bind:value={form.tipo_movimiento}>
                <option value="Entrada">Entrada</option>
                <option value="Salida">Salida</option>
                <option value="Traspaso">Traspaso</option>
              </select>
            </div>

            <div class="row span2">
              <label>Detalle</label>
              <textarea bind:value={form.detalle} placeholder="Descripción corta (p.ej. Compra kiosco, Pago proveedor, Aporte socio)"></textarea>
            </div>

            <div class="row">
              <label>Importe</label>
              <input type="number" bind:value={form.importe} />
            </div>
            <div class="row">
              <label>Caja/cuenta</label>
              <select bind:value={form.cuenta_id}>
                <option value="">Elegir…</option>
                {#each cuentas as c (c.id)}
                  <option value={c.id}>{c.nombre_cuenta}</option>
                {/each}
              </select>
            </div>

            {#if form.tipo_movimiento === 'Traspaso'}
              <div class="row span2">
                <label>Cuenta destino</label>
                <select bind:value={form.cuenta_destino_id}>
                  <option value="">Elegir…</option>
                  {#each cuentas as c (c.id)}
                    <option value={c.id}>{c.nombre_cuenta}</option>
                  {/each}
                </select>
              </div>
            {:else}
              <div class="row">
                <label>Rubro</label>
                <select bind:value={form.rubro_id} on:change={onRubroChange}>
                  <option value="">Elegir…</option>
                  {#each rubros as r (r.id)}
                    <option value={r.id}>{r.codigo_rubro} · {r.nombre_oficial}</option>
                  {/each}
                </select>
              </div>
              <div class="row">
                <label>Subrubro</label>
                <select bind:value={form.subrubro_id} disabled={!form.rubro_id}>
                  <option value="">(Opcional)</option>
                  {#each (subrubrosByRubro.get(Number(form.rubro_id)) || []) as s (s.id)}
                    <option value={s.id}>{s.nombre_subrubro}</option>
                  {/each}
                </select>
              </div>
            {/if}

            {#if String(cuentaById.get(Number(form.cuenta_id))?.nombre_cuenta || '') === 'Banco'}
              <div class="row span2">
                <label>Destino en banco</label>
                <select bind:value={form.destino_bancario}>
                  <option value="">(Opcional)</option>
                  <option value="CuentaCorriente">Cuenta corriente</option>
                  <option value="PlazoFijo">Plazo fijo</option>
                </select>
              </div>
            {/if}

            <div class="row span2">
              <label>Socio (opcional)</label>
              <select bind:value={form.socio_id}>
                <option value="">(Ninguno)</option>
                {#each socios as s (s.id)}
                  <option value={s.id}>{s.apellido}, {s.nombre} · DNI {s.dni || '-'}</option>
                {/each}
              </select>
            </div>

            <div class="row span2 hint">
              Se registra en el período <span class="mono">{monthKey(form.fecha)}</span> del ejercicio en curso.
            </div>
          </div>
        {:else}
          {#if filtered.length === 0}
            <div class="empty">
              <div class="emptyTitle">Listo para cargar movimientos</div>
              <div class="emptySub">Creá el primer movimiento para empezar.</div>
              <div class="emptyActions">
                <button class="btn" on:click={nuevo}>Nuevo movimiento</button>
              </div>
            </div>
          {:else}
            <div class="muted">Seleccioná un movimiento o creá uno nuevo.</div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}

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
    margin: 0;
    font-size: 16px;
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
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--grist-theme-input-bg, rgba(255, 255, 255, 0.85));
    color: inherit;
  }
  textarea {
    min-height: 64px;
    resize: vertical;
  }
  .btn {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 800;
    background: rgba(22, 179, 120, 0.9);
    color: #fff;
  }
  .btn.secondary {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 800;
    background: rgba(128, 128, 128, 0.18);
    color: inherit;
  }
  .muted {
    opacity: 0.7;
    font-size: 13px;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.95em;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(300px, 440px) 1fr;
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
  .editor {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.06);
  }
  .editorHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
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
  }
  .emptyActions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
  .item {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    padding: 12px;
    background: rgba(128, 128, 128, 0.06);
  }
  .title {
    font-weight: 800;
    font-size: 13px;
  }
  .sub {
    font-size: 12px;
    opacity: 0.75;
    margin-top: 4px;
  }
  .form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
    margin-top: 10px;
  }
  .row label {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 5px;
  }
  .row.span2 {
    grid-column: 1 / -1;
  }
  .row.hint {
    opacity: 0.75;
    font-size: 13px;
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
  }
</style>
