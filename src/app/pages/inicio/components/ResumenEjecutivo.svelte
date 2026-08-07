<script>
  import { Badge } from '$lib/components/ui/badge'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import UsersIcon from '@lucide/svelte/icons/users'
  import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle'
  import MetricCard from './MetricCard.svelte'

  let {
    dashLoading = false,
    ejercicioEnCurso = null,
    ejercicioProximoVencer = false,
    cargosCubiertos = 0,
    cargosObligatorios = 0,
    sociosActivos = 0,
    altasUltimoAnio = 0,
    bajasUltimoAnio = 0,
    vencimientosProximos = [],
    alertaAsamblea = false,
  } = $props()
</script>

<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
  <MetricCard
    label="Ejercicio en curso"
    loading={dashLoading}
    skeletonClass="h-6 w-32"
    value={ejercicioEnCurso ? `${ejercicioEnCurso.anio_inicio}-${ejercicioEnCurso.anio_fin}` : 'Sin ejercicio activo'}
    sub={ejercicioEnCurso ? `Inicio: ${ejercicioEnCurso.mes_inicio}` : ''}
    badge={ejercicioProximoVencer ? { text: 'Próximo a vencer', variant: 'destructive' } : null}
  >
    {#snippet icon()}<CalendarIcon class="size-4" />{/snippet}
  </MetricCard>

  <MetricCard
    label="Cargos obligatorios cubiertos"
    loading={dashLoading}
    skeletonClass="h-6 w-20"
    value={`${cargosCubiertos} / ${cargosObligatorios}`}
    badge={cargosCubiertos < cargosObligatorios
      ? { text: `Faltan ${cargosObligatorios - cargosCubiertos}`, variant: 'secondary' }
      : { text: 'Completo', variant: 'default' }}
  >
    {#snippet icon()}<ShieldCheckIcon class="size-4" />{/snippet}
  </MetricCard>

  <MetricCard
    label="Socios activos"
    loading={dashLoading}
    skeletonClass="h-6 w-16"
    value={sociosActivos}
  >
    {#snippet icon()}<UsersIcon class="size-4" />{/snippet}
  </MetricCard>

  {#if !dashLoading}
    <MetricCard
      label="Altas/bajas último año"
      value={`+${altasUltimoAnio} / -${bajasUltimoAnio}`}
      sub={`Saldo neto: ${altasUltimoAnio - bajasUltimoAnio}`}
    >
      {#snippet icon()}<TrendingUpIcon class="size-4" />{/snippet}
    </MetricCard>
  {:else}
    <MetricCard
      label="Altas/bajas último año"
      loading={true}
      skeletonClass="h-6 w-24"
    >
      {#snippet icon()}<TrendingUpIcon class="size-4" />{/snippet}
    </MetricCard>
  {/if}

  {#if vencimientosProximos.length > 0}
    <MetricCard
      label="Vencimientos próximos (60 días)"
      value={vencimientosProximos.length}
      sub="mandatos por vencer"
      cardClass="border-destructive/40"
      iconClass="text-destructive"
    >
      {#snippet icon()}<AlertCircleIcon class="size-4" />{/snippet}
    </MetricCard>
  {/if}

  {#if alertaAsamblea}
    <MetricCard
      label="Asamblea ordinaria"
      value="Recordatorio"
      sub="Segunda quincena de mayo: realizar AGO"
      cardClass="border-primary/40"
      iconClass="text-primary"
    >
      {#snippet icon()}<AlertCircleIcon class="size-4" />{/snippet}
    </MetricCard>
  {/if}
</div>
