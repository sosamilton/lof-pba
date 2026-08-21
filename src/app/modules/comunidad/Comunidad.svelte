<script>
  import { onMount } from 'svelte'
  import { comunidadStore as store } from './comunidadStore.svelte'
  import { normalize } from '$core/utils/utils'
  import { daysSince } from '$core/utils/utils'
  import { TIPOS_SOCIO, MOTIVOS_BAJA, CATEGORIAS_VINCULO } from '$app/modules/comunidad/constants.js'
  import { filterBySearch, sortByFields } from '$lib/hooks/useListFilter.svelte.js'
  import { useDebounce } from '$lib/hooks/useDebounce.svelte.js'
  import { buildPrefill, personaLabel, localidadesItems } from './personas/personasApi.js'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import * as Alert from '$lib/components/ui/alert'
  import { Switch } from '$lib/components/ui/switch'
  import Combobox from '$lib/components/Combobox.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import LinkIcon from '@lucide/svelte/icons/link'
  import FilterBar from './components/FilterBar.svelte'
  import RecordList from './components/RecordList.svelte'
  import PersonaFormFields from './components/PersonaFormFields.svelte'
  import CuilInput from './components/CuilInput.svelte'
  import EmptyStates from './components/EmptyStates.svelte'
  import PersonaMovimientos from './personas/components/PersonaMovimientos.svelte'
  import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'

  let q = $state('')
  const qd = useDebounce(() => q)
  let vinculoFilter = $state('') // '', 'socios', 'no-socios'
  let estadoFilter = $state('activos') // 'activos', 'bajas', 'todos'
  let tipoSocioFilter = $state('')
  let tipoPersonaFilter = $state('')
  let categoriaFilter = $state('')
  let esIntegral = $state(false)

  const isJuridica = (p) => p.tipo_persona === 'Juridica'

  let filtered = $derived(
    sortByFields(
      filterBySearch(
        store.records
          .filter((p) => {
            if (vinculoFilter === 'socios' && !p.esSocio) return false
            if (vinculoFilter === 'no-socios' && p.esSocio) return false
            return true
          })
          .filter((p) => {
            if (!p.esSocio) return true
            if (estadoFilter === 'activos') return !p.fecha_baja
            if (estadoFilter === 'bajas') return Boolean(p.fecha_baja)
            return true
          })
          .filter((p) => (tipoSocioFilter ? String(p.tipo_socio || '') === tipoSocioFilter : true))
          .filter((p) => (tipoPersonaFilter ? (p.tipo_persona || 'Fisica') === tipoPersonaFilter : true))
          .filter((p) => (categoriaFilter ? (p.categoria || '') === categoriaFilter : true)),
        qd.value,
        (p) => [p.dni, p.cuil, p.apellido, p.nombre, p.razon_social, p.email, p.telefono, p.localidad],
      ),
      (p) => [normalize(personaLabel(p))],
    ),
  )

  const handleSave = () => notifyAfter(store, store.save)

  onMount(async () => {
    const unsub = store.subscribe()
    store.load()
    try {
      const config = await loadConfig()
      esIntegral = Boolean(config?.modulo_gestion_integral)
    } catch { /* config opcional */ }
    return unsub
  })

  const vinculoFilterConfig = $derived({
    key: 'vinculo',
    value: vinculoFilter,
    allowDeselect: true,
    triggerClass: 'w-[140px]',
    ariaLabel: 'Filtrar por vínculo',
    placeholder: 'Todos',
    options: [
      { value: 'socios', label: 'Solo socios' },
      { value: 'no-socios', label: 'No socios' },
    ],
    onValueChange: (v) => (vinculoFilter = v),
  })

  const estadoSocioFilterConfig = $derived({
    key: 'estado-socio',
    value: estadoFilter,
    allowDeselect: false,
    triggerClass: 'w-[120px]',
    ariaLabel: 'Filtrar por estado de socio',
    placeholder: 'Estado',
    options: [
      { value: 'activos', label: 'Activos' },
      { value: 'bajas', label: 'Bajas' },
      { value: 'todos', label: 'Todos' },
    ],
    onValueChange: (v) => (estadoFilter = v),
  })

  const tipoSocioFilterConfig = $derived({
    key: 'tipo-socio',
    value: tipoSocioFilter,
    allowDeselect: true,
    triggerClass: 'w-[160px]',
    ariaLabel: 'Filtrar por tipo de socio',
    placeholder: 'Todos los tipos',
    options: TIPOS_SOCIO.map((t) => ({ value: t, label: t })),
    onValueChange: (v) => (tipoSocioFilter = v),
  })

  const tipoPersonaFilterConfig = $derived({
    key: 'tipo-persona',
    value: tipoPersonaFilter,
    allowDeselect: true,
    triggerClass: 'w-[140px]',
    ariaLabel: 'Filtrar por tipo de persona',
    placeholder: 'Todos los tipos',
    options: [
      { value: 'Fisica', label: 'Física' },
      { value: 'Juridica', label: 'Jurídica' },
    ],
    onValueChange: (v) => (tipoPersonaFilter = v),
  })

  const categoriaFilterConfig = $derived({
    key: 'categoria',
    value: categoriaFilter,
    allowDeselect: true,
    triggerClass: 'w-[160px]',
    ariaLabel: 'Filtrar por categoría / vínculo',
    placeholder: 'Categoría / vínculo',
    options: CATEGORIAS_VINCULO.map((cat) => ({ value: cat, label: cat })),
    onValueChange: (v) => (categoriaFilter = v),
  })

  // Filtros visibles según contexto
  let activeFilters = $derived(
    vinculoFilter === 'socios'
      ? [vinculoFilterConfig, estadoSocioFilterConfig, tipoSocioFilterConfig, tipoPersonaFilterConfig, categoriaFilterConfig]
      : [vinculoFilterConfig, tipoPersonaFilterConfig, categoriaFilterConfig],
  )
