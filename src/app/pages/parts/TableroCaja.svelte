<script>
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  let {
    dashLoading = false,
    saldos = null,
    tableroError = '',
  } = $props()
</script>

<Card.Root class="pt-2 border-0 shadow-none">
  <Card.Content class="flex flex-col gap-3 pt-4">
    {#if dashLoading}
      <Skeleton class="h-8 w-40" />
    {:else}
      <div class="flex flex-col gap-3">
        {#if tableroError}
          <div class="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangleIcon class="size-4 shrink-0" />
            {tableroError}
          </div>
        {/if}
        <div>
          <div class="text-xs text-muted-foreground">Saldo total</div>
          <div class="text-2xl font-bold">${saldos?.saldoTotal?.toLocaleString('es-AR') ?? 0}</div>
        </div>
        {#if saldos?.saldosInicialesEnCero}
          <div class="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangleIcon class="size-4 shrink-0" />
            Faltan saldos iniciales — los totales no incluyen arrastre.
          </div>
        {/if}
        <div class="grid gap-2 sm:grid-cols-3">
          {#each saldos?.cuentas ?? [] as c (c.id)}
            <div class="rounded-md border border-border px-3 py-2">
              <div class="text-xs text-muted-foreground">{c.nombre_cuenta}</div>
              <div class="text-sm font-semibold">${(saldos?.saldosPorCuenta?.get(Number(c.id)) || 0).toLocaleString('es-AR')}</div>
            </div>
          {/each}
        </div>
        <Separator />
        <div class="grid gap-2 sm:grid-cols-2">
          <div class="rounded-md border border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">Ingresos del mes</div>
            <div class="text-sm font-semibold text-primary">+${saldos?.ingresosMes?.toLocaleString('es-AR') ?? 0}</div>
          </div>
          <div class="rounded-md border border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">Egresos del mes</div>
            <div class="text-sm font-semibold text-destructive">-${saldos?.egresosMes?.toLocaleString('es-AR') ?? 0}</div>
          </div>
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
