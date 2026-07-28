<script>
  import { onMount } from 'svelte'
  import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId } from '../grist'
  import { normalize, dateToInput, monthKey, TIPOS_MOVIMIENTO, TABLE_PREFERRED_IDS } from '../utils'
  import '../shared.css'

  let loading = $state(true)
  let error = $state('')
  let notice = $state('')
  let busy = $state(false)
  let tableId = $state()
  let tEjercicios = $state()
  let tRubros = $state()
  let tSubrubros = $state()
  let tCuentas = $state()
  let tSocios = $state()
  let movimientos = $state([])
  let ejercicios = $state([])
  let ejercicio = $state(null)
  let rubros = $state([])
  let subrubros = $state([])
  let cuentas = $state([])
  let socios = $state([])

  let selectedId = $state(null)
  let form = $state(null)
  let listOpen = $state(true)

  let q = $state('')
  let tipo = $state('')

  let filtered = $derived(
    movimientos
      .filter((m) => (tipo ? String(m.tipo_movimiento || '') === tipo : true))
      .filter((m) => {
        const t = normalize(q)
        if (!t) return true
        return normalize(m.detalle).includes(t)
      })
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  )

  let showList = $derived(listOpen && filtered.length > 0)

  let rubroById = $derived(new Map(rubros.map((r) => [Number(r.id), r])))
  let subrubrosByRubro = $derived.by(() => {
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
  })

  let cuentaById = $derived(new Map(cuentas.map((c) => [Number(c.id), c])))

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
      fecha: dateToInput(m?.fecha),
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

    busy = true
    try {
      if (!tableId) {
        error = 'No se encontró la tabla movimientos. Ejecutá "Actualizar schema" en Inicio.'
        return
      }

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
    } finally {
      busy = false
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
      <button class="btn" onclick={nuevo}>Nuevo movimiento</button>
      <button class="btn secondary" onclick={load}>Recargar</button>
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
              <button class:selected={m.id === selectedId} onclick={() => select(m)}>
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
                <button class="btn secondary" onclick={() => (listOpen = false)}>Ocultar lista</button>
              {/if}
              <button class="btn" onclick={save}>Guardar</button>
            </div>
          </div>

          <div class="form">
            <div class="row">
              <label>Fecha<input type="date" bind:value={form.fecha} /></label>
            </div>
            <div class="row">
              <label>Tipo<select bind:value={form.tipo_movimiento}>
                <option value="Entrada">Entrada</option>
                <option value="Salida">Salida</option>
                <option value="Traspaso">Traspaso</option>
              </select></label>
            </div>

            <div class="row span2">
              <label>Detalle<textarea bind:value={form.detalle} placeholder="Descripción corta (p.ej. Compra kiosco, Pago proveedor, Aporte socio)"></textarea></label>
            </div>

            <div class="row">
              <label>Importe<input type="number" bind:value={form.importe} /></label>
            </div>
            <div class="row">
              <label>Caja/cuenta<select bind:value={form.cuenta_id}>
                <option value="">Elegir…</option>
                {#each cuentas as c (c.id)}
                  <option value={c.id}>{c.nombre_cuenta}</option>
                {/each}
              </select></label>
            </div>

            {#if form.tipo_movimiento === 'Traspaso'}
              <div class="row span2">
                <label>Cuenta destino<select bind:value={form.cuenta_destino_id}>
                  <option value="">Elegir…</option>
                  {#each cuentas as c (c.id)}
                    <option value={c.id}>{c.nombre_cuenta}</option>
                  {/each}
                </select></label>
              </div>
            {:else}
              <div class="row">
                <label>Rubro<select bind:value={form.rubro_id} onchange={onRubroChange}>
                  <option value="">Elegir…</option>
                  {#each rubros as r (r.id)}
                    <option value={r.id}>{r.codigo_rubro} · {r.nombre_oficial}</option>
                  {/each}
                </select></label>
              </div>
              <div class="row">
                <label>Subrubro<select bind:value={form.subrubro_id} disabled={!form.rubro_id}>
                  <option value="">(Opcional)</option>
                  {#each (subrubrosByRubro.get(Number(form.rubro_id)) || []) as s (s.id)}
                    <option value={s.id}>{s.nombre_subrubro}</option>
                  {/each}
                </select></label>
              </div>
            {/if}

            {#if String(cuentaById.get(Number(form.cuenta_id))?.nombre_cuenta || '') === 'Banco'}
              <div class="row span2">
                <label>Destino en banco<select bind:value={form.destino_bancario}>
                  <option value="">(Opcional)</option>
                  <option value="CuentaCorriente">Cuenta corriente</option>
                  <option value="PlazoFijo">Plazo fijo</option>
                </select></label>
              </div>
            {/if}

            <div class="row span2">
              <label>Socio (opcional)<select bind:value={form.socio_id}>
                <option value="">(Ninguno)</option>
                {#each socios as s (s.id)}
                  <option value={s.id}>{s.apellido}, {s.nombre} · DNI {s.dni || '-'}</option>
                {/each}
              </select></label>
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
                <button class="btn" onclick={nuevo}>Nuevo movimiento</button>
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
  .grid {
    display: grid;
    grid-template-columns: minmax(300px, 440px) 1fr;
    gap: 12px;
    align-items: start;
  }
  .grid.singlePane {
    grid-template-columns: 1fr;
  }
  .editorHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
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
    margin-top: 10px;
  }
  .row.hint {
    opacity: 0.75;
    font-size: 13px;
  }
  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
