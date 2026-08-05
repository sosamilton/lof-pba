<script>
  import { onMount } from 'svelte'
  import { sociosStore as store } from './sociosStore.svelte'
  import { TIPOS_SOCIO, MOTIVOS_BAJA, daysSince } from '$core/utils'
  import { filterBySearch, sortByFields } from '$core/useListFilter.svelte.js'
  import { buildPrefill } from '$core/personas'
  import { notifyAfter } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import * as Alert from '$lib/components/ui/alert'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import LinkIcon from '@lucide/svelte/icons/link'
  import FilterBar from './parts/FilterBar.svelte'
  import RecordList from './parts/RecordList.svelte'
  import PersonaFormFields from './parts/PersonaFormFields.svelte'
  import EmptyStates from './parts/EmptyStates.svelte'

  let q = $state('')
  let estado = $state('activos')
  let tipo = $state('')

  const isActivo = (/** @type {any} */ s) => !s.fecha_baja

  let filtered = $derived(
    sortByFields(
      filterBySearch(
        store.records
          .filter((/** @type {any} */ s) => {
            if (estado === 'activos') return isActivo(s)
            if (estado === 'bajas') return !isActivo(s)
            return true
          })
          .filter((/** @type {any} */ s) => (tipo ? String(s.tipo_socio || '') === tipo : true)),
        q,
        (/** @type {any} */ s) => [s.apellido, s.nombre, s.dni, s.cuil, s.email, s.telefono, s.localidad, s.domicilio],
      ),
      (/** @type {any} */ s) => [s.apellido, s.nombre],
    ),
  )

  const handleSave = () => notifyAfter(store, store.saveSocio)

  onMount(() => {
    const unsub = store.subscribe()
    store.load()
    return unsub
  })

  const estadoFilter = {
    key: 'estado',
    value: estado,
    allowDeselect: false,
    triggerClass: 'w-[120px]',
    ariaLabel: 'Filtrar por estado',
    placeholder: 'Estado',
    options: [
      { value: 'activos', label: 'Activos' },
      { value: 'bajas', label: 'Bajas' },
      { value: 'todos', label: 'Todos' },
    ],
    onValueChange: (v) => (estado = v),
  }

  const tipoFilter = {
    key: 'tipo',
    value: tipo,
    allowDeselect: true,
    triggerClass: 'w-[160px]',
    ariaLabel: 'Filtrar por tipo de socio',
    placeholder: 'Todos los tipos',
    options: TIPOS_SOCIO.map((t) => ({ value: t, label: t })),
    onValueChange: (v) => (tipo = v),
  }
</script>

