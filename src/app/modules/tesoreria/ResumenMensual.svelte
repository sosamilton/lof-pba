<script>
  import { onMount } from 'svelte'
  import { resumenStore as store } from './resumenStore.svelte.js'
  import { movimientosStore } from './movimientosStore.svelte.js'
  import { loadConfig } from '$core/configuracion'
  import { formatARS } from '$core/utils'
  import { navigate } from '$core/router.svelte'
  import { proximoPeriodoACargar } from './tesoreriaCalc.js'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Alert from '$lib/components/ui/alert'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import BarChartIcon from '@lucide/svelte/icons/bar-chart'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import LockIcon from '@lucide/svelte/icons/lock'
  import TableIcon from '@lucide/svelte/icons/table'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  // Modo de gestión: si es carga_consolidada, mostramos el botón de carga PIA.
  let modoConsolidada = $state(false)

  onMount(async () => {
    store.load()
    try {
      const config = await loadConfig()
      modoConsolidada = Boolean(
        config?.modulo_carga_consolidada || config?.modulo_solo_pia || config?.modulo_gestion_etapas
      )
    } catch { /* config opcional */ }
    // Cargar datos del store de movimientos (necesarios para calcular próximo período).
    if (modoConsolidada) {
      const unsub = movimientosStore.subscribe()
      await movimientosStore.loadAll()
      return unsub
    }
  })

  // Navega a la página de carga PIA con un período específico.
  const irACargaPIA = (periodo) => {
    navigate(`carga-pia/${periodo}`)
  }

  // Navega a la página de carga PIA sin período: la página calcula el más viejo adeudado.
  const irACargaPIADefault = () => {
    // Calcular el próximo período a cargar aquí para navegar con él.
    const periodosConDatos = new Set(
      store.movimientos.map((m) => String(m.periodo || '')).filter(Boolean)
    )
    const proximo = proximoPeriodoACargar(store.ejercicio, periodosConDatos)
    navigate(`carga-pia/${proximo}`)
  }
</script>

<PageScaffold title="Resumen">
  <div class="flex items-center gap-2 mb-4">
    <BarChartIcon class="size-5 text-primary" />
    <h1 class="text-lg font-bold">Resumen de tesorería</h1>
  </div>

  {#if store.loading}
    <Skeleton class="h-64 w-full" />
  {:else if store.error}
    <Alert.Root variant="destructive">
      <AlertTriangleIcon data-icon="inline-start" />
      <Alert.Title>Error</Alert.Title>
      <Alert.Description>{store.error}</Alert.Description>
    </Alert.Root>
  {:else}
    <!-- Botón de carga PIA (solo en modo carga_consolidada) -->
    {#if modoConsolidada}
      <div class="mb-4">
        <Button onclick={irACargaPIADefault}>
          <TableIcon data-icon="inline-start" />
          Cargar PIA por rubro
        </Button>
      </div>
    {/if}

    <!-- Selectores: ejercicio + vista -->
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground" for="resumen_ej">Ejercicio</Label>
        <select
          id="resumen_ej"
          value={store.selectedEjercicioId}
          onchange={(e) => store.setSelectedEjercicio(e.target.value)}
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {#each store.ejercicios as e (e.id)}
            <option value={e.id}>{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}{e.en_curso ? ' (en curso)' : ''}</option>
          {/each}
        </select>
      </div>
      <Tabs.Root value={store.vista} onValueChange={(v) => store.setVista(v)}>
        <Tabs.List class="h-9">
          <Tabs.Trigger value="mensual" class="px-3">Mensual</Tabs.Trigger>
          <Tabs.Trigger value="semanal" class="px-3">Semanal</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>

    {#if store.saldosInicialesEnCero}
      <Alert.Root class="mb-4">
        <AlertTriangleIcon data-icon="inline-start" />
        <Alert.Title>Faltan saldos iniciales</Alert.Title>
        <Alert.Description>
          Los saldos iniciales del ejercicio están en 0. Editálos desde <strong>Inicio → Información institucional</strong> para que el arrastre sea correcto.
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if store.resumen.length === 0}
      <Card.Root>
        <Card.Content class="pt-6 text-center text-sm text-muted-foreground">
          No hay períodos para este ejercicio.
          {#if modoConsolidada}
            <br />
            Usá el botón <strong>Cargar PIA por rubro</strong> para empezar a cargar los rubros del período.
          {/if}
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
                {#if modoConsolidada}
                  <Table.Head class="text-center w-20">Acciones</Table.Head>
                {/if}
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
                  {#if modoConsolidada}
                    <Table.Cell class="text-center">
                      {#if !store.periodoFirmado(r.periodo)}
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-7 gap-1"
                          onclick={() => irACargaPIA(r.periodo)}
                          title={r.origen === 'vacio' ? 'Cargar PIA de este período' : 'Editar carga PIA de este período'}
                        >
                          <PencilIcon class="size-3.5" />
                          {r.origen === 'vacio' ? 'Cargar' : 'Editar'}
                        </Button>
                      {/if}
                    </Table.Cell>
                  {/if}
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
                {#if modoConsolidada}<Table.Cell></Table.Cell>{/if}
              </Table.Row>
            </Table.Footer>
          </Table.Root>
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</PageScaffold>
