<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Skeleton } from '$lib/components/ui/skeleton'

  // Tarjeta de métrica reutilizable: icono + label + valor + badge opcional.
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
  } = $props()
</script>

<Card.Root class={cardClass}>
  <Card.Content class="flex flex-col gap-1 pt-4">
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
  </Card.Content>
</Card.Root>
