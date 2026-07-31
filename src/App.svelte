<script>
  import { onMount } from 'svelte'
  import { Toaster } from '$lib/components/ui/sonner'
  import AppShell from '$app/AppShell.svelte'
  import { initRouter, router, navigate } from '$core/router.svelte'
  import { detectGrist, getGristStatus, getWidgetOptions, isInGrist, subscribeAccess, listTables } from '$core/grist'
  import { isInstalled } from '$core/configuracion'

  import Inicio from '$app/pages/Inicio.svelte'
  import Landing from '$landing/Landing.svelte'
  import NeedsAccess from '$setup/NeedsAccess.svelte'
  import SetupWizard from '$setup/SetupWizard.svelte'
  import Cooperadora from '$app/pages/Cooperadora.svelte'
  import Socios from '$app/modules/comunidad/Socios.svelte'
  import Personas from '$app/modules/comunidad/Personas.svelte'
  import Movimientos from '$app/modules/tesoreria/Movimientos.svelte'
  import Gobierno from '$app/modules/gobierno/AsambleasAutoridades.svelte'

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
      <div class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">Cargando…</p>
    </div>
  </div>
{:else if gristStatus === 'ready' && needsSetup}
  <SetupWizard />
{:else if gristStatus === 'ready'}
  <AppShell title="AppCoop">
    {#snippet children()}
      {#if router.current === 'cooperadora'}
        <Cooperadora />
      {:else if router.current === 'socios'}
        <Socios />
      {:else if router.current === 'personas'}
        <Personas />
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
