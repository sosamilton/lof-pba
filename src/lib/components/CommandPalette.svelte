<script>
  import * as Command from '$lib/components/ui/command'
  import { keyboard } from '$core/ui/keyboard.svelte'
  import { navigate } from '$core/ui/router.svelte'
  import { shortcuts, displayBinding } from '$core/ui/shortcuts.svelte'
  import HomeIcon from '@lucide/svelte/icons/home'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SearchIcon from '@lucide/svelte/icons/search'

  let { menuItems = [] } = $props()

  const iconMap = {
    inicio: HomeIcon,
    comunidad: UsersIcon,
    movimientos: ArrowLeftRightIcon,
    gobierno: GavelIcon,
    configuracion: SettingsIcon,
  }

  let value = $state('')

  $effect(() => {
    if (keyboard.open) value = ''
  })

  const run = (fn) => {
    fn()
    keyboard.close()
  }

  // Atajos rápidos (no de navegación) para el grupo "Acciones rápidas".
  const quickActions = $derived(
    shortcuts.actions.filter(
      (a) => a.id === 'action.new' || a.id === 'action.cuota' || a.id === 'action.quickSearch'
    )
  )
  const quickIcons = {
    'action.new': PlusIcon,
    'action.cuota': ArrowLeftRightIcon,
    'action.quickSearch': SearchIcon,
  }
</script>

<Command.Dialog
  bind:open={keyboard.open}
  bind:value
  title="Paleta de comandos"
  description="Buscá una acción o navegá a una sección"
>
  <Command.List>
    <Command.Empty>No se encontraron comandos.</Command.Empty>

    {#if keyboard.actions.length > 0}
      <Command.Group heading="Acciones del módulo">
        {#each keyboard.actions as action (action.id)}
          <Command.Item value={action.label} onSelect={() => run(action.action)}>
            {#if action.icon}
              <action.icon />
            {/if}
            {action.label}
            {#if action.shortcut}
              <Command.Shortcut>{action.shortcut}</Command.Shortcut>
            {/if}
          </Command.Item>
        {/each}
      </Command.Group>
    {/if}

    <Command.Group heading="Navegación">
      {#each menuItems as item (item.route)}
        {@const Icon = iconMap[item.route]}
        {@const sc = displayBinding(shortcuts.keysFor('nav.' + item.route))}
        <Command.Item value={item.label} onSelect={() => run(() => navigate(item.route))}>
          {#if Icon}
            <Icon />
          {/if}
          {item.label}
          {#if sc}
            <Command.Shortcut>{sc}</Command.Shortcut>
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>

    <Command.Group heading="Acciones rápidas">
      {#each quickActions as action (action.id)}
        {@const Icon = quickIcons[action.id]}
        <Command.Item value={action.label} onSelect={() => run(action.run)}>
          {#if Icon}
            <Icon />
          {/if}
          {action.label}
          <Command.Shortcut>{displayBinding(shortcuts.keysFor(action.id))}</Command.Shortcut>
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>
</Command.Dialog>
