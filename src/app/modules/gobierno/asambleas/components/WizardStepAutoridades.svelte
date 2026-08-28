<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Field from '$lib/components/ui/field'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import PersonaPicker from '../../components/PersonaPicker.svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckIcon from '@lucide/svelte/icons/check'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import InfoIcon from '@lucide/svelte/icons/info'
  import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'
  import { formatFecha } from '$core/format/format'

  let {
    store,
    computed,
    cargosAccordion = $bindable([]),
    cargoInputRefs = {},
    ORGANISMO_LABELS,
    onBack,
    onSave,
    onPick,
  } = $props()
</script>

<div class="flex flex-col gap-4">
  <!-- Sub-step A: Selección de tipo de carga -->
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
          <span class="text-xs text-muted-foreground">Cargar todos los cargos. Se cesan las autoridades vigentes.</span>
          {#if store.cargarDraft.totalVigentes > 0}
            <span class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertTriangleIcon class="size-3 shrink-0" />
              Se cesarán {store.cargarDraft.totalVigentes} autoridad(es) vigente(s).
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
          <span class="text-xs text-muted-foreground">Seleccioná individualmente qué cargos cargar o reemplazar.</span>
        </div>
      </label>
    </div>

    {#if store.cargarDraft.cargaMode === 'parcial'}
      <Accordion.Root type="single" bind:value={cargosAccordion} class="rounded-lg border border-border">
        <Accordion.Item value="cargos">
          <Accordion.Trigger class="text-xs">
            <span class="flex items-center gap-2 font-semibold">
              <SlidersHorizontalIcon class="size-3.5" />
              Personalizar cargos a cargar
              <Badge variant="secondary" class="text-[10px]">{computed.cargosSeleccionadosCount} seleccionado(s)</Badge>
            </span>
          </Accordion.Trigger>
          <Accordion.Content>
            <div class="flex flex-col gap-2 pt-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold">Seleccioná los cargos a cargar:</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{computed.cargosSeleccionadosCount} seleccionado(s)</span>
                  <button
                    type="button"
                    class="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
                    onclick={() => {
                      const st = store.globalSelectState()
                      if (st === 'all') store.deselectAllCargos()
                      else store.selectAllCargos()
                    }}
                  >
                    {#if store.globalSelectState() === 'all'}
                      <span class="flex size-3.5 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground"><CheckIcon class="size-3" /></span>
                      Desactivar todos
                    {:else if store.globalSelectState() === 'partial'}
                      <span class="flex size-3.5 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground"><MinusIcon class="size-3" /></span>
                      Activar todos
                    {:else}
                      <span class="flex size-3.5 items-center justify-center rounded-sm border border-input bg-background"></span>
                      Activar todos
                    {/if}
                  </button>
                </div>
              </div>
              {#each computed.filasPorOrganismo as [org, items] (org)}
                <div class="flex flex-col gap-1">
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent"
                    onclick={() => store.toggleOrganismoCargos(org)}
                  >
                    {#if store.organismoSelectState(org) === 'all'}
                      <span class="flex size-3.5 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground"><CheckIcon class="size-3" /></span>
                    {:else if store.organismoSelectState(org) === 'partial'}
                      <span class="flex size-3.5 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground"><MinusIcon class="size-3" /></span>
                    {:else}
                      <span class="flex size-3.5 items-center justify-center rounded-sm border border-input bg-background"></span>
                    {/if}
                    {ORGANISMO_LABELS[org] || org}
                  </button>
                  {#each items as { fila: f, globalIdx } (f.cargoId)}
                    <label class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:bg-accent">
                      <Checkbox
                        checked={store.cargarDraft.cargosSeleccionados.has(f.cargoId)}
                        onCheckedChange={() => store.toggleCargoSeleccionado(f.cargoId)}
                      />
                      <span class="flex-1">{f.cargoNombre}</span>
                      {#if f.obligatorio}<Badge variant="secondary">Obligatorio</Badge>{/if}
                      {#if f.yaExiste}
                        <Badge variant="outline">Vigente</Badge>
                        {#if f.fecha_asuncion_existente}
                          <span class="text-[10px] text-muted-foreground">desde {formatFecha(f.fecha_asuncion_existente)}{#if f.fecha_vencimiento_existente} · hasta {formatFecha(f.fecha_vencimiento_existente)}{/if}</span>
                        {/if}
                      {/if}
                    </label>
                  {/each}
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    {/if}
  {:else}
    <div class="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
      No hay autoridades vigentes. Se realizará una carga total de todos los cargos.
    </div>
  {/if}

  <!-- Panel de renovación de CD por mitades (art. 15) -->
  {#if store.cargarDraft.esConstitucion}
    <div class="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div class="flex items-start gap-2">
        <InfoIcon class="size-4 shrink-0 text-primary mt-0.5" />
        <div class="flex flex-col gap-2 text-xs">
          <span class="font-bold text-foreground">Asamblea constitutiva — sorteo de mandatos</span>
          <span class="text-muted-foreground leading-relaxed">
            Al ser la primera elección de la CD, hay que sortear qué mitad dura 1 año y cuál 2 (art. 15, Decreto 4767/72). Después, cada grupo durará siempre 2 años y alternará renovación.
          </span>
          <div class="flex flex-col gap-1.5 mt-1">
            <span class="font-semibold text-foreground">¿Qué grupo queda con mandato corto (1 año)?</span>
            <div class="flex gap-2">
              <label class="flex items-center gap-1.5 cursor-pointer rounded-md border border-border px-2.5 py-1.5 text-xs {store.cargarDraft.grupoCortoSorteo === 'A' ? 'border-primary bg-primary/10 font-bold' : ''}">
                <input type="radio" name="grupoCorto" value="A" checked={store.cargarDraft.grupoCortoSorteo === 'A'} onchange={() => store.setGrupoCortoSorteo('A')} />
                Grupo A (1 año)
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer rounded-md border border-border px-2.5 py-1.5 text-xs {store.cargarDraft.grupoCortoSorteo === 'B' ? 'border-primary bg-primary/10 font-bold' : ''}">
                <input type="radio" name="grupoCorto" value="B" checked={store.cargarDraft.grupoCortoSorteo === 'B'} onchange={() => store.setGrupoCortoSorteo('B')} />
                Grupo B (1 año)
              </label>
            </div>
            <span class="text-[10px] text-muted-foreground">El otro grupo durará 2 años. Los vencimientos se calculan automáticamente al guardar.</span>
          </div>
        </div>
      </div>
    </div>
  {:else if store.cargarDraft.grupoAVencer}
    <div class="rounded-lg border border-border bg-muted/5 p-3">
      <div class="flex items-start gap-2">
        <InfoIcon class="size-4 shrink-0 text-muted-foreground mt-0.5" />
        <div class="flex flex-col gap-1 text-xs">
          <span class="font-bold text-foreground">Renovación de CD — le toca al Grupo {store.cargarDraft.grupoAVencer}</span>
          <span class="text-muted-foreground leading-relaxed">
            Según los vencimientos de las autoridades vigentes, en esta asamblea corresponde renovar los cargos del <strong>Grupo {store.cargarDraft.grupoAVencer}</strong>. Ya están pre-seleccionados. Los cargos del otro grupo continúan en funciones.
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sub-step B: Carga de personas por cargo -->
  <Separator />
  {#if store.cargarDraft.cargaMode === 'total' && store.cargarDraft.totalVigentes > 0}
    <div class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangleIcon class="size-4 shrink-0" />
      Al guardar se cesarán {store.cargarDraft.totalVigentes} autoridad(es) vigente(s) y se cargarán las nuevas.
    </div>
  {/if}

  {#each computed.filasPorOrganismo as [org, items] (org)}
    {#if store.cargarDraft.cargaMode === 'total' || items.some(({ fila: f }) => store.cargarDraft.cargosSeleccionados.has(f.cargoId))}
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-muted-foreground">{ORGANISMO_LABELS[org] || org}</span>
        {#each items as { fila: f, globalIdx } (f.cargoId)}
          {#if store.cargarDraft.cargaMode === 'total' || store.cargarDraft.cargosSeleccionados.has(f.cargoId)}
            <div class="rounded-lg border border-border p-3" bind:this={cargoInputRefs[f.cargoId]}>
              <div class="mb-2 flex items-center gap-2">
                <span class="text-sm font-bold">{f.cargoNombre}</span>
                {#if f.grupoRenovacion && org === 'CD'}
                  <Badge variant="outline" class="text-[10px] {f.grupoRenovacion === store.cargarDraft.grupoAVencer ? 'border-primary text-primary' : ''}">
                    Grupo {f.grupoRenovacion}
                  </Badge>
                {/if}
                {#if f.obligatorio}<Badge variant="secondary">Obligatorio</Badge>{/if}
                {#if f.yaExiste}
                  <Badge variant="outline">Vigente</Badge>
                  {#if f.fecha_asuncion_existente}
                    <span class="text-[10px] text-muted-foreground">desde {formatFecha(f.fecha_asuncion_existente)}{#if f.fecha_vencimiento_existente} · hasta {formatFecha(f.fecha_vencimiento_existente)}{/if}</span>
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
                  excludePersonaIds={computed.assignedPersonaIds}
                  onsearch={(v) => { store.personaSearch = v; store.doPersonaSearch(`cargar:${globalIdx}`) }}
                  onpick={(p) => onPick(globalIdx, p)}
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

<div class="flex gap-2">
  <Button variant="outline" onclick={onBack}>
    <ArrowLeftIcon data-icon="inline-start" />
    Atrás
  </Button>
  <Button onclick={onSave} disabled={store.busy}>Guardar autoridades</Button>
</div>
