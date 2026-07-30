<script>
  import * as Popover from '$lib/components/ui/popover'
  import * as Command from '$lib/components/ui/command'
  import { Button } from '$lib/components/ui/button'
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
  } = $props()

  let open = $state(false)
  let search = $state('')

  let filtered = $derived(
    search
      ? items.filter((item) => normalize(item.label).includes(normalize(search)))
      : items
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
              <CheckIcon class="size-4 {String(item.value) === String(value) ? 'opacity-100' : 'opacity-0'}" />
              {item.label}
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
