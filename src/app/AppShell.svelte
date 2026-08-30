<script>
  import { onMount, untrack } from 'svelte'
  import { router, navigate } from '$core/ui/router.svelte'
  import { configStore } from '$core/grist/stores/configStore.svelte'
  import { getActiveMenuItems } from '$core/utils/utils'
  import { applyBrandTheme } from '$core/ui/theme'
  import { keyboard } from '$core/ui/keyboard.svelte'
  import { shortcuts, matchShortcut, matchCustomAction, displayBinding } from '$core/ui/shortcuts.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import CommandPalette from '$lib/components/CommandPalette.svelte'
  import KeyboardHelp from '$lib/components/KeyboardHelp.svelte'
  import HomeIcon from '@lucide/svelte/icons/home'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import BarChartIcon from '@lucide/svelte/icons/bar-chart'
  import FileCheckIcon from '@lucide/svelte/icons/file-check'
  import BuildingIcon from '@lucide/svelte/icons/building-2'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import CommandIcon from '@lucide/svelte/icons/command'
  import HeartHandshakeIcon from '@lucide/svelte/icons/heart-handshake'
  import InfoIcon from '@lucide/svelte/icons/info'
  import ArrowUpCircleIcon from '@lucide/svelte/icons/arrow-up-circle'
  import HandHeartIcon from '@lucide/svelte/icons/hand-heart'
  import SparklesIcon from '@lucide/svelte/icons/sparkles'
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import { identidad } from '$core/data/identidad'
  import { updateCheck } from '$core/utils/updateCheck.svelte'
  import { pwaInstall } from '$core/utils/pwaInstall.svelte'
  import { swUpdate } from '$core/utils/swUpdate.svelte'
  import { notify } from '$core/ui/notify.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import InstallBanner from '$lib/components/InstallBanner.svelte'
  import MobileSidebarAutoClose from '$lib/components/MobileSidebarAutoClose.svelte'
  import { useConfirmDialog } from '$lib/hooks/useConfirmDialog.svelte.js'
  import { limpiarDispositivo } from '$core/data/intercambio.js'

  let { title = identidad.nombre, children } = $props()

  // Modo demo: flag client-only (no viaja en el .lof) seteado por la card
  // "Ver una demo" de la landing. Permite avisar al usuario y ofrecerle
  // limpiar el dispositivo para instalar su cooperadora real.
  const isDemo = typeof localStorage !== 'undefined' && localStorage.getItem('lof-demo-mode') === '1'
  const confirmSalirDemo = useConfirmDialog()
  const handleSalirDemo = () => {
    confirmSalirDemo.openConfirm({
      title: '¿Salir de la demo?',
      description: 'Se borrarán todos los datos de ejemplo de este dispositivo y volverás a la pantalla inicial para instalar tu cooperadora real. Esta acción no se puede deshacer.',
      confirmLabel: 'Salir y limpiar',
      variant: 'destructive',
      onConfirm: () => limpiarDispositivo(),
    })
  }

  // Versión del bundle (horneada en build time via Vite define).
  const versionActual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const shaActual = typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'

  let menuItems = $state([{ route: 'inicio', label: 'Inicio' }])
  let brandTitle = $state(untrack(() => title))
  let brandSub = $state('Demo cooperadora')
  let mainEl = $state(null)

  const iconMap = {
    inicio: HomeIcon,
    cooperadora: BuildingIcon,
    comunidad: UsersIcon,
    movimientos: ArrowLeftRightIcon,
    resumen: BarChartIcon,
    gobierno: GavelIcon,
    cierre: FileCheckIcon,
    configuracion: SettingsIcon,
  }

  const shortcutLabels = $derived(
    Object.fromEntries(
      shortcuts.actions
        .filter((a) => a.id.startsWith('nav.'))
        .map((a) => [a.id.replace('nav.', ''), displayBinding(shortcuts.keysFor(a.id))])
    )
  )

  const go = (r) => navigate(r)

  const skipToContent = (/** @type {MouseEvent} */ e) => {
    e.preventDefault()
    mainEl?.focus()
  }

  const isTypingTarget = (el) => {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }

  // Atajos de teclado globales — basados en shortcutStore (single source of truth).
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    // Si la UI de Configuración está capturando una tecla, no interferir.
    if (shortcuts.capturing || keyboard.capturing) return

    // Paleta de comandos: siempre funciona (incluso abierta, para cerrarla).
    if (matchShortcut(e, shortcuts.keysFor('action.palette'))) {
      e.preventDefault()
      keyboard.toggle()
      return
    }

    // Si la paleta está abierta, ella maneja su propio teclado.
    if (keyboard.open) return

    // Resto de las acciones: primera que matchee gana.
    for (const a of shortcuts.actions) {
      if (a.id === 'action.palette') continue
      const keys = shortcuts.keysFor(a.id)
      if (keys && matchShortcut(e, keys)) {
        // Atajos sin modificador (?, /) no disparan dentro de inputs.
        if (a.guardInput && isTypingTarget(e.target)) continue
        e.preventDefault()
        a.run()
        return
      }
    }

    // Acciones personalizadas del usuario (presets de form).
    if (matchCustomAction(e)) return
  }

  // Etiqueta accesible de la ruta actual (para título y anuncio de navegación)
  let currentLabel = $derived(
    menuItems.find((/** @type {any} */ m) => m.route === router.current)?.label
    || router.current
  )

  // Título del documento: se actualiza al cambiar la ruta, el brand o el menú.
  $effect(() => {
    const label = currentLabel
    document.title = `${brandTitle} · ${label} · ${identidad.nombre}`
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

    // Verificar si hay una versión más reciente publicada (best-effort).
    // No molesta si no hay internet o el fetch falla.
    updateCheck.init()

    // Capturar beforeinstallprompt para ofrecer instalación PWA con un
    // botón propio (más visible y medible que el banner nativo).
    pwaInstall.init()
  })

  // Mostrar toast cuando se detecta una actualización disponible.
  // Se dispara una sola vez cuando updateAvailable pasa a true.
  let _notifiedUpdate = false
  $effect(() => {
    if (updateCheck.updateAvailable && !_notifiedUpdate) {
      _notifiedUpdate = true
      notify.info(
        `Versión ${updateCheck.latestVersion} disponible (tenés v${updateCheck.currentVersion})`,
        {
          duration: 8000,
          description: 'Descargala desde la página de releases.',
          action: {
            label: 'Descargar',
            onClick: () => {
              if (updateCheck.releaseUrl) {
                window.open(updateCheck.releaseUrl, '_blank')
              }
            },
          },
        },
      )
    }
  })

  // Toast cuando el service worker detectó una nueva versión ya descargada.
  // El botón "Actualizar" envía SKIP_WAITING al SW y recarga la página
  // (la recarga la maneja el listener de controllerchange en swUpdate).
  let _notifiedSwUpdate = false
  $effect(() => {
    if (swUpdate.updateReady && !_notifiedSwUpdate) {
      _notifiedSwUpdate = true
      notify.info('Nueva versión de LOF disponible', {
        duration: Infinity,
        description: 'Ya se descargó en segundo plano. Actualizá para usarla.',
        action: {
          label: 'Actualizar',
          onClick: () => swUpdate.applyUpdate(),
        },
      })
    }
  })

  // Reactivo: cuando configStore.config cambia (ej. desde Configuración),
  // actualizar brand y tema en vivo sin recargar.
  let isColaborador = $state(false)
  $effect(() => {
    const c = configStore.config
    if (!c) return
    if (c.cooperadora_nombre) brandTitle = c.cooperadora_nombre
    if (c.escuela_nombre) brandSub = c.escuela_nombre
    if (c.color_primario) applyBrandTheme(c.color_primario)
    isColaborador = c.modo_colaborador === true
  })
