<script>
  import { onMount } from 'svelte'
  import { fetchRecords, gristReady, isInGrist, resolveTableId } from '../grist'

  let loading = true
  let error = ''
  let tableId
  let movimientos = []

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

  const load = async () => {
    loading = true
    error = ''
    if (!isInGrist()) {
      loading = false
      return
    }
    try {
      await gristReady()
      tableId = await resolveTableId(['Movimientos', 'movimientos'])
      movimientos = await fetchRecords(tableId)
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
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
      <button class="btn secondary" on:click={load}>Recargar</button>
    </div>
    <div class="muted">{filtered.length} movimientos</div>
  </div>

  {#if filtered.length === 0}
    <div class="empty">
      <div class="emptyTitle">No hay movimientos</div>
      <div class="emptySub">Cuando cargues movimientos en Grist, van a aparecer acá.</div>
    </div>
  {:else}
    <div class="list">
      {#each filtered as m (m.id)}
        <div class="item">
          <div class="title">{m.fecha} · {m.tipo_movimiento} · ${m.importe}</div>
          <div class="sub">{m.detalle || ''}</div>
        </div>
      {/each}
    </div>
  {/if}

  {#if error}
    <div class="msg error">{error}</div>
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
  .btn.secondary {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 700;
    background: rgba(128, 128, 128, 0.18);
    color: inherit;
  }
  .muted {
    opacity: 0.7;
    font-size: 13px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
</style>
