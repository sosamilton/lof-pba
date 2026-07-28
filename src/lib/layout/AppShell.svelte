<script>
  import { route, navigate } from '../router'

  export let title = 'AppCoop'
</script>

<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-title">{title}</div>
      <div class="brand-sub">Demo cooperadora</div>
    </div>

    <nav class="nav">
      <a class:selected={$route === 'inicio'} href="#inicio" on:click|preventDefault={() => navigate('inicio')}>Inicio</a>
      <a class:selected={$route === 'setup'} href="#setup" on:click|preventDefault={() => navigate('setup')}>Setup</a>
      <a class:selected={$route === 'socios'} href="#socios" on:click|preventDefault={() => navigate('socios')}>Socios</a>
      <a class:selected={$route === 'movimientos'} href="#movimientos" on:click|preventDefault={() => navigate('movimientos')}>Movimientos</a>
      <a class:selected={$route === 'gobierno'} href="#gobierno" on:click|preventDefault={() => navigate('gobierno')}>Gobierno</a>
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
    .sidebar {
      border-right: 0;
      border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    }
  }
</style>

