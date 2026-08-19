<script>
  import * as Card from '$lib/components/ui/card'
  import * as Alert from '$lib/components/ui/alert'
  import { Button } from '$lib/components/ui/button'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { formatARS } from '$core/utils/utils'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock'
  import FileUpIcon from '@lucide/svelte/icons/file-up'
  import ActivityIcon from '@lucide/svelte/icons/activity'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import { navigate } from '$core/ui/router.svelte'

  let {
    dashLoading = false,
    saldos = null,
    ultimaCarga = null,
    periodoActual = '',
    movimientosMes = 0,
    ejercicioEnCurso = null,
  } = $props()

  let mesLabel = $derived.by(() => {
    if (!periodoActual) return ''
    const [y, m] = periodoActual.split('-')
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const idx = Number(m) - 1
    if (idx < 0 || idx > 11) return periodoActual
    return `${meses[idx]} ${y}`
  })

  let ultimaCargaLabel = $derived.by(() => {
    if (!ultimaCarga) return 'Sin movimientos'
    const fechaStr = ultimaCarga.fecha
      ? ultimaCarga.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : ultimaCarga.periodo || '—'
    return fechaStr
  })
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-sm flex items-center gap-2">
      <ActivityIcon class="size-4 text-primary" />
      Situación actual
    </Card.Title>
  </Card.Header>
  <Card.Content class="pt-4">
    {#if dashLoading}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {#each Array(4) as _, i}
          <Skeleton class="h-16 w-full" key={i} />
        {/each}
      </div>
    {:else if !ejercicioEnCurso}
      <!-- Sin ejercicio en curso: CTA para crear uno nuevo -->
      <Alert.Root class="border-primary/40">
        <AlertTriangleIcon data-icon="inline-start" class="text-primary" />
        <Alert.Title>No hay ejercicio en curso</Alert.Title>
        <Alert.Description>
          Creá un nuevo ejercicio para comenzar a cargar movimientos y generar reportes.
        </Alert.Description>
      </Alert.Root>
      <div class="flex justify-end mt-3 gap-2">
        <Button variant="outline" size="sm" onclick={() => navigate('cooperadora')}>
          Gestionar ejercicios
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    {:else}
      <!-- Saldos por cuenta (una tarjeta por cuenta) -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Saldo total -->
        <div class="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WalletIcon class="size-3" />
            Saldo total
          </div>
          <div class="text-lg font-bold text-primary">{formatARS(saldos?.saldoTotal ?? 0)}</div>
        </div>
        {#each saldos?.cuentas ?? [] as c (c.id)}
          <div class="rounded-md border border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">{c.nombre_cuenta}</div>
            <div class="text-lg font-bold">{formatARS(saldos?.saldosPorCuenta?.get(Number(c.id)) || 0)}</div>
          </div>
        {/each}
      </div>

      <!-- Indicadores operativos -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
        <!-- Última carga de movimientos -->
        <div class="rounded-md border border-border px-3 py-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileUpIcon class="size-3" />
            Última carga
          </div>
          <div class="text-lg font-bold">{ultimaCargaLabel}</div>
          <div class="text-xs text-muted-foreground">
            {#if ultimaCarga}
              Período: {ultimaCarga.periodo || '—'} · {ultimaCarga.cantidad} mov. en el ejercicio
            {:else}
              Sin movimientos cargados
            {/if}
          </div>
        </div>

        <!-- Período actual -->
        <div class="rounded-md border border-border px-3 py-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClockIcon class="size-3" />
            Período actual
          </div>
          <div class="text-lg font-bold">{mesLabel || '—'}</div>
          <div class="text-xs text-muted-foreground">
            {movimientosMes} movimiento{movimientosMes === 1 ? '' : 's'} cargado{movimientosMes === 1 ? '' : 's'}
          </div>
        </div>

        <!-- Ejercicio -->
        <div class="rounded-md border border-border px-3 py-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClockIcon class="size-3" />
            Ejercicio
          </div>
          <div class="text-lg font-bold">
            {ejercicioEnCurso ? `${ejercicioEnCurso.anio_inicio}-${ejercicioEnCurso.anio_fin}` : '—'}
          </div>
          <div class="text-xs text-muted-foreground">
            {ejercicioEnCurso?.mes_inicio ? `Inicio: ${ejercicioEnCurso.mes_inicio}` : ''}
          </div>
        </div>
      </div>

      <div class="flex justify-end mt-3">
        <Button variant="outline" size="sm" onclick={() => navigate('resumen')}>
          Ver resumen detallado
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