</script>

<Sidebar.Provider>
  <MobileSidebarAutoClose />
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
                    <kbd class="ml-auto shrink-0 text-[12px] font-mono text-muted-foreground/70 group-data-[collapsible=icon]:hidden">{sc}</kbd>
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
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton onclick={() => go('landing')} tooltipContent="Acerca de LOF" class="h-auto min-h-8">
            <InfoIcon class="shrink-0" />
            <span class="flex-1 leading-tight">Acerca de LOF</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
      <div class="flex items-center gap-2 px-2 py-1 select-none">
        <HeartHandshakeIcon class="size-6 shrink-0 text-primary" />
        <div class="text-[12px] text-muted-foreground/80 leading-tight group-data-[collapsible=icon]:hidden">
          {identidad.nombre} v{versionActual}{#if shaActual && shaActual !== 'dev'} · {shaActual}{/if}
          {#if updateCheck.updateAvailable}
            <a
              href={updateCheck.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline"
              title="Hay una versión más reciente (v{updateCheck.latestVersion})"
            >
              <ArrowUpCircleIcon class="size-3" />
              v{updateCheck.latestVersion}
            </a>
          {/if}
        </div>
      </div>
    </Sidebar.Footer>
  </Sidebar.Root>

  <Sidebar.Inset>
    <header class="flex h-12 shrink-0 items-center gap-2 px-4 min-w-0 overflow-hidden">
      <Sidebar.Trigger class="shrink-0" />
      <span class="flex-1 min-w-0 text-center text-sm font-semibold truncate">{brandTitle}</span>
      <button
        type="button"
        onclick={() => keyboard.toggle()}
        class="inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Abrir paleta de comandos ({displayBinding(shortcuts.keysFor('action.palette'))})"
        title="Paleta de comandos ({displayBinding(shortcuts.keysFor('action.palette'))})"
      >
        <CommandIcon class="size-4" />
      </button>
      {#if isColaborador}
        <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[12px] font-semibold text-amber-700 dark:text-amber-400">
          <HandHeartIcon class="size-3" />
          <span class="hidden sm:inline">Modo colaborador</span>
        </span>
      {/if}
      {#if isDemo}
        <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-chart-2/15 px-2 py-0.5 text-[12px] font-semibold text-chart-2">
          <SparklesIcon class="size-3" />
          <span class="hidden sm:inline">Modo demo</span>
        </span>
        <button
          type="button"
          onclick={handleSalirDemo}
          class="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Salir de la demo y limpiar los datos de ejemplo"
        >
          <LogOutIcon class="size-3" />
          <span class="hidden sm:inline">Salir de la demo</span>
        </button>
      {/if}
      {#if pwaInstall.canInstall}
        <button
          type="button"
          onclick={() => pwaInstall.promptInstall()}
          class="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          title="Instalar LOF en este dispositivo para usarlo sin conexión"
        >
          <DownloadIcon class="size-3" />
          <span class="hidden sm:inline">Instalar</span>
        </button>
      {/if}
      <span class="hidden sm:inline text-xs text-muted-foreground shrink-0">
        v{versionActual}
        {#if updateCheck.updateAvailable}
          <a
            href={updateCheck.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline"
            title="Versión {updateCheck.latestVersion} disponible"
          >
            <ArrowUpCircleIcon class="size-3" />
          </a>
        {/if}
      </span>
    </header>
    {#if pwaInstall.needsManualInstructions}
      <div class="px-4 pt-2 sm:px-6">
        <InstallBanner />
      </div>
    {/if}
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

<ConfirmDialog
  bind:open={confirmSalirDemo.open}
  title={confirmSalirDemo.title}
  description={confirmSalirDemo.description}
  confirmLabel={confirmSalirDemo.confirmLabel}
  variant={confirmSalirDemo.variant}
  onConfirm={confirmSalirDemo.handleConfirm}
/>
