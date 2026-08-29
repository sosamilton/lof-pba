<script>
  /**
   * Banner con instrucciones visuales para instalar LOF como app en
   * plataformas que NO soportan `beforeinstallprompt` (iOS Safari,
   * Firefox Android). En Chrome/Edge el botón nativo ya funciona,
   * así que este banner no se muestra en esas plataformas.
   *
   * El usuario puede cerrar el banner. Se guarda en localStorage para
   * no volver a mostrarlo por 7 días (no es permanente: la app puede
   * mejorar y querer volver a sugerirlo).
   */
  import { pwaInstall } from '$core/utils/pwaInstall.svelte'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import ShareIcon from '@lucide/svelte/icons/share'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import XIcon from '@lucide/svelte/icons/x'
  import { trackEvent } from '$core/analytics/plausible.js'

  const DISMISS_KEY = 'lof_install_banner_dismissed'
  const DISMISS_DAYS = 7

  let dismissed = $state(false)

  // Verificar si fue dismissado recientemente.
  $effect(() => {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw) {
      const until = Number(raw)
      if (Date.now() < until) {
        dismissed = true
      } else {
        localStorage.removeItem(DISMISS_KEY)
      }
    }
  })

  function dismiss() {
    dismissed = true
    if (typeof localStorage !== 'undefined') {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
      localStorage.setItem(DISMISS_KEY, String(until))
    }
    trackEvent('pwa_install_banner_dismissed', { platform: pwaInstall.platform })
  }

  // Solo mostrar si la plataforma necesita instrucciones manuales y no fue dismissado.
  let show = $derived(
    pwaInstall.needsManualInstructions && !dismissed
  )

  let isIOS = $derived(pwaInstall.platform === 'ios-safari')
</script>

{#if show}
  <div class="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
    <DownloadIcon class="mt-0.5 size-5 shrink-0 text-primary" />

    <div class="min-w-0 flex-1">
      <p class="font-semibold text-foreground">
        Instalá LOF en tu dispositivo
      </p>
      <p class="mt-0.5 text-muted-foreground">
        {#if isIOS}
          Tocá el botón <strong>Compartir</strong>
          <ShareIcon class="inline-block size-3.5 align-text-bottom" />
          abajo en la barra de Safari y elegí
          <strong>"Añadir a pantalla de inicio"</strong>
          <PlusIcon class="inline-block size-3.5 align-text-bottom" />.
        {:else}
          Tocá el menú
          <strong>⋮</strong>
          arriba a la derecha en Firefox y elegí
          <strong>"Instalar esta página como app"</strong>
          o <strong>"Añadir a pantalla de inicio"</strong>.
        {/if}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        Después vas a poder abrir LOF sin navegador y usarlo sin conexión.
      </p>
    </div>

    <button
      type="button"
      onclick={dismiss}
      class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="No mostrar por 7 días"
      aria-label="Cerrar aviso de instalación"
    >
      <XIcon class="size-4" />
    </button>
  </div>
{/if}
