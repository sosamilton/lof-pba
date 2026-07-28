<script>
  import { onMount } from 'svelte'
  import { route, navigate } from '../router'

  export let title = 'AppCoop'

  let drawerOpen = false
  let isSmall = false

  const syncSmall = () => {
    isSmall = window.matchMedia('(max-width: 860px)').matches
    if (!isSmall) drawerOpen = false
  }

  const go = (r) => {
    navigate(r)
    drawerOpen = false
  }

  onMount(() => {
    syncSmall()
    const onResize = () => syncSmall()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })
</script>

<div class="shell">
  {#if isSmall}
    <div class="topbar">
      <button class="iconBtn" aria-label="Abrir menú" on:click={() => (drawerOpen = true)}>Menu</button>
      <div class="topbarTitle">{title}</div>
      <div class="topbarSpacer"></div>
    </div>
  {/if}

  {#if isSmall && drawerOpen}
    <button class="backdrop" aria-label="Cerrar menú" on:click={() => (drawerOpen = false)}></button>
  {/if}

  <aside class:sidebar={true} class:drawer={isSmall} class:drawerOpen={drawerOpen}>
    <div class="brand">
      <div class="brand-title">{title}</div>
      <div class="brand-sub">Demo cooperadora</div>
    </div>

    <nav class="nav">
      <a class:selected={$route === 'inicio'} href="#inicio" on:click|preventDefault={() => go('inicio')}>Inicio</a>
      <a class:selected={$route === 'setup'} href="#setup" on:click|preventDefault={() => go('setup')}>Cooperadora</a>
      <a class:selected={$route === 'socios'} href="#socios" on:click|preventDefault={() => go('socios')}>Socios</a>
      <a class:selected={$route === 'movimientos'} href="#movimientos" on:click|preventDefault={() => go('movimientos')}>Movimientos</a>
      <a class:selected={$route === 'gobierno'} href="#gobierno" on:click|preventDefault={() => go('gobierno')}>Gobierno</a>
    </nav>
  </aside>

  <main class="content">
    <slot />
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 100vh;
    background: var(--grist-theme-page-panels-main-panel-bg, var(--bg, #fff));
    color: var(--grist-theme-text, var(--text-h, #111));
  }

  .sidebar {
    border-right: 1px solid rgba(128, 128, 128, 0.25);
    background: rgba(128, 128, 128, 0.06);
    padding: 14px;
    box-sizing: border-box;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    background: var(--grist-theme-page-panels-main-panel-bg, rgba(128, 128, 128, 0.06));
  }

  .topbarTitle {
    font-weight: 800;
    font-size: 14px;
  }

  .topbarSpacer {
    flex: 1;
  }

  .iconBtn {
    border: 1px solid rgba(128, 128, 128, 0.28);
    border-radius: 10px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    cursor: pointer;
    font-weight: 800;
    font-size: 13px;
  }

  .iconBtn:hover {
    border-color: rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.12);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 35;
    border: 0;
    background: rgba(0, 0, 0, 0.35);
  }

  .drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    width: min(320px, 86vw);
    transform: translateX(-102%);
    transition: transform 140ms ease;
    border-right: 1px solid rgba(128, 128, 128, 0.25);
    background: var(--grist-theme-page-panels-main-panel-bg, rgba(128, 128, 128, 0.06));
  }

  .drawerOpen {
    transform: translateX(0);
  }

  .brand {
    margin-bottom: 12px;
  }

  .brand-title {
    font-weight: 800;
    font-size: 14px;
  }

  .brand-sub {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 2px;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nav a {
    padding: 10px 10px;
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    font-size: 14px;
    border: 1px solid transparent;
  }

  .nav a:hover {
    background: rgba(22, 179, 120, 0.1);
    border-color: rgba(22, 179, 120, 0.25);
  }

  .nav a.selected {
    background: rgba(22, 179, 120, 0.16);
    border-color: rgba(22, 179, 120, 0.35);
    font-weight: 700;
  }

  .content {
    padding: 18px 18px;
    box-sizing: border-box;
  }

  @media (max-width: 860px) {
    .shell {
      grid-template-columns: 1fr;
    }
    .content {
      padding: 14px 12px;
    }
  }
</style>
