<script>
  import { onMount } from 'svelte'
  import { personasStore as store } from './personasStore.svelte'
  import { normalize, CATEGORIAS_VINCULO } from '$core/utils'
  import { personaLabel, isDniQuery, buildPrefill, localidadesItems } from '$core/personas'
  import { notifyAfter } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import * as Field from '$lib/components/ui/field'
  import Combobox from '$lib/components/Combobox.svelte'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import { useInfiniteScroll } from '$lib/useInfiniteScroll.svelte.js'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import SearchIcon from '@lucide/svelte/icons/search'
  import UsersIcon from '@lucide/svelte/icons/users'
  import BuildingIcon from '@lucide/svelte/icons/building-2'
  let q = $state('')
  let tipoFilter = $state('')
  let categoriaFilter = $state('')

  const isJuridica = (/** @type {any} */ p) => p.tipo_persona === 'Juridica'

  let filtered = $derived(
    store.records
      .filter((/** @type {any} */ p) => (tipoFilter ? (p.tipo_persona || 'Fisica') === tipoFilter : true))
      .filter((/** @type {any} */ p) => (categoriaFilter ? (p.categoria || '') === categoriaFilter : true))
      .filter((/** @type {any} */ p) => {
        const t = normalize(q)
        if (!t) return true
        const hay = [p.dni, p.cuil, p.apellido, p.nombre, p.razon_social, p.email, p.telefono, p.localidad]
          .map((/** @type {any} */ v) => normalize(v))
          .join(' ')
        return hay.includes(t)
      })
      .sort((/** @type {any} */ a, /** @type {any} */ b) => {
        const la = normalize(personaLabel(a))
        const lb = normalize(personaLabel(b))
        return la.localeCompare(lb)
      })
  )

  const scroll = useInfiniteScroll(() => filtered)

  const handleSave = () => notifyAfter(store, store.savePersona)

  onMount(() => {
    const unsub = store.subscribe()
    store.load()
    return unsub
  })
</script>

<PageScaffold title="Personas" loading={store.loading} error={store.error} notice={store.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <div class="flex gap-3">
        <Skeleton class="h-9 flex-1" />
        <Skeleton class="h-9 w-32" />
        <Skeleton class="h-9 w-32" />
      </div>
      <div class="grid gap-4" style="grid-template-columns: 320px 1fr">
        <Skeleton class="h-96" />
        <Skeleton class="h-96" />
      </div>
    </div>
  {/snippet}
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <div class="relative flex-1 min-w-[200px]">
      <SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Buscar (nombre, DNI, razón social…)" bind:value={q} class="pl-9" aria-label="Buscar personas" />
    </div>
    <Select.Root type="single" bind:value={tipoFilter} allowDeselect={true}>
      <Select.Trigger class="w-[140px]" aria-label="Filtrar por tipo de persona">
        <Select.Value placeholder="Todos los tipos" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="Fisica">Física</Select.Item>
        <Select.Item value="Juridica">Jurídica</Select.Item>
      </Select.Content>
    </Select.Root>
    <Select.Root type="single" bind:value={categoriaFilter} allowDeselect={true}>
      <Select.Trigger class="w-[160px]" aria-label="Filtrar por categoría / vínculo">
        <Select.Value placeholder="Categoría / vínculo" />
      </Select.Trigger>
      <Select.Content>
        {#each CATEGORIAS_VINCULO as cat}
          <Select.Item value={cat}>{cat}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <Button onclick={() => store.nuevo(buildPrefill(q))}>
      <UserPlusIcon data-icon="inline-start" />
      Nueva persona
    </Button>
    <span class="text-sm text-muted-foreground">{filtered.length} personas</span>
  </div>

  <div class="grid gap-4" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    {#if filtered.length > 0}
      <div bind:this={scroll.scrollEl} onscroll={scroll.onScroll} class="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-border bg-card">
        {#each scroll.visible as p (p.id)}
          <button
            class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {store.form?.id === p.id ? 'bg-primary/10' : ''}"
            onclick={() => store.select(p)}
            aria-pressed={store.form?.id === p.id}
          >
            <div class="font-semibold text-sm">
              {#if isJuridica(p)}
                <BuildingIcon class="mr-1 inline size-3.5 text-muted-foreground" />
                {p.razon_social || '(sin razón social)'}
              {:else}
                {p.apellido}, {p.nombre}
              {/if}
            </div>
            <div class="text-xs text-muted-foreground">
              {#if isJuridica(p)}
                <Badge variant="secondary" class="mr-1 text-[10px]">Jurídica</Badge>
                CUIT {p.cuil || '-'}
              {:else}
                <Badge variant="secondary" class="mr-1 text-[10px]">Física</Badge>
                DNI {p.dni || '-'} · {p.localidad || ''}
              {/if}
            </div>
          </button>
        {/each}
        {#if scroll.hasMore}
          <div class="py-3 text-center text-xs text-muted-foreground">Cargando más…</div>
        {/if}
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
              {:else}
                <Field.Field data-invalid={Boolean(store.dniWarning)}>
                  <Field.FieldLabel for="dni">DNI</Field.FieldLabel>
                  <Input id="dni" bind:value={store.form.dni} oninput={store.onDniInput} aria-invalid={Boolean(store.dniWarning)} placeholder="12.345.678" inputmode="numeric" />
                  {#if store.dniWarning}<Field.FieldError>{store.dniWarning}</Field.FieldError>{/if}
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.cuilWarning)}>
                  <Field.FieldLabel for="cuil">CUIL</Field.FieldLabel>
                  <Input id="cuil" bind:value={store.form.cuil} oninput={store.onCuilInput} aria-invalid={Boolean(store.cuilWarning)} placeholder="20-12345678-9" inputmode="numeric" />
                  {#if store.cuilWarning}<Field.FieldError>{store.cuilWarning}</Field.FieldError>{/if}
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="apellido">Apellido</Field.FieldLabel>
                  <Input id="apellido" bind:value={store.form.apellido} />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="nombre">Nombre</Field.FieldLabel>
                  <Input id="nombre" bind:value={store.form.nombre} />
                </Field.Field>
              {/if}

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
              {#if store.form.tipo_persona !== 'Juridica'}
                <Field.Field>
                  <Field.FieldLabel for="fecha-nacimiento">Fecha de nacimiento</Field.FieldLabel>
                  <Input id="fecha-nacimiento" type="date" bind:value={store.form.fecha_nacimiento} />
                </Field.Field>
              {/if}
            </Field.FieldGroup>

            <div class="flex gap-2">
              <Button onclick={handleSave}>Guardar</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {:else if filtered.length === 0 && q.trim()}
        <EmptyState
          title="Sin coincidencias"
          sub="No se encontraron personas con ese criterio. ¿Querés crear una nueva?"
          actionLabel="Crear persona"
          onaction={() => store.nuevo(buildPrefill(q))}
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyState>
      {:else if filtered.length === 0}
        <EmptyState
          title="Todavía no hay personas"
          sub="Creá la primera persona para empezar."
          actionLabel="Nueva persona"
          onaction={() => store.nuevo()}
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyState>
      {:else}
        <div class="flex flex-col items-center gap-2 py-12 text-center">
          <UsersIcon class="size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">Seleccioná una persona o creá una nueva.</p>
        </div>
      {/if}
    </div>
  </div>

</PageScaffold>
