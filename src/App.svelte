<script>
  import { onMount } from 'svelte'
  import AppShell from './lib/layout/AppShell.svelte'
  import { initRouter, router, navigate } from './lib/router.svelte'
  import { detectGrist, getGristStatus, getWidgetOptions, isInGrist, subscribeAccess } from './lib/grist'

  import Inicio from './lib/pages/Inicio.svelte'
  import Landing from './lib/pages/Landing.svelte'
  import NeedsAccess from './lib/pages/NeedsAccess.svelte'
  import Setup from './lib/pages/Setup.svelte'
  import Socios from './lib/pages/Socios.svelte'
  import Movimientos from './lib/pages/Movimientos.svelte'
  import Gobierno from './lib/pages/Gobierno.svelte'

  let ready = $state(false)
  let gristStatus = $state('none')

  onMount(async () => {
    const cleanup = await initRouter()
    const status = await detectGrist()
    gristStatus = status
    if (status === 'ready') {
      const opts = await getWidgetOptions()
      if (opts?.lastRoute && opts.lastRoute !== router.current) {
        navigate(opts.lastRoute)
      }
    }
    const unsubAccess = subscribeAccess((s) => {
      gristStatus = s
    })
    ready = true
    return () => {
      cleanup?.()
      unsubAccess?.()
    }
  })
</script>

{#if !ready}
  <div style="padding: 18px; opacity: 0.8;">Cargando…</div>
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
