<script>
  import * as Select from '$lib/components/ui/select'
  import { Badge } from '$lib/components/ui/badge'

  let {
    ejercicios = [],
    value = '',
    onValueChange = () => {},
    placeholder = 'Ejercicio…',
    showEnCurso = true,
    showBadges = false,
    showMesInicio = false,
    class: className = 'h-8 w-[160px] text-xs',
    id = '',
  } = $props()

  function formatLabel(e) {
    const base = `${e.anio_inicio || '?'}-${e.anio_fin || '?'}`
    if (showMesInicio && e.mes_inicio) return `${base} · ${e.mes_inicio}`
    return base
  }

  let opciones = $derived(
    [...(ejercicios || [])]
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
      .map((e) => ({
        value: String(e.id),
        label: formatLabel(e),
        item: e,
      }))
  )

  let selLabel = $derived(
    opciones.find((o) => o.value === String(value))?.label || placeholder
  )
</script>

<Select.Root
  type="single"
  value={value ? String(value) : undefined}
  {onValueChange}
>
  <Select.Trigger {id} class={className}>
    <Select.Value>{selLabel}</Select.Value>
  </Select.Trigger>
  <Select.Content>
    {#each opciones as opt (opt.value)}
      <Select.Item value={opt.value} class="text-xs">
        {opt.label}
        {#if showEnCurso && opt.item.en_curso}
          <span class="text-muted-foreground"> (en curso)</span>
        {/if}
        {#if showBadges && opt.item.cerrado}
          <Badge variant="secondary" class="ml-2 text-[10px]">Cerrado</Badge>
        {/if}
        {#if showBadges && opt.item.en_curso}
          <Badge variant="outline" class="ml-2 text-[10px]">En curso</Badge>
        {/if}
      </Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
