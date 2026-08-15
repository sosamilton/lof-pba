<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import { Separator } from '$lib/components/ui/separator'
  import { TIPOS_ASAMBLEA_CORTO } from '$app/modules/gobierno/constants.js'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import PersonaPicker from '../../components/PersonaPicker.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import XIcon from '@lucide/svelte/icons/x'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckIcon from '@lucide/svelte/icons/check'
  import MinusIcon from '@lucide/svelte/icons/minus'

  let { store, wizardOpen = $bindable(false), askDelete = () => {} } = $props()

  let wizardStep = $state(1)
  let savedAsambleaId = $state(null)

  // Si el wizard se abre y ya hay un cargarDraft inline, ir directo a paso 2
  $effect(() => {
    if (wizardOpen && store.cargarDraft?.inlineMode && wizardStep === 1) {
      wizardStep = 2
    }
  })

  const MOTIVOS_CONVOCATORIA = [
    'Reforma estatuto',
    'Relevo autoridades',
    'Integracion CD',
    'Decision excepcional',
    'Modificacion temporal atribuciones',
    'Constitucion cooperadora',
    'Otro',
  ]

  const CONVOCATORIA_ORIGEN = [
    { value: 'Mas10pctSocios', label: 'Más del 10% de socios' },
    { value: 'DosMiembrosCD', label: 'Dos miembros de CD' },
    { value: 'DireccionCoopEscolar', label: 'Dirección de Cooperación Escolar' },
    { value: 'ComisionDirectiva', label: 'Comisión Directiva' },
  ]

  const ORGANISMO_LABELS = { CD: 'Comisión Directiva', CRC: 'Comisión Revisora de Cuentas', Federacion: 'Representante Federación' }

  const handleNextFromData = async () => {
    const id = await store.saveAsamblea({ keepForm: true })
    if (!id) return
    savedAsambleaId = id

    if (store.asambleaForm?.tipo_asamblea === 'RCD') {
      wizardStep = 2
    } else {
      // AGO/AGE: open cargar autoridades inline as step 2
      store.openCargarAutoridades(id, { inlineMode: true })
      wizardStep = 2
    }
  }

  const handleSaveRcd = () => {
    notifyAfter(store, async () => {
      await store.saveAsamblea()
      wizardOpen = false
    })
  }

  const handleSaveAutoridades = () => {
    notifyAfter(store, async () => {
      await store.saveAutoridadesFromAsamblea()
      wizardOpen = false
    })
  }

  const close = () => {
    wizardOpen = false
    wizardStep = 1
    savedAsambleaId = null
    store.closeCargarAutoridades()
  }

  const goBackToData = () => {
    wizardStep = 1
    store.closeCargarAutoridades()
  }

  const isAge = $derived(store.asambleaForm?.tipo_asamblea === 'AGE')
  const isRcd = $derived(store.asambleaForm?.tipo_asamblea === 'RCD')
  const isAgo = $derived(store.asambleaForm?.tipo_asamblea === 'AGO')

  // Helper: agrupar filas por organismo con índice global
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

  const cargosSeleccionadosCount = $derived(
    store.cargarDraft ? store.cargarDraft.cargosSeleccionados.size : 0,
  )

  // IDs de personas ya asignadas a otros cargos (para excluirlas de la búsqueda)
  const assignedPersonaIds = $derived.by(() => {
    if (!store.cargarDraft) return []
    return store.cargarDraft.filas
      .filter((f) => f.persona_id)
      .map((f) => f.persona_id)
  })

  // Auto-focus: al seleccionar una persona, enfocar el siguiente cargo vacío
  let cargoInputRefs = {}

  const focusNextCargo = (currentGlobalIdx) => {
    if (!store.cargarDraft) return
    const filas = store.cargarDraft.filas
    for (let i = currentGlobalIdx + 1; i < filas.length; i++) {
      if (!filas[i].persona_id) {
        queueMicrotask(() => {
          const el = cargoInputRefs[filas[i].cargoId]
          if (el) {
            const input = el.querySelector('input[placeholder*="Buscar"]')
            if (input) input.focus()
          }
        })
        return
      }
    }
  }

  const handlePick = (globalIdx, p) => {
    store.setDraftPersona(globalIdx, p)
    focusNextCargo(globalIdx)
  }

  const stepTitle = $derived.by(() => {
    if (wizardStep === 1) return `Paso 1: Datos de la ${isRcd ? 'reunión' : 'asamblea'}`
    if (isRcd) return 'Paso 2: Resoluciones'
    return 'Paso 2: Cargar autoridades electas'
  })
