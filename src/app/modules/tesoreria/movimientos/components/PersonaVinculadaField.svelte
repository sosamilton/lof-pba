<script>
  import * as Field from '$lib/components/ui/field'
  import Combobox from '$lib/components/Combobox.svelte'
  import { formatARS } from '$core/utils/utils'
  import { formatFecha } from '$core/format/format'

  // Campo de persona/socio vinculado a un movimiento, con filtro de categoría.
  let {
    personasSeleccionables,
    categoriasDisponibles = [],
    filtroCategoria = '',
    onSetFiltroCategoria = () => {},
    value = '',
    onchange = () => {},
    // Último pago de cuota societaria del socio seleccionado (solo lectura,
    // informativo — no se guarda en el movimiento ni se exporta).
    ultimoPago = null,
    ultimoPagoLoading = false,
    disabled = false,
  } = $props()
</script>

{#if personasSeleccionables.tipo !== 'none' && (personasSeleccionables.items.length > 0 || personasSeleccionables.filtroCategoria)}
  <Field.Field class="sm:col-span-2">
    <Field.FieldLabel for="persona-vinculada">{personasSeleccionables.label} (opcional)</Field.FieldLabel>

    {#if personasSeleccionables.filtroCategoria && categoriasDisponibles.length > 0}
      <div class="mb-2 flex flex-wrap items-center gap-1.5">
        <span class="text-xs text-muted-foreground">Categoría:</span>
        <button
          type="button"
          class="rounded-full border px-2.5 py-0.5 text-xs transition-colors {!filtroCategoria ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
          onclick={() => onSetFiltroCategoria('')}
        >Todas</button>
        {#each categoriasDisponibles as cat}
          <button
            type="button"
            class="rounded-full border px-2.5 py-0.5 text-xs transition-colors {filtroCategoria === cat ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
            onclick={() => onSetFiltroCategoria(filtroCategoria === cat ? '' : cat)}
          >{cat}</button>
        {/each}
      </div>
    {/if}

    {#if personasSeleccionables.items.length > 0}
      <Combobox
        {value}
        {onchange}
        items={personasSeleccionables.items}
        placeholder="(Ninguno)"
        searchPlaceholder="Buscar persona…"
        class="mt-1"
        {disabled}
      />
      {#if personasSeleccionables.tipo === 'socio'}
        <Field.FieldDescription>Solo se muestran socios activos (pago societario).</Field.FieldDescription>
        {#if value}
          {#if ultimoPagoLoading}
            <p class="mt-1 text-xs text-muted-foreground">Buscando último pago…</p>
          {:else if ultimoPago}
            <p class="mt-1 text-xs text-muted-foreground">
              Último pago de cuota: {formatARS(ultimoPago.importe)} el {formatFecha(ultimoPago.fecha)}
            </p>
          {:else}
            <p class="mt-1 text-xs text-muted-foreground">Sin pagos de cuota registrados para este socio.</p>
          {/if}
        {/if}
      {:else}
        <Field.FieldDescription>
          Se muestran todas las personas con su tipo y categoría. Usá el filtro para acotar.
        </Field.FieldDescription>
      {/if}
    {:else}
      <Field.FieldDescription>
        No hay personas {filtroCategoria ? `con categoría "${filtroCategoria}"` : 'cargadas'}. Registrá una persona en el módulo Personas.
      </Field.FieldDescription>
    {/if}
  </Field.Field>
{/if}
