<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import * as Field from '$lib/components/ui/field'
  import { notifyAfter } from '$core/notify.svelte'
  import ControlledDialog from '$lib/components/ControlledDialog.svelte'
  import PersonaPicker from './PersonaPicker.svelte'

  let { store } = $props()

  const handleSave = () => notifyAfter(store, store.saveAutoridadesFromAsamblea)
</script>

<ControlledDialog open={Boolean(store.cargarDraft)} onClose={store.closeCargarAutoridades} class="sm:max-w-2xl">
  <Dialog.Header>
      <Dialog.Title>Cargar autoridades electas</Dialog.Title>
      <Dialog.Description class="text-xs">
        {#if store.cargarDraft}
          Asamblea del {store.cargarDraft.asambleaFecha} · {store.cargarDraft.tipo === 'AGE' ? 'Extraordinaria' : 'Ordinaria'}
        {/if}
        <br />
        Asigná una persona a cada cargo de la Comisión Directiva. La fecha de asunción se toma de la asamblea.
      </Dialog.Description>
    </Dialog.Header>

    {#if store.cargarDraft}
      <div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
        {#each store.cargarDraft.filas as f, idx (f.cargoId)}
          <div class="rounded-lg border border-border p-3">
            <div class="mb-2 flex items-center gap-2">
              <span class="text-sm font-bold">{f.cargoNombre}</span>
              {#if f.obligatorio}<Badge variant="secondary">Obligatorio</Badge>{/if}
              {#if f.yaExiste}<Badge variant="outline">Ya vigente</Badge>{/if}
            </div>
            <Field.FieldGroup class="grid gap-2 sm:grid-cols-[1fr_120px_140px]">
              <PersonaPicker
                personaId={f.persona_id}
                apellidoNombre={f.apellido_nombre}
                disabled={false}
                searchValue={store.searchTarget === `cargar:${idx}` ? store.personaSearch : ''}
                searching={store.personaSearching && store.searchTarget === `cargar:${idx}`}
                results={store.personaResults}
                onsearch={(v) => { store.personaSearch = v; store.doPersonaSearch(`cargar:${idx}`) }}
                onpick={(p) => store.linkPersonaSearch(p)}
                onunlink={() => { f.persona_id = null; f.apellido_nombre = ''; f.dni = ''; f.cuil = '' }}
                compact
              />
              <Field.Field>
                <Field.FieldLabel class="text-[11px]">DNI</Field.FieldLabel>
                <Input bind:value={f.dni} class="h-8 text-xs" disabled={!!f.persona_id} />
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel class="text-[11px]">Asunción</Field.FieldLabel>
                <Input type="date" bind:value={f.fecha_asuncion} class="h-8 text-xs" />
              </Field.Field>
            </Field.FieldGroup>
          </div>
        {/each}
      </div>
    {/if}

    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={store.closeCargarAutoridades}>Cancelar</Button>
      <Button onclick={handleSave} disabled={store.busy}>Guardar autoridades</Button>
    </Dialog.Footer>
  </ControlledDialog>
