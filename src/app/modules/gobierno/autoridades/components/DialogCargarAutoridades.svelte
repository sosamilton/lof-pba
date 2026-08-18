<script>
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Field from '$lib/components/ui/field'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import ControlledDialog from '$lib/components/ControlledDialog.svelte'
  import PersonaPicker from '../../components/PersonaPicker.svelte'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'

  let { store } = $props()

  let wizardStep = $state(1)

  const handleSave = () => notifyAfter(store, store.saveAutoridadesFromAsamblea)

  const goNext = () => { wizardStep = 2 }
  const goBack = () => { wizardStep = 1 }

  const resetWizard = () => { wizardStep = 1 }

  const handleClose = () => {
    resetWizard()
    store.closeCargarAutoridades()
  }

  // Agrupar filas por organismo con índice global
  const filasPorOrganismo = $derived.by(() => {
    if (!store.cargarDraft) return []
    const groups = {}
    const filas = store.cargarDraft.filas
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]
      const org = f.organismo || 'CD'
      if (!groups[org]) groups[org] = []
      groups[org].push({ fila: f, globalIdx: i })
    }
    return Object.entries(groups)
  })

  const ORGANISMO_LABELS = { CD: 'Comisión Directiva', CRC: 'Comisión Revisora de Cuentas', Federacion: 'Representante Federación' }

  const cargosSeleccionadosCount = $derived(
    store.cargarDraft ? store.cargarDraft.cargosSeleccionados.size : 0,
  )

  const assignedPersonaIds = $derived.by(() => {
    if (!store.cargarDraft) return []
    return store.cargarDraft.filas
      .filter((f) => f.persona_id)
      .map((f) => f.persona_id)
  })
</script>

