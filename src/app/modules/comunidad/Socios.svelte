<script>
  import { onMount } from 'svelte'
  import { sociosStore as store } from './sociosStore.svelte'
  import { normalize, TIPOS_SOCIO, MOTIVOS_BAJA, daysSince, isAdult } from '$core/utils'
  import { personaLabel, isDniQuery, buildPrefill, localidadesItems } from '$core/personas'
  import { notifyAfter } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import * as Alert from '$lib/components/ui/alert'
  import Combobox from '$lib/components/Combobox.svelte'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import SearchIcon from '@lucide/svelte/icons/search'
  import LinkIcon from '@lucide/svelte/icons/link'
  import UsersIcon from '@lucide/svelte/icons/users'
  let q = $state('')
  let estado = $state('activos')
  let tipo = $state('')

  const isActivo = (/** @type {any} */ s) => !s.fecha_baja
  const isElectoral = (/** @type {any} */ s) => s.tipo_socio === 'Activo' && !s.fecha_baja && (daysSince(s.fecha_alta) ?? 0) >= 30

  let filtered = $derived(
    store.records
      .filter((/** @type {any} */ s) => {
        if (estado === 'activos') return isActivo(s)
        if (estado === 'bajas') return !isActivo(s)
        return true
      })
      .filter((/** @type {any} */ s) => (tipo ? String(s.tipo_socio || '') === tipo : true))
      .filter((/** @type {any} */ s) => {
        const t = normalize(q)
        if (!t) return true
        const hay = [s.apellido, s.nombre, s.dni, s.cuil, s.email, s.telefono, s.localidad, s.domicilio]
          .map((/** @type {any} */ v) => normalize(v))
          .join(' ')
        return hay.includes(t)
      })
      .sort((/** @type {any} */ a, /** @type {any} */ b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)))
  )

  const handleSave = () => notifyAfter(store, store.saveSocio)

  onMount(() => {
    const unsub = store.subscribe()
    store.load()
    return unsub
  })
</script>

<PageScaffold title="Socios" loading={store.loading} error={store.error} notice={store.notice}>
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
      <Input placeholder="Buscar (apellido, nombre, DNI…)" bind:value={q} class="pl-9" />
    </div>
    <Select.Root type="single" bind:value={estado}>
      <Select.Trigger class="w-[120px]">
        <Select.Value placeholder="Estado" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="activos">Activos</Select.Item>
        <Select.Item value="bajas">Bajas</Select.Item>
        <Select.Item value="todos">Todos</Select.Item>
      </Select.Content>
    </Select.Root>
    <Select.Root type="single" bind:value={tipo} allowDeselect={true}>
      <Select.Trigger class="w-[160px]">
        <Select.Value placeholder="Todos los tipos" />
      </Select.Trigger>
      <Select.Content>
        {#each TIPOS_SOCIO as t}
          <Select.Item value={t}>{t}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <Button onclick={() => store.nuevo(buildPrefill(q))}>
      <UserPlusIcon data-icon="inline-start" />
      Nuevo socio
    </Button>
    <Button variant="outline" onclick={store.load}>Recargar</Button>
    <span class="text-sm text-muted-foreground">{filtered.length} socios</span>
  </div>

  <div class="grid gap-4" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    {#if filtered.length > 0}
      <div class="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-border bg-card">
        {#each filtered as s (s.id)}
          <button
            class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {store.form?.id === s.id ? 'bg-primary/10' : ''}"
            onclick={() => store.select(s)}
          >
            <div class="font-semibold text-sm">{s.apellido}, {s.nombre}</div>
            <div class="text-xs text-muted-foreground">
              {#if isActivo(s)}
                <Badge variant="secondary" class="mr-1 text-[10px]">Activo</Badge>
              {:else}
                <Badge variant="outline" class="mr-1 text-[10px]">Baja</Badge>
              {/if}
              {#if s.tipo_socio && s.tipo_socio !== 'Activo'}
                <Badge variant="outline" class="mr-1 text-[10px] text-muted-foreground">Sin voto</Badge>
              {/if}
              DNI {s.dni || '-'} · {s.localidad || ''}
            </div>
          </button>
        {/each}
      </div>
    {/if}

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
                <span class="text-sm font-medium">Persona vinculada: {personaLabel(store.linkedPersona)}</span>
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
              <Field.Field data-invalid={Boolean(store.edadWarning)}>
                <Field.FieldLabel for="fecha-nacimiento">Fecha de nacimiento</Field.FieldLabel>
                <Input id="fecha-nacimiento" type="date" bind:value={store.form.fecha_nacimiento} oninput={store.onFechaNacimientoInput} aria-invalid={Boolean(store.edadWarning)} />
                {#if store.edadWarning}<Field.FieldError>{store.edadWarning}</Field.FieldError>{/if}
              </Field.Field>
              <Field.Field>
                <Field.FieldLabel for="fecha-alta">Fecha alta</Field.FieldLabel>
                <Input id="fecha-alta" type="date" bind:value={store.form.fecha_alta} />
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
      {:else if filtered.length === 0 && q.trim()}
        <EmptyState
          title="Sin coincidencias"
          sub="No se encontraron socios con ese criterio. ¿Querés crear uno nuevo?"
          actionLabel="Crear socio"
          onaction={() => store.nuevo(buildPrefill(q))}
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyState>
      {:else if filtered.length === 0}
        <EmptyState
          title="Todavía no hay socios"
          sub="Creá el primer socio para empezar."
          actionLabel="Nuevo socio"
          onaction={() => store.nuevo()}
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyState>
      {:else}
        <div class="flex flex-col items-center gap-2 py-12 text-center">
          <UsersIcon class="size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">Seleccioná un socio o creá uno nuevo.</p>
        </div>
      {/if}
    </div>
  </div>

</PageScaffold>
