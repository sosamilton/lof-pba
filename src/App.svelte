<script>
  import { onMount } from 'svelte'
  import AppShell from './lib/layout/AppShell.svelte'
  import { initRouter, route } from './lib/router'
  import { isInGrist } from './lib/grist'

  import Inicio from './lib/pages/Inicio.svelte'
  import Landing from './lib/pages/Landing.svelte'
  import Setup from './lib/pages/Setup.svelte'
  import Socios from './lib/pages/Socios.svelte'
  import Movimientos from './lib/pages/Movimientos.svelte'
  import Gobierno from './lib/pages/Gobierno.svelte'

  onMount(() => {
    if (isInGrist()) initRouter()
  })
</script>

{#if isInGrist()}
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
