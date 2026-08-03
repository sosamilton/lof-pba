<script>
  import { onMount } from 'svelte'
  import { router, navigate } from '$core/router.svelte'
  import { configStore } from '$core/stores/configStore.svelte'
  import { getActiveMenuItems } from '$core/utils'
  import { applyBrandTheme } from '$core/theme'
  import { keyboard, NAV_SHORTCUTS, triggerContextAction } from '$core/keyboard.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import CommandPalette from '$lib/components/CommandPalette.svelte'
  import KeyboardHelp from '$lib/components/KeyboardHelp.svelte'
  import HomeIcon from '@lucide/svelte/icons/home'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ContactIcon from '@lucide/svelte/icons/contact'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import BuildingIcon from '@lucide/svelte/icons/building-2'
  import CommandIcon from '@lucide/svelte/icons/command'

  let { title = 'AppCoop', children } = $props()

  // Versión del bundle (horneada en build time via Vite define).
  const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const shaActual = typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'

  let menuItems = $state([{ route: 'inicio', label: 'Inicio' }])
  let brandTitle = $state(title)
  let brandSub = $state('Demo cooperadora')
  let mainEl = $state(null)

  const iconMap = {
    inicio: HomeIcon,
    socios: UsersIcon,
    personas: ContactIcon,
    movimientos: ArrowLeftRightIcon,
    gobierno: GavelIcon,
    cooperadora: SettingsIcon,
  }

  const shortcutLabels = {
    inicio: 'Ctrl+I',
    socios: 'Ctrl+S',
    personas: 'Ctrl+P',
    movimientos: 'Ctrl+M',
    gobierno: 'Ctrl+A',
    cooperadora: 'Ctrl+C',
  }

  const go = (r) => navigate(r)

  const skipToContent = (/** @type {MouseEvent} */ e) => {
    e.preventDefault()
    mainEl?.focus()
  }

  // Atajos de teclado globales
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    // Ctrl+K → abrir/cerrar paleta de comandos
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      keyboard.toggle()
      return
    }

    // Si la paleta está abierta, no procesar más atajos (ella maneja su propio teclado)
    if (keyboard.open) return

    // Ctrl+N → nuevo registro (context-aware)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      triggerContextAction('new')
      return
    }

    // Ctrl+F → buscar en la página actual (context-aware)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      triggerContextAction('search')
      return
    }

    // Ctrl+1 → cuota societaria rápida (navega a movimientos y abre form pre-cargado)
    if ((e.ctrlKey || e.metaKey) && e.key === '1') {
      e.preventDefault()
      if (router.current === 'movimientos') {
        triggerContextAction('cuota')
      } else {
        keyboard.setPendingAction({
          id: 'cuota-societaria',
          action: () => triggerContextAction('cuota'),
        })
        navigate('movimientos')
      }
      return
    }

    // Atajos de navegación: Ctrl+Letra
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase()
      const nav = NAV_SHORTCUTS[key]
      if (nav) {
        e.preventDefault()
        navigate(nav.route)
        return
      }
    }

    // '?' → mostrar ayuda de atajos (solo si no se está escribiendo en un input)
    if (e.key === '?' && !isTypingTarget(e.target)) {
      e.preventDefault()
      keyboard.toggleHelp()
      return
    }

    // '/' → enfocar búsqueda (solo si no se está escribiendo en un input)
    if (e.key === '/' && !isTypingTarget(e.target)) {
      e.preventDefault()
      triggerContextAction('search')
    }
  }

  const isTypingTarget = (el) => {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }

  // Etiqueta accesible de la ruta actual (para título y anuncio de navegación)
  let currentLabel = $derived(
    menuItems.find((/** @type {any} */ m) => m.route === router.current)?.label
    || router.current
  )

  // Título del documento: se actualiza al cambiar la ruta, el brand o el menú.
  $effect(() => {
    const label = currentLabel
    document.title = `${brandTitle} · ${label} · AppCoop`
  })

  // Foco al <main>: SOLO al cambiar de ruta, no cuando se carga la config
  // (menuItems/brandTitle se actualizan en onMount y dispararían el foco de más).
  let _lastFocusedRoute = ''
  $effect(() => {
    const route = router.current
    if (!mainEl || route === _lastFocusedRoute) return
    _lastFocusedRoute = route
    mainEl.focus()
  })

  onMount(async () => {
    try {
      const config = await configStore.load()
      if (config) {
        menuItems = getActiveMenuItems(config)
        if (config.cooperadora_nombre) brandTitle = config.cooperadora_nombre
        if (config.escuela_nombre) brandSub = config.escuela_nombre
        if (config.color_primario) applyBrandTheme(config.color_primario)
      }
    } catch {
      // keep defaults
    }
  })
</script>

<Sidebar.Provider>
  <a
    href="#main-content"
    onclick={skipToContent}
    class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
  >
    Saltar al contenido
  </a>
  <Sidebar.Root collapsible="icon">
    <Sidebar.Header>
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="lg" onclick={() => go('inicio')}>
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BuildingIcon class="size-4" />
            </div>
            <div class="flex flex-col gap-0.5 leading-none">
              <span class="text-sm font-bold truncate">{brandTitle}</span>
              <span class="text-xs text-muted-foreground truncate">{brandSub}</span>
            </div>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>
    <Sidebar.Separator />
    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel>Navegación</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each menuItems as item (item.route)}
              {@const Icon = iconMap[item.route]}
              {@const sc = shortcutLabels[item.route]}
              <Sidebar.MenuItem class="py-0.5">
                <Sidebar.MenuButton
                  isActive={router.current === item.route}
                  tooltipContent={item.label}
                  onclick={() => go(item.route)}
                  aria-keyshortcuts={sc ? sc.replace('Ctrl', 'Control') : undefined}
                  class="h-auto min-h-8"
                >
                  {#if Icon}
                    <Icon class="shrink-0" />
                  {/if}
                  <span class="flex-1 leading-tight">{item.label}</span>
                  {#if sc}
                    <kbd class="ml-auto shrink-0 text-[10px] font-mono text-muted-foreground/70 group-data-[collapsible=icon]:hidden">{sc}</kbd>
                  {/if}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Rail />
    <Sidebar.Footer>
      <div class="px-2 py-1 text-[11px] text-muted-foreground/80 select-none">
        AppCoop v{versionActual}{#if shaActual && shaActual !== 'dev'} · {shaActual}{/if}
      </div>
    </Sidebar.Footer>
  </Sidebar.Root>

  <Sidebar.Inset>
    <header class="flex h-12 shrink-0 items-center gap-2 px-4">
      <Sidebar.Trigger />
      <span class="flex-1 text-center text-sm font-semibold truncate">{brandTitle}</span>
      <button
        type="button"
        onclick={() => keyboard.toggle()}
        class="inline-flex items-center justify-center rounded-md border border-input bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Abrir paleta de comandos (Ctrl+K)"
        title="Paleta de comandos (Ctrl+K)"
      >
        <CommandIcon class="size-4" />
      </button>
      <span class="text-xs text-muted-foreground">v{versionActual}</span>
    </header>
    <main
      bind:this={mainEl}
      id="main-content"
      aria-label="{currentLabel}"
      tabindex="-1"
      class="box-border flex-1 p-4 sm:p-6 focus:outline-none"
    >
      {@render children()}
    </main>
  </Sidebar.Inset>
</Sidebar.Provider>

<svelte:window onkeydown={onKeyDown} />

<CommandPalette {menuItems} />

<KeyboardHelp />
