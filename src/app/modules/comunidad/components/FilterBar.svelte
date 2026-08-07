<script>
  import SearchInput from '$lib/components/SearchInput.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'

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
</script>

<div class="mb-4 flex flex-wrap items-center gap-3">
  <SearchInput bind:value={q} placeholder={searchPlaceholder} ariaLabel={searchAriaLabel} />
  {#each filters as f (f.key)}
    <Select.Root
      type="single"
      value={f.value}
      allowDeselect={f.allowDeselect ?? false}
      onValueChange={(v) => f.onValueChange(v)}
    >
      <Select.Trigger class={f.triggerClass ?? 'w-[140px]'} aria-label={f.ariaLabel}>
        <Select.Value placeholder={f.placeholder} />
      </Select.Trigger>
      <Select.Content>
        {#each f.options as opt (opt.value)}
          <Select.Item value={opt.value}>{opt.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  {/each}
  {@render children?.()}
  <Button data-shortcut="new" onclick={onNew}>
    {#if newIcon}{@render newIcon()}{/if}
    {newLabel}
  </Button>
  {#if showReload}
    <Button variant="outline" onclick={onReload}>Recargar</Button>
  {/if}
  <span class="text-sm text-muted-foreground">{count} {countLabel}</span>
</div>
