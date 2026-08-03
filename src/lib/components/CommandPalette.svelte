<script>
  import * as Command from '$lib/components/ui/command'
  import { keyboard, triggerContextAction } from '$core/keyboard.svelte'
  import { navigate } from '$core/router.svelte'
  import HomeIcon from '@lucide/svelte/icons/home'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ContactIcon from '@lucide/svelte/icons/contact'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SearchIcon from '@lucide/svelte/icons/search'

  let { menuItems = [] } = $props()

  const iconMap = {
    inicio: HomeIcon,
    socios: UsersIcon,
    personas: ContactIcon,
    movimientos: ArrowLeftRightIcon,
    gobierno: GavelIcon,
    cooperadora: SettingsIcon,
  }

  const shortcutMap = {
    inicio: 'Ctrl+I',
    socios: 'Ctrl+S',
    personas: 'Ctrl+P',
    movimientos: 'Ctrl+M',
    gobierno: 'Ctrl+A',
    cooperadora: 'Ctrl+C',
  }

  let value = $state('')

  $effect(() => {
    if (keyboard.open) value = ''
  })

  const run = (fn) => {
    fn()
    keyboard.close()
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
        <Command.Item value={item.label} onSelect={() => run(() => navigate(item.route))}>
          {#if Icon}
            <Icon />
          {/if}
          {item.label}
          {#if shortcutMap[item.route]}
            <Command.Shortcut>{shortcutMap[item.route]}</Command.Shortcut>
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>

    <Command.Group heading="Acciones rápidas">
      <Command.Item
        value="buscar en la página actual"
        onSelect={() => run(() => triggerContextAction('search'))}
      >
        <SearchIcon />
        Buscar en la página actual
        <Command.Shortcut>Ctrl+F</Command.Shortcut>
      </Command.Item>
      <Command.Item
        value="crear nuevo registro"
        onSelect={() => run(() => triggerContextAction('new'))}
      >
        <PlusIcon />
        Crear nuevo registro
        <Command.Shortcut>Ctrl+N</Command.Shortcut>
      </Command.Item>
      <Command.Item
        value="cuota societaria rápida"
        onSelect={() => run(() => {
          if (window.location.hash.replace('#', '') === 'movimientos') {
            triggerContextAction('cuota')
          } else {
            keyboard.setPendingAction({
              id: 'cuota-societaria',
              action: () => triggerContextAction('cuota'),
            })
            navigate('movimientos')
          }
        })}
      >
        <ArrowLeftRightIcon />
        Cargar cuota societaria
        <Command.Shortcut>Ctrl+1</Command.Shortcut>
      </Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
