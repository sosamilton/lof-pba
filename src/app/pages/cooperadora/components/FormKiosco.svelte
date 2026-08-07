<script>
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'

  let {
    kiosco,
    busy = false,
    onSave = () => {},
    saveDisabled = false,
  } = $props()
</script>

<div class="flex flex-col gap-4">
  <div class="grid gap-3 sm:grid-cols-2">
    <div>
      <Label for="kiosco-posee">Posee</Label>
      <Select.Root type="single" value={kiosco.posee != null ? String(kiosco.posee) : undefined} onValueChange={(v) => kiosco.posee = v === 'true'}>
        <Select.Trigger id="kiosco-posee" class="mt-1 w-full">
          <Select.Value placeholder="Elegir…" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="true">Sí</Select.Item>
          <Select.Item value="false">No</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
    <div>
      <Label for="kiosco-modalidad">Modalidad</Label>
      <Select.Root type="single" bind:value={kiosco.modalidad} allowDeselect={true}>
        <Select.Trigger id="kiosco-modalidad" class="mt-1 w-full">
          <Select.Value placeholder="(sin)" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="Propio">Propio</Select.Item>
          <Select.Item value="Licitado">Licitado</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
  </div>
  <div class="flex justify-end"><Button onclick={onSave} disabled={busy || saveDisabled}>Guardar</Button></div>
</div>
