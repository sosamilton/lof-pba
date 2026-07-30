<script>
  import { onMount } from 'svelte'
  import { sociosStore as store } from '../stores/sociosStore.svelte'
  import { isInGrist } from '../grist'
  import { normalize, TIPOS_SOCIO } from '../utils'
  import { personaLabel } from '../personas'
  import { notify } from '../stores/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import EmptyState from '../components/EmptyState.svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import SearchIcon from '@lucide/svelte/icons/search'
  import LinkIcon from '@lucide/svelte/icons/link'
  import UnlinkIcon from '@lucide/svelte/icons/unlink'
  import UsersIcon from '@lucide/svelte/icons/users'

  let q = $state('')
  let estado = $state('activos')
  let tipo = $state('')

  const isActivo = (s) => !s.fecha_baja

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

  let showList = $derived(store.listOpen && filtered.length > 0)

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

{#if !isInGrist()}
  <h1 class="text-lg font-bold">Socios</h1>
  <p class="text-sm text-muted-foreground">Esta pantalla solo funciona dentro de Grist.</p>
{:else if store.loading}
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
{:else}
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <div class="relative flex-1 min-w-[200px]">
      <SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Buscar (apellido, nombre, DNI…)" bind:value={q} class="pl-9" />
    </div>
    <select bind:value={estado} class="h-9 rounded-md border border-input bg-background px-3 text-sm">
      <option value="activos">Activos</option>
      <option value="bajas">Bajas</option>
      <option value="todos">Todos</option>
    </select>
    <select bind:value={tipo} class="h-9 rounded-md border border-input bg-background px-3 text-sm">
      <option value="">Todos los tipos</option>
      {#each TIPOS_SOCIO as t}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <Button onclick={store.nuevo}>
      <UserPlusIcon data-icon="inline-start" />
      Nuevo socio
    </Button>
    <Button variant="outline" onclick={store.load}>Recargar</Button>
    <span class="text-sm text-muted-foreground">{filtered.length} socios</span>
  </div>

  <div class="grid gap-4" style="grid-template-columns: {showList ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    {#if showList}
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
            <!-- Persona search -->
            {#if store.linkedPersona}
              <div class="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                <span class="text-sm font-medium">
                  <LinkIcon class="mr-1 inline size-3.5" />
                  Persona vinculada: {personaLabel(store.linkedPersona)}
                </span>
                <Button variant="ghost" size="sm" onclick={store.unlinkPersona}>
                  <UnlinkIcon data-icon="inline-start" />
                  Desvincular
                </Button>
              </div>
            {:else}
              <div class="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                <Label class="text-xs text-muted-foreground">Buscar persona existente (DNI, apellido o nombre)</Label>
                <div class="mt-1.5 flex items-center gap-2">
                  <Input
                    placeholder="Escribí DNI, apellido o nombre…"
                    bind:value={store.personaSearch}
                    oninput={store.doPersonaSearch}
                  />
                  {#if store.personaSearching}
                    <span class="text-xs text-muted-foreground">buscando…</span>
                  {/if}
                </div>
                {#if store.personaResults.length > 0}
                  <div class="mt-2 flex flex-col gap-1">
                    {#each store.personaResults as p (p.id)}
                      <button
                        class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10"
                        onclick={() => store.selectPersona(p)}
                      >
                        <LinkIcon class="size-3.5 shrink-0 text-primary" />
                        <strong>{personaLabel(p)}</strong>
                        <span class="text-muted-foreground"> · DNI {p.dni || '-'} · {p.localidad || ''}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Toolbar -->
            <div class="flex flex-wrap justify-end gap-2">
              {#if store.form.id}
                <Button variant="outline" size="sm" onclick={() => { store.showBaja = !store.showBaja }}>
                  {store.showBaja ? 'Ocultar baja' : 'Dar de baja'}
                </Button>
                {#if showList}
                  <Button variant="outline" size="sm" onclick={() => store.setListOpen(false)}>Ocultar lista</Button>
                {/if}
              {:else}
                <Button variant="outline" size="sm" onclick={() => store.setListOpen(true)} disabled={filtered.length === 0}>Ver lista</Button>
              {/if}
            </div>

            <Separator />

            <!-- Form -->
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <Label for="dni">DNI</Label>
                <Input id="dni" bind:value={store.form.dni} oninput={store.onDniInput} class="mt-1" />
                {#if store.dniWarning}
                  <p class="mt-1 text-xs text-destructive">{store.dniWarning}</p>
                {/if}
              </div>
              <div>
                <Label for="cuil">CUIL</Label>
                <Input id="cuil" bind:value={store.form.cuil} class="mt-1" />
              </div>
              <div>
                <Label for="apellido">Apellido</Label>
                <Input id="apellido" bind:value={store.form.apellido} class="mt-1" />
              </div>
              <div>
                <Label for="nombre">Nombre</Label>
                <Input id="nombre" bind:value={store.form.nombre} class="mt-1" />
              </div>
              <div>
                <Label for="tipo">Tipo</Label>
                <select id="tipo" bind:value={store.form.tipo_socio} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {#each TIPOS_SOCIO as t}
                    <option value={t}>{t}</option>
                  {/each}
                </select>
              </div>
              <div>
                <Label for="fecha-alta">Fecha alta</Label>
                <Input id="fecha-alta" type="date" bind:value={store.form.fecha_alta} class="mt-1" />
              </div>
              <div>
                <Label for="domicilio">Domicilio</Label>
                <Input id="domicilio" bind:value={store.form.domicilio} class="mt-1" />
              </div>
              <div>
                <Label for="localidad">Localidad</Label>
                <Input id="localidad" bind:value={store.form.localidad} class="mt-1" />
              </div>
              <div>
                <Label for="telefono">Teléfono</Label>
                <Input id="telefono" bind:value={store.form.telefono} class="mt-1" />
              </div>
              <div>
                <Label for="email">Email</Label>
                <Input id="email" type="email" bind:value={store.form.email} class="mt-1" />
              </div>
              {#if store.form.id && store.showBaja}
                <div>
                  <Label for="fecha-baja">Fecha baja</Label>
                  <Input id="fecha-baja" type="date" bind:value={store.form.fecha_baja} class="mt-1" />
                </div>
                <div>
                  <Label for="motivo-baja">Motivo baja</Label>
                  <Input id="motivo-baja" bind:value={store.form.motivo_baja} disabled={!store.form.fecha_baja} class="mt-1" />
                </div>
              {/if}
            </div>

            <div class="flex gap-2">
              <Button onclick={handleSave}>Guardar</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {:else if filtered.length === 0}
        <EmptyState
          title="Todavía no hay socios"
          sub="Creá el primer socio para empezar."
          actionLabel="Nuevo socio"
          onaction={store.nuevo}
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

  {#if store.error}
    <Alert variant="destructive" class="mt-4">
      <AlertDescription>{store.error}</AlertDescription>
    </Alert>
  {/if}
{/if}