</script>

{#if wizardOpen && store.asambleaForm}
  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <div>
          <Card.Title class="text-base">
            {#if store.asambleaForm.id}
              {#if isRcd}
                Editar Reunión de CD
              {:else if isAge}
                Editar Asamblea Extraordinaria
              {:else}
                Editar Asamblea Ordinaria
              {/if}
            {:else if isRcd}
              Nueva Reunión de CD
            {:else if isAge}
              Nueva Asamblea Extraordinaria
            {:else}
              Nueva Asamblea Ordinaria
            {/if}
          </Card.Title>
          <Card.Description class="text-xs">
            {stepTitle}
          </Card.Description>
        </div>
        <Button variant="ghost" size="sm" class="shrink-0" onclick={close} aria-label="Cerrar">
          <XIcon class="size-4" />
        </Button>
      </div>
    </Card.Header>

    <Card.Content class="flex flex-col gap-4">
    {#if wizardStep === 1}
      <div class="flex flex-col gap-4">
        <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.FieldLabel for="wiz-fecha">Fecha</Field.FieldLabel>
            <Input id="wiz-fecha" type="date" bind:value={store.asambleaForm.fecha} />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="wiz-acta">Acta N°</Field.FieldLabel>
            <Input id="wiz-acta" bind:value={store.asambleaForm.acta_numero} />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="wiz-fojas">Fojas</Field.FieldLabel>
            <Input id="wiz-fojas" bind:value={store.asambleaForm.acta_fojas} />
          </Field.Field>

          {#if isAge}
            <Field.Field>
              <Field.FieldLabel for="wiz-motivo">Motivo de convocatoria</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.motivo_convocatoria}>
                <Select.Trigger id="wiz-motivo" class="w-full">
                  <Select.Value placeholder="Elegir…" />
                </Select.Trigger>
                <Select.Content>
                  {#each MOTIVOS_CONVOCATORIA as m}
                    <Select.Item value={m}>{m}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-origen">Origen de convocatoria</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.convocatoria_origen}>
                <Select.Trigger id="wiz-origen" class="w-full">
                  <Select.Value placeholder="Elegir…" />
                </Select.Trigger>
                <Select.Content>
                  {#each CONVOCATORIA_ORIGEN as o}
                    <Select.Item value={o.value}>{o.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </Field.Field>
          {/if}

          {#if isAgo}
            <Field.Field>
              <Field.FieldLabel for="wiz-presentes">Socios presentes</Field.FieldLabel>
              <Input id="wiz-presentes" type="number" bind:value={store.asambleaForm.socios_presentes_cantidad} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-cuota">Cuota social ($)</Field.FieldLabel>
              <Input id="wiz-cuota" type="number" bind:value={store.asambleaForm.cuota_social_importe} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-modalidad">Cuota modalidad</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.cuota_social_modalidad}>
                <Select.Trigger id="wiz-modalidad" class="w-full">
                  <Select.Value placeholder="Elegir…" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="Mensual">Mensual</Select.Item>
                  <Select.Item value="Anual">Anual</Select.Item>
                </Select.Content>
              </Select.Root>
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-caja">Caja chica ($)</Field.FieldLabel>
              <Input id="wiz-caja" type="number" bind:value={store.asambleaForm.caja_chica_importe} />
            </Field.Field>
          {/if}
        </Field.FieldGroup>

        {#if isAge}
          <Field.Field>
            <Field.FieldLabel for="wiz-orden">Orden del día</Field.FieldLabel>
            <Textarea id="wiz-orden" bind:value={store.asambleaForm.orden_del_dia} placeholder="Temas a tratar en la asamblea…" />
          </Field.Field>
        {/if}

        {#if isRcd}
          <Separator />
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold">Resoluciones</span>
              <Button variant="outline" size="sm" onclick={store.addResolucion}>
                <PlusIcon data-icon="inline-start" />
                Agregar
              </Button>
            </div>
            {#each store.resoluciones as res, idx (idx)}
              <div class="flex items-start gap-2">
                <div class="flex-1">
                  <Field.FieldLabel class="text-xs text-muted-foreground">Punto {idx + 1}</Field.FieldLabel>
                  <Textarea bind:value={res.texto} placeholder="Texto de la resolución…" class="mt-1" />
                </div>
                <Button variant="ghost" size="sm" class="mt-6" onclick={() => store.removeResolucion(idx)} aria-label="Eliminar resolución">
                  <TrashIcon class="size-4" />
                </Button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onclick={close}>Cancelar</Button>
        <div class="flex gap-2">
          {#if store.asambleaForm.id}
            <Button variant="destructive" size="sm" onclick={askDelete} disabled={store.busy}>
              <TrashIcon data-icon="inline-start" />
              Eliminar
            </Button>
          {/if}
          {#if isRcd}
            <Button onclick={handleNextFromData} disabled={store.busy}>Guardar</Button>
          {:else}
            <Button onclick={handleNextFromData} disabled={store.busy}>
              Guardar y seguir
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          {/if}
        </div>
      </div>
    {:else if wizardStep === 2 && isRcd}
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">Resoluciones</span>
          <Button variant="outline" size="sm" onclick={store.addResolucion}>
            <PlusIcon data-icon="inline-start" />
            Agregar
          </Button>
        </div>
        {#each store.resoluciones as res, idx (idx)}
          <div class="flex items-start gap-2">
            <div class="flex-1">
              <Field.FieldLabel class="text-xs text-muted-foreground">Punto {idx + 1}</Field.FieldLabel>
              <Textarea bind:value={res.texto} placeholder="Texto de la resolución…" class="mt-1" />
            </div>
            <Button variant="ghost" size="sm" class="mt-6" onclick={() => store.removeResolucion(idx)} aria-label="Eliminar resolución">
              <TrashIcon class="size-4" />
            </Button>
          </div>
        {/each}
      </div>

      <div class="flex gap-2">
        <Button variant="outline" onclick={() => { wizardStep = 1 }}>Atrás</Button>
        <Button onclick={handleSaveRcd} disabled={store.busy}>Guardar</Button>
      </div>
    {:else if wizardStep === 2 && !isRcd && store.cargarDraft}
      <!-- Step 2 for AGO/AGE: Cargar autoridades inline -->
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
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold">Seleccioná los cargos a cargar:</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{cargosSeleccionadosCount} seleccionado(s)</span>
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
              {#each filasPorOrganismo as [org, items] (org)}
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

        <!-- Sub-step B: Carga de personas por cargo -->
        <Separator />
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
                  <div class="rounded-lg border border-border p-3" bind:this={cargoInputRefs[f.cargoId]}>
                    <div class="mb-2 flex items-center gap-2">
                      <span class="text-sm font-bold">{f.cargoNombre}</span>
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
                        onpick={(p) => handlePick(globalIdx, p)}
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
        <Button variant="outline" onclick={goBackToData}>
          <ArrowLeftIcon data-icon="inline-start" />
          Atrás
        </Button>
        <Button onclick={handleSaveAutoridades} disabled={store.busy}>Guardar autoridades</Button>
      </div>
    {/if}
    </Card.Content>
  </Card.Root>
{/if}
