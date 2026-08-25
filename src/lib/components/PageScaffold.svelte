<script>
  import { isInGrist } from '$core/data/dataRepository'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import MessageBanner from './MessageBanner.svelte'

  let {
    title = '',
    loading = false,
    error = '',
    notice = '',
    skeleton = null,
    children,
  } = $props()
</script>

{#if !isInGrist()}
  <h1 class="text-lg font-bold">{title}</h1>
  <p class="text-sm text-muted-foreground">Esta pantalla solo funciona dentro de Grist.</p>
{:else if loading}
  <div role="status" aria-live="polite" aria-label="Cargando contenido">
  {#if skeleton}
    {@render skeleton()}
  {:else}
    <div class="flex flex-col gap-4">
      <div class="flex gap-3">
        <Skeleton class="h-9 flex-1" />
        <Skeleton class="h-9 w-32" />
        <Skeleton class="h-9 w-32" />
      </div>
      <div class="grid gap-4" style="grid-template-columns: 320px 1fr">
        <Skeleton class="h-96" />
        <Skeleton class="h-96" />
      </div>
    </div>
  {/if}
  </div>
  <span class="sr-only">Cargando…</span>
{:else}
  {@render children?.()}
{/if}

<MessageBanner {error} {notice} />
