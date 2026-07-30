<script>
  import * as Popover from '$lib/components/ui/popover'
  import * as Command from '$lib/components/ui/command'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import { normalize } from '$core/utils'

  let {
    value = $bindable(),
    items = [],
    placeholder = 'Seleccionar…',
    searchPlaceholder = 'Buscar…',
    disabled = false,
    class: className = '',
    onchange = null,
    maxResults = 50,
  } = $props()

  let open = $state(false)
  let search = $state('')

  // Filtrar y limitar resultados para no renderizar miles de items de golpe.
  // Sin búsqueda: mostrar solo los primeros maxResults (pre-carga).
  // Con búsqueda: filtrar y limitar también.
  let filtered = $derived.by(() => {
    const q = normalize(search)
    const source = q
      ? items.filter((item) => normalize(item.label).includes(q))
      : items
    return source.slice(0, maxResults)
  })

  let hasMore = $derived(
    search
      ? items.filter((item) => normalize(item.label).includes(normalize(search))).length > maxResults
      : items.length > maxResults
  )

  let selectedLabel = $derived(items.find((item) => String(item.value) === String(value))?.label || '')

  const select = (val) => {
    value = val
    open = false
    search = ''
    if (onchange) onchange(val)
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger class={className}>
    <Button
      variant="outline"
      role="combobox"
      {disabled}
      aria-expanded={open}
      class="w-full justify-between font-normal {selectedLabel ? '' : 'text-muted-foreground'}"
    >
      {selectedLabel || placeholder}
      <ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
    </Button>
  </Popover.Trigger>
  <Popover.Content class="w-[var(--bit-popover-width,300px)] p-0">
    <Command.Root>
      <Command.Input bind:value={search} placeholder={searchPlaceholder} />
      <Command.List>
        <Command.Empty>No se encontraron resultados.</Command.Empty>
        <Command.Group>
          {#each filtered as item (item.value)}
            <Command.Item
              onSelect={() => select(item.value)}
              class="flex items-center gap-2"
            >
              <CheckIcon class="size-4 shrink-0 {String(item.value) === String(value) ? 'opacity-100' : 'opacity-0'}" />
              <span class="flex-1 truncate">{item.label}</span>
              {#if item.badges}
                <span class="flex shrink-0 gap-1">
                  {#each item.badges as badge}
                    <Badge variant="secondary" class="text-[10px] px-1.5 py-0 h-4">{badge}</Badge>
                  {/each}
                </span>
              {/if}
            </Command.Item>
          {/each}
        </Command.Group>
        {#if hasMore}
          <div class="py-2 px-2 text-xs text-muted-foreground text-center">
            Mostrando {filtered.length} de {items.length}. Escribí para filtrar más.
          </div>
        {/if}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
