<script>
  // Componente presentacional: muestra una fila de chips (segmentos) clickeables
  // + opcionalmente un selector de período. No conoce reglas de negocio de
  // Comunidad ni de tesorería — recibe `segments` y `periodSelector` ya armados
  // por `buildResumenSegments()` (resumenSegments.js).
  //
  // Vocabulario visual: Badge + Select de shadcn-svelte, mismo lenguaje que
  // RecordList.svelte y MetricCard.svelte. Patrón <button aria-pressed> para
  // los chips clickeables (accesibilidad, igual que RecordList).

  import { Badge } from '$lib/components/ui/badge'
  import * as Select from '$lib/components/ui/select'
  import { Skeleton } from '$lib/components/ui/skeleton'

  let {
    segments = [],
    periodSelector = null, // { value, options, onChange } | null
    loading = false,
    onSegmentClick = () => {}, // (segmentId) => void
  } = $props()
</script>

{#if loading}
  <div class="mb-3 flex flex-wrap items-center gap-2">
    <Skeleton class="h-6 w-24 rounded-full" />
    <Skeleton class="h-6 w-20 rounded-full" />
    <Skeleton class="h-6 w-28 rounded-full" />
  </div>
{:else if segments.length > 0}
  <div class="mb-3 flex flex-wrap items-center gap-2">
    {#each segments as seg (seg.id)}
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {seg.active ? 'ring-2 ring-ring' : ''}"
        aria-pressed={seg.active}
        onclick={() => onSegmentClick(seg.id)}
      >
        <Badge variant={seg.variant} class="text-xs">
          {seg.label}
          {#if seg.count > 0}
            <span class="ml-1 font-semibold">{seg.count}</span>
          {/if}
        </Badge>
      </button>
    {/each}

    {#if periodSelector}
      <div class="ml-auto">
        <Select.Root
          type="single"
          value={periodSelector.value}
          onValueChange={(v) => periodSelector.onChange?.(v)}
        >
          <Select.Trigger class="h-7 w-[140px] text-xs" aria-label="Período de bajas">
            <Select.Value placeholder="Período" />
          </Select.Trigger>
          <Select.Content>
            {#each periodSelector.options as opt (opt.value)}
              <Select.Item value={opt.value}>{opt.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    {/if}
  </div>
{/if}
