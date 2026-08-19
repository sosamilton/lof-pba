<script>
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { BarChart } from 'layerchart'
  import { formatARS } from '$core/utils/utils'
  import { Badge } from '$lib/components/ui/badge'
  import { Label } from '$lib/components/ui/label'

  let { store } = $props()

  // Ejercicios disponibles para comparar (excluyendo el actual)
  let ejerciciosComparar = $derived(
    store.ejercicios
      .filter((e) => Number(e.id) !== Number(store.selectedEjercicioId))
      .slice()
      .sort((a, b) => Number(b.anio_inicio || 0) - Number(a.anio_inicio || 0))
  )

  // Datos para gráfico: combinamos ingresos/egresos por mes relativo
  let chartData = $derived.by(() => {
    const c = store.comparativa
    if (!c?.meses) return []
    return c.meses.map((mes, i) => ({
      mes,
      actualIngresos: c.actual.ingresos[i] || 0,
      actualEgresos: c.actual.egresos[i] || 0,
      anteriorIngresos: c.anterior.ingresos[i] || 0,
      anteriorEgresos: c.anterior.egresos[i] || 0,
    }))
  })

  let totalesActual = $derived.by(() => {
    const c = store.comparativa
    if (!c) return { ingresos: 0, egresos: 0, resultado: 0 }
    const ingresos = c.actual.ingresos.reduce((a, b) => a + b, 0)
    const egresos = c.actual.egresos.reduce((a, b) => a + b, 0)
    return { ingresos, egresos, resultado: ingresos - egresos }
  })

  let totalesAnterior = $derived.by(() => {
    const c = store.comparativa
    if (!c) return { ingresos: 0, egresos: 0, resultado: 0 }
    const ingresos = c.anterior.ingresos.reduce((a, b) => a + b, 0)
    const egresos = c.anterior.egresos.reduce((a, b) => a + b, 0)
    return { ingresos, egresos, resultado: ingresos - egresos }
  })

  let variacionIngresos = $derived(
    totalesAnterior.ingresos > 0
      ? ((totalesActual.ingresos - totalesAnterior.ingresos) / totalesAnterior.ingresos) * 100
      : 0
  )
  let variacionEgresos = $derived(
    totalesAnterior.egresos > 0
      ? ((totalesActual.egresos - totalesAnterior.egresos) / totalesAnterior.egresos) * 100
      : 0
  )
</script>

