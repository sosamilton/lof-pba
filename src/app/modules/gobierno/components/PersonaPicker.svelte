<script>
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import * as Field from '$lib/components/ui/field'
  import * as Select from '$lib/components/ui/select'
  import * as InputGroup from '$lib/components/ui/input-group'
  import Combobox from '$lib/components/Combobox.svelte'
  import LinkIcon from '@lucide/svelte/icons/link'
  import UnlinkIcon from '@lucide/svelte/icons/unlink'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import PersonaFormFields from '$app/modules/comunidad/components/PersonaFormFields.svelte'
  import CuilInput from '$app/modules/comunidad/components/CuilInput.svelte'
  import { personaLabel, findOrCreatePersona, localidadesItems } from '$app/modules/comunidad/personas/personasApi.js'
  import { useFieldWarnings } from '$lib/hooks/useFieldWarnings.svelte.js'
  import { formatDni, parseDni, parseCuil, normalizeTelefonoForStorage, normalizeEmail, buildCuilPendiente, isCuilPendiente } from '$core/format/format.js'
  import { resolveTableId, applyUserActions } from '$core/data/dataRepository'
  import { TABLE_PREFERRED_IDS, todayISO } from '$core/utils/utils.js'

  let {
    personaId = null,
    apellidoNombre = '',
    dni = '',
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
    // Nuevos props para unificación
    tipoPersona = 'Fisica',
    cargaMinima = true,
  } = $props()

  let createMode = $state(false)
  let filteredResults = $derived(
    excludePersonaIds.length > 0
      ? results.filter((p) => !excludePersonaIds.includes(p.id))
      : results,
  )
  let creating = $state(false)
  let createError = $state('')

  // Cuando showCreateSocio es true (carga desde asamblea/autoridades),
  // el tipo de persona se fija en Física (las autoridades siempre son físicas)
  // y el socio se crea siempre (no es opcional).
  let effectiveTipoPersona = $derived(showCreateSocio ? 'Fisica' : tipoPersona)

  // Form de nueva persona — usa los mismos campos que PersonaFormFields
  function buildNewPerson() {
    return {
      tipo_persona: effectiveTipoPersona,
      dni: '',
      cuil: '',
      apellido: '',
      nombre: '',
      razon_social: '',
      domicilio: '',
      localidad: '',
      telefono: '',
      email: '',
      fecha_nacimiento: '',
      categoria: '',
    }
  }

  let newPerson = $state(buildNewPerson())

  // useFieldWarnings necesita acceder al form actual
  const fw = useFieldWarnings({ getForm: () => newPerson })

  const isJuridica = $derived(newPerson.tipo_persona === 'Juridica')

  const startCreate = () => {
    createMode = true
    createError = ''
    newPerson = buildNewPerson()
    // Si el searchValue es un DNI, precargarlo
    const d = parseDni(searchValue)
    if (d && d.length >= 7) {
      newPerson.dni = formatDni(d)
      // Auto-completar CUIL pendiente desde el DNI
      const cuilPendiente = buildCuilPendiente(d)
      if (cuilPendiente) newPerson.cuil = cuilPendiente
    }
  }

  const cancelCreate = () => {
    createMode = false
    createError = ''
    newPerson = buildNewPerson()
    fw.reset()
  }

  const onDniInput = () => {
    const d = parseDni(newPerson.dni)
    newPerson.dni = formatDni(d)
    // Auto-completar CUIL pendiente desde el DNI si no hay CUIL real ya cargado
    if (d && d.length >= 7) {
      const existingCuil = parseCuil(newPerson.cuil)
      if (!existingCuil || isCuilPendiente(existingCuil)) {
        const cuilPendiente = buildCuilPendiente(d)
        if (cuilPendiente) newPerson.cuil = cuilPendiente
      }
    }
  }

  const onTipoPersonaChange = (v) => {
    newPerson.tipo_persona = v
    // Al cambiar tipo, limpiar campos que no aplican
    if (v === 'Juridica') {
      newPerson.apellido = ''
      newPerson.nombre = ''
      newPerson.dni = ''
      // CUIL pendiente no aplica a jurídicas; usar prefijo 30
      newPerson.cuil = '30'
    } else {
      newPerson.razon_social = ''
      // CUIL pendiente default para físicas
      newPerson.cuil = '00'
    }
    fw.reset()
  }

  const confirmCreate = async () => {
    createError = ''
    // Validar campos obligatorios
    if (fw.hasBlockingWarnings()) {
      createError = 'Corregí los campos marcados antes de continuar.'
      return
    }
    if (isJuridica) {
      if (!newPerson.razon_social.trim()) {
        createError = 'Ingresá la razón social.'
        return
      }
    } else {
      if (!newPerson.apellido.trim() && !newPerson.nombre.trim()) {
        createError = 'Ingresá apellido o nombre.'
        return
      }
    }
    // CUIL obligatorio (pendiente o completo, pero debe tener 11 dígitos)
    const cuil = parseCuil(newPerson.cuil)
    if (cuil.length !== 11) {
      createError = 'Ingresá el CUIL/CUIT (o el DNI para autocompletarlo).'
      return
    }

    creating = true
    try {
      const dniValue = isJuridica ? '' : parseDni(newPerson.dni)
      const personaData = {
        tipo_persona: newPerson.tipo_persona,
        apellido: newPerson.apellido.trim(),
        nombre: newPerson.nombre.trim(),
        razon_social: newPerson.razon_social.trim(),
        dni: dniValue,
        cuil: cuil,
        domicilio: newPerson.domicilio.trim(),
        localidad: newPerson.localidad,
        telefono: newPerson.telefono.trim() ? normalizeTelefonoForStorage(newPerson.telefono) : '',
        email: newPerson.email.trim() ? normalizeEmail(newPerson.email) : '',
      }
      if (!cargaMinima && newPerson.fecha_nacimiento) {
        personaData.fecha_nacimiento = newPerson.fecha_nacimiento
      }
      if (newPerson.categoria) {
        personaData.categoria = newPerson.categoria
      }

      const persona = await findOrCreatePersona(personaData)
      if (!persona || !persona.id) {
        createError = 'No se pudo crear la persona.'
        return
      }

      // Cuando showCreateSocio es true, el socio se crea siempre (no es opcional)
      if (showCreateSocio) {
        const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
        if (tSocios) {
          await applyUserActions([['AddRecord', tSocios, null, {
            persona_id: persona.id,
            tipo_socio: 'Activo',
            fecha_alta: fechaAltaSocio || todayISO(),
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

      <!-- Tipo de persona: solo se muestra si NO es carga con socio (autoridades siempre son físicas) -->
      {#if !showCreateSocio}
        <Field.Field class="sm:col-span-2">
          <Field.FieldLabel for="pp-tipo" class="text-[11px]">Tipo de persona</Field.FieldLabel>
          <Select.Root type="single" value={newPerson.tipo_persona} onValueChange={onTipoPersonaChange}>
            <Select.Trigger id="pp-tipo" class="h-8 w-full text-xs">
              <Select.Value placeholder="Elegir…" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="Fisica">Física</Select.Item>
              <Select.Item value="Juridica">Jurídica</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field.Field>
      {/if}

      {#if isJuridica}
        <Field.FieldGroup class="grid gap-2 sm:grid-cols-2">
          <Field.Field class="sm:col-span-2">
            <Field.FieldLabel for="pp-razon" class="text-[11px]">Razón social</Field.FieldLabel>
            <Input id="pp-razon" bind:value={newPerson.razon_social} class="h-8 text-xs" />
          </Field.Field>
          <CuilInput
            bind:value={newPerson.cuil}
            cuilWarning={fw.cuilWarning}
            isJuridica={true}
            label="CUIT"
            onCuilInput={fw.onCuilInput}
          />
          <Field.Field>
            <Field.FieldLabel for="pp-dom-j" class="text-[11px]">Domicilio</Field.FieldLabel>
            <Input id="pp-dom-j" bind:value={newPerson.domicilio} class="h-8 text-xs" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="pp-loc-j" class="text-[11px]">Localidad</Field.FieldLabel>
            <Combobox
              bind:value={newPerson.localidad}
              items={localidadesItems.current}
              placeholder="Elegir…"
              searchPlaceholder="Buscar…"
            />
          </Field.Field>
          <Field.Field data-invalid={Boolean(fw.telefonoWarning)}>
            <Field.FieldLabel for="pp-tel-j" class="text-[11px]">Teléfono</Field.FieldLabel>
            <InputGroup.Root>
              <InputGroup.Addon class="text-xs font-bold">+54</InputGroup.Addon>
              <InputGroup.Input id="pp-tel-j" bind:value={newPerson.telefono} oninput={fw.onTelefonoInput} class="h-8 text-xs" placeholder="9 11 1234-5678" inputmode="tel" />
            </InputGroup.Root>
            {#if fw.telefonoWarning}<Field.FieldError class="text-[10px]">{fw.telefonoWarning}</Field.FieldError>{/if}
          </Field.Field>
          <Field.Field data-invalid={Boolean(fw.emailWarning)}>
            <Field.FieldLabel for="pp-email-j" class="text-[11px]">Email</Field.FieldLabel>
            <Input id="pp-email-j" type="email" bind:value={newPerson.email} oninput={fw.onEmailInput} class="h-8 text-xs" placeholder="nombre@ejemplo.com" />
            {#if fw.emailWarning}<Field.FieldError class="text-[10px]">{fw.emailWarning}</Field.FieldError>{/if}
          </Field.Field>
        </Field.FieldGroup>
      {:else}
        <!-- Persona física: usa PersonaFormFields + CuilInput con validaciones -->
        <Field.FieldGroup class="grid gap-2 sm:grid-cols-2">
          <Field.Field data-invalid={Boolean(fw.dniWarning)}>
            <Field.FieldLabel for="pp-dni" class="text-[11px]">DNI</Field.FieldLabel>
            <Input id="pp-dni" bind:value={newPerson.dni} oninput={onDniInput} aria-invalid={Boolean(fw.dniWarning)} class="h-8 text-xs" placeholder="12.345.678" inputmode="numeric" />
            {#if fw.dniWarning}<Field.FieldError class="text-[10px]">{fw.dniWarning}</Field.FieldError>{/if}
          </Field.Field>
          <CuilInput
            bind:value={newPerson.cuil}
            dni={newPerson.dni}
            cuilWarning={fw.cuilWarning}
            onCuilInput={fw.onCuilInput}
          />
          <Field.Field>
            <Field.FieldLabel for="pp-apellido" class="text-[11px]">Apellido</Field.FieldLabel>
            <Input id="pp-apellido" bind:value={newPerson.apellido} class="h-8 text-xs" />
          </Field.Field>
          <Field.Field>
            <Field.FieldLabel for="pp-nombre" class="text-[11px]">Nombre</Field.FieldLabel>
            <Input id="pp-nombre" bind:value={newPerson.nombre} class="h-8 text-xs" />
          </Field.Field>
          {#if !cargaMinima}
            <Field.Field data-invalid={Boolean(fw.telefonoWarning)}>
              <Field.FieldLabel for="pp-tel" class="text-[11px]">Teléfono</Field.FieldLabel>
              <InputGroup.Root>
                <InputGroup.Addon class="text-xs font-bold">+54</InputGroup.Addon>
                <InputGroup.Input id="pp-tel" bind:value={newPerson.telefono} oninput={fw.onTelefonoInput} class="h-8 text-xs" placeholder="9 11 1234-5678" inputmode="tel" />
              </InputGroup.Root>
              {#if fw.telefonoWarning}<Field.FieldError class="text-[10px]">{fw.telefonoWarning}</Field.FieldError>{/if}
            </Field.Field>
            <Field.Field data-invalid={Boolean(fw.emailWarning)}>
              <Field.FieldLabel for="pp-email" class="text-[11px]">Email</Field.FieldLabel>
              <Input id="pp-email" type="email" bind:value={newPerson.email} oninput={fw.onEmailInput} class="h-8 text-xs" placeholder="nombre@ejemplo.com" />
              {#if fw.emailWarning}<Field.FieldError class="text-[10px]">{fw.emailWarning}</Field.FieldError>{/if}
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="pp-dom" class="text-[11px]">Domicilio</Field.FieldLabel>
              <Input id="pp-dom" bind:value={newPerson.domicilio} class="h-8 text-xs" />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="pp-loc" class="text-[11px]">Localidad</Field.FieldLabel>
              <Combobox
                bind:value={newPerson.localidad}
                items={localidadesItems.current}
                placeholder="Elegir…"
                searchPlaceholder="Buscar…"
              />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="pp-nac" class="text-[11px]">Fecha de nacimiento</Field.FieldLabel>
              <Input id="pp-nac" type="date" bind:value={newPerson.fecha_nacimiento} class="h-8 text-xs" />
            </Field.Field>
          {/if}
        </Field.FieldGroup>
      {/if}

      {#if showCreateSocio}
        <span class="text-xs text-muted-foreground">Se creará la persona y se dará de alta como socio activo.</span>
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
