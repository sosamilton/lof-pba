<script>
  import { onMount } from 'svelte'
  import { resumenStore as store } from './resumenStore.svelte.js'
  import { navigate } from '$core/ui/router.svelte'
  import * as Card from '$lib/components/ui/card'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Alert from '$lib/components/ui/alert'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import BarChartIcon from '@lucide/svelte/icons/bar-chart'
  import PieChartIcon from '@lucide/svelte/icons/pie-chart'
  import GitCompareIcon from '@lucide/svelte/icons/git-compare'
  import UsersIcon from '@lucide/svelte/icons/users'
  import HeartPulseIcon from '@lucide/svelte/icons/heart-pulse'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import LockIcon from '@lucide/svelte/icons/lock'
  import FileTextIcon from '@lucide/svelte/icons/file-text'

  import TabFlujoCaja from './components/TabFlujoCaja.svelte'
  import TabGastosIngresos from './components/TabGastosIngresos.svelte'
  import TabComparativa from './components/TabComparativa.svelte'
  import TabMorosidad from './components/TabMorosidad.svelte'
  import TabSaludOperativa from './components/TabSaludOperativa.svelte'

  let tab = $state('flujo')

  onMount(() => {
    store.load()
  })
</script>

<PageScaffold title="Análisis de tesorería">
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
    <!-- Selectores: ejercicio + cierre -->
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
      {#if store.ejercicio && store.ejercicio.cerrado !== true}
        <Button variant="outline" size="sm" onclick={() => navigate('cierre')} class="ml-auto">
          <FileTextIcon data-icon="inline-start" />
          Cerrar ejercicio
        </Button>
      {:else if store.ejercicio?.cerrado === true}
        <Badge variant="secondary" class="ml-auto">
          <LockIcon data-icon="inline-start" />
          Ejercicio cerrado
        </Badge>
      {/if}
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

    {#if !store.ejercicio}
      <Card.Root>
        <Card.Content class="pt-6 text-center text-sm text-muted-foreground">
          No hay ejercicio seleccionado.
        </Card.Content>
      </Card.Root>
    {:else}
      <Tabs.Root value={tab} onValueChange={(v) => (tab = v)} class="min-w-0">
        <Tabs.List class="mb-4">
          <Tabs.Trigger value="flujo" class="px-3">
            <BarChartIcon class="size-3.5" />
            Flujo de caja
          </Tabs.Trigger>
          <Tabs.Trigger value="gastos" class="px-3">
            <PieChartIcon class="size-3.5" />
            Gastos e ingresos
          </Tabs.Trigger>
          <Tabs.Trigger value="comparativa" class="px-3">
            <GitCompareIcon class="size-3.5" />
            Comparativa
          </Tabs.Trigger>
          <Tabs.Trigger value="morosidad" class="px-3">
            <UsersIcon class="size-3.5" />
            Morosidad
          </Tabs.Trigger>
          <Tabs.Trigger value="salud" class="px-3">
            <HeartPulseIcon class="size-3.5" />
            Salud operativa
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="flujo">
          <!-- Sub-tabs: vista periódica (según config) + semanal -->
          <Tabs.Root value={store.vista} onValueChange={(v) => store.setVista(v)} class="mb-4 min-w-0">
            <Tabs.List class="h-8">
              <Tabs.Trigger value="mensual" class="px-3 text-xs capitalize">
                {store.periodicidad === 'trimestral' ? 'Trimestral'
                  : store.periodicidad === 'semestral' ? 'Semestral'
                  : store.periodicidad === 'anual' ? 'Anual'
                  : 'Mensual'}
              </Tabs.Trigger>
              <Tabs.Trigger value="semanal" class="px-3 text-xs">Semanal</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
          <TabFlujoCaja {store} />
        </Tabs.Content>

        <Tabs.Content value="gastos">
          <TabGastosIngresos {store} />
        </Tabs.Content>

        <Tabs.Content value="comparativa">
          <TabComparativa {store} />
        </Tabs.Content>

        <Tabs.Content value="morosidad">
          <TabMorosidad {store} />
        </Tabs.Content>

        <Tabs.Content value="salud">
          <TabSaludOperativa {store} />
        </Tabs.Content>
      </Tabs.Root>
    {/if}
  {/if}
</PageScaffold>
