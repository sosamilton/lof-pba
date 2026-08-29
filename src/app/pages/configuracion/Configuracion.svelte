<script>
  import { onMount } from 'svelte'
  import { inicioStore as inicio } from '$app/pages/inicio/inicioStore.svelte.js'
  import { categoriasStore as categorias } from './categoriasStore.svelte.js'
  import { syncStore as sync } from './syncStore.svelte.js'
  import * as Tabs from '$lib/components/ui/tabs'
  import PageScaff from '$lib/components/PageScaffold.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import TagsIcon from '@lucide/svelte/icons/tags'
  import CloudIcon from '@lucide/svelte/icons/cloud'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import ConfigGeneral from './components/ConfigGeneral.svelte'
  import CategoriasTab from './components/CategoriasTab.svelte'
  import SyncTab from './components/SyncTab.svelte'
  import IntercambioTab from './components/IntercambioTab.svelte'

  let tab = $state('general')

  onMount(() => {
    // El inicioStore se inicializa desde Inicio.svelte; si el usuario entra
    // directo a Configuracion, lo inicializamos acá también.
    const unsubInicio = inicio.init()
    categorias.load()
    const unsubCategorias = categorias.subscribe()
    sync.load()
    return () => {
      if (typeof unsubInicio === 'function') unsubInicio()
      unsubCategorias?.()
    }
  })
</script>

<PageScaff title="Configuración" loading={inicio.loading && categorias.loading} error={inicio.error || categorias.error} notice={categorias.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-64 w-full" />
    </div>
  {/snippet}

  <div class="flex flex-col gap-4 w-full">
    <Tabs.Root bind:value={tab} class="min-w-0">
      <Tabs.List class="mb-4">
        <Tabs.Trigger value="general" class="px-3">
          <SettingsIcon data-icon="inline-start" />
          General
        </Tabs.Trigger>
        <Tabs.Trigger value="categorias" class="px-3">
          <TagsIcon data-icon="inline-start" />
          Categorías y subcategorías
        </Tabs.Trigger>
        <Tabs.Trigger value="sync" class="px-3">
          <CloudIcon data-icon="inline-start" />
          Sincronización
        </Tabs.Trigger>
        <Tabs.Trigger value="intercambio" class="px-3">
          <ArrowLeftRightIcon data-icon="inline-start" />
          Intercambio
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="general" class="flex flex-col gap-4">
        <ConfigGeneral store={inicio} />
      </Tabs.Content>

      <Tabs.Content value="categorias" class="flex flex-col gap-4">
        <CategoriasTab store={categorias} />
      </Tabs.Content>

      <Tabs.Content value="sync" class="flex flex-col gap-4">
        <SyncTab />
      </Tabs.Content>

      <Tabs.Content value="intercambio" class="flex flex-col gap-4">
        <IntercambioTab />
      </Tabs.Content>
    </Tabs.Root>
  </div>
</PageScaff>
