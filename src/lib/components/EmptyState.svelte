<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'

  let {
    title,
    sub = '',
    icon = null,
    actionLabel = '',
    actionIcon = null,
    onaction = null,
    children,
  } = $props()
</script>

<Card.Root class="border-dashed">
  <Card.Content class="flex flex-col items-center gap-3 py-10 text-center">
    {#if icon}
      {@render icon()}
    {/if}
    <p class="text-sm font-semibold">{title}</p>
    {#if sub}
      <p class="text-sm text-muted-foreground max-w-sm">{sub}</p>
    {/if}
    {#if children}
      <div class="mt-2">
        {@render children()}
      </div>
    {:else if onaction && actionLabel}
      <Button class="mt-2" onclick={onaction}>
        {#if actionIcon}
          {@render actionIcon()}
        {/if}
        {actionLabel}
      </Button>
    {/if}
  </Card.Content>
</Card.Root>
