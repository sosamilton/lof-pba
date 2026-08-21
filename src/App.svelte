<script>
  import { onMount } from 'svelte'
  import { Toaster } from '$lib/components/ui/sonner'
  import AppShell from '$app/AppShell.svelte'
  import { initRouter, router, navigate } from '$core/ui/router.svelte'
  import { detectGrist, getGristStatus, getWidgetOptions, isInGrist, subscribeAccess, listTables } from '$core/grist/grist'
  import { isInstalled } from '$app/pages/cooperadora/cooperadoraApi.js'
  import { identidad } from '$core/data/identidad'

  import Inicio from '$app/pages/inicio/Inicio.svelte'
  import Landing from '$landing/Landing.svelte'
  import InstallGuide from '$landing/InstallGuide.svelte'
  import SobreLof from '$landing/SobreLof.svelte'
  import NeedsAccess from '$setup/NeedsAccess.svelte'
  import SetupWizard from '$setup/SetupWizard.svelte'
  import Cooperadora from '$app/pages/cooperadora/Cooperadora.svelte'
  import Comunidad from '$app/modules/comunidad/Comunidad.svelte'
  import Movimientos from '$app/modules/tesoreria/movimientos/Movimientos.svelte'
  import CargaPIAMatrix from '$app/modules/tesoreria/cargaPia/CargaPIAMatrix.svelte'
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
  <div class="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
    <div class="flex flex-col items-center gap-3">
      <div class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">Cargando…</p>
    </div>
  </div>
{:else if gristStatus === 'ready' && needsSetup}
  <SetupWizard />
{:else if gristStatus === 'ready'}
  <AppShell title={identidad.nombre}>
    {#snippet children()}
      {#if router.current === 'cooperadora'}
        <Cooperadora />
      {:else if router.current === 'comunidad'}
        <Comunidad />
      {:else if router.current === 'movimientos'}
        <Movimientos />
      {:else if router.current === 'resumen'}
        {#await import('$app/modules/tesoreria/resumen/ResumenMensual.svelte')}
          <div class="flex items-center justify-center py-12" role="status">
            <div class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        {:then mod}
          <mod.default />
        {:catch}
          <p class="p-4 text-sm text-destructive">Error al cargar el módulo. Reintentá.</p>
        {/await}
      {:else if router.current.startsWith('carga-pia')}
        <CargaPIAMatrix />
      {:else if router.current === 'cierre'}
        {#await import('$app/modules/tesoreria/cierre/Cierre.svelte')}
          <div class="flex items-center justify-center py-12" role="status">
            <div class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        {:then mod}
          <mod.default />
        {:catch}
          <p class="p-4 text-sm text-destructive">Error al cargar el módulo. Reintentá.</p>
        {/await}
      {:else if router.current === 'gobierno'}
        <Gobierno />
      {:else}
        <Inicio />
      {/if}
    {/snippet}
  </AppShell>
{:else if gristStatus === 'no-access'}
  <NeedsAccess />
{:else if router.current === 'instalacion'}
  <InstallGuide />
{:else if router.current === 'sobre-lof'}
  <SobreLof />
{:else}
  <Landing />
{/if}

<Toaster position="top-right" richColors closeButton />
