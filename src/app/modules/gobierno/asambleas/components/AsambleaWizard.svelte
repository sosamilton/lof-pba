<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Badge } from '$lib/components/ui/badge'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import { Separator } from '$lib/components/ui/separator'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import { createAsambleaWizardComputed } from '../asambleaWizardComputed.svelte.js'
  import WizardStepAutoridades from './WizardStepAutoridades.svelte'
  import WizardStepRevisar from './WizardStepRevisar.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import XIcon from '@lucide/svelte/icons/x'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckIcon from '@lucide/svelte/icons/check'

  let { store, wizardOpen = $bindable(false), askDelete = () => {} } = $props()

  let wizardStep = $state(1)
  // Acordeón de personalización de cargos (colapsado por defecto).
  // El default (preselección por grupo a vencer o carga total) resuelve la
  // mayoría de los casos; el usuario lo expande solo si quiere ajustar.
  let cargosAccordion = $state([])

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

  const CONVOCATORIA_ORIGEN_LABEL = (val) =>
    CONVOCATORIA_ORIGEN.find((o) => o.value === val)?.label || val || ''

  const handleNextFromData = async () => {
    const id = await store.saveAsamblea({ keepForm: true })
    if (!id) return

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
      const ok = await store.saveAutoridadesFromAsamblea()
      if (ok === false) return
      // Ir al paso 3: revisar y confirmar
      wizardStep = 3
    })
  }

  const handleGuardarSinVerificar = () => {
    notifyAfter(store, async () => {
      await store.saveAsamblea()
      wizardOpen = false
    })
  }

  const handleGuardarYVerificar = () => {
    notifyAfter(store, async () => {
      const id = await store.verificarAsamblea()
      if (id) wizardOpen = false
    })
  }

  const close = () => {
    wizardOpen = false
    wizardStep = 1
    store.closeCargarAutoridades()
  }

  const goBackToData = () => {
    wizardStep = 1
    store.closeCargarAutoridades()
  }

  // Valores derivados de negocio extraídos al módulo computed.
  // Se usa $derived para que Svelte 5 no warning sobre "captura del valor
  // inicial" — el objeto store no cambia de referencia, pero sus
  // propiedades sí son reactivas y se acceden dentro de $derived en el módulo.
  const computed = $derived(createAsambleaWizardComputed(store))

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
    if (wizardStep === 1) return `Paso 1: Datos de la ${computed.isRcd ? 'reunión' : 'asamblea'}`
    if (computed.isRcd) return 'Paso 2: Resoluciones'
    if (wizardStep === 3) return 'Paso 3: Revisar y confirmar'
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
              {#if computed.isRcd}
                Editar Reunión de CD
              {:else if computed.isAge}
                Editar Asamblea Extraordinaria
              {:else}
                Editar Asamblea Ordinaria
              {/if}
            {:else if computed.isRcd}
              Nueva Reunión de CD
            {:else if computed.isAge}
              Nueva Asamblea Extraordinaria
            {:else}
              Nueva Asamblea Ordinaria
            {/if}
            {#if computed.isVerificada}
              <Badge variant="secondary" class="ml-2 align-middle">
                <CheckIcon class="size-3" data-icon="inline-start" />
                Verificada
              </Badge>
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
            <Input id="wiz-fecha" type="date" bind:value={store.asambleaForm.fecha} disabled={computed.isVerificada} />
            {#if computed.agoFueraDeTermino}
              <Field.FieldDescription class="text-amber-600 dark:text-amber-500">
                <AlertTriangleIcon class="inline size-3 align-text-bottom" />
                {#if computed.esEjercicioNormativo}
                  El art. 10 del Decreto 4767/72 prevé la Asamblea Ordinaria para la segunda quincena de {computed.mesEsperadoAgoNombre.toLowerCase()}. La fecha ingresada está fuera de ese período.
                {:else}
                  Según el cierre del ejercicio, la Asamblea Ordinaria debería realizarse en la segunda quincena de {computed.mesEsperadoAgoNombre.toLowerCase()}. La fecha ingresada está fuera de ese período.
                {/if}
              </Field.FieldDescription>
            {/if}
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="wiz-acta">Acta N°</Field.FieldLabel>
            <Input id="wiz-acta" bind:value={store.asambleaForm.acta_numero} disabled={computed.isVerificada} />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="wiz-fojas">Fojas</Field.FieldLabel>
            <Input id="wiz-fojas" bind:value={store.asambleaForm.acta_fojas} disabled={computed.isVerificada} />
          </Field.Field>

          {#if computed.isAge}
            <Field.Field>
              <Field.FieldLabel for="wiz-motivo">Motivo de convocatoria</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.motivo_convocatoria} disabled={computed.isVerificada}>
                <Select.Trigger id="wiz-motivo" class="w-full">
                  <Select.Value placeholder="Elegir…" />
                </Select.Trigger>
                <Select.Content>
                  {#each MOTIVOS_CONVOCATORIA as m}
                    <Select.Item value={m}>{m}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              {#if store.asambleaForm?.motivo_convocatoria === 'Reforma estatuto'}
                <Field.FieldDescription>
                  <AlertTriangleIcon class="inline size-3 align-text-bottom" />
                  Al guardar esta asamblea se <strong>desbloqueará</strong> la edición de los cargos del estatuto en Institucional para que puedas aplicar los cambios aprobados. Volvé a verificarlos allí cuando termines.
                </Field.FieldDescription>
              {/if}
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-origen">Origen de convocatoria</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.convocatoria_origen} disabled={computed.isVerificada}>
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

          {#if computed.isAgo}
            <Field.Field>
              <Field.FieldLabel for="wiz-presentes">Socios presentes</Field.FieldLabel>
              <Input id="wiz-presentes" type="number" bind:value={store.asambleaForm.socios_presentes_cantidad} disabled={computed.isVerificada} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-cuota">Cuota social ($)</Field.FieldLabel>
              <Input id="wiz-cuota" type="number" bind:value={store.asambleaForm.cuota_social_importe} disabled={computed.isVerificada} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="wiz-modalidad">Cuota modalidad</Field.FieldLabel>
              <Select.Root type="single" bind:value={store.asambleaForm.cuota_social_modalidad} disabled={computed.isVerificada}>
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
              <Input id="wiz-caja" type="number" bind:value={store.asambleaForm.caja_chica_importe} disabled={computed.isVerificada} />
            </Field.Field>
          {/if}
        </Field.FieldGroup>

        {#if computed.isAge}
          <Field.Field>
            <Field.FieldLabel for="wiz-orden">Orden del día</Field.FieldLabel>
            <Textarea id="wiz-orden" bind:value={store.asambleaForm.orden_del_dia} placeholder="Temas a tratar en la asamblea…" disabled={computed.isVerificada} />
          </Field.Field>
        {/if}

        {#if computed.isRcd}
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
        <Button variant="outline" onclick={close}>{computed.isVerificada ? 'Cerrar' : 'Cancelar'}</Button>
        {#if computed.isVerificada}
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckIcon class="size-3.5" />
              Asamblea verificada — solo lectura
            </div>
            {#if !computed.isRcd}
              <Button variant="outline" size="sm" onclick={() => { wizardStep = 3 }}>
                Ver autoridades
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            {/if}
          </div>
        {:else}
          <div class="flex gap-2">
            {#if store.asambleaForm.id}
              <Button variant="destructive" size="sm" onclick={askDelete} disabled={store.busy}>
                <TrashIcon data-icon="inline-start" />
                Eliminar
              </Button>
            {/if}
            {#if computed.isRcd}
              <Button onclick={handleNextFromData} disabled={store.busy}>Guardar</Button>
            {:else}
              <Button onclick={handleNextFromData} disabled={store.busy}>
                Guardar y seguir
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {:else if wizardStep === 2 && computed.isRcd}
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
    {:else if wizardStep === 2 && !computed.isRcd && store.cargarDraft}
      <WizardStepAutoridades
        {store}
        {computed}
        bind:cargosAccordion
        {cargoInputRefs}
        {ORGANISMO_LABELS}
        onBack={goBackToData}
        onSave={handleSaveAutoridades}
        onPick={handlePick}
      />
    {:else if wizardStep === 3 && !computed.isRcd}
      <WizardStepRevisar
        {store}
        {computed}
        {ORGANISMO_LABELS}
        {CONVOCATORIA_ORIGEN_LABEL}
        onBackToData={() => { wizardStep = 1 }}
        onBackToAutoridades={() => { wizardStep = 2; store.openCargarAutoridades(store.asambleaForm.id, { inlineMode: true }) }}
        onGuardarSinVerificar={handleGuardarSinVerificar}
        onGuardarYVerificar={handleGuardarYVerificar}
        onClose={close}
      />
    {/if}
    </Card.Content>
  </Card.Root>
{/if}
