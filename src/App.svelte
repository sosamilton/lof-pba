<script>
  import { onMount } from 'svelte'
  import AppShell from './lib/layout/AppShell.svelte'
  import { initRouter, route } from './lib/router'
  import { detectGrist, isInGrist } from './lib/grist'

  import Inicio from './lib/pages/Inicio.svelte'
  import Landing from './lib/pages/Landing.svelte'
  import Setup from './lib/pages/Setup.svelte'
  import Socios from './lib/pages/Socios.svelte'
  import Movimientos from './lib/pages/Movimientos.svelte'
  import Gobierno from './lib/pages/Gobierno.svelte'

  let ready = false

  onMount(() => {
    ;(async () => {
      await detectGrist()
      if (isInGrist()) initRouter()
      ready = true
    })()
  })
</script>

{#if !ready}
  <div style="padding: 18px; opacity: 0.8;">Cargando…</div>
{:else if isInGrist()}
  <AppShell title="AppCoop">
    {#if $route === 'setup'}
      <Setup />
    {:else if $route === 'socios'}
      <Socios />
    {:else if $route === 'movimientos'}
      <Movimientos />
    {:else if $route === 'gobierno'}
      <Gobierno />
    {:else}
      <Inicio />
    {/if}
  </AppShell>
{:else}
  <Landing />
{/if}
