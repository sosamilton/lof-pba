<script>
  import { useInfiniteScroll } from '$lib/useInfiniteScroll.svelte.js'
  import { Badge } from '$lib/components/ui/badge'

  let {
    items = [],
    selectedId = null,
    onSelect = () => {},
    itemLabel = (r) => `${r.apellido || ''}, ${r.nombre || ''}`,
    itemSub = (r) => '',
    itemBadges = () => [],
    emptyIcon = null,
  } = $props()

  const scroll = useInfiniteScroll(() => items)
</script>

{#if items.length > 0}
  <div bind:this={scroll.scrollEl} onscroll={scroll.onScroll} class="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-border bg-card">
    {#each scroll.visible as r (r.id)}
      <button
        class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {selectedId === r.id ? 'bg-primary/10' : ''}"
        onclick={() => onSelect(r)}
        aria-pressed={selectedId === r.id}
      >
        <div class="font-semibold text-sm">{itemLabel(r)}</div>
        <div class="text-xs text-muted-foreground">
          {#each itemBadges(r) as b (b.text)}
            <Badge variant={b.variant || 'secondary'} class="mr-1 text-[10px]">{b.text}</Badge>
          {/each}
          {itemSub(r)}
        </div>
      </button>
    {/each}
    {#if scroll.hasMore}
      <div class="py-3 text-center text-xs text-muted-foreground">Cargando más…</div>
    {/if}
  </div>
{/if}
