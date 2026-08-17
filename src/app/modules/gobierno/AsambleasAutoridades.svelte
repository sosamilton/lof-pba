<script>
  import { onMount } from 'svelte'
  import { asambleasAutoridadesStore as store } from './asambleasAutoridadesStore.svelte'
  import { isInGrist } from '$core/grist/grist'
  import * as Tabs from '$lib/components/ui/tabs'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import UsersIcon from '@lucide/svelte/icons/users'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import TabAsambleas from './asambleas/components/TabAsambleas.svelte'
  import TabAutoridades from './autoridades/components/TabAutoridades.svelte'
  import TabHistorico from './autoridades/components/TabHistorico.svelte'
  import DialogCese from './autoridades/components/DialogCese.svelte'
  import DialogReemplazo from './autoridades/components/DialogReemplazo.svelte'

  onMount(async () => {
    if (!isInGrist()) return
    await store.initFromOptions()
    const unsub = store.subscribe()
    await store.load()
    return unsub
  })
</script>

<PageScaffold title="Asambleas y Autoridades" loading={store.loading} error={store.error} notice={store.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-72 w-full" />
    </div>
  {/snippet}

  <div class="mb-4">
    <h1 class="text-lg font-bold">Asambleas y Autoridades</h1>
    <p class="text-sm text-muted-foreground">
      {#if store.ejercicio}
        Ejercicio en curso: <span class="font-mono">{store.ejercicio.anio_inicio}-{store.ejercicio.anio_fin}</span>
      {:else}
        No hay ejercicio en curso. Activá uno en "Institucional".
      {/if}
    </p>
  </div>

  {#if store.ejercicio}
    <Tabs.Root bind:value={store.tab}>
      <Tabs.List class="mb-4 mx-auto h-10">
        <Tabs.Trigger value="asambleas" class="px-3">
          <GavelIcon data-icon="inline-start" />
          Asambleas y reuniones
        </Tabs.Trigger>
        <Tabs.Trigger value="autoridades" class="px-3">
          <UsersIcon data-icon="inline-start" />
          Autoridades vigentes
        </Tabs.Trigger>
        <Tabs.Trigger value="historico" class="px-3">
          <HistoryIcon data-icon="inline-start" />
          Histórico
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="asambleas">
        <TabAsambleas {store} />
      </Tabs.Content>
      <Tabs.Content value="autoridades">
        <TabAutoridades {store} />
      </Tabs.Content>
      <Tabs.Content value="historico">
        <TabHistorico {store} />
      </Tabs.Content>
    </Tabs.Root>
  {/if}

  <DialogCese {store} />
  <DialogReemplazo {store} />
</PageScaffold>
