<script>
  import { Input } from '$lib/components/ui/input'
  import SearchIcon from '@lucide/svelte/icons/search'

  let { value = $bindable(), placeholder = 'Buscar…', ariaLabel = 'Buscar', class: klass = '' } = $props()
</script>

<div class="relative flex-1 min-w-[200px] {klass}">
  <SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  <Input {placeholder} bind:value aria-label={ariaLabel} data-shortcut="search" class="pl-9" />
</div>
