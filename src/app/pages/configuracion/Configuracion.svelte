<script>
  import { onMount } from 'svelte'
  import { inicioStore as inicio } from '$app/pages/inicio/inicioStore.svelte.js'
  import { categoriasStore as categorias } from './categoriasStore.svelte.js'
  import { syncStore as sync } from './syncStore.svelte.js'
  import { configStore } from '$core/grist/stores/configStore.svelte'
  import { migrateRoleFromConfig, can } from '$core/security/roles'
  import { pinStore } from '$core/security/pinStore.svelte'
  import * as Tabs from '$lib/components/ui/tabs'
  import PageScaff from '$lib/components/PageScaffold.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import TagsIcon from '@lucide/svelte/icons/tags'
  import CloudIcon from '@lucide/svelte/icons/cloud'
  import ShareIcon from '@lucide/svelte/icons/share'
  import KeyboardIcon from '@lucide/svelte/icons/keyboard'
  import ShieldIcon from '@lucide/svelte/icons/shield-check'
  import ConfigGeneral from './components/ConfigGeneral.svelte'
  import CategoriasTab from './components/CategoriasTab.svelte'
  import SyncTab from './components/SyncTab.svelte'
  import IntercambioTab from './components/IntercambioTab.svelte'
  import AtajosTab from './components/AtajosTab.svelte'
  import SeguridadTab from './components/SeguridadTab.svelte'

  let tab = $state('general')

  // Rol del dispositivo: si el PIN se desbloqueó con un rol específico,
  // ese es el rol activo. Si no, usar el de la config.
  let deviceRole = $derived(pinStore.activeRole || migrateRoleFromConfig(configStore.config))
  let canSeeSeguridad = $derived(can(deviceRole, 'view', 'seguridad'))

  onMount(() => {
    // El inicioStore se inicializa desde Inicio.svelte; si el usuario entra
    // directo a Configuracion, lo inicializamos acá también.
    const unsubInicio = inicio.init()
    categorias.load()
    const unsubCategorias = categorias.subscribe()
    sync.load()
    configStore.load()
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
          <ShareIcon data-icon="inline-start" />
          Exportar / compartir
        </Tabs.Trigger>
        <Tabs.Trigger value="atajos" class="px-3">
          <KeyboardIcon data-icon="inline-start" />
          Atajos
        </Tabs.Trigger>
        {#if canSeeSeguridad}
          <Tabs.Trigger value="seguridad" class="px-3">
            <ShieldIcon data-icon="inline-start" />
            Seguridad
          </Tabs.Trigger>
        {/if}
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

      <Tabs.Content value="atajos" class="flex flex-col gap-4">
        <AtajosTab />
      </Tabs.Content>

      {#if canSeeSeguridad}
        <Tabs.Content value="seguridad" class="flex flex-col gap-4">
          <SeguridadTab />
        </Tabs.Content>
      {/if}
    </Tabs.Root>
  </div>
</PageScaff>
