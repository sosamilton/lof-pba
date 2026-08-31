<script>
  // Sección colapsable estandarizada.
  // Trigger: chevron izquierda + título + icono opcional + badge opcional.
  // Estilo base del de Categorías (Configuración): border, px-3 py-2,
  // font-semibold, hover:bg-accent/50, aria-expanded.
  //
  // Props:
  //   open      — $bindable boolean (caso simple) o solo get (con onToggle)
  //   onToggle  — callback (v) => void, para casos sin bind (ej: Set de abiertos)
  //   title     — texto del header
  //   icon      — componente de icono opcional (ej: SettingsIcon)
  //   contentClass — clases del wrapper de contenido (default: px-3 pb-3 pt-1)
  //
  // Snippets:
  //   badge     — contenido a la derecha del título (ej: Badge con contador)
  //   actions   — botones a la derecha del header (ej: "Verificar cargos")
  //   children  — contenido colapsable

  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'

  let {
    open = $bindable(false),
    onToggle = null,
    title,
    icon: Icon = null,
    contentClass = 'px-3 pb-3 pt-1',
    badge = null,
    actions = null,
    children,
  } = $props()

  const toggle = () => {
    if (onToggle) onToggle(!open)
    else open = !open
  }
</script>

<div class="rounded-lg border border-border">
  <div class="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors">
    <button
      type="button"
      class="flex flex-1 items-center gap-2 text-sm font-semibold text-left"
      onclick={toggle}
      aria-expanded={open}
    >
      {#if open}
        <ChevronDownIcon class="size-4 text-muted-foreground shrink-0" />
      {:else}
        <ChevronRightIcon class="size-4 text-muted-foreground shrink-0" />
      {/if}
      {#if Icon}
        <Icon class="size-4 text-muted-foreground shrink-0" />
      {/if}
      <span>{title}</span>
      {#if badge}
        {@render badge()}
      {/if}
    </button>
    {#if actions}
      <div class="flex items-center gap-2 shrink-0">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if open}
    <div class={contentClass}>
      {@render children?.()}
    </div>
  {/if}
</div>
