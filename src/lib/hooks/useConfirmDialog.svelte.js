/**
 * Estado y lógica de orquestación para `ConfirmDialog.svelte`.
 *
 * Centraliza el patrón que antes se duplicaba en cada consumidor:
 * `$state` para `open`/`title`/`description`/`confirmLabel`/`variant`/
 * `pendingAction` + funciones `openConfirm(opts)` / `handleConfirm()`.
 *
 * El componente visual sigue siendo `$lib/components/ConfirmDialog.svelte`;
 * este hook solo expone el estado y los handlers para alimentarlo.
 *
 * @returns {{
 *   open: boolean,
 *   title: string,
 *   description: string,
 *   confirmLabel: string,
 *   variant: 'default' | 'destructive',
 *   openConfirm: (opts: {
 *     title: string,
 *     description?: string,
 *     confirmLabel?: string,
 *     variant?: 'default' | 'destructive',
 *     onConfirm: () => void | Promise<void>,
 *   }) => void,
 *   handleConfirm: () => Promise<void>,
 *   close: () => void,
 * }}
 */
export function useConfirmDialog() {
  let open = $state(false)
  let title = $state('')
  let description = $state('')
  let confirmLabel = $state('Confirmar')
  let variant = $state('destructive')
  let pendingAction = $state(() => {})

  const openConfirm = (opts) => {
    title = opts.title
    description = opts.description || ''
    confirmLabel = opts.confirmLabel || 'Confirmar'
    variant = opts.variant || 'destructive'
    pendingAction = opts.onConfirm
    open = true
  }

  const handleConfirm = async () => {
    // Limpiar `pendingAction` antes de ejecutar para evitar reentradas
    // si `fn()` dispara otro `openConfirm` (ej. confirmaciones anidadas).
    open = false
    const fn = pendingAction
    pendingAction = () => {}
    await fn()
  }

  const close = () => {
    open = false
    pendingAction = () => {}
  }

  return {
    get open() { return open },
    set open(v) { open = v },
    get title() { return title },
    get description() { return description },
    get confirmLabel() { return confirmLabel },
    get variant() { return variant },
    openConfirm,
    handleConfirm,
    close,
  }
}
