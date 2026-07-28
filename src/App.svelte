<script>
  import { onMount } from 'svelte'
  import AppShell from './lib/layout/AppShell.svelte'
  import { initRouter, router } from './lib/router.svelte'
  import { detectGrist, isInGrist } from './lib/grist'

  import Inicio from './lib/pages/Inicio.svelte'
  import Landing from './lib/pages/Landing.svelte'
  import Setup from './lib/pages/Setup.svelte'
  import Socios from './lib/pages/Socios.svelte'
  import Movimientos from './lib/pages/Movimientos.svelte'
  import Gobierno from './lib/pages/Gobierno.svelte'

  let ready = $state(false)

  onMount(() => {
    const cleanup = initRouter()
    ;(async () => {
      await detectGrist()
      ready = true
    })()
    return cleanup
  })
</script>

{#if !ready}
  <div style="padding: 18px; opacity: 0.8;">Cargando…</div>
{:else if isInGrist()}
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
{:else}
  <Landing />
{/if}
