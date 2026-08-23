<script>
  import { onMount } from 'svelte'
  import { inicioStore as inicio } from '$app/pages/inicio/inicioStore.svelte.js'
  import { categoriasStore as categorias } from './categoriasStore.svelte.js'
  import * as Tabs from '$lib/components/ui/tabs'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import TagsIcon from '@lucide/svelte/icons/tags'
  import ConfigGeneral from './components/ConfigGeneral.svelte'
  import CategoriasTab from './components/CategoriasTab.svelte'

  let tab = $state('general')

  onMount(() => {
    // El inicioStore se inicializa desde Inicio.svelte; si el usuario entra
    // directo a Configuracion, lo inicializamos acá también.
    const unsubInicio = inicio.init()
    categorias.load()
    const unsubCategorias = categorias.subscribe()
    return () => {
      if (typeof unsubInicio === 'function') unsubInicio()
      unsubCategorias?.()
    }
  })
</script>

<PageScaffold title="Configuración" loading={inicio.loading && categorias.loading} error={inicio.error || categorias.error} notice={categorias.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-64 w-full" />
    </div>
  {/snippet}

  <div class="flex flex-col gap-4 w-full">
    <Tabs.Root bind:value={tab}>
      <Tabs.List class="mb-4">
        <Tabs.Trigger value="general" class="px-3">
          <SettingsIcon data-icon="inline-start" />
          General
        </Tabs.Trigger>
        <Tabs.Trigger value="categorias" class="px-3">
          <TagsIcon data-icon="inline-start" />
          Categorías y subcategorías
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="general" class="flex flex-col gap-4">
        <ConfigGeneral store={inicio} />
      </Tabs.Content>

      <Tabs.Content value="categorias" class="flex flex-col gap-4">
        <CategoriasTab store={categorias} />
      </Tabs.Content>
    </Tabs.Root>
  </div>
</PageScaffold>
