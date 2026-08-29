<script>
  import SearchInput from '$lib/components/SearchInput.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'
  import FilterIcon from '@lucide/svelte/icons/funnel'

  let {
    q = $bindable(),
    count = 0,
    countLabel = 'registros',
    searchPlaceholder = 'Buscar…',
    searchAriaLabel = 'Buscar',
    newLabel = 'Nuevo',
    newIcon = null,
    showReload = false,
    onNew = () => {},
    onReload = () => {},
    filters = [],
    children,
  } = $props()

  let filtrosOpen = $state(false)

  // Si no hay filtros, no mostrar el botón de toggle
  let hasFilters = $derived(filters.length > 0)
</script>

<!-- Fila siempre visible: búsqueda + acciones + contador + toggle de filtros (mobile) -->
<div class="mb-4 flex flex-wrap items-center gap-3">
  <SearchInput bind:value={q} placeholder={searchPlaceholder} ariaLabel={searchAriaLabel} />
  {@render children?.()}
  <Button data-shortcut="new" onclick={onNew}>
    {#if newIcon}{@render newIcon()}{/if}
    {newLabel}
  </Button>
  {#if showReload}
    <Button variant="outline" onclick={onReload}>Recargar</Button>
  {/if}
  <span class="text-sm text-muted-foreground">{count} {countLabel}</span>
  {#if hasFilters}
    <Button
      variant="outline"
      size="sm"
      class="md:hidden"
      onclick={() => (filtrosOpen = !filtrosOpen)}
      aria-expanded={filtrosOpen}
    >
      <FilterIcon data-icon="inline-start" />
      Filtros
    </Button>
  {/if}
</div>

<!-- Filtros: colapsables en mobile, siempre visibles en desktop -->
{#if hasFilters}
  <div class="mb-4 flex flex-wrap items-center gap-3 {filtrosOpen ? 'flex' : 'hidden'} md:flex">
    {#each filters as f (f.key)}
      <Select.Root
        type="single"
        value={f.value}
        allowDeselect={f.allowDeselect ?? false}
        onValueChange={(v) => f.onValueChange(v)}
      >
        <Select.Trigger class={f.triggerClass ? f.triggerClass.replace('w-[', 'w-full sm:w-[') : 'w-full sm:w-[140px]'} aria-label={f.ariaLabel}>
          <Select.Value placeholder={f.placeholder} />
        </Select.Trigger>
        <Select.Content>
          {#each f.options as opt (opt.value)}
            <Select.Item value={opt.value}>{opt.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    {/each}
  </div>
{/if}
