<script>
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Switch } from '$lib/components/ui/switch'
  import { EMAIL_INSTITUCIONAL_DOMAIN } from '$core/format/emailInstitucional'
  import LockIcon from '@lucide/svelte/icons/lock'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'

  let {
    escuela,
    escuelaValidada = false,
    escuelaDirty = false,
    emailEscuelaAlias = '',
    emailEscuelaBloqueado = false,
    telefonoMismoQueEscuela = false,
    busy = false,
    onCueInput = () => {},
    onCuitInput = () => {},
    onTelefonoInput = () => {},
    onTelefonoEscuelaInput = () => {},
    onEmailEscuelaInput = () => {},
    onDirty = () => {},
    onToggleTelefono = () => {},
    onValidar = () => {},
    onSave = () => {},
  } = $props()
</script>

<div class="flex flex-col gap-4">
  <div class="grid gap-3 sm:grid-cols-2">
    <div>
      <Label for="distrito">Distrito</Label>
      <Input id="distrito" bind:value={escuela.distrito} disabled={escuelaValidada} oninput={() => onDirty()} class="mt-1" />
    </div>
    <div>
      <Label for="escuela-nombre">Escuela</Label>
      <Input id="escuela-nombre" bind:value={escuela.escuela_nombre} disabled={escuelaValidada} oninput={() => onDirty()} class="mt-1" />
    </div>
    <div>
      <Label for="escuela-numero">Número</Label>
      <Input id="escuela-numero" bind:value={escuela.escuela_numero} disabled={escuelaValidada} oninput={() => onDirty()} class="mt-1" />
    </div>
    <div>
      <Label for="cue">CUE</Label>
      <Input id="cue" bind:value={escuela.cue} disabled={escuelaValidada} oninput={() => { onCueInput(); onDirty() }} placeholder="06-12345-00" inputmode="numeric" class="mt-1" />
    </div>
    <div>
      <Label for="cuit">CUIT</Label>
      <Input id="cuit" bind:value={escuela.cuit} disabled={escuelaValidada} oninput={() => { onCuitInput(); onDirty() }} placeholder="20-12345678-9" inputmode="numeric" class="mt-1" />
    </div>
    <div>
      <Label for="coop-dom">Domicilio</Label>
      <Input id="coop-dom" bind:value={escuela.domicilio} disabled={escuelaValidada} oninput={() => onDirty()} class="mt-1" />
    </div>
    <div>
      <Label for="coop-loc">Localidad</Label>
      <Input id="coop-loc" bind:value={escuela.localidad} disabled={escuelaValidada} oninput={() => onDirty()} class="mt-1" />
    </div>
    <div>
      <Label for="coop-email">Email cooperadora</Label>
      <Input id="coop-email" bind:value={escuela.email_cooperadora} oninput={() => onDirty()} class="mt-1" />
    </div>
    <div>
      <Label for="coop-tel">Teléfono cooperadora</Label>
      <Input id="coop-tel" bind:value={escuela.telefono_cooperadora} oninput={() => { onTelefonoInput(); onDirty() }} disabled={telefonoMismoQueEscuela} placeholder="+54 9 11 1234-5678" inputmode="tel" class="mt-1" />
      <div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <Switch checked={telefonoMismoQueEscuela} onCheckedChange={() => onToggleTelefono()} />
        Mismo que la escuela
      </div>
    </div>
    <div>
      <Label for="email-escuela">Email institucional</Label>
      <div class="flex items-center gap-1 mt-1">
        <Input
          id="email-escuela"
          value={emailEscuelaAlias}
          oninput={onEmailEscuelaInput}
          disabled={emailEscuelaBloqueado}
          placeholder="escuela"
          class="flex-1"
        />
        <span class="text-sm text-muted-foreground whitespace-nowrap">{EMAIL_INSTITUCIONAL_DOMAIN}</span>
      </div>
      {#if escuelaValidada && !emailEscuelaBloqueado}
        <p class="mt-1 text-xs text-muted-foreground">Cargá el email institucional; al guardar queda bloqueado.</p>
      {/if}
    </div>
    <div>
      <Label for="tel-escuela">Teléfono escuela</Label>
      <Input id="tel-escuela" bind:value={escuela.telefono_escuela} disabled={escuelaValidada} oninput={() => { onTelefonoEscuelaInput(); onDirty() }} placeholder="+54 9 11 1234-5678" inputmode="tel" class="mt-1" />
    </div>
  </div>
  <div class="flex items-center justify-between">
    {#if !escuelaValidada}
      <Button variant="outline" size="sm" onclick={onValidar} disabled={busy}>
        <CheckCircleIcon data-icon="inline-start" />
        Validar y bloquear
      </Button>
    {/if}
    <Button onclick={onSave} disabled={busy || (escuelaValidada && !escuelaDirty)} class="ml-auto">Guardar</Button>
  </div>
</div>