<ControlledDialog open={Boolean(store.cargarDraft) && !store.cargarDraft?.inlineMode} onClose={handleClose} class="sm:max-w-2xl">
  <Dialog.Header>
      <Dialog.Title>Cargar autoridades electas</Dialog.Title>
      <Dialog.Description class="text-xs">
        {#if store.cargarDraft}
          Asamblea del {store.cargarDraft.asambleaFecha} · {store.cargarDraft.tipo === 'AGE' ? 'Extraordinaria' : 'Ordinaria'}
        {/if}
        <br />
        Paso {wizardStep} de 2: {wizardStep === 1 ? 'Seleccioná el tipo de carga' : 'Asigná personas a los cargos'}
      </Dialog.Description>
    </Dialog.Header>

    {#if store.cargarDraft}
      {#if wizardStep === 1}
        <!-- Step 1: Selección de tipo de carga -->
        <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          {#if store.cargarDraft.totalVigentes > 0}
            <div class="flex flex-col gap-3">
              <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                <input
                  type="radio"
                  name="cargaMode"
                  value="total"
                  checked={store.cargarDraft.cargaMode === 'total'}
                  onchange={() => store.setCargaMode('total')}
                  class="mt-0.5"
                />
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-bold">Carga total</span>
                  <span class="text-xs text-muted-foreground">Cargar todos los cargos de todos los organismos.</span>
                  {#if store.cargarDraft.totalVigentes > 0}
                    <span class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                      <AlertTriangleIcon class="size-3 shrink-0" />
                      Se cesarán {store.cargarDraft.totalVigentes} autoridad(es) vigente(s) y se cargarán las nuevas.
                    </span>
                  {/if}
                </div>
              </label>

              <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                <input
                  type="radio"
                  name="cargaMode"
                  value="parcial"
                  checked={store.cargarDraft.cargaMode === 'parcial'}
                  onchange={() => store.setCargaMode('parcial')}
                  class="mt-0.5"
                />
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-bold">Carga parcial</span>
                  <span class="text-xs text-muted-foreground">Seleccioná individualmente qué cargos cargar.</span>
                </div>
              </label>
            </div>

            {#if store.cargarDraft.cargaMode === 'parcial'}
              <div class="flex flex-col gap-2">
                <span class="text-xs font-semibold">Seleccioná los cargos a cargar:</span>
                {#each filasPorOrganismo as [org, items] (org)}
                  <div class="flex flex-col gap-1">
                    <span class="text-xs font-bold text-muted-foreground">{ORGANISMO_LABELS[org] || org}</span>
                    {#each items as { fila: f, globalIdx } (f.cargoId)}
                      <label class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:bg-accent">
                        <Checkbox
                          checked={store.cargarDraft.cargosSeleccionados.has(f.cargoId)}
                          onCheckedChange={() => store.toggleCargoSeleccionado(f.cargoId)}
                        />
                        <span class="flex-1">{f.cargoNombre}</span>
                        {#if f.grupoRenovacion}<Badge variant="secondary" class="text-[10px]">Grupo {f.grupoRenovacion}</Badge>{/if}
                        {#if f.obligatorio}<Badge variant="secondary">Obligatorio</Badge>{/if}
                        {#if f.yaExiste}
                          <Badge variant="outline">Vigente</Badge>
                          {#if f.fecha_asuncion_existente}
                            <span class="text-[10px] text-muted-foreground">desde {f.fecha_asuncion_existente}{#if f.fecha_vencimiento_existente} · hasta {f.fecha_vencimiento_existente}{/if}</span>
                          {/if}
                        {/if}
                      </label>
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
          {:else}
            <div class="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              No hay autoridades vigentes. Se realizará una carga total de todos los cargos.
            </div>
          {/if}
        </div>

        <Dialog.Footer class="gap-2">
          <Button variant="outline" onclick={handleClose}>Cancelar</Button>
          <Button onclick={goNext} disabled={cargosSeleccionadosCount === 0}>Siguiente</Button>
        </Dialog.Footer>
      {:else}
        <!-- Step 2: Carga de personas por cargo -->
        <div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          {#if store.cargarDraft.cargaMode === 'total' && store.cargarDraft.totalVigentes > 0}
            <div class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangleIcon class="size-4 shrink-0" />
              Al guardar se cesarán {store.cargarDraft.totalVigentes} autoridad(es) vigente(s) y se cargarán las nuevas.
            </div>
          {/if}

          {#each filasPorOrganismo as [org, items] (org)}
            {#if store.cargarDraft.cargaMode === 'total' || items.some(({ fila: f }) => store.cargarDraft.cargosSeleccionados.has(f.cargoId))}
              <div class="flex flex-col gap-2">
                <span class="text-xs font-bold text-muted-foreground">{ORGANISMO_LABELS[org] || org}</span>
                {#each items as { fila: f, globalIdx } (f.cargoId)}
                  {#if store.cargarDraft.cargaMode === 'total' || store.cargarDraft.cargosSeleccionados.has(f.cargoId)}
                    <div class="rounded-lg border border-border p-3">
                      <div class="mb-2 flex items-center gap-2">
                        <span class="text-sm font-bold">{f.cargoNombre}</span>
                        {#if f.grupoRenovacion}<Badge variant="secondary" class="text-[10px]">Grupo {f.grupoRenovacion}</Badge>{/if}
                        {#if f.obligatorio}<Badge variant="secondary">Obligatorio</Badge>{/if}
                        {#if f.yaExiste}
                          <Badge variant="outline">Vigente</Badge>
                          {#if f.fecha_asuncion_existente}
                            <span class="text-[10px] text-muted-foreground">desde {f.fecha_asuncion_existente}{#if f.fecha_vencimiento_existente} · hasta {f.fecha_vencimiento_existente}{/if}</span>
                          {/if}
                        {/if}
                      </div>
                      <Field.FieldGroup class="grid gap-2 sm:grid-cols-[1fr_120px_140px]">
                        <PersonaPicker
                          personaId={f.persona_id}
                          apellidoNombre={f.apellido_nombre}
                          disabled={false}
                          searchValue={store.searchTarget === `cargar:${globalIdx}` ? store.personaSearch : ''}
                          searching={store.personaSearching && store.searchTarget === `cargar:${globalIdx}`}
                          results={store.personaResults}
                          excludePersonaIds={assignedPersonaIds}
                          onsearch={(v) => { store.personaSearch = v; store.doPersonaSearch(`cargar:${globalIdx}`) }}
                          onpick={(p) => store.setDraftPersona(globalIdx, p)}
                          onunlink={() => store.unlinkDraftPersona(globalIdx)}
                          compact
                          showCreateSocio
                          fechaAltaSocio={store.cargarDraft.asambleaFecha}
                        />
                        <Field.Field>
                          <Field.FieldLabel class="text-[11px]">DNI</Field.FieldLabel>
                          <Input value={f.dni} class="h-8 text-xs" disabled placeholder="Se completa al vincular persona" />
                        </Field.Field>
                        <Field.Field>
                          <Field.FieldLabel class="text-[11px]">Asunción</Field.FieldLabel>
                          <Input type="date" bind:value={f.fecha_asuncion} class="h-8 text-xs" />
                        </Field.Field>
                      </Field.FieldGroup>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          {/each}
        </div>

        <Dialog.Footer class="gap-2">
          <Button variant="outline" onclick={goBack}>Atrás</Button>
          <Button onclick={handleSave} disabled={store.busy}>Guardar autoridades</Button>
        </Dialog.Footer>
      {/if}
    {/if}
  </ControlledDialog>
