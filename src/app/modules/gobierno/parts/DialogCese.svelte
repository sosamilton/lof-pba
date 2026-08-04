<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import { MOTIVOS_CESE, TIPOS_ASAMBLEA_CORTO } from '$core/utils'
  import { notifyAfter } from '$core/notify.svelte'
  import ControlledDialog from '$lib/components/ControlledDialog.svelte'

  let { store } = $props()

  const handleSave = () => notifyAfter(store, store.saveCese)
</script>

<ControlledDialog open={Boolean(store.ceseTarget)} onClose={store.closeCese} class="sm:max-w-md">
  <Dialog.Header>
      <Dialog.Title>Registrar cese / renuncia</Dialog.Title>
      <Dialog.Description class="text-xs">
        {#if store.ceseTarget}
          {store.ceseTarget.cargoNombre} · {store.ceseTarget.apellido_nombre || '(sin nombre)'}
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    {#if store.ceseTarget}
      <div class="flex flex-col gap-4">
        <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.FieldLabel for="cese-fecha">Fecha de cese</Field.FieldLabel>
            <Input id="cese-fecha" type="date" bind:value={store.ceseTarget.fecha_cese} />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="cese-motivo">Motivo</Field.FieldLabel>
            <Select.Root type="single" bind:value={store.ceseTarget.motivo_cese}>
              <Select.Trigger id="cese-motivo" class="w-full">
                <Select.Value placeholder="Elegir…" />
              </Select.Trigger>
              <Select.Content>
                {#each MOTIVOS_CESE as m}
                  <Select.Item value={m}>{m}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>
        </Field.FieldGroup>

        <p class="rounded-lg border border-border bg-muted/5 p-3 text-xs text-muted-foreground">
          Origen del acta que respalda el cese (Reunión de CD o Asamblea). Dejá en blanco si no querés vincularlo a una reunión registrada.
        </p>

        <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.FieldLabel for="cese-acta">Acta de referencia (texto)</Field.FieldLabel>
            <Input id="cese-acta" bind:value={store.ceseTarget.acta_origen_ref} placeholder="Ej: Acta CD 12/2026" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="cese-fecha-acta">Fecha del acta</Field.FieldLabel>
            <Input id="cese-fecha-acta" type="date" bind:value={store.ceseTarget.fecha_acta_origen} />
          </Field.Field>
        </Field.FieldGroup>

        <Field.Field>
          <Field.FieldLabel for="cese-asamblea">Reunión de origen (opcional)</Field.FieldLabel>
          <Select.Root type="single" bind:value={store.ceseTarget.asamblea_id}>
            <Select.Trigger id="cese-asamblea" class="w-full">
              <Select.Value placeholder="Sin vincular" />
            </Select.Trigger>
            <Select.Content>
              {#each store.asambleas as a (a.id)}
                <Select.Item value={a.id}>
                  {a.fecha || '(s/f)'} · {TIPOS_ASAMBLEA_CORTO[a.tipo_asamblea] || a.tipo_asamblea} · Acta {a.acta_numero || '-'}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </Field.Field>
      </div>
    {/if}

    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={store.closeCese}>Cancelar</Button>
      <Button onclick={handleSave} disabled={store.busy}>Registrar cese</Button>
    </Dialog.Footer>
  </ControlledDialog>
