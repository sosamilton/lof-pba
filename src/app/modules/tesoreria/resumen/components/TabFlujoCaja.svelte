<script>
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { LineChart } from 'layerchart'
  import { formatARS } from '$core/utils/utils'
  import LockIcon from '@lucide/svelte/icons/lock'
  import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
  import TrendingDownIcon from '@lucide/svelte/icons/trending-down'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock'

  let { store } = $props()

  let cuentasConSaldo = $derived(
    store.cuentas.map((c) => ({
      ...c,
      saldo: store.saldosPorCuenta?.get(Number(c.id)) || 0,
    }))
  )
</script>

<!-- KPIs -->
<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
  <Card.Root>
    <Card.Content class="pt-4 pb-4">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <WalletIcon class="size-3.5" />
        Saldo total
      </div>
      <div class="text-xl font-bold">{formatARS(store.saldoTotal)}</div>
      <div class="mt-2 grid grid-cols-3 gap-1 text-xs">
        {#each cuentasConSaldo as c (c.id)}
          <div>
            <div class="text-muted-foreground">{c.nombre_cuenta}</div>
            <div class="font-semibold">{formatARS(c.saldo)}</div>
          </div>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Content class="pt-4 pb-4">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUpIcon class="size-3.5 text-primary" />
        Ingresos del ejercicio
      </div>
      <div class="text-xl font-bold text-primary">+{formatARS(store.totales.ingresos)}</div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Content class="pt-4 pb-4">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingDownIcon class="size-3.5 text-destructive" />
        Egresos del ejercicio
      </div>
      <div class="text-xl font-bold text-destructive">-{formatARS(store.totales.egresos)}</div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Content class="pt-4 pb-4">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClockIcon class="size-3.5" />
        Resultado neto
      </div>
      <div class="text-xl font-bold {store.resultadoNeto >= 0 ? 'text-primary' : 'text-destructive'}">
        {store.resultadoNeto >= 0 ? '+' : ''}{formatARS(store.resultadoNeto)}
      </div>
      <div class="text-xs text-muted-foreground mt-1">Próximo período: {store.proximoPeriodo}</div>
    </Card.Content>
  </Card.Root>
</div>

<!-- Gráfico de saldo mensual -->
{#if store.serieSaldo.length > 0}
  <Card.Root class="mb-4">
    <Card.Header>
      <Card.Title class="text-sm">Evolución del saldo</Card.Title>
    </Card.Header>
    <Card.Content>
      <div style="height: 220px;">
        <LineChart
          data={store.serieSaldo}
          x="periodo"
          y="saldo"
          series={[{ key: 'saldo', label: 'Saldo', color: 'var(--color-primary)' }]}
          tooltip
        />
      </div>
    </Card.Content>
  </Card.Root>
{/if}

<!-- Tabla periódica (según periodicidad configurada) -->
{#if store.resumen.length === 0}
  <Card.Root>
    <Card.Content class="pt-6 text-center text-sm text-muted-foreground">
      No hay períodos para este ejercicio.
    </Card.Content>
  </Card.Root>
{:else}
<Card.Root>
  <Card.Content class="pt-6">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Período</Table.Head>
          <Table.Head class="text-right">Ingresos</Table.Head>
          <Table.Head class="text-right">Egresos</Table.Head>
          <Table.Head class="text-right">Saldo inicial</Table.Head>
          <Table.Head class="text-right">Saldo del período</Table.Head>
          <Table.Head class="text-center">Estado</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each store.resumen as r (r.periodo)}
          <Table.Row>
            <Table.Cell class="font-mono text-xs">{r.label || r.periodo}</Table.Cell>
            <Table.Cell class="text-right text-primary">+{formatARS(r.ingresos)}</Table.Cell>
            <Table.Cell class="text-right text-destructive">-{formatARS(r.egresos)}</Table.Cell>
            <Table.Cell class="text-right">{formatARS(r.saldoInicial)}</Table.Cell>
            <Table.Cell class="text-right font-semibold">{formatARS(r.saldoPeriodo)}</Table.Cell>
            <Table.Cell class="text-center">
              {#if store.periodoFirmado(r.periodo)}
                <Badge variant="destructive">
                  <LockIcon class="size-3" />
                  Firmado
                </Badge>
              {:else if r.origen === 'vacio'}
                <Badge variant="outline" class="text-muted-foreground">Falta cargar</Badge>
              {:else}
                <Badge variant="secondary">Abierto</Badge>
              {/if}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell class="font-bold">Totales</Table.Cell>
          <Table.Cell class="text-right font-bold text-primary">+{formatARS(store.totales.ingresos)}</Table.Cell>
          <Table.Cell class="text-right font-bold text-destructive">-{formatARS(store.totales.egresos)}</Table.Cell>
          <Table.Cell></Table.Cell>
          <Table.Cell class="text-right font-bold">{formatARS(store.totales.saldoFinal)}</Table.Cell>
          <Table.Cell></Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  </Card.Content>
</Card.Root>
{/if}