{#if !store.ejComparar}
  <Card.Root>
    <Card.Content class="pt-6 text-center text-sm text-muted-foreground">
      No hay otro ejercicio para comparar. Esta vista requiere al menos dos ejercicios cargados.
    </Card.Content>
  </Card.Root>
{:else}
  <div class="flex flex-wrap items-end gap-3 mb-4">
    <div class="flex flex-col gap-1">
      <Label class="text-xs font-bold text-muted-foreground" for="comparar_ej">Comparar contra</Label>
      <select
        id="comparar_ej"
        value={store.selectedCompararId}
        onchange={(e) => store.setCompararEjercicio(e.target.value)}
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {#each ejerciciosComparar as e (e.id)}
          <option value={e.id}>{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</option>
        {/each}
      </select>
    </div>
    <span class="text-sm text-muted-foreground">
      Comparando <strong>{store.ejercicio?.anio_inicio}-{store.ejercicio?.anio_fin}</strong>
      vs. <strong>{store.ejComparar.anio_inicio}-{store.ejComparar.anio_fin}</strong>
      (alineado por mes relativo al inicio de cada ejercicio)
    </span>
  </div>

  <!-- KPIs comparativos -->
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="text-xs text-muted-foreground">Ingresos acumulados</div>
        <div class="text-lg font-bold text-primary">+{formatARS(totalesActual.ingresos)}</div>
        <div class="text-xs text-muted-foreground">Anterior: +{formatARS(totalesAnterior.ingresos)}</div>
        {#if variacionIngresos !== 0}
          <Badge variant={variacionIngresos > 0 ? 'default' : 'destructive'} class="mt-1">
            {variacionIngresos > 0 ? '↑' : '↓'} {Math.abs(variacionIngresos).toFixed(1)}%
          </Badge>
        {/if}
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="text-xs text-muted-foreground">Egresos acumulados</div>
        <div class="text-lg font-bold text-destructive">-{formatARS(totalesActual.egresos)}</div>
        <div class="text-xs text-muted-foreground">Anterior: -{formatARS(totalesAnterior.egresos)}</div>
        {#if variacionEgresos !== 0}
          <Badge variant={variacionEgresos < 0 ? 'default' : 'destructive'} class="mt-1">
            {variacionEgresos < 0 ? '↓' : '↑'} {Math.abs(variacionEgresos).toFixed(1)}%
          </Badge>
        {/if}
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="text-xs text-muted-foreground">Resultado actual</div>
        <div class="text-lg font-bold {totalesActual.resultado >= 0 ? 'text-primary' : 'text-destructive'}">
          {totalesActual.resultado >= 0 ? '+' : ''}{formatARS(totalesActual.resultado)}
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="pt-4 pb-4">
        <div class="text-xs text-muted-foreground">Resultado anterior</div>
        <div class="text-lg font-bold {totalesAnterior.resultado >= 0 ? 'text-primary' : 'text-destructive'}">
          {totalesAnterior.resultado >= 0 ? '+' : ''}{formatARS(totalesAnterior.resultado)}
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Gráfico de barras agrupadas: ingresos actual vs anterior por mes -->
  {#if chartData.length > 0}
    <Card.Root class="mb-4">
      <Card.Header>
        <Card.Title class="text-sm">Ingresos por mes — actual vs. anterior</Card.Title>
      </Card.Header>
      <Card.Content>
        <div style="height: 260px;">
          <BarChart
            data={chartData}
            x="mes"
            y="actualIngresos"
            series={[
              { key: 'actualIngresos', label: 'Actual', color: 'var(--color-primary)' },
              { key: 'anteriorIngresos', label: 'Anterior', color: 'var(--color-muted-foreground)' },
            ]}
            tooltip
          />
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root class="mb-4">
      <Card.Header>
        <Card.Title class="text-sm">Egresos por mes — actual vs. anterior</Card.Title>
      </Card.Header>
      <Card.Content>
        <div style="height: 260px;">
          <BarChart
            data={chartData}
            x="mes"
            y="actualEgresos"
            series={[
              { key: 'actualEgresos', label: 'Actual', color: 'var(--color-destructive)' },
              { key: 'anteriorEgresos', label: 'Anterior', color: 'var(--color-muted-foreground)' },
            ]}
            tooltip
          />
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Tabla detallada -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm">Detalle mensual comparativo</Card.Title>
    </Card.Header>
    <Card.Content class="pt-4">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Mes</Table.Head>
            <Table.Head class="text-right">Ing. actual</Table.Head>
            <Table.Head class="text-right">Ing. anterior</Table.Head>
            <Table.Head class="text-right">Egr. actual</Table.Head>
            <Table.Head class="text-right">Egr. anterior</Table.Head>
            <Table.Head class="text-right">Res. actual</Table.Head>
            <Table.Head class="text-right">Res. anterior</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each store.comparativa.meses as mes, i (mes)}
            {@const resAct = store.comparativa.actual.resultado[i] ?? 0}
            {@const resAnt = store.comparativa.anterior.resultado[i] ?? 0}
            <Table.Row>
              <Table.Cell class="font-mono text-xs">{mes}</Table.Cell>
              <Table.Cell class="text-right text-primary text-sm">+{formatARS(store.comparativa.actual.ingresos[i] ?? 0)}</Table.Cell>
              <Table.Cell class="text-right text-sm text-muted-foreground">+{formatARS(store.comparativa.anterior.ingresos[i] ?? 0)}</Table.Cell>
              <Table.Cell class="text-right text-destructive text-sm">-{formatARS(store.comparativa.actual.egresos[i] ?? 0)}</Table.Cell>
              <Table.Cell class="text-right text-sm text-muted-foreground">-{formatARS(store.comparativa.anterior.egresos[i] ?? 0)}</Table.Cell>
              <Table.Cell class="text-right text-sm font-semibold {resAct >= 0 ? 'text-primary' : 'text-destructive'}">
                {resAct >= 0 ? '+' : ''}{formatARS(resAct)}
              </Table.Cell>
              <Table.Cell class="text-right text-sm text-muted-foreground">
                {resAnt >= 0 ? '+' : ''}{formatARS(resAnt)}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>
{/if}
