<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Select from '$lib/components/ui/select'
  import { Badge } from '$lib/components/ui/badge'
  import * as Field from '$lib/components/ui/field'
  import { TIPOS_ASAMBLEA_CORTO } from '$app/modules/gobierno/constants.js'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import ControlledDialog from '$lib/components/ControlledDialog.svelte'
  import PersonaPicker from '../../components/PersonaPicker.svelte'

  let { store } = $props()

  const handleSave = () => notifyAfter(store, store.saveReemplazo)

  let cargosMismoOrg = $derived(
    store.reemplazoTarget
      ? store.cargos
          .filter((c) => String(c.organismo) === String(store.reemplazoTarget.cesado.organismo))
          .filter((c) => c.activo === true || c.cargo_obligatorio === true)
          .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
      : [],
  )
</script>

<ControlledDialog open={Boolean(store.reemplazoTarget)} onClose={store.closeReemplazo} class="sm:max-w-lg">
  <Dialog.Header>
      <Dialog.Title>Registrar reemplazo</Dialog.Title>
      <Dialog.Description class="text-xs">
        Cesar al integrante actual y designar a su reemplazante. El nuevo mandato quedará vinculado al anterior para trazabilidad.
      </Dialog.Description>
    </Dialog.Header>

    {#if store.reemplazoTarget}
      <div class="flex flex-col gap-4">
        <!-- Cesado -->
        <div class="rounded-lg border border-border bg-muted/5 p-3">
          <div class="mb-1 flex items-center gap-2">
            <Badge variant="destructive">Cesa</Badge>
            <span class="text-sm font-bold">{store.reemplazoTarget.cesado.cargoNombre}</span>
          </div>
          <span class="text-xs text-muted-foreground">{store.reemplazoTarget.cesado.apellido_nombre || '(sin nombre)'}</span>
        </div>

        <!-- Nuevo -->
        <div class="rounded-lg border border-primary/30 p-3">
          <div class="mb-2 flex items-center gap-2">
            <Badge variant="default">Reemplazante</Badge>
          </div>
          <Field.FieldGroup class="flex flex-col gap-3">
            <Field.Field>
              <Field.FieldLabel for="rep-cargo">Cargo que asume</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.reemplazoTarget.nuevo.cargoId}>
                <Select.Trigger id="rep-cargo" class="w-full">
                  <Select.Value placeholder="Elegir cargo…" />
                </Select.Trigger>
                <Select.Content>
                  {#each cargosMismoOrg as c (c.id)}
                    <Select.Item value={c.id}>{c.nombre_cargo}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              <Field.FieldDescription>Permite ascenso (ej: Vicepresidente → Presidente).</Field.FieldDescription>
            </Field.Field>

            <PersonaPicker
              personaId={store.reemplazoTarget.nuevo.persona_id}
              apellidoNombre={store.reemplazoTarget.nuevo.apellido_nombre}
              searchValue={store.searchTarget === 'reemplazo' ? store.personaSearch : ''}
              searching={store.personaSearching && store.searchTarget === 'reemplazo'}
              results={store.personaResults}
              onsearch={(v) => { store.personaSearch = v; store.doPersonaSearch('reemplazo') }}
              onpick={(p) => store.linkPersonaSearch(p)}
              onunlink={() => { store.reemplazoTarget.nuevo.persona_id = null; store.reemplazoTarget.nuevo.apellido_nombre = ''; store.reemplazoTarget.nuevo.dni = ''; store.reemplazoTarget.nuevo.cuil = '' }}
            />

            <Field.Field>
              <Field.FieldLabel for="rep-asuncion">Fecha de asunción</Field.FieldLabel>
              <Input id="rep-asuncion" type="date" bind:value={store.reemplazoTarget.nuevo.fecha_asuncion} />
            </Field.Field>

            <Field.FieldGroup class="grid gap-3 sm:grid-cols-2">
              <Field.Field>
                <Field.FieldLabel for="rep-acta">Acta de referencia</Field.FieldLabel>
                <Input id="rep-acta" bind:value={store.reemplazoTarget.nuevo.acta_origen_ref} placeholder="Ej: Acta CD 13/2026" />
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="rep-fecha-acta">Fecha del acta</Field.FieldLabel>
                <Input id="rep-fecha-acta" type="date" bind:value={store.reemplazoTarget.nuevo.fecha_acta_origen} />
              </Field.Field>
            </Field.FieldGroup>

            <Field.Field>
              <Field.FieldLabel for="rep-asamblea">Reunión de origen (opcional)</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.reemplazoTarget.nuevo.asamblea_id}>
                <Select.Trigger id="rep-asamblea" class="w-full">
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
          </Field.FieldGroup>
        </div>
      </div>
    {/if}

    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={store.closeReemplazo}>Cancelar</Button>
      <Button onclick={handleSave} disabled={store.busy}>Registrar reemplazo</Button>
    </Dialog.Footer>
  </ControlledDialog>
