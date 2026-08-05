<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'
  import * as Alert from '$lib/components/ui/alert'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import { MESES } from '$core/utils'

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
  <Dialog.Content class="sm:max-w-[520px]">
    <Dialog.Header>
      <Dialog.Title>Editar ejercicio</Dialog.Title>
      <Dialog.Description>
        Modificá los datos del ejercicio. Si hay movimientos cargados, se pedirá confirmación al guardar.
      </Dialog.Description>
    </Dialog.Header>
    {#if ejercicioEditando}
      <div class="flex flex-col gap-4 py-2">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_ej_anio_inicio">Año desde</Label>
            <Input id="edit_ej_anio_inicio" type="number" bind:value={ejercicioEditando.anio_inicio} placeholder="2025" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_ej_anio_fin">Año hasta</Label>
            <Input id="edit_ej_anio_fin" type="number" bind:value={ejercicioEditando.anio_fin} placeholder="2026" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_ej_mes">Mes inicio</Label>
            <Select.Root type="single" bind:value={ejercicioEditando.mes_inicio}>
              <Select.Trigger id="edit_ej_mes" class="w-full">
                <Select.Value placeholder="Mes…" />
              </Select.Trigger>
              <Select.Content>
                {#each MESES as m}<Select.Item value={m}>{m}</Select.Item>{/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_ej_fecha_inicio">Fecha desde</Label>
            <Input id="edit_ej_fecha_inicio" type="date" bind:value={ejercicioEditando.fecha_inicio} />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_ej_fecha_fin">Fecha hasta</Label>
            <Input id="edit_ej_fecha_fin" type="date" bind:value={ejercicioEditando.fecha_fin} />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_saldo_banco">Saldo banco</Label>
            <Input id="edit_saldo_banco" type="number" bind:value={ejercicioEditando.saldo_inicial_banco} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_saldo_efectivo">Saldo efectivo</Label>
            <Input id="edit_saldo_efectivo" type="number" bind:value={ejercicioEditando.saldo_inicial_efectivo} placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground" for="edit_saldo_caja">Saldo caja chica</Label>
            <Input id="edit_saldo_caja" type="number" bind:value={ejercicioEditando.saldo_inicial_caja_chica} placeholder="0" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <Label class="text-xs font-bold text-muted-foreground" for="edit_ej_obs">Observaciones</Label>
          <Input id="edit_ej_obs" type="text" bind:value={ejercicioEditando.observaciones} placeholder="—" />
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
