<script>
  import { Input } from '$lib/components/ui/input'
  import * as Field from '$lib/components/ui/field'
  import * as InputGroup from '$lib/components/ui/input-group'
  import Combobox from '$lib/components/Combobox.svelte'
  import { localidadesItems } from '../personas/personasApi.js'
  import CuilInput from './CuilInput.svelte'

  // Campos compartidos de persona física: DNI, CUIL, apellido, nombre,
  // domicilio, localidad, teléfono, email, fecha_nacimiento.
  // Se usa tanto en Socios como en Personas (para tipo Física).
  let {
    form,
    dniWarning = '',
    cuilWarning = '',
    telefonoWarning = '',
    emailWarning = '',
    onDniInput = () => {},
    onCuilInput = () => {},
    onTelefonoInput = () => {},
    onEmailInput = () => {},
    showFechaNacimiento = true,
    fechaNacimientoWarning = '',
    onFechaNacimientoInput = () => {},
  } = $props()
</script>

<Field.Field data-invalid={Boolean(dniWarning)}>
  <Field.FieldLabel for="dni">DNI</Field.FieldLabel>
  <Input id="dni" bind:value={form.dni} oninput={onDniInput} aria-invalid={Boolean(dniWarning)} placeholder="12.345.678" inputmode="numeric" />
  {#if dniWarning}<Field.FieldError>{dniWarning}</Field.FieldError>{/if}
</Field.Field>
<CuilInput bind:value={form.cuil} dni={form.dni} {cuilWarning} {onCuilInput} />
<Field.Field>
  <Field.FieldLabel for="apellido">Apellido</Field.FieldLabel>
  <Input id="apellido" bind:value={form.apellido} />
</Field.Field>
<Field.Field>
  <Field.FieldLabel for="nombre">Nombre</Field.FieldLabel>
  <Input id="nombre" bind:value={form.nombre} />
</Field.Field>
{#if showFechaNacimiento}
  <Field.Field data-invalid={Boolean(fechaNacimientoWarning)}>
    <Field.FieldLabel for="fecha-nacimiento">Fecha de nacimiento</Field.FieldLabel>
    <Input id="fecha-nacimiento" type="date" bind:value={form.fecha_nacimiento} oninput={onFechaNacimientoInput} aria-invalid={Boolean(fechaNacimientoWarning)} />
    {#if fechaNacimientoWarning}<Field.FieldError>{fechaNacimientoWarning}</Field.FieldError>{/if}
  </Field.Field>
{/if}
<Field.Field>
  <Field.FieldLabel for="domicilio">Domicilio</Field.FieldLabel>
  <Input id="domicilio" bind:value={form.domicilio} />
</Field.Field>
<Field.Field>
  <Field.FieldLabel for="localidad">Localidad</Field.FieldLabel>
  <Combobox
    bind:value={form.localidad}
    items={localidadesItems.current}
    placeholder="Elegir localidad…"
    searchPlaceholder="Buscar localidad de PBA…"
  />
</Field.Field>
<Field.Field data-invalid={Boolean(telefonoWarning)}>
  <Field.FieldLabel for="telefono">Teléfono</Field.FieldLabel>
  <InputGroup.Root>
    <InputGroup.Addon class="font-bold text-sm">+54</InputGroup.Addon>
    <InputGroup.Input id="telefono" bind:value={form.telefono} oninput={onTelefonoInput} aria-invalid={Boolean(telefonoWarning)} placeholder="9 11 1234-5678" inputmode="tel" />
  </InputGroup.Root>
  {#if telefonoWarning}<Field.FieldError>{telefonoWarning}</Field.FieldError>{/if}
</Field.Field>
<Field.Field data-invalid={Boolean(emailWarning)}>
  <Field.FieldLabel for="email">Email</Field.FieldLabel>
  <Input id="email" type="email" bind:value={form.email} oninput={onEmailInput} aria-invalid={Boolean(emailWarning)} placeholder="nombre@ejemplo.com" inputmode="email" />
  {#if emailWarning}<Field.FieldError>{emailWarning}</Field.FieldError>{/if}
</Field.Field>
