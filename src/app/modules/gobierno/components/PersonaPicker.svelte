<script>
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import LinkIcon from '@lucide/svelte/icons/link'
  import UnlinkIcon from '@lucide/svelte/icons/unlink'
  import { personaLabel } from '$app/modules/comunidad/personas/personasApi.js'

  let {
    personaId = null,
    apellidoNombre = '',
    dni = '',
    cuil = '',
    disabled = false,
    searchValue = '',
    searching = false,
    results = [],
    onsearch = () => {},
    onpick = () => {},
    onunlink = () => {},
    compact = false,
  } = $props()
</script>

<div class="flex flex-col gap-1">
  {#if personaId}
    <div class="flex items-center gap-2">
      <Input value={apellidoNombre} disabled class={compact ? 'h-8 text-sm' : 'h-9 text-sm'} />
      <Button variant="ghost" size="sm" class="h-8 shrink-0 px-2" onclick={onunlink} aria-label="Desvincular persona">
        <UnlinkIcon data-icon="inline-start" />
      </Button>
    </div>
  {:else}
    <Input
      value={searchValue}
      oninput={(e) => onsearch(e.target.value)}
      placeholder="Buscar por nombre o DNI…"
      class={compact ? 'h-8 text-xs' : 'h-9 text-sm'}
    />
    {#if searching}
      <span class="text-xs text-muted-foreground">Buscando…</span>
    {/if}
    {#if results.length > 0}
      <div class="flex flex-col gap-1">
        {#each results as p (p.id)}
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-primary/10"
            onclick={() => onpick(p)}
          >
            <LinkIcon class="size-3 shrink-0 text-primary" />
            <span class="flex-1">{personaLabel(p)}</span>
            {#if p.dni}<span class="text-muted-foreground">· DNI {p.dni}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
