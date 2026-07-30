<script>
  import { onMount } from 'svelte'
  import { Toaster } from '$lib/components/ui/sonner'
  import AppShell from './lib/layout/AppShell.svelte'
  import { initRouter, router, navigate } from './lib/router.svelte'
  import { detectGrist, getGristStatus, getWidgetOptions, isInGrist, subscribeAccess, listTables } from './lib/grist'
  import { isInstalled } from './lib/configuracion'

  import Inicio from './lib/pages/Inicio.svelte'
  import Landing from './lib/pages/Landing.svelte'
  import NeedsAccess from './lib/pages/NeedsAccess.svelte'
  import SetupWizard from './lib/pages/SetupWizard.svelte'
  import Setup from './lib/pages/Setup.svelte'
  import Socios from './lib/pages/Socios.svelte'
  import Movimientos from './lib/pages/Movimientos.svelte'
  import Gobierno from './lib/pages/Gobierno.svelte'

  let ready = $state(false)
  let gristStatus = $state('none')
  let needsSetup = $state(false)

  const checkInstalled = async () => {
    try {
      const tables = await listTables()
      const hasConfig = tables.some((t) => String(t).toLowerCase() === 'configuracion')
      if (!hasConfig) {
        needsSetup = true
        return
      }
      const installed = await isInstalled()
      needsSetup = !installed
    } catch {
      needsSetup = true
    }
  }

  onMount(async () => {
    const cleanup = await initRouter()
    const status = await detectGrist()
    gristStatus = status
    if (status === 'ready') {
      await checkInstalled()
      if (!needsSetup) {
        const opts = await getWidgetOptions()
        if (opts?.lastRoute && opts.lastRoute !== router.current) {
          navigate(opts.lastRoute)
        }
      }
    }
    const unsubAccess = subscribeAccess(async (s) => {
      gristStatus = s
      if (s === 'ready') {
        await checkInstalled()
      }
    })
    ready = true
    return () => {
      cleanup?.()
      unsubAccess?.()
    }
  })
</script>

{#if !ready}
  <div class="flex items-center justify-center min-h-screen">
    <div class="flex flex-col items-center gap-3">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">Cargando…</p>
    </div>
  </div>
{:else if gristStatus === 'ready' && needsSetup}
  <SetupWizard />
{:else if gristStatus === 'ready'}
  <AppShell title="AppCoop">
    {#snippet children()}
      {#if router.current === 'setup'}
        <Setup />
      {:else if router.current === 'socios'}
        <Socios />
      {:else if router.current === 'movimientos'}
        <Movimientos />
      {:else if router.current === 'gobierno'}
        <Gobierno />
      {:else}
        <Inicio />
      {/if}
    {/snippet}
  </AppShell>
{:else if gristStatus === 'no-access'}
  <NeedsAccess />
{:else}
  <Landing />
{/if}

<Toaster position="top-right" richColors closeButton />
