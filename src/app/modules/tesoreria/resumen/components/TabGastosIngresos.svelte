<script>
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import * as Select from '$lib/components/ui/select'
  import { BarChart } from 'layerchart'
  import { formatARS } from '$core/utils/utils'

  let { store } = $props()

  let tipoFiltro = $state('') // '' | 'Entrada' | 'Salida'
  let grupoFiltro = $state('') // '' | nombre de grupo

  let gruposOptions = $derived(
    [...new Set(store.distribucionGrupos.map((d) => d.grupo))].sort()
  )

  let distribFiltrada = $derived.by(() => {
    let d = store.distribucionRubros
    if (tipoFiltro) d = d.filter((x) => x.tipo === tipoFiltro)
    if (grupoFiltro) d = d.filter((x) => x.grupo === grupoFiltro)
    return d
  })

  let topRubros = $derived(distribFiltrada.slice(0, 15))

  // Datos para gráfico de barras horizontal: top 10 por importe
  let chartData = $derived(
    distribFiltrada.slice(0, 10).map((d) => ({
      nombre: d.nombre.length > 20 ? d.nombre.slice(0, 18) + '…' : d.nombre,
      importe: d.importe,
      tipo: d.tipo,
    }))
  )

  let gruposChart = $derived(
    store.distribucionGrupos.map((d) => ({
      grupo: d.grupo,
      importe: d.importe,
      tipo: d.tipo,
    }))
  )
</script>

<div class="flex flex-wrap items-end gap-3 mb-4">
  <Select.Root type="single" bind:value={tipoFiltro} allowDeselect={true}>
    <Select.Trigger class="w-[130px]" aria-label="Filtrar por tipo">
      <Select.Value placeholder="Tipo" />
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="Entrada">Entradas</Select.Item>
      <Select.Item value="Salida">Salidas</Select.Item>
    </Select.Content>
  </Select.Root>
  <Select.Root type="single" bind:value={grupoFiltro} allowDeselect={true}>
    <Select.Trigger class="w-[180px]" aria-label="Filtrar por grupo">
      <Select.Value placeholder="Grupo" />
    </Select.Trigger>
    <Select.Content>
      {#each gruposOptions as g}
        <Select.Item value={g}>{g}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
  <span class="text-sm text-muted-foreground">{distribFiltrada.length} rubros</span>
</div>

{#if chartData.length > 0}
  <Card.Root class="mb-4">
    <Card.Header>
      <Card.Title class="text-sm">Top 10 rubros por importe</Card.Title>
    </Card.Header>
    <Card.Content>
      <div style="height: 280px;">
        <BarChart
          data={chartData}
          x="importe"
          y="nombre"
          orientation="horizontal"
          color="tipo"
          tooltip
        />
      </div>
    </Card.Content>
  </Card.Root>
{/if}

<div class="grid gap-4 lg:grid-cols-2">
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm">Detalle por rubro</Card.Title>
    </Card.Header>
    <Card.Content class="pt-4">
      {#if topRubros.length === 0}
        <p class="text-sm text-muted-foreground text-center py-8">Sin movimientos para los filtros seleccionados.</p>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Rubro</Table.Head>
              <Table.Head>Grupo</Table.Head>
              <Table.Head class="text-center">Tipo</Table.Head>
              <Table.Head class="text-right">Cant.</Table.Head>
              <Table.Head class="text-right">Importe</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each topRubros as r (r.rubroId)}
              <Table.Row>
                <Table.Cell class="text-sm">{r.nombre}</Table.Cell>
                <Table.Cell class="text-xs text-muted-foreground">{r.grupo || '—'}</Table.Cell>
                <Table.Cell class="text-center">
                  <span class={r.tipo === 'Entrada' ? 'text-primary text-xs font-medium' : 'text-destructive text-xs font-medium'}>
                    {r.tipo === 'Entrada' ? '↑' : '↓'}
                  </span>
                </Table.Cell>
                <Table.Cell class="text-right text-sm">{r.cantidad}</Table.Cell>
                <Table.Cell class="text-right font-semibold {r.tipo === 'Entrada' ? 'text-primary' : 'text-destructive'}">
                  {r.tipo === 'Entrada' ? '+' : '-'}{formatARS(r.importe)}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm">Agrupado por grupo</Card.Title>
    </Card.Header>
    <Card.Content class="pt-4">
      {#if gruposChart.length === 0}
        <p class="text-sm text-muted-foreground text-center py-8">Sin datos.</p>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Grupo</Table.Head>
              <Table.Head class="text-center">Tipo</Table.Head>
              <Table.Head class="text-right">Cant.</Table.Head>
              <Table.Head class="text-right">Importe</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each store.distribucionGrupos as g (g.grupo + g.tipo)}
              <Table.Row>
                <Table.Cell class="text-sm">{g.grupo}</Table.Cell>
                <Table.Cell class="text-center">
                  <span class={g.tipo === 'Entrada' ? 'text-primary text-xs font-medium' : 'text-destructive text-xs font-medium'}>
                    {g.tipo === 'Entrada' ? '↑' : '↓'}
                  </span>
                </Table.Cell>
                <Table.Cell class="text-right text-sm">{g.cantidad}</Table.Cell>
                <Table.Cell class="text-right font-semibold {g.tipo === 'Entrada' ? 'text-primary' : 'text-destructive'}">
                  {g.tipo === 'Entrada' ? '+' : '-'}{formatARS(g.importe)}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