</script>

<PageScaffold title="Comunidad" loading={store.loading} error={store.error} notice={store.notice}>
  <FilterBar
    bind:q
    count={filtered.length}
    countLabel="personas"
    searchPlaceholder="Buscar (nombre, DNI, razón social…)"
    searchAriaLabel="Buscar personas"
    newLabel="Nueva persona"
    onNew={() => store.nuevo(buildPrefill(q))}
    onReload={store.load}
    showReload
    filters={activeFilters}
  >
    {#snippet newIcon()}
      <UserPlusIcon data-icon="inline-start" />
    {/snippet}
  </FilterBar>

  <div class="grid gap-4 items-start" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    {#if filtered.length > 0}
      <div class="relative min-h-0 self-stretch min-h-[75vh]">
        <RecordList
          items={filtered}
          selectedId={store.form?.id}
          onSelect={(p) => store.select(p)}
          itemLabel={(p) => isJuridica(p) ? (p.razon_social || '(sin razón social)') : `${p.apellido}, ${p.nombre}`}
          itemSub={(p) => isJuridica(p) ? `CUIT ${p.cuil || '-'}` : `DNI ${p.dni || '-'} · ${p.localidad || ''}`}
          itemBadges={(p) => {
            const badges = []
            if (p.esSocio) {
              badges.push(p.fecha_baja
                ? { text: 'Socio baja', variant: 'outline' }
                : { text: `Socio ${p.tipo_socio || 'Activo'}`, variant: 'secondary' })
            } else {
              badges.push({ text: 'No socio', variant: 'outline' })
            }
            badges.push(isJuridica(p) ? { text: 'Jurídica', variant: 'outline' } : { text: 'Física', variant: 'outline' })
            return badges
          }}
        />
      </div>
    {/if}

    <div>
      {#if store.form}
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">
              {store.form.id ? 'Editar persona' : 'Nueva persona'}
            </Card.Title>
          </Card.Header>
          <Card.Content class="flex flex-col gap-4">
            {#if store.linkedPersona}
              <div class="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                <LinkIcon class="size-3.5 text-primary" />
                <span class="text-sm font-medium">Persona vinculada: {store.linkedPersona.apellido || ''}, {store.linkedPersona.nombre || store.linkedPersona.razon_social || ''}</span>
              </div>
            {/if}

            <!-- Toolbar -->
            <div class="flex flex-wrap justify-end gap-2">
              {#if store.form.id && store.esSocio}
                {#if store.form.fecha_baja}
                  <Button variant="outline" size="sm" onclick={store.reactivar}>Reactivar socio</Button>
                {/if}
                <Button variant="outline" size="sm" onclick={store.toggleBaja}>
                  {store.showBaja ? 'Ocultar baja' : 'Dar de baja'}
                </Button>
              {:else if !store.form.id}
                <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
              {/if}
            </div>

            <Separator />

            <!-- Form persona -->
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
                <CuilInput bind:value={store.form.cuil} cuilWarning={store.cuilWarning} isJuridica={true} label="CUIT" onCuilInput={store.onCuilInput} />
                <Field.Field>
                  <Field.FieldLabel for="domicilio">Domicilio</Field.FieldLabel>
                  <Input id="domicilio" bind:value={store.form.domicilio} />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="localidad">Localidad</Field.FieldLabel>
                  <Combobox
                    bind:value={store.form.localidad}
                    items={localidadesItems.current}
                    placeholder="Elegir localidad…"
                    searchPlaceholder="Buscar localidad de PBA…"
                  />
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.telefonoWarning)}>
                  <Field.FieldLabel for="telefono">Teléfono</Field.FieldLabel>
                  <Input id="telefono" bind:value={store.form.telefono} oninput={store.onTelefonoInput} aria-invalid={Boolean(store.telefonoWarning)} placeholder="9 11 1234-5678" inputmode="tel" />
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
                  fechaNacimientoWarning={store.edadWarning}
                  onFechaNacimientoInput={store.onFechaNacimientoInput}
                />
              {/if}
            </Field.FieldGroup>

            <!-- Toggle socio -->
            <Separator />
            <div class="flex items-center gap-3">
              <Switch checked={store.esSocio} onCheckedChange={(v) => store.esSocio = v} />
              <span class="text-sm font-medium">Es socio</span>
            </div>

            {#if store.esSocio}
              <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
                <Field.Field>
                  <Field.FieldLabel for="tipo">Tipo de socio</Field.FieldLabel>
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
            {/if}

            <div class="flex gap-2">
              <Button onclick={handleSave}>Guardar</Button>
            </div>
          </Card.Content>
        </Card.Root>

        {#if esIntegral && store.form.id}
          <PersonaMovimientos personaId={store.form.id} />
        {/if}
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
