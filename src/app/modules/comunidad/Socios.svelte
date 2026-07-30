<script>
  import { onMount } from 'svelte'
  import { sociosStore as store } from './sociosStore.svelte'
  import { normalize, TIPOS_SOCIO } from '$core/utils'
  import { personaLabel } from '$core/personas'
  import { notify } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import FormField from '$lib/components/FormField.svelte'
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

  const isActivo = (s) => !s.fecha_baja

  const isDniQuery = (str) => /^\d+$/.test(str.trim())
  const buildPrefill = (str) => {
    const trimmed = str.trim()
    if (!trimmed) return {}
    if (isDniQuery(trimmed)) return { dni: trimmed }
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) return { apellido: parts[0], nombre: parts.slice(1).join(' ') }
    return { nombre: trimmed }
  }

  let filtered = $derived(
    store.records
      .filter((s) => {
        if (estado === 'activos') return isActivo(s)
        if (estado === 'bajas') return !isActivo(s)
        return true
      })
      .filter((s) => (tipo ? String(s.tipo_socio || '') === tipo : true))
      .filter((s) => {
        const t = normalize(q)
        if (!t) return true
        const hay = [s.apellido, s.nombre, s.dni, s.cuil, s.email, s.telefono, s.localidad, s.domicilio]
          .map((v) => normalize(v))
          .join(' ')
        return hay.includes(t)
      })
      .sort((a, b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)))
  )

  const handleSave = async () => {
    await store.saveSocio()
    if (store.error) notify.error(store.error)
    else if (store.notice) notify.success(store.notice)
  }

  onMount(() => {
    const unsub = store.subscribe(() => {})
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
                <Button variant="outline" size="sm" onclick={() => { store.showBaja = !store.showBaja }}>
                  {store.showBaja ? 'Ocultar baja' : 'Dar de baja'}
                </Button>
              {:else}
                <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
              {/if}
            </div>

            <Separator />

            <!-- Form -->
            <div class="grid gap-4 sm:grid-cols-2">
              <FormField label="DNI" id="dni" bind:value={store.form.dni} oninput={store.onDniInput} error={store.dniWarning} />
              <FormField label="CUIL" id="cuil" bind:value={store.form.cuil} />
              <FormField label="Apellido" id="apellido" bind:value={store.form.apellido} />
              <FormField label="Nombre" id="nombre" bind:value={store.form.nombre} />
              <div>
                <Label for="tipo">Tipo</Label>
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
              </div>
              <FormField label="Fecha alta" id="fecha-alta" type="date" bind:value={store.form.fecha_alta} />
              <FormField label="Domicilio" id="domicilio" bind:value={store.form.domicilio} />
              <FormField label="Localidad" id="localidad" bind:value={store.form.localidad} />
              <FormField label="Teléfono" id="telefono" bind:value={store.form.telefono} />
              <FormField label="Email" id="email" type="email" bind:value={store.form.email} />
              {#if store.form.id && store.showBaja}
                <FormField label="Fecha baja" id="fecha-baja" type="date" bind:value={store.form.fecha_baja} />
                <FormField label="Motivo baja" id="motivo-baja" bind:value={store.form.motivo_baja} disabled={!store.form.fecha_baja} />
              {/if}
            </div>

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
