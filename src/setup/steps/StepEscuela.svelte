<script>
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as InputGroup from '$lib/components/ui/input-group'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import Combobox from '$lib/components/Combobox.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { cueSedeLabel } from '$core/format'
  import { EMAIL_INSTITUCIONAL_DOMAIN } from '$core/emailInstitucional'
  import CuilInput from '$app/modules/comunidad/parts/CuilInput.svelte'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check-big'
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert'

  let { store } = $props()

  // Campos de la escuela que se bloquean cuando se encontró en el índice oficial.
  // Los campos de cooperadora (cuit, email, telefono, color) siempre son editables.
  let escuelaLocked = $derived(store.cueState === 'found')
  // Los campos de escuela solo se habilitan cuando el CUE está resuelto
  // (found o not_found). Mientras está idle/typing, quedan deshabilitados.
  let escuelaEnabled = $derived(store.cueState === 'found' || store.cueState === 'not_found')
  let cueIsError = $derived(
    store.cueState === 'typing' ||
    (store.cueState === 'not_found' && !store.schoolData.cue.replace(/\D/g, '').startsWith('06'))
  )
</script>

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Datos de la escuela</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Ingresá el CUE para buscar la escuela en el registro oficial. Si se encuentra, los datos se completan automáticamente.</p>

    <!-- CUE primero: es la clave de búsqueda -->
    <div class="flex flex-col gap-1 mb-4">
      <Label class="text-xs font-bold text-muted-foreground">CUE (Clave Única de Establecimiento)</Label>
      <Input
        bind:value={store.schoolData.cue}
        oninput={() => store.onCueInput()}
        placeholder="06-XXXXX-0 (sede) o 06-XXXXX-00"
        inputmode="numeric"
        aria-invalid={cueIsError}
      />
      {#if store.cueState === 'found'}
        <div class="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500">
          <CheckCircleIcon class="size-3.5" />
          <span>Establecimiento encontrado: {store.escuelaOficial?.nombre}</span>
          {#if cueSedeLabel(store.schoolData.cue)}
            <Badge variant="secondary" class="text-[10px]">{cueSedeLabel(store.schoolData.cue)}</Badge>
          {/if}
        </div>
      {:else if store.cueState === 'not_found'}
        <div class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <AlertCircleIcon class="size-3.5 mt-0.5 shrink-0" />
          <span>{store.cueWarning}</span>
        </div>
      {:else if store.cueWarning}
        <span class="text-xs {cueIsError ? 'text-destructive' : 'text-muted-foreground'}">{store.cueWarning}</span>
      {:else}
        <span class="text-xs text-muted-foreground">Ingresá al menos 4 dígitos para iniciar la búsqueda.</span>
      {/if}
    </div>

    <!-- Campos de la escuela: deshabilitados hasta que el CUE se resuelva,
         y de solo lectura si se encontró en el registro oficial. -->
    <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Nombre</Label>
        <Input bind:value={store.schoolData.escuela_nombre} disabled={escuelaLocked || !escuelaEnabled} placeholder={escuelaEnabled ? 'Ej: Escuela N° 12' : 'Ingresá el CUE primero'} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Número</Label>
        <Input bind:value={store.schoolData.escuela_numero} disabled={escuelaLocked || !escuelaEnabled} placeholder={escuelaEnabled ? 'Ej: 12' : 'Ingresá el CUE primero'} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Distrito</Label>
        <Input bind:value={store.schoolData.distrito} disabled={escuelaLocked || !escuelaEnabled} placeholder={escuelaEnabled ? 'Ej: La Plata' : 'Ingresá el CUE primero'} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Domicilio</Label>
        <Input bind:value={store.schoolData.domicilio} disabled={escuelaLocked || !escuelaEnabled} placeholder={escuelaEnabled ? 'Calle N° 123' : 'Ingresá el CUE primero'} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Localidad</Label>
        <Combobox bind:value={store.schoolData.localidad} items={store.localidades} placeholder={escuelaEnabled ? 'Buscar localidad de PBA…' : 'Ingresá el CUE primero'} searchPlaceholder="Escribí el nombre…" disabled={escuelaLocked || !escuelaEnabled} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Email institucional</Label>
        <InputGroup.Root>
          <InputGroup.Input value={store.emailEscuelaAlias} oninput={(/** @type {Event} */ e) => store.onEmailEscuelaInput(e)} placeholder="escuela12" inputmode="email" disabled={!escuelaEnabled} />
          <InputGroup.Addon align="inline-end" class="font-bold text-sm">{EMAIL_INSTITUCIONAL_DOMAIN}</InputGroup.Addon>
        </InputGroup.Root>
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Teléfono</Label>
        <InputGroup.Root>
          <InputGroup.Addon class="font-bold text-sm">+54</InputGroup.Addon>
          <InputGroup.Input bind:value={store.schoolData.telefono_escuela} oninput={() => store.onTelefonoEscuelaInput()} placeholder="9 11 1234-5678" inputmode="tel" disabled={!escuelaEnabled} />
        </InputGroup.Root>
        {#if store.telefonoEscuelaWarning}
          <span class="text-xs text-destructive">{store.telefonoEscuelaWarning}</span>
        {/if}
      </div>
    </div>
  </Card.Content>
</Card.Root>

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Datos de la cooperadora</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Información de la cooperadora escolar asociada a la escuela. Estos datos no provienen del registro oficial; completalos manualmente.</p>

    <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Nombre</Label>
        <Input bind:value={store.schoolData.cooperadora_nombre} placeholder="Ej: Cooperadora Escolar N° 12" disabled={!escuelaEnabled} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">CUIT</Label>
        <CuilInput bind:value={store.schoolData.cuit} cuilWarning={store.cuitWarning} isJuridica={true} label="" onCuilInput={() => store.onCuitInput()} />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Email</Label>
        <Input bind:value={store.schoolData.email} oninput={() => store.onEmailInput()} placeholder="cooperadora@email.com" inputmode="email" disabled={!escuelaEnabled} />
        {#if store.emailWarning}
          <span class="text-xs text-destructive">{store.emailWarning}</span>
        {/if}
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Teléfono</Label>
        <InputGroup.Root>
          <InputGroup.Addon class="font-bold text-sm">+54</InputGroup.Addon>
          <InputGroup.Input bind:value={store.schoolData.telefono} oninput={() => store.onTelefonoInput()} placeholder="9 11 1234-5678" inputmode="tel" disabled={store.telefonoMismoQueEscuela || !escuelaEnabled} />
        </InputGroup.Root>
        {#if store.telefonoWarning}
          <span class="text-xs text-destructive">{store.telefonoWarning}</span>
        {/if}
        <label class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 cursor-pointer">
          <Checkbox checked={store.telefonoMismoQueEscuela} onCheckedChange={(e) => store.toggleTelefonoMismoQueEscuela()} disabled={!escuelaEnabled} />
          Mismo que la escuela
        </label>
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Color de marca</Label>
        <Input type="color" bind:value={store.schoolData.color_primario} disabled={!escuelaEnabled} />
      </div>
    </div>
  </Card.Content>
</Card.Root>
