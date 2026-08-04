<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { keyboard, NAV_SHORTCUTS } from '$core/keyboard.svelte'

  const shortcutLabels = {
    inicio: 'Ctrl+I',
    socios: 'Ctrl+S',
    personas: 'Ctrl+P',
    movimientos: 'Ctrl+M',
    gobierno: 'Ctrl+A',
  }

  const actionShortcuts = [
    { keys: 'Ctrl+K', desc: 'Abrir paleta de comandos' },
    { keys: 'Ctrl+N', desc: 'Crear nuevo registro' },
    { keys: 'Ctrl+F', desc: 'Buscar en la página actual' },
    { keys: 'Ctrl+1', desc: 'Cargar cuota societaria' },
    { keys: '/', desc: 'Buscar (acceso rápido)' },
    { keys: '?', desc: 'Mostrar esta ayuda' },
  ]

  let navShortcuts = $derived(Object.values(NAV_SHORTCUTS))
</script>

<Dialog.Root bind:open={keyboard.helpOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Atajos de teclado</Dialog.Title>
      <Dialog.Description class="sr-only">
        Lista de atajos de teclado disponibles en la aplicación.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <section>
        <h3 class="mb-2 text-sm font-semibold text-muted-foreground">Navegación</h3>
        <ul class="flex flex-col gap-1.5">
          {#each navShortcuts as nav (nav.route)}
            <li class="flex items-center justify-between text-sm">
              <span>{nav.label}</span>
              <kbd class="rounded border border-input bg-muted px-1.5 py-0.5 text-xs font-mono">
                {shortcutLabels[nav.route]}
              </kbd>
            </li>
          {/each}
        </ul>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-muted-foreground">Acciones</h3>
        <ul class="flex flex-col gap-1.5">
          {#each actionShortcuts as s (s.keys)}
            <li class="flex items-center justify-between text-sm">
              <span>{s.desc}</span>
              <kbd class="rounded border border-input bg-muted px-1.5 py-0.5 text-xs font-mono">
                {s.keys}
              </kbd>
            </li>
          {/each}
        </ul>
      </section>
    </div>

    <Dialog.Footer class="pt-2">
      <p class="text-xs text-muted-foreground">
        Presioná <kbd class="rounded border border-input bg-muted px-1 py-0.5 text-[10px] font-mono">?</kbd> para abrir esta ayuda en cualquier momento.
      </p>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
