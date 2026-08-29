  <script>
  import * as Tabs from '$lib/components/ui/tabs'
  import { cn } from '$lib/utils.js'
  import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'

  let {
    value = $bindable(),
    class: className,
  } = $props()
</script>

<Tabs.Root bind:value class={cn('min-w-0', className)}>
  <Tabs.List>
    {#each ORGANISMOS as org}
      <Tabs.Trigger value={org} class="flex-none">{ORGANISMO_LABELS[org]}</Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>
