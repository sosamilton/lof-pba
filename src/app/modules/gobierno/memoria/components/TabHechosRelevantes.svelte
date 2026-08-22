<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Field from '$lib/components/ui/field'
  import * as Select from '$lib/components/ui/select'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import { dateToInput } from '$core/utils/utils.js'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import SaveIcon from '@lucide/svelte/icons/save'
  import CloseIcon from '@lucide/svelte/icons/x'
  import InfoIcon from '@lucide/svelte/icons/info'

  let { store } = $props()

  const CATEGORIAS_LABEL = {
    'Evento': 'Evento',
    'Infraestructura': 'Infraestructura',
    'Equipamiento': 'Equipamiento',
    'Beneficios': 'Beneficios',
    'Actividades': 'Actividades',
    'Proyecto educativo': 'Proyecto educativo',
    'Otro': 'Otro',
  }

  const handleSaveHecho = () => {
    notifyAfter(store, () => store.saveHecho())
  }

  const handleDeleteHecho = (id) => {
    notifyAfter(store, () => store.deleteHecho(id))
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Info -->
  <div class="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
    <InfoIcon class="size-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
    <p class="text-xs text-muted-foreground">
      Registrá los hechos relevantes del ejercicio (eventos, obras, equipamiento, beneficios, actividades).
      Estos hechos se compilan automáticamente en la <strong>Memoria anual</strong>, que se genera y exporta
      desde el módulo <strong>Cierre de Ciclo</strong>.
    </p>
  </div>

  <!-- Header + botón -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-base font-bold">Hechos relevantes del ejercicio</h2>
      <p class="text-xs text-muted-foreground">
        {#if store.ejercicioSeleccionado}
          {@const ej = store.ejercicios.find((e) => e.id === store.ejercicioSeleccionado)}
          Ejercicio {ej?.anio_inicio || '?'}-{ej?.anio_fin || '?'}
        {/if}
      </p>
    </div>
    <Button variant="outline" size="sm" onclick={() => store.newHecho()}>
      <PlusIcon data-icon="inline-start" />
      Nuevo hecho
    </Button>
  </div>

  <!-- Formulario de hecho (nuevo o editando) -->
  {#if store.hechoForm}
    <div class="rounded-lg border border-border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm font-semibold">
          {store.hechoEditingId ? 'Editar hecho' : 'Nuevo hecho'}
        </span>
        <Button variant="ghost" size="sm" onclick={() => store.closeHechoForm()} aria-label="Cerrar">
          <CloseIcon class="size-4" />
        </Button>
      </div>
      <div class="flex flex-col gap-3">
        <Field.FieldGroup class="grid gap-3 sm:grid-cols-2">
          <Field.Field>
            <Field.FieldLabel for="hecho-fecha" class="text-xs">Fecha</Field.FieldLabel>
            <Input id="hecho-fecha" type="date" bind:value={store.hechoForm.fecha} class="h-8 text-sm" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="hecho-categoria" class="text-xs">Categoría</Field.FieldLabel>
            <Select.Root type="single" bind:value={store.hechoForm.categoria}>
              <Select.Trigger id="hecho-categoria" class="h-8 text-sm">
                <Select.Value placeholder="Elegir…" />
              </Select.Trigger>
              <Select.Content>
                {#each store.hechoCategorias as cat}
                  <Select.Item value={cat}>{CATEGORIAS_LABEL[cat] || cat}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>
        </Field.FieldGroup>
        <Field.Field>
          <Field.FieldLabel for="hecho-desc" class="text-xs">Descripción</Field.FieldLabel>
          <Textarea id="hecho-desc" bind:value={store.hechoForm.descripcion} placeholder="Describí el hecho relevante…" class="text-sm" rows="2" />
        </Field.Field>
        <Field.FieldGroup class="grid gap-3 sm:grid-cols-2">
          <Field.Field>
            <Field.FieldLabel for="hecho-monto" class="text-xs">Monto (opcional)</Field.FieldLabel>
            <Input id="hecho-monto" type="number" bind:value={store.hechoForm.monto} class="h-8 text-sm" placeholder="$0" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="hecho-doc" class="text-xs">Referencia documento (opcional)</Field.FieldLabel>
            <Input id="hecho-doc" bind:value={store.hechoForm.documento_ref} class="h-8 text-sm" placeholder="Factura, acta, etc." />
          </Field.Field>
        </Field.FieldGroup>
        <div class="flex gap-2">
          <Button size="sm" onclick={handleSaveHecho} disabled={store.busy}>
            <SaveIcon data-icon="inline-start" />
            {store.hechoEditingId ? 'Actualizar' : 'Guardar'}
          </Button>
          <Button variant="outline" size="sm" onclick={() => store.closeHechoForm()}>Cancelar</Button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Lista de hechos -->
  {#if store.hechosRelevantes.length === 0 && !store.hechoForm}
    <EmptyState
      title="No hay hechos registrados"
      sub="Cargá los hechos relevantes del ejercicio. Se van a compilar automáticamente en la Memoria anual."
      actionLabel="+ Nuevo hecho"
      onaction={() => store.newHecho()}
    >
      {#snippet actionIcon()}
        <PlusIcon data-icon="inline-start" />
      {/snippet}
    </EmptyState>
  {:else if store.hechosRelevantes.length > 0}
    <div class="flex flex-col gap-2">
      {#each store.hechosRelevantes as h (h.id)}
        <div class="flex items-start gap-3 rounded-lg border border-border p-3">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <Badge variant="outline" class="text-[10px]">{CATEGORIAS_LABEL[h.categoria] || h.categoria || 'Otro'}</Badge>
              <span class="text-xs text-muted-foreground">{dateToInput(h.fecha) || '(sin fecha)'}</span>
              {#if h.monto != null && h.monto !== ''}
                <span class="text-xs font-medium">${Number(h.monto).toLocaleString('es-AR')}</span>
              {/if}
            </div>
            <p class="mt-1 text-sm">{h.descripcion || '(sin descripción)'}</p>
            {#if h.documento_ref}
              <p class="mt-0.5 text-xs text-muted-foreground">Ref: {h.documento_ref}</p>
            {/if}
          </div>
          <div class="flex gap-1">
            <Button variant="ghost" size="sm" class="size-7 p-0" onclick={() => store.editHecho(h)} aria-label="Editar">
              <PencilIcon class="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" class="size-7 p-0 text-destructive" onclick={() => handleDeleteHecho(h.id)} aria-label="Eliminar">
              <TrashIcon class="size-3.5" />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
