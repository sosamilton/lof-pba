<script>
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { formatARS } from '$core/utils/utils'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import LockIcon from '@lucide/svelte/icons/lock'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import FileWarningIcon from '@lucide/svelte/icons/file-warning'

  let { store } = $props()
  let s = $derived(store.salud)

  let hayAlertas = $derived(
    s.periodosPendientes.length > 0 ||
    s.rubrosFijosSinMovimiento.length > 0 ||
    s.cierresDuplicados.length > 0
  )
</script>

{#if !hayAlertas && s.periodosAbiertos.length === 0 && s.periodosFirmados.length === 0}
  <Card.Root>
    <Card.Content class="pt-6 text-center text-sm text-muted-foreground">
      No hay datos para este ejercicio.
    </Card.Content>
  </Card.Root>
{:else}
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Períodos pendientes -->
    <Card.Root class={s.periodosPendientes.length > 0 ? 'border-yellow-500/40' : ''}>
      <Card.Header>
        <Card.Title class="text-sm flex items-center gap-2">
          <CalendarIcon class="size-4" />
          Períodos sin cargar
          {#if s.periodosPendientes.length > 0}
            <Badge variant="secondary">{s.periodosPendientes.length}</Badge>
          {/if}
        </Card.Title>
      </Card.Header>
      <Card.Content class="pt-4">
        {#if s.periodosPendientes.length === 0}
          <p class="text-sm text-muted-foreground">Todos los períodos del ejercicio tienen datos o cierre.</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each s.periodosPendientes as p (p)}
              <Badge variant="outline" class="font-mono text-xs border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                {p}
              </Badge>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Rubros fijos sin movimiento -->
    <Card.Root class={s.rubrosFijosSinMovimiento.length > 0 ? 'border-yellow-500/40' : ''}>
      <Card.Header>
        <Card.Title class="text-sm flex items-center gap-2">
          <FileWarningIcon class="size-4" />
          Rubros fijos sin movimiento
          {#if s.rubrosFijosSinMovimiento.length > 0}
            <Badge variant="secondary">{s.rubrosFijosSinMovimiento.length}</Badge>
          {/if}
        </Card.Title>
      </Card.Header>
      <Card.Content class="pt-4">
        {#if s.rubrosFijosSinMovimiento.length === 0}
          <p class="text-sm text-muted-foreground">Todos los rubros fijos tienen movimientos en el ejercicio.</p>
        {:else}
          <ul class="text-sm space-y-1">
            {#each s.rubrosFijosSinMovimiento as r (r.id)}
              <li class="flex items-center justify-between">
                <span>{r.nombre}</span>
                <Badge variant="outline" class="text-xs">{r.tipo}</Badge>
              </li>
            {/each}
          </ul>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Cierres duplicados -->
    <Card.Root class={s.cierresDuplicados.length > 0 ? 'border-destructive/40' : ''}>
      <Card.Header>
        <Card.Title class="text-sm flex items-center gap-2">
          <AlertTriangleIcon class="size-4" />
          Cierres duplicados
        </Card.Title>
      </Card.Header>
      <Card.Content class="pt-4">
        {#if s.cierresDuplicados.length === 0}
          <p class="text-sm text-muted-foreground">No hay períodos con cierres duplicados.</p>
        {:else}
          <ul class="text-sm space-y-1">
            {#each s.cierresDuplicados as d (d.periodo)}
              <li class="flex items-center justify-between text-destructive">
                <span class="font-mono text-xs">{d.periodo}</span>
                <Badge variant="destructive" class="text-xs">{d.cantidad} registros</Badge>
              </li>
            {/each}
          </ul>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Resumen de estados -->
  <Card.Root class="mt-4">
    <Card.Header>
      <Card.Title class="text-sm">Estado de períodos</Card.Title>
    </Card.Header>
    <Card.Content class="pt-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-md border border-border px-3 py-2">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircleIcon class="size-3.5" />
            Abiertos
          </div>
          <div class="text-lg font-bold">{s.periodosAbiertos.length}</div>
        </div>
        <div class="rounded-md border border-border px-3 py-2">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <LockIcon class="size-3.5" />
            Firmados
          </div>
          <div class="text-lg font-bold">{s.periodosFirmados.length}</div>
        </div>
        <div class="rounded-md border border-border px-3 py-2">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarIcon class="size-3.5" />
            Pendientes
          </div>
          <div class="text-lg font-bold">{s.periodosPendientes.length}</div>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
