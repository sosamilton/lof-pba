<script>
  import { useInfiniteScroll } from '$lib/useInfiniteScroll.svelte.js'
  import { formatARS } from '$core/utils/utils'
  import { formatFecha } from '$core/format/format'

  let {
    items = [],
    selectedId = null,
    onSelect = () => {},
    rubroById = new Map(),
    cuentaById = new Map(),
  } = $props()

  const scroll = useInfiniteScroll(() => items)
</script>

{#if items.length > 0}
  <div bind:this={scroll.scrollEl} onscroll={scroll.onScroll} class="max-h-[calc(100dvh-180px)] overflow-y-auto rounded-lg border border-border bg-card">
    {#each scroll.visible as m (m.id)}
      <button
        class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {m.id === selectedId ? 'bg-primary/10' : ''}"
        onclick={() => onSelect(m)}
        aria-pressed={m.id === selectedId}
      >
        <div class="text-sm font-medium">{formatFecha(m.fecha)} · {m.tipo_movimiento} · {formatARS(m.importe)}</div>
        <div class="text-xs text-muted-foreground">
          {#if m.tipo_movimiento === 'Traspaso'}
            {cuentaById.get(Number(m.cuenta_id))?.nombre_cuenta || ''} → {cuentaById.get(Number(m.cuenta_destino_id))?.nombre_cuenta || ''}
          {:else}
            {rubroById.get(Number(m.rubro_id))?.codigo_rubro || ''} · {m.detalle || ''}
          {/if}
        </div>
      </button>
    {/each}
    {#if scroll.hasMore}
      <div class="py-3 text-center text-xs text-muted-foreground">Cargando más…</div>
    {/if}
  </div>
{/if}
