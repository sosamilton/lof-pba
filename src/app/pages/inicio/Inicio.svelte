<script>
  import { onMount } from 'svelte'
  import { isInGrist, subscribeAccess } from '$core/grist/grist'
  import { identidad } from '$core/data/identidad'
  import { inicioStore as store } from './inicioStore.svelte.js'
  import { cooperadoraStore } from '$app/pages/cooperadora/cooperadoraStore.svelte.js'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { Separator } from '$lib/components/ui/separator'
  import MessageBanner from '$lib/components/MessageBanner.svelte'
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import ResumenEjecutivo from './components/ResumenEjecutivo.svelte'
  import TableroCaja from './components/TableroCaja.svelte'
  import ConfigPanel from './components/ConfigPanel.svelte'
  import InstitucionalTab from './components/InstitucionalTab.svelte'
  import SchemaErrorView from './components/SchemaErrorView.svelte'
  import { navigate } from '$core/ui/router.svelte'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus'

  const saldos = $derived(store.saldos)

  let resumenAccordion = $state(['resumen-ejecutivo', 'tablero-caja'])

  // Estado reactivo de Grist: isInGrist() lee una variable de módulo no
  // reactiva (_gristStatus, plain let), por lo que {#if isInGrist()} no se
  // re-evalúa cuando el estado cambia. Sincronizamos a un $state local via
  // subscribeAccess para que la UI reaccione (mismo patrón que App.svelte).
  let gristReady = $state(isInGrist())

  onMount(() => {
    const unsubAccess = subscribeAccess((s) => {
      gristReady = s === 'ready'
    })
    cooperadoraStore.setOnSaldosChanged(async (ejercicioActualizado) => {
      if (ejercicioActualizado && store.moduloGestionIntegral) {
        store.saldos.loadFromData({
          movimientos: store.saldos.movimientos,
          ejercicio: ejercicioActualizado,
          cuentas: store.saldos.cuentas,
        })
      }
    })
    cooperadoraStore.load()
    const unsubInit = store.init()
    return () => {
      unsubAccess?.()
      if (typeof unsubInit === 'function') unsubInit()
    }
  })
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center gap-2">
    <DatabaseIcon class="size-5 text-primary" />
    <h1 class="text-lg font-bold">{identidad.nombre}</h1>
  </div>

  {#if gristReady}
    {#if store.loading}
      <div class="flex flex-col gap-4">
        <Skeleton class="h-8 w-48" />
        <Skeleton class="h-64 w-full" />
      </div>
    {:else if store.status}
      {#if store.status.missing.length === 0 && store.status.schemaDiff?.missingTables?.length === 0 && store.status.schemaDiff?.missingColumns?.length === 0}
        <Tabs.Root value="resumen">
          <Tabs.List>
            <Tabs.Trigger value="resumen">Resumen</Tabs.Trigger>
            <Tabs.Trigger value="institucional">Información institucional</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="resumen" class="flex flex-col gap-4 mt-2">
            <Accordion.Root type="multiple" bind:value={resumenAccordion}>
              <Accordion.Item value="resumen-ejecutivo">
                <Accordion.Trigger>
                  <span class="font-semibold flex items-center gap-2">
                    <LayoutDashboardIcon class="size-4" />
                    Resumen ejecutivo
                  </span>
                </Accordion.Trigger>
                <Accordion.Content>
                  <ResumenEjecutivo
                    dashLoading={store.dashLoading}
                    ejercicioEnCurso={store.ejercicioEnCurso}
                    ejercicioProximoVencer={store.ejercicioProximoVencer}
                    cargosCubiertos={store.cargosCubiertos}
                    cargosObligatorios={store.cargosObligatorios}
                    sociosActivos={store.sociosActivos}
                    altasUltimoAnio={store.altasUltimoAnio}
                    bajasUltimoAnio={store.bajasUltimoAnio}
                    vencimientosProximos={store.vencimientosProximos}
                    alertaAsamblea={store.alertaAsamblea}
                  />
                </Accordion.Content>
              </Accordion.Item>

              {#if store.moduloGestionIntegral}
                <Accordion.Item value="tablero-caja">
                  <Accordion.Trigger>
                    <span class="font-semibold flex items-center gap-2">
                      <WalletIcon class="size-4" />
                      Tablero de caja
                    </span>
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <TableroCaja
                      dashLoading={store.dashLoading}
                      saldos={saldos}
                      tableroError={store.tableroError}
                    />
                  </Accordion.Content>
                </Accordion.Item>
              {/if}

              <Accordion.Item value="config">
                <Accordion.Trigger>
                  <span class="font-semibold flex items-center gap-2">
                    <SettingsIcon class="size-4" />
                    Configuración y administración
                  </span>
                </Accordion.Trigger>
                <Accordion.Content>
                  <ConfigPanel {store} identidadNombre={identidad.nombre} />
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>

            {#if store.ejercicioProximoVencer}
              <div class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <CalendarPlusIcon class="size-4 text-destructive shrink-0" />
                <span class="text-sm text-muted-foreground">El ejercicio está próximo a vencer.</span>
                <Button variant="outline" size="sm" class="ml-auto" onclick={() => navigate('cooperadora')}>
                  Gestionar ejercicios
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </div>
            {/if}
          </Tabs.Content>

          <Tabs.Content value="institucional" class="flex flex-col gap-4 mt-2">
            <InstitucionalTab
              loading={cooperadoraStore.loading}
              escuela={cooperadoraStore.escuela}
              banco={cooperadoraStore.banco}
              kiosco={cooperadoraStore.kiosco}
              moduloKiosco={store.moduloKiosco}
              ejercicioEnCurso={store.ejercicioEnCurso}
            />
          </Tabs.Content>
        </Tabs.Root>
      {:else}
        <SchemaErrorView
          status={store.status}
          creating={store.creating}
          repairResult={store.repairResult}
          onCheck={store.check}
          onRepair={store.repairSchema}
        />
      {/if}
    {/if}
  {:else}
    <Card.Root>
      <Card.Content class="flex flex-col gap-3 pt-6">
        <p class="text-sm text-muted-foreground">Esta app está pensada para ejecutarse dentro de Grist como Custom Widget.</p>
        <p class="text-sm text-muted-foreground">Al abrirla desde un navegador, no tiene acceso a los datos del documento.</p>
        <Separator />
        <p class="text-sm font-semibold">Cómo instalarla en un documento Grist</p>
        <ol class="ml-5 list-decimal text-sm text-muted-foreground">
          <li>Abrí tu documento</li>
          <li><span class="font-mono">Add New</span> → <span class="font-mono">Add Widget to Page</span> → <span class="font-mono">Custom</span></li>
          <li>Pegá la URL publicada (GitHub Pages)</li>
          <li>Elegí <span class="font-mono">Access level</span>: <strong>Full document access</strong></li>
        </ol>
      </Card.Content>
    </Card.Root>
  {/if}

  <MessageBanner error={store.error} />
</div>
