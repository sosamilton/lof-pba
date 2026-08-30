<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { keyboard } from '$core/ui/keyboard.svelte'
  import { shortcuts, displayBinding } from '$core/ui/shortcuts.svelte'

  // Agrupa las acciones por su `group` (Navegación / Acciones) y lee las
  // teclas actuales del store (single source of truth).
  const groups = $derived.by(() => {
    const map = /** @type {Record<string, { id: string, label: string, keys: string }[]>} */ ({})
    for (const a of shortcuts.actions) {
      const g = a.group
      ;(map[g] ||= []).push({ id: a.id, label: a.label, keys: displayBinding(shortcuts.keysFor(a.id)) })
    }
    return map
  })

  const groupOrder = ['Navegación', 'Acciones']
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
      {#each groupOrder as groupName (groupName)}
        {#if groups[groupName]}
          <section>
            <h3 class="mb-2 text-sm font-semibold text-muted-foreground">{groupName}</h3>
            <ul class="flex flex-col gap-1.5">
              {#each groups[groupName] as s (s.id)}
                <li class="flex items-center justify-between text-sm">
                  <span>{s.label}</span>
                  <kbd class="rounded border border-input bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {s.keys}
                  </kbd>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {/each}
    </div>

    <Dialog.Footer class="pt-2">
      <p class="text-xs text-muted-foreground">
        Presioná <kbd class="rounded border border-input bg-muted px-1 py-0.5 text-[10px] font-mono">{displayBinding(shortcuts.keysFor('action.help'))}</kbd> para abrir esta ayuda en cualquier momento. Personalizá los atajos desde Configuración.
      </p>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
