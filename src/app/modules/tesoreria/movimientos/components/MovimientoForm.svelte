<script>
  import { monthKey } from '$core/utils/utils'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import Combobox from '$lib/components/Combobox.svelte'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import PersonaVinculadaField from './PersonaVinculadaField.svelte'
  import ComprobanteField from './ComprobanteField.svelte'

  let {
    store,
    filteredRubros = [],
    subrubrosByRubro = new Map(),
    cuentaById = new Map(),
    readonly = false,
  } = $props()

  // Alias reactivo para pasar a sub-componentes (PersonaVinculadaField,
  // ComprobanteField) que aceptan `disabled` como prop.
  let disabled = $derived(readonly)

  // Rango de fechas del ejercicio visto (para limitar el date picker).
  // Si no hay ejercicio visto o no tiene fechas calculadas, no se limita.
  let rangoFechas = $derived(store.rangoFechasEjercicioVisto?.() || null)
  let fechaMin = $derived(rangoFechas?.fechaMin || undefined)
  let fechaMax = $derived(rangoFechas?.fechaMax || undefined)

  // Warning si la fecha del movimiento cae fuera del rango del ejercicio visto.
  // Solo para movimientos nuevos (no edición de existentes que pueden tener
  // fechas legítimamente en otro ejercicio).
  let fechaFueraRango = $derived.by(() => {
    if (!rangoFechas || !store.form || store.form.id) return false
    const f = store.form.fecha
    if (!f) return false
    return f < rangoFechas.fechaMin || f > rangoFechas.fechaMax
  })

  let personaVinculadaValue = $derived(
    store.personasSeleccionables.tipo === 'socio'
      ? store.form?.socio_id ?? ''
      : store.form?.persona_id ?? '',
  )

  const onPersonaVinculadaChange = (/** @type {any} */ val) => {
    if (store.personasSeleccionables.tipo === 'socio') {
      store.form.socio_id = val
    } else {
      store.form.persona_id = val
    }
  }

  const handleSave = () => notifyAfter(store, store.saveMovimiento)
</script>

