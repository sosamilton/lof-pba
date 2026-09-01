<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import * as Field from '$lib/components/ui/field'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import KeyIcon from '@lucide/svelte/icons/key-round'

  let { open = $bindable(false), title = 'Contraseña maestra', description = '', onConfirm, onCancel } = $props()

  let passphrase = $state('')
  let error = $state('')
  let verifying = $state(false)

  $effect(() => {
    if (open) {
      passphrase = ''
      error = ''
      verifying = false
    }
  })

  async function handleSubmit() {
    if (!passphrase) {
      error = 'Ingresá la passphrase.'
      return
    }
    verifying = true
    error = ''
    try {
      await onConfirm?.(passphrase)
      open = false
    } catch (e) {
      error = e?.message || 'Error al verificar la passphrase.'
    } finally {
      verifying = false
    }
  }

  function handleCancel() {
    onCancel?.()
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <KeyIcon class="size-5" />
        {title}
      </Dialog.Title>
      {#if description}
        <Dialog.Description>{description}</Dialog.Description>
      {/if}
    </Dialog.Header>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }} class="flex flex-col gap-4">
      <Field.Field>
        <Field.FieldLabel for="passphrase-input" class="sr-only">Passphrase</Field.FieldLabel>
        <Input
          id="passphrase-input"
          type="password"
          autocomplete="off"
          placeholder="Contraseña maestra"
          bind:value={passphrase}
          disabled={verifying}
          autofocus
        />
      </Field.Field>

      {#if error}
        <Alert variant="destructive">
          <AlertDescription class="text-sm">{error}</AlertDescription>
        </Alert>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={handleCancel} disabled={verifying}>Cancelar</Button>
        <Button type="submit" disabled={!passphrase || verifying}>
          {verifying ? 'Verificando…' : 'Confirmar'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
