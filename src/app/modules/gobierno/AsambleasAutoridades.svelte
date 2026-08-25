<script>
  import { onMount } from 'svelte'
  import { asambleasAutoridadesStore as store } from './asambleasAutoridadesStore.svelte'
  import { isInGrist } from '$core/data/dataRepository'
  import * as Tabs from '$lib/components/ui/tabs'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaff from '$lib/components/PageScaffold.svelte'
  import EjercicioSelector from '$lib/components/EjercicioSelector.svelte'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import BookIcon from '@lucide/svelte/icons/book-open'
  import TabAsambleas from './asambleas/components/TabAsambleas.svelte'
  import TabHistorico from './autoridades/components/TabHistorico.svelte'
  import TabHechosRelevantes from './memoria/components/TabHechosRelevantes.svelte'

  onMount(async () => {
    if (!isInGrist()) return
    await store.initFromOptions()
    const unsub = store.subscribe()
    await store.load()
    return unsub
  })
  // Ejercicios para el selector
  let cantidadEjercicios = $derived((store.ejercicios || []).length)
</script>

<PageScaff title="Asambleas y Memorias" loading={store.loading} error={store.error} notice={store.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-72 w-full" />
    </div>
  {/snippet}

  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-lg font-bold">Asambleas y Memorias</h1>
      <p class="text-sm text-muted-foreground">
        {#if store.ejercicio}
          Ejercicio en curso: <span class="font-mono">{store.ejercicio.anio_inicio}-{store.ejercicio.anio_fin}</span>
        {:else}
          No hay ejercicio en curso. Activá uno en "Institucional".
        {/if}
      </p>
    </div>
    {#if store.ejercicio && cantidadEjercicios > 1}
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Viendo:</span>
        <EjercicioSelector
          ejercicios={store.ejercicios}
          value={store.ejercicioSeleccionado}
          onValueChange={(v) => { if (v) store.ejercicioSeleccionado = Number(v) }}
          class="h-8 w-[180px] text-xs"
          showMesInicio={true}
        />
      </div>
    {/if}
  </div>

  {#if store.ejercicio}
    <Tabs.Root bind:value={store.tab}>
      <Tabs.List class="mb-4 mx-auto h-10">
        <Tabs.Trigger value="asambleas" class="px-3">
          <GavelIcon data-icon="inline-start" />
          Asambleas y reuniones
        </Tabs.Trigger>
        <Tabs.Trigger value="historico" class="px-3">
          <HistoryIcon data-icon="inline-start" />
          Histórico
        </Tabs.Trigger>
        <Tabs.Trigger value="memoria" class="px-3">
          <BookIcon data-icon="inline-start" />
          Hechos relevantes
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="asambleas">
        <TabAsambleas {store} />
      </Tabs.Content>
      <Tabs.Content value="historico">
        <TabHistorico {store} />
      </Tabs.Content>
      <Tabs.Content value="memoria">
        <TabHechosRelevantes {store} />
      </Tabs.Content>
    </Tabs.Root>
  {/if}
</PageScaff>
