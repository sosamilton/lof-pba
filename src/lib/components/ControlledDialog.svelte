<script>
  import * as Dialog from '$lib/components/ui/dialog'

  let { open = false, onClose, class: klass = '', children } = $props()

  const handleOpenChange = (v) => { if (!v) onClose?.() }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class={klass}>
    {@render children?.()}
  </Dialog.Content>
</Dialog.Root>
