<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  /**
   * Diálogo de confirmación reutilizable basado en Dialog de shadcn-svelte.
   * Reemplaza los `confirm()` nativos del navegador que rompen la UI.
   *
   * Props:
   * @prop {boolean} open - Controla la visibilidad (bindable).
   * @prop {string} title - Título del diálogo.
   * @prop {string} description - Mensaje de confirmación.
   * @prop {string} confirmLabel - Texto del botón de confirmación.
   * @prop {string} cancelLabel - Texto del botón de cancelación.
   * @prop {'default' | 'destructive'} variant - Estilo del botón de confirmación.
   * @prop {boolean} busy - Deshabilita los botones durante una operación.
   * @prop {() => void} onConfirm - Callback al confirmar.
   * @prop {() => void} onCancel - Callback al cancelar/cerrar.
   */
  let {
    open = $bindable(false),
    title = '¿Confirmar?',
    description = '',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'destructive',
    busy = false,
    onConfirm = () => {},
    onCancel = () => {},
  } = $props()

  const handleConfirm = () => {
    onConfirm?.()
  }

  const handleOpenChange = (v) => {
    if (!v) onCancel?.()
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-[440px]">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if description}
        <Dialog.Description>{description}</Dialog.Description>
      {/if}
    </Dialog.Header>

    <div class="flex items-start gap-2.5 py-2">
      {#if variant === 'destructive'}
        <AlertTriangleIcon class="size-5 shrink-0 text-destructive mt-0.5" />
      {/if}
      <span class="text-sm text-muted-foreground leading-relaxed">
        Esta acción no se puede deshacer.
      </span>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => { onCancel?.(); open = false }} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button {variant} onclick={handleConfirm} disabled={busy}>
        {confirmLabel}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
