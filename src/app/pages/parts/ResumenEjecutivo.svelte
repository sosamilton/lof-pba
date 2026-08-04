<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import UsersIcon from '@lucide/svelte/icons/users'
  import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle'

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
  <Card.Root>
    <Card.Content class="flex flex-col gap-1 pt-4">
      <div class="flex items-center gap-2 text-muted-foreground">
        <CalendarIcon class="size-4" />
        <span class="text-xs font-medium">Ejercicio en curso</span>
      </div>
      {#if dashLoading}
        <Skeleton class="h-6 w-32 mt-1" />
      {:else if ejercicioEnCurso}
        <div class="text-lg font-bold">{ejercicioEnCurso.anio_inicio}-{ejercicioEnCurso.anio_fin}</div>
        <div class="text-xs text-muted-foreground">Inicio: {ejercicioEnCurso.mes_inicio}</div>
        {#if ejercicioProximoVencer}
          <Badge variant="destructive" class="mt-1 w-fit">Próximo a vencer</Badge>
        {/if}
      {:else}
        <div class="text-sm text-muted-foreground">Sin ejercicio activo</div>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Content class="flex flex-col gap-1 pt-4">
      <div class="flex items-center gap-2 text-muted-foreground">
        <ShieldCheckIcon class="size-4" />
        <span class="text-xs font-medium">Cargos obligatorios cubiertos</span>
      </div>
      {#if dashLoading}
        <Skeleton class="h-6 w-20 mt-1" />
      {:else}
        <div class="text-lg font-bold">{cargosCubiertos} / {cargosObligatorios}</div>
        {#if cargosCubiertos < cargosObligatorios}
          <Badge variant="secondary" class="mt-1 w-fit">Faltan {cargosObligatorios - cargosCubiertos}</Badge>
        {:else}
          <Badge variant="default" class="mt-1 w-fit">Completo</Badge>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Content class="flex flex-col gap-1 pt-4">
      <div class="flex items-center gap-2 text-muted-foreground">
        <UsersIcon class="size-4" />
        <span class="text-xs font-medium">Socios activos</span>
      </div>
      {#if dashLoading}
        <Skeleton class="h-6 w-16 mt-1" />
      {:else}
        <div class="text-lg font-bold">{sociosActivos}</div>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Content class="flex flex-col gap-1 pt-4">
      <div class="flex items-center gap-2 text-muted-foreground">
        <TrendingUpIcon class="size-4" />
        <span class="text-xs font-medium">Altas/bajas último año</span>
      </div>
      {#if dashLoading}
        <Skeleton class="h-6 w-24 mt-1" />
      {:else}
        <div class="text-lg font-bold">
          <span class="text-primary">+{altasUltimoAnio}</span>
          <span class="text-muted-foreground mx-1">/</span>
          <span class="text-destructive">-{bajasUltimoAnio}</span>
        </div>
        <div class="text-xs text-muted-foreground">Saldo neto: {altasUltimoAnio - bajasUltimoAnio}</div>
      {/if}
    </Card.Content>
  </Card.Root>

  {#if vencimientosProximos.length > 0}
    <Card.Root class="border-destructive/40">
      <Card.Content class="flex flex-col gap-1 pt-4">
        <div class="flex items-center gap-2 text-destructive">
          <AlertCircleIcon class="size-4" />
          <span class="text-xs font-medium">Vencimientos próximos (60 días)</span>
        </div>
        <div class="text-lg font-bold">{vencimientosProximos.length}</div>
        <div class="text-xs text-muted-foreground">mandatos por vencer</div>
      </Card.Content>
    </Card.Root>
  {/if}

  {#if alertaAsamblea}
    <Card.Root class="border-primary/40">
      <Card.Content class="flex flex-col gap-1 pt-4">
        <div class="flex items-center gap-2 text-primary">
          <AlertCircleIcon class="size-4" />
          <span class="text-xs font-medium">Asamblea ordinaria</span>
        </div>
        <div class="text-sm font-semibold">Recordatorio</div>
        <div class="text-xs text-muted-foreground">Segunda quincena de mayo: realizar AGO</div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>
