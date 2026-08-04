<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import * as Alert from '$lib/components/ui/alert'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  let {
    open = false,
    ejercicioEditando = null,
    error = '',
    busy = false,
    onClose = () => {},
    onSave = () => {},
  } = $props()
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[480px]">
    <Dialog.Header>
      <Dialog.Title>Editar saldos iniciales</Dialog.Title>
      <Dialog.Description>
        Modificá el saldo inicial del ejercicio. Si hay movimientos cargados, se pedirá confirmación al guardar.
      </Dialog.Description>
    </Dialog.Header>
    {#if ejercicioEditando}
      <div class="flex flex-col gap-4 py-2">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_saldo_banco">Banco</Label>
            <Input id="edit_saldo_banco" type="number" bind:value={ejercicioEditando.saldo_inicial_banco} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_saldo_efectivo">Efectivo</Label>
            <Input id="edit_saldo_efectivo" type="number" bind:value={ejercicioEditando.saldo_inicial_efectivo} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_saldo_caja">Caja chica</Label>
            <Input id="edit_saldo_caja" type="number" bind:value={ejercicioEditando.saldo_inicial_caja_chica} placeholder="0" />
          </div>
        </div>
        {#if error}
          <Alert.Root variant="destructive">
            <AlertTriangleIcon data-icon="inline-start" />
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        {/if}
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={onClose} disabled={busy}>Cancelar</Button>
      <Button onclick={onSave} disabled={busy}>
        {#if busy}Guardando…{:else}Guardar{/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
