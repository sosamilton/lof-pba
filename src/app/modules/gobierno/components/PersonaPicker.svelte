<script>
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Field from '$lib/components/ui/field'
  import * as InputGroup from '$lib/components/ui/input-group'
  import Combobox from '$lib/components/Combobox.svelte'
  import LinkIcon from '@lucide/svelte/icons/link'
  import UnlinkIcon from '@lucide/svelte/icons/unlink'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import { personaLabel, findOrCreatePersona, localidadesItems } from '$app/modules/comunidad/personas/personasApi.js'
  import { formatDni, parseDni, parseCuil, normalizeTelefonoForStorage, normalizeEmail } from '$core/format/format.js'
  import { resolveTableId, applyUserActions } from '$core/grist/grist.js'
  import { TABLE_PREFERRED_IDS } from '$core/utils/utils.js'

  let {
    personaId = null,
    apellidoNombre = '',
    dni = '',
    cuil = '',
    disabled = false,
    searchValue = '',
    searching = false,
    results = [],
    onsearch = () => {},
    onpick = () => {},
    onunlink = () => {},
    compact = false,
    showCategoria = false,
    showCreateSocio = false,
    fechaAltaSocio = '',
    excludePersonaIds = [],
  } = $props()

  let createMode = $state(false)
  let filteredResults = $derived(
    excludePersonaIds.length > 0
      ? results.filter((p) => !excludePersonaIds.includes(p.id))
      : results,
  )
  let creating = $state(false)
  let createError = $state('')
  let createSocio = $state(true)

  let newPerson = $state({
    apellido: '',
    nombre: '',
    dni: '',
    cuil: '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
  })

  const startCreate = () => {
    createMode = true
    createError = ''
    const d = parseDni(searchValue)
    if (d && d.length >= 7) {
      newPerson.dni = formatDni(d)
    }
  }

  const cancelCreate = () => {
    createMode = false
    createError = ''
    newPerson = { apellido: '', nombre: '', dni: '', cuil: '', domicilio: '', localidad: '', telefono: '', email: '' }
  }

  const onDniInput = () => {
    newPerson.dni = formatDni(newPerson.dni)
  }

  const confirmCreate = async () => {
    createError = ''
    if (!newPerson.apellido.trim() && !newPerson.nombre.trim()) {
      createError = 'Ingresá apellido o nombre.'
      return
    }
    creating = true
    try {
      const personaData = {
        tipo_persona: 'Fisica',
        apellido: newPerson.apellido.trim(),
        nombre: newPerson.nombre.trim(),
        dni: parseDni(newPerson.dni) || '',
        cuil: parseCuil(newPerson.cuil) || '',
        domicilio: newPerson.domicilio.trim(),
        localidad: newPerson.localidad,
        telefono: newPerson.telefono.trim() ? normalizeTelefonoForStorage(newPerson.telefono) : '',
        email: newPerson.email.trim() ? normalizeEmail(newPerson.email) : '',
      }

      const persona = await findOrCreatePersona(personaData)
      if (!persona || !persona.id) {
        createError = 'No se pudo crear la persona.'
        return
      }

      if (showCreateSocio && createSocio) {
        const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
        if (tSocios) {
          await applyUserActions([['AddRecord', tSocios, null, {
            persona_id: persona.id,
            tipo_socio: 'Activo',
            fecha_alta: fechaAltaSocio || new Date().toISOString().slice(0, 10),
          }]])
        }
      }

      onpick(persona)
      cancelCreate()
    } catch (e) {
      createError = e?.message || String(e)
    } finally {
      creating = false
    }
  }
</script>

<div class="flex flex-col gap-1">
  {#if personaId}
    <div class="flex items-center gap-2">
      <Input value={apellidoNombre} disabled class={compact ? 'h-8 text-sm' : 'h-9 text-sm'} />
      <Button variant="ghost" size="sm" class="h-8 shrink-0 px-2" onclick={onunlink} aria-label="Desvincular persona">
        <UnlinkIcon data-icon="inline-start" />
      </Button>
    </div>
  {:else if createMode}
    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold">Crear nueva persona</span>
        <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={cancelCreate}>Cancelar</Button>
      </div>

      <Field.FieldGroup class="grid gap-2 {compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}">
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">Apellido</Field.FieldLabel>
          <Input bind:value={newPerson.apellido} class="h-8 text-xs" />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">Nombre</Field.FieldLabel>
          <Input bind:value={newPerson.nombre} class="h-8 text-xs" />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">DNI</Field.FieldLabel>
          <Input bind:value={newPerson.dni} oninput={onDniInput} class="h-8 text-xs" placeholder="12.345.678" inputmode="numeric" />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">CUIL</Field.FieldLabel>
          <Input bind:value={newPerson.cuil} class="h-8 text-xs" placeholder="20-12345678-9" />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">Domicilio</Field.FieldLabel>
          <Input bind:value={newPerson.domicilio} class="h-8 text-xs" />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">Localidad</Field.FieldLabel>
          <Combobox
            bind:value={newPerson.localidad}
            items={localidadesItems}
            placeholder="Elegir…"
            searchPlaceholder="Buscar…"
          />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">Teléfono</Field.FieldLabel>
          <InputGroup.Root>
            <InputGroup.Addon class="text-xs font-bold">+54</InputGroup.Addon>
            <InputGroup.Input bind:value={newPerson.telefono} class="h-8 text-xs" placeholder="9 11 1234-5678" inputmode="tel" />
          </InputGroup.Root>
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel class="text-[11px]">Email</Field.FieldLabel>
          <Input type="email" bind:value={newPerson.email} class="h-8 text-xs" placeholder="nombre@ejemplo.com" />
        </Field.Field>
      </Field.FieldGroup>

      {#if showCreateSocio}
        <label class="flex items-center gap-2 text-xs">
          <Checkbox bind:checked={createSocio} />
          Crear también como socio activo
        </label>
      {/if}

      {#if createError}
        <span class="text-xs text-destructive">{createError}</span>
      {/if}

      <Button size="sm" onclick={confirmCreate} disabled={creating}>
        <UserPlusIcon data-icon="inline-start" />
        {creating ? 'Creando…' : 'Confirmar'}
      </Button>
    </div>
  {:else}
    <Input
      value={searchValue}
      oninput={(e) => onsearch(e.target.value)}
      placeholder="Buscar por nombre o DNI…"
      class={compact ? 'h-8 text-xs' : 'h-9 text-sm'}
    />
    {#if searching}
      <span class="text-xs text-muted-foreground">Buscando…</span>
    {/if}
    {#if filteredResults.length > 0}
      <div class="flex flex-col gap-1">
        {#each filteredResults as p (p.id)}
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-primary/10"
            onclick={() => onpick(p)}
          >
            <LinkIcon class="size-3 shrink-0 text-primary" />
            <span class="flex-1">{personaLabel(p)}</span>
            {#if p.dni}<span class="text-muted-foreground">· DNI {p.dni}</span>{/if}
            {#if showCategoria && p.categoria}
              <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{p.categoria}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
    <Button variant="outline" size="sm" class="h-7 text-xs" onclick={startCreate}>
      <UserPlusIcon data-icon="inline-start" />
      Crear nueva persona
    </Button>
  {/if}
</div>
