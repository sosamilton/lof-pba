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

  let {
    store,
    filteredRubros = [],
    subrubrosByRubro = new Map(),
    cuentaById = new Map(),
  } = $props()

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
        {store.form.id ? 'Editar movimiento' : 'Nuevo movimiento'}
      </Card.Title>
      <div class="flex gap-2">
        {#if !store.form.id}
          <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
        {/if}
        <Button onclick={handleSave}>Guardar</Button>
      </div>
    </div>
  </Card.Header>
  <Card.Content class="flex flex-col gap-4">
    <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
      <Field.Field>
        <Field.FieldLabel for="fecha">Fecha</Field.FieldLabel>
        <Input id="fecha" type="date" bind:value={store.form.fecha} />
      </Field.Field>
      <Field.Field>
        <Field.FieldLabel for="tipo-mov">Tipo</Field.FieldLabel>
        <Select.Root type="single" bind:value={store.form.tipo_movimiento} onchange={store.onTipoChange}>
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
        <Textarea id="detalle" bind:value={store.form.detalle} placeholder="Descripción corta (p.ej. Compra kiosco, Pago proveedor, Aporte socio)" />
      </Field.Field>
      <Field.Field>
        <Field.FieldLabel for="importe">Importe</Field.FieldLabel>
        <div class="relative mt-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
          <Input id="importe" type="number" step="0.01" min="0" bind:value={store.form.importe} class="pl-7" placeholder="0,00" />
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
          />
        </Field.Field>
        {#if (subrubrosByRubro.get(Number(store.form.rubro_id)) || []).length > 0}
          <Field.Field>
            <Field.FieldLabel for="subrubro">Subrubro</Field.FieldLabel>
            <Select.Root
              type="single"
              value={store.form.subrubro_id ? String(store.form.subrubro_id) : undefined}
              onValueChange={(v) => { store.form.subrubro_id = v ? Number(v) : '' }}
              disabled={!store.form.rubro_id}
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
          <Select.Root type="single" bind:value={store.form.destino_bancario} allowDeselect={true}>
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
      />
    </Field.FieldGroup>

    <Field.FieldDescription>
      Se registra en el período <span class="font-mono">{monthKey(store.form.fecha)}</span> del ejercicio en curso.
    </Field.FieldDescription>
  </Card.Content>
</Card.Root>
