<script>
  import { Skeleton } from '$lib/components/ui/skeleton'

  let { filters = 2 } = $props()
</script>

<div class="flex flex-col gap-4">
  <div class="flex gap-3">
    <Skeleton class="h-9 flex-1" />
    {#each Array(filters) as _}
      <Skeleton class="h-9 w-32" />
    {/each}
  </div>
  <div class="grid gap-4 grid-cols-1 md:grid-cols-[320px_1fr]">
    <Skeleton class="h-96" />
    <Skeleton class="h-96" />
  </div>
</div>
