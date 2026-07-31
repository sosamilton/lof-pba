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
    popoverWidth = '300px',
  } = $props()

  let open = $state(false)
  let search = $state('')

  const MIN_CHARS = 3
  const LARGE_THRESHOLD = 50
  let isLarge = $derived(items.length > LARGE_THRESHOLD)
  let canSearch = $derived(!isLarge || search.trim().length >= MIN_CHARS)

  let filtered = $derived.by(() => {
    if (isLarge && search.trim().length < MIN_CHARS) return []
    if (!isLarge) return items
    const q = normalize(search)
    return items.filter((item) => normalize(item.label).includes(q))
  })

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
  <Popover.Content class="p-0" style="--bit-popover-width: {popoverWidth}; width: {popoverWidth};">
    <Command.Root shouldFilter={false}>
      <Command.Input bind:value={search} placeholder={searchPlaceholder} />
      <Command.List>
        {#if !canSearch}
          <div class="py-6 text-center text-sm text-muted-foreground">
            Escribí al menos {MIN_CHARS} letras para buscar…
          </div>
        {:else if filtered.length === 0}
          <div class="py-6 text-center text-sm text-muted-foreground">
            No se encontraron resultados.
          </div>
        {:else}
          <Command.Group>
            {#each filtered as item (item.value)}
              <Command.Item
                onSelect={() => select(item.value)}
                class="flex items-center gap-2 {String(item.value) === String(value) ? 'text-primary font-medium' : ''}"
              >
                <CheckIcon class="size-4 shrink-0 {String(item.value) === String(value) ? 'opacity-100 text-primary' : 'opacity-0'}" />
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
        {/if}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
