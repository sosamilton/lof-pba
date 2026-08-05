<script>
  import { onMount } from 'svelte'
  import { personasStore as store } from './personasStore.svelte'
  import { normalize, CATEGORIAS_VINCULO } from '$core/utils'
  import { filterBySearch } from '$core/useListFilter.svelte.js'
  import { personaLabel, buildPrefill, localidadesItems } from '$core/personas'
  import { notifyAfter } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import { Input } from '$lib/components/ui/input'
  import Combobox from '$lib/components/Combobox.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import BuildingIcon from '@lucide/svelte/icons/building-2'
  import FilterBar from './parts/FilterBar.svelte'
  import RecordList from './parts/RecordList.svelte'
  import PersonaFormFields from './parts/PersonaFormFields.svelte'
  import EmptyStates from './parts/EmptyStates.svelte'

  let q = $state('')
  let tipoFilter = $state('')
  let categoriaFilter = $state('')

  const isJuridica = (/** @type {any} */ p) => p.tipo_persona === 'Juridica'

  let filtered = $derived(
    filterBySearch(
      store.records
        .filter((/** @type {any} */ p) => (tipoFilter ? (p.tipo_persona || 'Fisica') === tipoFilter : true))
        .filter((/** @type {any} */ p) => (categoriaFilter ? (p.categoria || '') === categoriaFilter : true)),
      q,
      (/** @type {any} */ p) => [p.dni, p.cuil, p.apellido, p.nombre, p.razon_social, p.email, p.telefono, p.localidad],
    ).sort((/** @type {any} */ a, /** @type {any} */ b) => normalize(personaLabel(a)).localeCompare(normalize(personaLabel(b)))),
  )

  const handleSave = () => notifyAfter(store, store.savePersona)

  onMount(() => {
    const unsub = store.subscribe()
    store.load()
    return unsub
  })

  const tipoFilterConfig = {
    key: 'tipo',
    value: tipoFilter,
    allowDeselect: true,
    triggerClass: 'w-[140px]',
    ariaLabel: 'Filtrar por tipo de persona',
    placeholder: 'Todos los tipos',
    options: [
      { value: 'Fisica', label: 'Física' },
      { value: 'Juridica', label: 'Jurídica' },
    ],
    onValueChange: (v) => (tipoFilter = v),
  }

  const categoriaFilterConfig = {
    key: 'categoria',
    value: categoriaFilter,
    allowDeselect: true,
    triggerClass: 'w-[160px]',
    ariaLabel: 'Filtrar por categoría / vínculo',
    placeholder: 'Categoría / vínculo',
    options: CATEGORIAS_VINCULO.map((cat) => ({ value: cat, label: cat })),
    onValueChange: (v) => (categoriaFilter = v),
  }
</script>

