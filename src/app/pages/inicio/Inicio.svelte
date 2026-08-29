<script>
  import { onMount } from 'svelte'
  import { isInGrist, subscribeAccess } from '$core/data/dataRepository'
  import { identidad } from '$core/data/identidad'
  import { inicioStore as store } from './inicioStore.svelte.js'
  import { cooperadoraStore } from '$app/pages/cooperadora/cooperadoraStore.svelte.js'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { Separator } from '$lib/components/ui/separator'
  import MessageBanner from '$lib/components/MessageBanner.svelte'
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import ResumenEjecutivo from './components/ResumenEjecutivo.svelte'
  import TableroCaja from './components/TableroCaja.svelte'
  import SituacionActual from './components/SituacionActual.svelte'
  import SchemaErrorView from './components/SchemaErrorView.svelte'
  import { navigate } from '$core/ui/router.svelte'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus'
  import BuildingIcon from '@lucide/svelte/icons/building'

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
    <h1 class="text-lg font-bold">Inicio — {identidad.nombre}</h1>
  </div>

  {#if gristReady}
    {#if store.loading}
      <div class="flex flex-col gap-4">
        <Skeleton class="h-8 w-48" />
        <Skeleton class="h-64 w-full" />
      </div>
    {:else if store.status}
      {#if store.status.missing.length === 0 && store.status.schemaDiff?.missingTables?.length === 0 && store.status.schemaDiff?.missingColumns?.length === 0}
        <div class="flex flex-col gap-4 mt-2">
          <!-- Ficha institucional compacta (una línea) -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground rounded-lg border border-border bg-card px-3 py-2">
            <BuildingIcon class="size-4 text-primary shrink-0" />
            <span class="font-semibold text-foreground">
              {cooperadoraStore.escuela?.escuela_nombre || identidad.nombre}
            </span>
            {#if cooperadoraStore.escuela?.escuela_numero}
              <span>N° {cooperadoraStore.escuela.escuela_numero}</span>
            {/if}
            {#if cooperadoraStore.escuela?.cue}
              <span>CUE: {cooperadoraStore.escuela.cue}</span>
            {/if}
            {#if store.ejercicioEnCurso}
              <span>Ejercicio: <strong class="text-foreground">{store.ejercicioEnCurso.anio_inicio}-{store.ejercicioEnCurso.anio_fin}</strong></span>
            {/if}
            <Button variant="ghost" size="sm" class="ml-auto h-7 px-2 text-xs" onclick={() => navigate('cooperadora')}>
              Editar
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>

          <!-- Situación actual: foto de la cooperadora -->
          <SituacionActual
            dashLoading={store.dashLoading}
            saldos={saldos}
            ultimaCarga={store.ultimaCarga}
            periodoActual={store.periodoActual}
            movimientosMes={store.movimientosMes}
            ejercicioEnCurso={store.ejercicioEnCurso}
          />

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
                  morosidadPct={store.morosidadPct}
                  mayorGasto={store.mayorGasto}
                  moduloGestionIntegral={store.moduloGestionIntegral}
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
        </div>
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
        <p class="text-sm text-muted-foreground">Esta aplicación funciona dentro de Grist, una planilla inteligente gratuita.</p>
        <p class="text-sm text-muted-foreground">Si la abrís sola en el navegador, no tiene acceso a los datos de tu cooperadora. Necesitás agregarla a tu documento de Grist.</p>
        <Separator />
        <p class="text-sm font-semibold">Cómo instalarla en tu documento de Grist</p>
        <ol class="ml-5 list-decimal text-sm text-muted-foreground">
          <li>Abrí tu documento de Grist</li>
          <li>Agregá una página nueva y elegí "Personalizado" (Custom)</li>
          <li>Pegá la URL publicada de LOF</li>
          <li>Elegí el nivel de acceso: <strong>Acceso completo al documento</strong></li>
        </ol>
      </Card.Content>
    </Card.Root>
  {/if}

  <MessageBanner error={store.error} />
</div>