<PageScaffold title="Socios" loading={store.loading} error={store.error} notice={store.notice}>
  <FilterBar
    bind:q
    count={filtered.length}
    countLabel="socios"
    searchPlaceholder="Buscar (apellido, nombre, DNI…)"
    searchAriaLabel="Buscar socios"
    newLabel="Nuevo socio"
    onNew={() => store.nuevo(buildPrefill(q))}
    onReload={store.load}
    showReload
    filters={[estadoFilter, tipoFilter]}
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
        onSelect={(s) => store.select(s)}
        itemLabel={(s) => `${s.apellido}, ${s.nombre}`}
        itemSub={(s) => `DNI ${s.dni || '-'} · ${s.localidad || ''}`}
        itemBadges={(s) => {
          const badges = []
          badges.push(isActivo(s) ? { text: 'Activo', variant: 'secondary' } : { text: 'Baja', variant: 'outline' })
          if (s.tipo_socio && s.tipo_socio !== 'Activo') badges.push({ text: 'Sin voto', variant: 'outline' })
          return badges
        }}
      />
    </div>

    <div>
      {#if store.form}
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">
              {store.form.id ? 'Editar socio' : 'Nuevo socio'}
            </Card.Title>
          </Card.Header>
          <Card.Content class="flex flex-col gap-4">
            {#if store.linkedPersona}
              <div class="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                <LinkIcon class="size-3.5 text-primary" />
                <span class="text-sm font-medium">Persona vinculada: {store.linkedPersona.apellido || ''}, {store.linkedPersona.nombre || ''}</span>
              </div>
            {/if}

            <!-- Toolbar -->
            <div class="flex flex-wrap justify-end gap-2">
              {#if store.form.id}
                {#if store.form.fecha_baja}
                  <Button variant="outline" size="sm" onclick={store.reactivar}>Reactivar socio</Button>
                {/if}
                <Button variant="outline" size="sm" onclick={store.toggleBaja}>
                  {store.showBaja ? 'Ocultar baja' : 'Dar de baja'}
                </Button>
              {:else}
                <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
              {/if}
            </div>

            <Separator />

            <!-- Form -->
            <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
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
                fechaNacimientoWarning={store.edadWarning}
                onFechaNacimientoInput={store.onFechaNacimientoInput}
              />
              <Field.Field>
                <Field.FieldLabel for="tipo">Tipo</Field.FieldLabel>
                <Select.Root type="single" bind:value={store.form.tipo_socio}>
                  <Select.Trigger id="tipo" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    {#each TIPOS_SOCIO as t}
                      <Select.Item value={t}>{t}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="fecha-alta">Fecha alta</Field.FieldLabel>
                <Input id="fecha-alta" type="date" bind:value={store.form.fecha_alta} />
              </Field.Field>
              {#if store.form.id && store.form.fecha_baja && !store.showBaja}
                <Field.Field class="sm:col-span-2">
                  <Alert.Root variant="destructive">
                    <Alert.Title>Socio dado de baja</Alert.Title>
                    <Alert.Description>
                      Fecha de baja: {store.form.fecha_baja}{#if store.form.motivo_baja} · Motivo: {store.form.motivo_baja === 'CambioEscuela' ? 'Cambio de escuela' : store.form.motivo_baja}{/if}
                      <br />
                      <Button variant="outline" size="sm" class="mt-2" onclick={store.toggleBaja}>Editar baja</Button>
                      <Button variant="outline" size="sm" class="mt-2 ml-2" onclick={store.reactivar}>Reactivar socio</Button>
                    </Alert.Description>
                  </Alert.Root>
                </Field.Field>
              {/if}
            </Field.FieldGroup>

            {#if store.form.id && store.form.tipo_socio === 'Activo' && !store.form.fecha_baja}
              {#if (daysSince(store.form.fecha_alta) ?? 0) < 30}
                <Alert.Root>
                  <Alert.Title>Antigüedad insuficiente para votar</Alert.Title>
                  <Alert.Description>
                    Faltan {30 - (daysSince(store.form.fecha_alta) ?? 0)} días para alcanzar los 30 días mínimos.
                  </Alert.Description>
                </Alert.Root>
              {:else}
                <Alert.Root>
                  <Alert.Title>Habilitado electoralmente</Alert.Title>
                  <Alert.Description>
                    Socio activo con antigüedad ≥ 30 días.
                  </Alert.Description>
                </Alert.Root>
              {/if}
            {/if}

            {#if store.form.id && store.showBaja}
              <Alert.Root variant="destructive">
                <Alert.Title>Dar de baja al socio</Alert.Title>
                <Alert.Description>
                  Completá los datos de la baja. Al guardar, el socio pasará a estado inactivo.
                </Alert.Description>
              </Alert.Root>
              <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
                <Field.Field>
                  <Field.FieldLabel for="fecha-baja">Fecha de baja</Field.FieldLabel>
                  <Input id="fecha-baja" type="date" bind:value={store.form.fecha_baja} />
                </Field.Field>
                <Field.Field data-disabled={!store.form.fecha_baja}>
                  <Field.FieldLabel for="motivo-baja">Motivo de baja</Field.FieldLabel>
                  <Select.Root type="single" bind:value={store.form.motivo_baja} allowDeselect={true}>
                    <Select.Trigger id="motivo-baja" class="mt-1 w-full" disabled={!store.form.fecha_baja}>
                      <Select.Value placeholder="Elegir motivo…" />
                    </Select.Trigger>
                    <Select.Content>
                      {#each MOTIVOS_BAJA as m}
                        <Select.Item value={m}>{m === 'CambioEscuela' ? 'Cambio de escuela' : m}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </Field.Field>
              </Field.FieldGroup>
            {/if}

            <div class="flex gap-2">
              <Button onclick={handleSave}>Guardar</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {:else}
        <EmptyStates
          filteredCount={filtered.length}
          hasQuery={Boolean(q.trim())}
          entityLabel="socio"
          entityArticle="uno"
          onNew={() => store.nuevo()}
          onNewFromQuery={() => store.nuevo(buildPrefill(q))}
          selectPrompt="Seleccioná un socio o creá uno nuevo."
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyStates>
      {/if}
    </div>
  </div>

</PageScaffold>