<Card.Root>
  <Card.Header>
    <div class="flex items-center justify-between gap-2">
      <Card.Title class="text-base">
        {#if readonly}
          Movimiento (ejercicio cerrado — solo lectura)
        {:else if store.form.id}
          Editar movimiento
        {:else}
          Nuevo movimiento
        {/if}
      </Card.Title>
      <div class="flex gap-2">
        {#if !store.form.id && !readonly}
          <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
        {/if}
        {#if !readonly}
          <Button onclick={handleSave}>Guardar</Button>
        {/if}
      </div>
    </div>
  </Card.Header>
  <Card.Content class="flex flex-col gap-4">
    <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
      <Field.Field>
        <Field.FieldLabel for="fecha">Fecha</Field.FieldLabel>
        <Input id="fecha" type="date" bind:value={store.form.fecha} {disabled} min={fechaMin} max={fechaMax} />
        {#if fechaFueraRango}
          <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
            La fecha está fuera del rango del ejercicio visto
            ({fechaMin} a {fechaMax}). El movimiento se guardará en el
            ejercicio que corresponda a esa fecha.
          </p>
        {/if}
      </Field.Field>
      <Field.Field>
        <Field.FieldLabel for="tipo-mov">Tipo</Field.FieldLabel>
        <Select.Root type="single" bind:value={store.form.tipo_movimiento} onchange={store.onTipoChange} {disabled}>
          <Select.Trigger id="tipo-mov" class="mt-1 w-full">
            <Select.Value placeholder="Elegir…" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="Entrada">Entrada</Select.Item>
            <Select.Item value="Salida">Salida</Select.Item>
            <Select.Item value="Traspaso">Traspaso</Select.Item>
          </Select.Content>
        </Select.Root>
      </Field.Field>
      <Field.Field class="sm:col-span-2">
        <Field.FieldLabel for="detalle">Detalle</Field.FieldLabel>
        <Textarea id="detalle" bind:value={store.form.detalle} {disabled} placeholder="Descripción corta (p.ej. Compra kiosco, Pago proveedor, Aporte socio)" />
      </Field.Field>
      <Field.Field>
        <Field.FieldLabel for="importe">Importe</Field.FieldLabel>
        <div class="relative mt-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
          <Input id="importe" type="number" step="0.01" min="0" bind:value={store.form.importe} {disabled} class="pl-7" placeholder="0,00" />
        </div>
      </Field.Field>
      <Field.Field>
        <Field.FieldLabel for="cuenta">Caja/cuenta</Field.FieldLabel>
        <Combobox
          bind:value={store.form.cuenta_id}
          items={store.cuentas.map((c) => ({ value: c.id, label: c.nombre_cuenta }))}
          placeholder="Elegir…"
          searchPlaceholder="Buscar cuenta…"
          class="mt-1"
          {disabled}
        />
      </Field.Field>

      {#if store.form.tipo_movimiento === 'Traspaso'}
        <Field.Field class="sm:col-span-2">
          <Field.FieldLabel for="cuenta-destino">Cuenta destino</Field.FieldLabel>
          <Combobox
            bind:value={store.form.cuenta_destino_id}
            items={store.cuentas.map((c) => ({ value: c.id, label: c.nombre_cuenta }))}
            placeholder="Elegir…"
            searchPlaceholder="Buscar cuenta…"
            class="mt-1"
            {disabled}
          />
        </Field.Field>
      {:else}
        <Field.Field>
          <Field.FieldLabel for="rubro">Rubro</Field.FieldLabel>
          <Combobox
            bind:value={store.form.rubro_id}
            items={filteredRubros.map((r) => ({ value: r.id, label: `${r.codigo_rubro} · ${r.nombre_oficial}` }))}
            placeholder="Elegir…"
            searchPlaceholder="Buscar rubro…"
            popoverWidth="100%"
            class="mt-1"
            onchange={store.onRubroChange}
            {disabled}
          />
        </Field.Field>
        {#if (subrubrosByRubro.get(Number(store.form.rubro_id)) || []).length > 0}
          <Field.Field>
            <Field.FieldLabel for="subrubro">Subrubro</Field.FieldLabel>
            <Select.Root
              type="single"
              value={store.form.subrubro_id ? String(store.form.subrubro_id) : undefined}
              onValueChange={(v) => { store.form.subrubro_id = v ? Number(v) : '' }}
              disabled={!store.form.rubro_id || readonly}
              allowDeselect={true}
            >
              <Select.Trigger id="subrubro" class="mt-1 w-full">
                <Select.Value placeholder="(Opcional)" />
              </Select.Trigger>
              <Select.Content>
                {#each (subrubrosByRubro.get(Number(store.form.rubro_id)) || []) as s (s.id)}
                  <Select.Item value={String(s.id)}>{s.nombre_subrubro}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>
        {/if}
      {/if}

      {#if String(cuentaById.get(Number(store.form.cuenta_id))?.nombre_cuenta || '') === 'Banco'}
        <Field.Field class="sm:col-span-2">
          <Field.FieldLabel for="destino-banco">Destino en banco</Field.FieldLabel>
          <Select.Root type="single" bind:value={store.form.destino_bancario} allowDeselect={true} {disabled}>
            <Select.Trigger id="destino-banco" class="mt-1 w-full">
              <Select.Value placeholder="(Opcional)" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="CuentaCorriente">Cuenta corriente</Select.Item>
              <Select.Item value="PlazoFijo">Plazo fijo</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field.Field>
      {/if}

      <PersonaVinculadaField
        personasSeleccionables={store.personasSeleccionables}
        categoriasDisponibles={store.categoriasDisponibles}
        filtroCategoria={store.filtroCategoria}
        onSetFiltroCategoria={store.setFiltroCategoria}
        value={personaVinculadaValue}
        onchange={onPersonaVinculadaChange}
        {disabled}
      />

      <Field.Field class="sm:col-span-2">
        <Field.FieldLabel for="comprobante">Comprobante</Field.FieldLabel>
        <ComprobanteField
          attachmentIds={store.form.comprobante || []}
          onchange={(ids) => { store.form.comprobante = ids }}
          {disabled}
        />
        <Field.FieldDescription>Factura, recibo o ticket del movimiento (opcional).</Field.FieldDescription>
      </Field.Field>
    </Field.FieldGroup>

    <Field.FieldDescription>
      Se registra en el período <span class="font-mono">{monthKey(store.form.fecha)}</span> del ejercicio en curso.
    </Field.FieldDescription>
  </Card.Content>
</Card.Root>
