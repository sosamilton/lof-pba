<script>
  import { onMount } from 'svelte'
  import { retryAccess, subscribeAccess, getGristStatus } from '../grist'
  import '../shared.css'

  let status = $state(getGristStatus())
  let retrying = $state(false)

  onMount(() => {
    return subscribeAccess((s) => {
      status = s
    })
  })

  const handleRetry = async () => {
    retrying = true
    await retryAccess()
    retrying = false
  }
</script>

<main class="wrap">
  <div class="card">
    <div class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z" stroke="currentColor" stroke-width="2" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" />
      </svg>
    </div>

    <h1>AppCoop necesita acceso al documento</h1>

    <p class="lead">
      El widget está cargado dentro de Grist, pero todavía no tiene permisos
      para acceder a las tablas del documento. Sin esto, la app no puede
      funcionar.
    </p>

    <div class="steps">
      <div class="step">
        <div class="stepN">1</div>
        <div>
          <div class="stepTitle">Abrir configuración del widget</div>
          <div class="stepSub">
            Hacé clic en el ícono <span class="mono">⚙</span> (engrane) arriba a la
            derecha del widget, o en <span class="mono">⋮</span> →
            <span class="mono">Widget options</span>.
          </div>
        </div>
      </div>

      <div class="step">
        <div class="stepN">2</div>
        <div>
          <div class="stepTitle">Cambiar el nivel de acceso</div>
          <div class="stepSub">
            En <span class="mono">Access level</span>, seleccioná
            <strong>Full document access</strong>.
          </div>
        </div>
      </div>

      <div class="step">
        <div class="stepN">3</div>
        <div>
          <div class="stepTitle">Confirmar el cambio</div>
          <div class="stepSub">
            Grist pedirá confirmación. Aceptá y volvé a hacer clic en
            &laquo;Reintentar&raquo; abajo.
          </div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn" onclick={handleRetry} disabled={retrying}>
        {retrying ? 'Verificando…' : 'Reintentar acceso'}
      </button>
    </div>

    {#if retrying}
      <p class="muted">Esperando confirmación de Grist…</p>
    {/if}
  </div>

  <div class="help">
    <p>
      ¿No ves la opción de permisos? Es posible que necesites permisos de
      <strong>editor</strong> en el documento. Si sos solo lector, pedile a un
      editor o dueño del documento que cambie el acceso del widget.
    </p>
  </div>
</main>

<style>
  .wrap {
    max-width: 620px;
    margin: 0 auto;
    padding: 32px 18px;
  }

  .card {
    border-radius: 18px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background:
      radial-gradient(600px 300px at 50% 0%, rgba(22, 179, 120, 0.08), transparent 60%),
      rgba(128, 128, 128, 0.04);
    padding: 24px 20px;
  }

  .icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    border: 1px solid rgba(22, 179, 120, 0.25);
    background: rgba(22, 179, 120, 0.1);
  }

  .icon svg {
    width: 22px;
    height: 22px;
    color: var(--grist-theme-cursor, #16b378);
  }

  h1 {
    margin: 0 0 8px 0;
    font-size: 20px;
    line-height: 1.2;
  }

  .lead {
    margin: 0 0 18px 0;
    opacity: 0.85;
    font-size: 14px;
    line-height: 1.55;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 18px;
  }

  .step {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    border-radius: 14px;
    border: 1px solid rgba(128, 128, 128, 0.18);
    background: rgba(128, 128, 128, 0.04);
    padding: 12px;
  }

  .stepN {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 13px;
    flex-shrink: 0;
    border: 1px solid rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.12);
  }

  .stepTitle {
    font-weight: 800;
    font-size: 13px;
  }

  .stepSub {
    opacity: 0.78;
    font-size: 13px;
    margin-top: 3px;
    line-height: 1.45;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .muted {
    margin-top: 10px;
    font-size: 13px;
    opacity: 0.7;
  }

  .help {
    margin-top: 16px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid rgba(255, 180, 0, 0.25);
    background: rgba(255, 180, 0, 0.06);
  }

  .help p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    opacity: 0.85;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.92em;
  }
</style>
