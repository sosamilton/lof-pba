<script>
  import { onMount } from 'svelte'
  import { router, navigate } from '$core/router.svelte'
  import { configStore } from '$core/stores/configStore.svelte'
  import { getActiveMenuItems } from '$core/utils'
  import { applyBrandTheme } from '$core/theme'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import HomeIcon from '@lucide/svelte/icons/home'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ContactIcon from '@lucide/svelte/icons/contact'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import BuildingIcon from '@lucide/svelte/icons/building-2'

  let { title = 'AppCoop', children } = $props()

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

  const go = (r) => navigate(r)

  const skipToContent = (/** @type {MouseEvent} */ e) => {
    e.preventDefault()
    mainEl?.focus()
  }

  // Etiqueta accesible de la ruta actual (para título y anuncio de navegación)
  let currentLabel = $derived(
    menuItems.find((/** @type {any} */ m) => m.route === router.current)?.label
    || router.current
  )

  // Al cambiar de ruta: actualiza el título del documento y mueve el foco al <main>
  $effect(() => {
    const route = router.current
    if (!mainEl) return
    const label = menuItems.find((/** @type {any} */ m) => m.route === route)?.label || route
    document.title = `${brandTitle} · ${label} · AppCoop`
    // Mueve el foco al contenido principal y anuncia el cambio de vista
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
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  isActive={router.current === item.route}
                  tooltipContent={item.label}
                  onclick={() => go(item.route)}
                >
                  {#if Icon}
                    <Icon />
                  {/if}
                  <span>{item.label}</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Rail />
  </Sidebar.Root>

  <Sidebar.Inset>
    <header class="flex h-12 shrink-0 items-center px-4">
      <Sidebar.Trigger />
      <span class="flex-1 text-center text-sm font-semibold truncate">{brandTitle}</span>
      <span class="text-xs text-muted-foreground">AppCoop</span>
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
