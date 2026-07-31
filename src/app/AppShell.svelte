<script>
  import { onMount } from 'svelte'
  import { router, navigate } from '$core/router.svelte'
  import { configStore } from '$core/stores/configStore.svelte'
  import { getActiveMenuItems } from '$core/utils'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { Separator } from '$lib/components/ui/separator'
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

  const iconMap = {
    inicio: HomeIcon,
    socios: UsersIcon,
    personas: ContactIcon,
    movimientos: ArrowLeftRightIcon,
    gobierno: GavelIcon,
    cooperadora: SettingsIcon,
  }

  const go = (r) => navigate(r)

  onMount(async () => {
    try {
      const config = await configStore.load()
      if (config) {
        menuItems = getActiveMenuItems(config)
        if (config.cooperadora_nombre) brandTitle = config.cooperadora_nombre
        if (config.escuela_nombre) brandSub = config.escuela_nombre
        if (config.cooperadora_nombre) {
          document.title = `${config.cooperadora_nombre} · AppCoop`
        }
      }
    } catch {
      // keep defaults
    }
  })
</script>

<Sidebar.Provider>
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
    <header class="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 transition-[width,height] ease-linear">
      <Sidebar.Trigger />
      <Separator />
      <span class="text-sm font-semibold truncate">{brandTitle}</span>
    </header>
    <main class="box-border flex-1 p-4 sm:p-6">
      {@render children()}
    </main>
  </Sidebar.Inset>
</Sidebar.Provider>
