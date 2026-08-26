<script>
  import { onMount } from 'svelte'
  import { Toaster } from '$lib/components/ui/sonner'
  import AppShell from '$app/AppShell.svelte'
  import { initRouter, router, navigate } from '$core/ui/router.svelte'
  import { detectGrist, getGristStatus, getWidgetOptions, isInGrist, subscribeAccess, listTables, getActiveBackend } from '$core/data/dataRepository'
  import { trackPageview } from '$core/analytics/plausible.js'
  import { isInstalled, loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
  import { identidad } from '$core/data/identidad'
  import { syncStore as sync } from '$app/pages/configuracion/syncStore.svelte.js'

  const activeBackend = getActiveBackend()
  const isPouchMode = activeBackend === 'pouch'

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
  import Configuracion from '$app/pages/configuracion/Configuracion.svelte'

  let ready = $state(false)
  let gristStatus = $state('none')
  let needsSetup = $state(false)
  let modalidad = $state('')  // 'gestion_integral' | 'carga_consolidada' | '' (no instalada)

  const checkInstalled = async () => {
    try {
      if (isPouchMode) {
        // En modo PouchDB, listTables devuelve keys del schema (siempre existen).
        // Verificamos directamente si hay config instalada.
        const installed = await isInstalled()
        needsSetup = !installed
      } else {
        // En modo Grist, verificamos que la tabla configuracion exista.
        const tables = await listTables()
        const hasConfig = tables.some((t) => String(t).toLowerCase() === 'configuracion')
        if (!hasConfig) {
          needsSetup = true
          return
        }
        const installed = await isInstalled()
        needsSetup = !installed
      }
      // Cargar modalidad de gestión desde config para segmentar en analytics
      if (!needsSetup) {
        try {
          const config = await loadConfig()
          modalidad = config?.modulo_gestion_integral ? 'gestion_integral' : 'carga_consolidada'
        } catch { /* non-fatal */ }
      }
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
      // En modo PouchDB (standalone), si no está instalada y el usuario
      // no navegó explícitamente a una ruta de la app, mostrar la landing.
      if (isPouchMode && needsSetup && router.current === 'inicio') {
        navigate('landing')
      }
      if (!needsSetup) {
        const opts = await getWidgetOptions()
        if (opts?.lastRoute && opts.lastRoute !== router.current && opts.lastRoute !== 'landing') {
          navigate(opts.lastRoute)
        }
        // Auto-start sync si está configurado y habilitado (solo PouchDB)
        if (isPouchMode) {
          try {
            await sync.load()
            const cfg = sync.config
            if (cfg.sync_enabled && cfg.sync_auto) {
              sync.start()
            }
          } catch { /* sync es opcional */ }
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

  // Trackea pageviews en Plausible distinguiendo landing vs app por URL.
  // Landing  → "/"  "/instalacion"  "/sobre-lof"  "/needs-access"
  // App      → "/app/{route}"  o  "/app/setup"
  // Props: backend (pouch|grist), installed (bool), grist_status, section
  $effect(() => {
    // deps reactivas: ready, gristStatus, needsSetup, router.current
    if (!ready) return

    let path
    let section = 'landing'
    if (router.current === 'landing') {
      path = '/'
      section = 'landing'
    } else if (gristStatus === 'ready' && needsSetup) {
      path = '/app/setup'
      section = 'setup'
    } else if (gristStatus === 'ready') {
      path = `/app/${router.current}`
      section = 'app'
    } else if (gristStatus === 'no-access') {
      path = '/needs-access'
      section = 'landing'
    } else if (router.current === 'instalacion') {
      path = '/instalacion'
      section = 'landing'
    } else if (router.current === 'sobre-lof') {
      path = '/sobre-lof'
      section = 'landing'
    } else {
      path = '/'
      section = 'landing'
    }

    trackPageview(path, {
      backend: activeBackend,
      installed: !needsSetup,
      grist_status: gristStatus,
      section,
      modalidad,
    })
  })
</script>

{#if !ready}
  <div class="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
    <div class="flex flex-col items-center gap-3">
      <div class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      <p class="text-sm text-muted-foreground">Cargando…</p>
    </div>
  </div>
{:else if router.current === 'landing'}
  <Landing installed={gristStatus === 'ready' && !needsSetup} />
{:else if router.current === 'sobre-lof'}
  <SobreLof />
{:else if router.current === 'instalacion'}
  <InstallGuide />
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
      {:else if router.current === 'configuracion'}
        <Configuracion />
      {:else}
        <Inicio />
      {/if}
    {/snippet}
  </AppShell>
{:else if gristStatus === 'no-access'}
  {#if isPouchMode}
    <!-- En modo PouchDB, no-access significa que IndexedDB no está disponible -->
    <main class="max-w-[620px] mx-auto px-4 py-8">
      <div class="rounded-2xl border border-border bg-muted/5 p-5">
        <h1 class="text-xl font-bold leading-tight mb-2">No se pudo acceder al almacenamiento local</h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          Tu navegador no soporta IndexedDB o está bloqueado. Probá con otro navegador
          o revisá la configuración de privacidad.
        </p>
      </div>
    </main>
  {:else}
    <NeedsAccess />
  {/if}
{:else}
  <Landing />
{/if}

<Toaster position="top-right" richColors closeButton />
