<script>
  import EmptyState from '$lib/components/EmptyState.svelte'
  import UsersIcon from '@lucide/svelte/icons/users'

  // 3 estados vacíos compartidos: sin coincidencias, lista vacía, selección pendiente.
  // entityLabel = 'socio' | 'persona' (femenino: 'una' vs 'un')
  let {
    filteredCount = 0,
    hasQuery = false,
    entityLabel = 'registro',
    entityArticle = 'un',
    onNew = () => {},
    onNewFromQuery = () => {},
    selectPrompt = 'Seleccioná un registro o creá uno nuevo.',
    actionIcon = null,
  } = $props()
</script>

{#if filteredCount === 0 && hasQuery}
  <EmptyState
    title="Sin coincidencias"
    sub="No se encontraron {entityLabel}s con ese criterio. ¿Querés crear {entityArticle} nuevo?"
    actionLabel="Crear {entityLabel}"
    onaction={onNewFromQuery}
  >
    {#snippet actionIcon()}
      {#if actionIcon}{@render actionIcon()}{/if}
    {/snippet}
  </EmptyState>
{:else if filteredCount === 0}
  <EmptyState
    title="Todavía no hay {entityLabel}s"
    sub="Creá el primer {entityLabel} para empezar."
    actionLabel="Nuevo {entityLabel}"
    onaction={onNew}
  >
    {#snippet actionIcon()}
      {#if actionIcon}{@render actionIcon()}{/if}
    {/snippet}
  </EmptyState>
{:else}
  <div class="flex flex-col items-center gap-2 py-12 text-center">
    <UsersIcon class="size-8 text-muted-foreground" />
    <p class="text-sm text-muted-foreground">{selectPrompt}</p>
  </div>
{/if}