<PageScaffold title="Personas" loading={store.loading} error={store.error} notice={store.notice}>
  <FilterBar
    bind:q
    count={filtered.length}
    countLabel="personas"
    searchPlaceholder="Buscar (nombre, DNI, razón social…)"
    searchAriaLabel="Buscar personas"
    newLabel="Nueva persona"
    onNew={() => store.nuevo(buildPrefill(q))}
    filters={[tipoFilterConfig, categoriaFilterConfig]}
  >
    {#snippet newIcon()}
      <UserPlusIcon data-icon="inline-start" />
    {/snippet}
  </FilterBar>

  <div class="grid gap-4 items-start" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    <div class="relative min-h-0 self-stretch min-h-[75vh]">
      <RecordList
        items={filtered}
        selectedId={store.form?.id}
        onSelect={(p) => store.select(p)}
        itemLabel={(p) => isJuridica(p) ? (p.razon_social || '(sin razón social)') : `${p.apellido}, ${p.nombre}`}
        itemSub={(p) => isJuridica(p) ? `CUIT ${p.cuil || '-'}` : `DNI ${p.dni || '-'} · ${p.localidad || ''}`}
        itemBadges={(p) => isJuridica(p)
          ? [{ text: 'Jurídica', variant: 'secondary' }]
          : [{ text: 'Física', variant: 'secondary' }]}
      />
    </div>

    <div>
      {#if store.form}
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">
              {store.form.id ? 'Editar persona' : 'Nueva persona'}
            </Card.Title>
          </Card.Header>
          <Card.Content class="flex flex-col gap-4">
            <!-- Toolbar -->
            <div class="flex flex-wrap justify-end gap-2">
              {#if !store.form.id}
                <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
              {/if}
            </div>

            <Separator />

            <!-- Form -->
            <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
              <Field.Field class="sm:col-span-2">
                <Field.FieldLabel for="tipo_persona">Tipo de persona</Field.FieldLabel>
                <Select.Root type="single" bind:value={store.form.tipo_persona}>
                  <Select.Trigger id="tipo_persona" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="Fisica">Física</Select.Item>
                    <Select.Item value="Juridica">Jurídica</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field.Field>

              <Field.Field class="sm:col-span-2">
                <Field.FieldLabel for="categoria">Categoría / vínculo</Field.FieldLabel>
                <Select.Root type="single" bind:value={store.form.categoria} allowDeselect={true}>
                  <Select.Trigger id="categoria" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    {#each CATEGORIAS_VINCULO as cat}
                      <Select.Item value={cat}>{cat}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </Field.Field>

              {#if store.form.tipo_persona === 'Juridica'}
                <Field.Field class="sm:col-span-2">
                  <Field.FieldLabel for="razon_social">Razón social</Field.FieldLabel>
                  <Input id="razon_social" bind:value={store.form.razon_social} />
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.cuilWarning)}>
                  <Field.FieldLabel for="cuil">CUIT</Field.FieldLabel>
                  <Input id="cuil" bind:value={store.form.cuil} oninput={store.onCuilInput} aria-invalid={Boolean(store.cuilWarning)} placeholder="20-12345678-9" />
                  {#if store.cuilWarning}<Field.FieldError>{store.cuilWarning}</Field.FieldError>{/if}
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="domicilio">Domicilio</Field.FieldLabel>
                  <Input id="domicilio" bind:value={store.form.domicilio} />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="localidad">Localidad</Field.FieldLabel>
                  <Combobox
                    bind:value={store.form.localidad}
                    items={localidadesItems}
                    placeholder="Elegir localidad…"
                    searchPlaceholder="Buscar localidad de PBA…"
                  />
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.telefonoWarning)}>
                  <Field.FieldLabel for="telefono">Teléfono</Field.FieldLabel>
                  <Input id="telefono" bind:value={store.form.telefono} oninput={store.onTelefonoInput} aria-invalid={Boolean(store.telefonoWarning)} placeholder="+54 9 11 1234-5678" inputmode="tel" />
                  {#if store.telefonoWarning}<Field.FieldError>{store.telefonoWarning}</Field.FieldError>{/if}
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.emailWarning)}>
                  <Field.FieldLabel for="email">Email</Field.FieldLabel>
                  <Input id="email" type="email" bind:value={store.form.email} oninput={store.onEmailInput} aria-invalid={Boolean(store.emailWarning)} placeholder="nombre@ejemplo.com" inputmode="email" />
                  {#if store.emailWarning}<Field.FieldError>{store.emailWarning}</Field.FieldError>{/if}
                </Field.Field>
              {:else}
                <PersonaFormFields
                  form={store.form}
                  dniWarning={store.dniWarning}
                  cuilWarning={store.cuilWarning}
                  telefonoWarning={store.telefonoWarning}
                  emailWarning={store.emailWarning}
                  onDniInput={store.onDniInput}
                  onCuilInput={store.onCuilInput}
                  onTelefonoInput={store.onTelefonoInput}
                  onEmailInput={store.onEmailInput}
                />
              {/if}
            </Field.FieldGroup>

            <div class="flex gap-2">
              <Button onclick={handleSave}>Guardar</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {:else}
        <EmptyStates
          filteredCount={filtered.length}
          hasQuery={Boolean(q.trim())}
          entityLabel="persona"
          entityArticle="una"
          onNew={() => store.nuevo()}
          onNewFromQuery={() => store.nuevo(buildPrefill(q))}
          selectPrompt="Seleccioná una persona o creá una nueva."
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyStates>
      {/if}
    </div>
  </div>

</PageScaffold>
