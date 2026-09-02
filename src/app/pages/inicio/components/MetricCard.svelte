<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Skeleton } from '$lib/components/ui/skeleton'

  // Tarjeta de métrica reutilizable: icono + label + valor + badge opcional.
  // `onclick` opcional: si se pasa, la tarjeta es clickeable (cursor-pointer +
  // hover) y se envuelve en un <button> para accesibilidad.
  let {
    icon = null,
    label = '',
    value = '',
    sub = '',
    loading = false,
    skeletonClass = 'h-6 w-20',
    badge = null, // { text, variant }
    cardClass = '',
    iconClass = 'text-muted-foreground',
    onclick = null,
  } = $props()
</script>

<Card.Root class={`${cardClass} ${onclick ? 'cursor-pointer' : ''}`}>
  <Card.Content class={`flex flex-col gap-1 pt-4 ${onclick ? 'hover:bg-accent' : ''}`}>
    {#snippet content()}
      <div class="flex items-center gap-2 {iconClass}">
        {#if icon}{@render icon()}{/if}
        <span class="text-xs font-medium">{label}</span>
      </div>
      {#if loading}
        <Skeleton class="{skeletonClass} mt-1" />
      {:else}
        <div class="text-lg font-bold">{value}</div>
        {#if sub}<div class="text-xs text-muted-foreground">{sub}</div>{/if}
        {#if badge}
          <Badge variant={badge.variant || 'secondary'} class="mt-1 w-fit">{badge.text}</Badge>
        {/if}
      {/if}
    {/snippet}
    {#if onclick}
      <button type="button" class="text-left w-full" {onclick} aria-label={`${label}: ${value}`}>
        {@render content()}
      </button>
    {:else}
      {@render content()}
    {/if}
  </Card.Content>
</Card.Root>
