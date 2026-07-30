<script>
  import { onMount } from 'svelte'
  import { personasStore as store } from './personasStore.svelte'
  import { normalize } from '$core/utils'
  import { personaLabel } from '$core/personas'
  import { notify } from '$core/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import FormField from '$lib/components/FormField.svelte'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import SearchIcon from '@lucide/svelte/icons/search'
  import UsersIcon from '@lucide/svelte/icons/users'
  import BuildingIcon from '@lucide/svelte/icons/building-2'

  let q = $state('')
  let tipoFilter = $state('')

  const isJuridica = (p) => p.tipo_persona === 'Juridica'

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
      .filter((p) => (tipoFilter ? (p.tipo_persona || 'Fisica') === tipoFilter : true))
      .filter((p) => {
        const t = normalize(q)
        if (!t) return true
        const hay = [p.dni, p.cuil, p.apellido, p.nombre, p.razon_social, p.email, p.telefono, p.localidad]
          .map((v) => normalize(v))
          .join(' ')
        return hay.includes(t)
      })
      .sort((a, b) => {
        const la = normalize(personaLabel(a))
        const lb = normalize(personaLabel(b))
        return la.localeCompare(lb)
      })
  )

  const handleSave = async () => {
    await store.savePersona()
    if (store.error) notify.error(store.error)
    else if (store.notice) notify.success(store.notice)
  }

  onMount(() => {
    const unsub = store.subscribe(() => {})
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
      <Input placeholder="Buscar (nombre, DNI, razón social…)" bind:value={q} class="pl-9" />
    </div>
    <Select.Root type="single" bind:value={tipoFilter} allowDeselect={true}>
      <Select.Trigger class="w-[140px]">
        <Select.Value placeholder="Todos los tipos" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="Fisica">Física</Select.Item>
        <Select.Item value="Juridica">Jurídica</Select.Item>
      </Select.Content>
    </Select.Root>
    <Button onclick={() => store.nuevo(buildPrefill(q))}>
      <UserPlusIcon data-icon="inline-start" />
      Nueva persona
    </Button>
    <Button variant="outline" onclick={store.load}>Recargar</Button>
    <span class="text-sm text-muted-foreground">{filtered.length} personas</span>
  </div>

  <div class="grid gap-4" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
    {#if filtered.length > 0}
      <div class="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-border bg-card">
        {#each filtered as p (p.id)}
          <button
            class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {store.form?.id === p.id ? 'bg-primary/10' : ''}"
            onclick={() => store.select(p)}
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
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <Label for="tipo_persona">Tipo de persona</Label>
                <Select.Root type="single" bind:value={store.form.tipo_persona}>
                  <Select.Trigger id="tipo_persona" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="Fisica">Física</Select.Item>
                    <Select.Item value="Juridica">Jurídica</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>

              {#if store.form.tipo_persona === 'Juridica'}
                <div class="sm:col-span-2">
                  <FormField label="Razón social" id="razon_social" bind:value={store.form.razon_social} />
                </div>
                <FormField label="CUIT" id="cuil" bind:value={store.form.cuil} oninput={store.onCuilInput} />
              {:else}
                <FormField label="DNI" id="dni" bind:value={store.form.dni} oninput={store.onDniInput} error={store.dniWarning} />
                <FormField label="CUIL" id="cuil" bind:value={store.form.cuil} oninput={store.onCuilInput} />
                <FormField label="Apellido" id="apellido" bind:value={store.form.apellido} />
                <FormField label="Nombre" id="nombre" bind:value={store.form.nombre} />
              {/if}

              <FormField label="Domicilio" id="domicilio" bind:value={store.form.domicilio} />
              <FormField label="Localidad" id="localidad" bind:value={store.form.localidad} />
              <FormField label="Teléfono" id="telefono" bind:value={store.form.telefono} />
              <FormField label="Email" id="email" type="email" bind:value={store.form.email} />
            </div>

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
