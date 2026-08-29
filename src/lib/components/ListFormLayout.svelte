<script>
  import { untrack } from 'svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import { Button } from '$lib/components/ui/button'
  import { IsMobile } from '$lib/hooks/is-mobile.svelte.js'

  /**
   * Layout reutilizable para vistas lista+detalle.
   *
   * - Desktop (>=768px): grid de 2 columnas (lista | detalle), igual al
   *   patrón actual.
   * - Mobile (<768px): patrón "stack con back". La lista ocupa todo el
   *   ancho. Al haber un formulario activo (showForm=true), el detalle
   *   reemplaza la lista a full-width con un botón "← Volver".
   *
   * Props:
   * @param {boolean} showForm  - si hay un form/panel activo (edit/new)
   * @param {boolean} hasItems  - si la lista tiene items (controla columnas en desktop)
   * @param {function} onBack   - callback del botón volver (mobile)
   * @param {string} backLabel  - texto del botón volver
   * @param {Snippet} list      - contenido de la lista
   * @param {Snippet} detail    - contenido del panel derecho (form, empty state, placeholder)
   */
  let {
    showForm = false,
    hasItems = false,
    onBack = () => {},
    backLabel = 'Volver',
    list = null,
    detail = null,
  } = $props()

  const isMobile = new IsMobile()

  // En mobile, sincronizar la vista con showForm.
  // Cuando showForm pasa a true, el detalle reemplaza la lista.
  // Cuando vuelve a false, la lista vuelve a ser visible.
  let mobileView = $state(untrack(() => (showForm ? 'form' : 'list')))

  $effect(() => {
    if (isMobile.current) {
      mobileView = showForm ? 'form' : 'list'
    }
  })
</script>

{#if isMobile.current}
  <!-- Mobile: stack con back -->
  {#if mobileView === 'form' && showForm}
    <div>
      <Button
        variant="ghost"
        size="sm"
        onclick={onBack}
        class="sticky top-0 z-10 mb-3 -ml-2 bg-background/95 backdrop-blur-sm"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {backLabel}
      </Button>
      {@render detail?.()}
    </div>
  {:else if hasItems}
    {@render list?.()}
  {:else}
    {@render detail?.()}
  {/if}
{:else}
  <!-- Desktop: grid de 2 columnas (o 1 columna si no hay items) -->
  <div
    class="grid gap-4 items-start"
    style="grid-template-columns: {hasItems ? 'minmax(280px, 380px) 1fr' : '1fr'}"
  >
    {#if hasItems}
      {@render list?.()}
    {/if}
    <div>
      {@render detail?.()}
    </div>
  </div>
{/if}
