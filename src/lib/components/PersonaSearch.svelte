<script>
  import { usePersonaSearch } from '$core/usePersonaSearch.svelte.js'
  import { personaLabel } from '$core/personas'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import LinkIcon from '@lucide/svelte/icons/link'

  let {
    onSelect = null,
    placeholder = 'Escribí DNI, apellido o nombre…',
    label = 'Buscar persona existente (DNI, apellido o nombre)',
    minChars = 2,
    debounceMs = 300,
  } = $props()

  const ps = usePersonaSearch({ minChars, debounceMs })
</script>

<div class="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
  <Label class="text-xs text-muted-foreground">{label}</Label>
  <div class="mt-1.5 flex items-center gap-2">
    <Input {placeholder} bind:value={ps.query} oninput={ps.search} />
    {#if ps.searching}
      <span class="text-xs text-muted-foreground">buscando…</span>
    {/if}
  </div>
  {#if ps.results.length > 0}
    <div class="mt-2 flex flex-col gap-1">
      {#each ps.results as p (p.id)}
        <button
          class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10"
          onclick={() => onSelect?.(p)}
        >
          <LinkIcon class="size-3.5 shrink-0 text-primary" />
          <strong>{personaLabel(p)}</strong>
          <span class="text-muted-foreground"> · DNI {p.dni || '-'} · {p.localidad || ''}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
