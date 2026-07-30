<script>
  import { onMount } from 'svelte'
  import { router, navigate } from '$core/router.svelte'
  import { configStore } from '$core/stores/configStore.svelte'
  import { getActiveMenuItems } from '$core/utils'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import * as Sheet from '$lib/components/ui/sheet'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import HomeIcon from '@lucide/svelte/icons/home'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ContactIcon from '@lucide/svelte/icons/contact'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import SettingsIcon from '@lucide/svelte/icons/settings'

  let { title = 'AppCoop', children } = $props()

  let drawerOpen = $state(false)
  let isSmall = $state(false)
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

  const syncSmall = () => {
    isSmall = window.matchMedia('(max-width: 860px)').matches
    if (!isSmall) drawerOpen = false
  }

  const go = (r) => {
    navigate(r)
    drawerOpen = false
  }

  onMount(async () => {
    syncSmall()
    const onResize = () => syncSmall()
    window.addEventListener('resize', onResize)
    try {
      const config = await configStore.load()
      if (config) {
        menuItems = getActiveMenuItems(config)
        if (config.cooperadora_nombre) brandTitle = config.cooperadora_nombre
        if (config.escuela_nombre) brandSub = config.escuela_nombre
      }
    } catch {
      // keep defaults
    }
    return () => window.removeEventListener('resize', onResize)
  })
</script>

<div class="grid min-h-screen bg-background text-foreground" style="grid-template-columns: {isSmall ? '1fr' : '260px 1fr'}">
  {#if isSmall}
    <div class="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
      <Button variant="ghost" size="icon" aria-label="Abrir menú" onclick={() => (drawerOpen = true)}>
        <MenuIcon class="size-5" />
      </Button>
      <span class="text-sm font-bold">{brandTitle}</span>
    </div>
  {/if}

  {#if isSmall}
    <Sheet.Root bind:open={drawerOpen}>
      <Sheet.Content side="left" class="w-[280px] p-0">
        <Sheet.Header class="px-4 py-3">
          <Sheet.Title class="text-sm font-bold">{brandTitle}</Sheet.Title>
          <Sheet.Description class="text-xs text-muted-foreground">{brandSub}</Sheet.Description>
        </Sheet.Header>
        <Separator />
        <nav class="flex flex-col gap-1 p-3">
          {#each menuItems as item (item.route)}
            {@const Icon = iconMap[item.route]}
            <button
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {router.current === item.route ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}"
              onclick={() => go(item.route)}
            >
              {#if Icon}
                <Icon class="size-4 shrink-0" />
              {/if}
              {item.label}
            </button>
          {/each}
        </nav>
      </Sheet.Content>
    </Sheet.Root>
  {/if}

  {#if !isSmall}
    <aside class="sticky top-0 h-screen border-r border-border bg-card/50 p-3 overflow-y-auto">
      <div class="mb-3 px-2">
        <div class="text-sm font-bold">{brandTitle}</div>
        <div class="text-xs text-muted-foreground">{brandSub}</div>
      </div>
      <Separator class="mb-3" />
      <nav class="flex flex-col gap-1">
        {#each menuItems as item (item.route)}
          {@const Icon = iconMap[item.route]}
          <button
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {router.current === item.route ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}"
            onclick={() => go(item.route)}
          >
            {#if Icon}
              <Icon class="size-4 shrink-0" />
            {/if}
            {item.label}
          </button>
        {/each}
      </nav>
    </aside>
  {/if}

  <main class="box-border p-4 sm:p-6">
    {@render children()}
  </main>
</div>
