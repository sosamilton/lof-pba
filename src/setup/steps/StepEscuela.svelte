<script>
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as InputGroup from '$lib/components/ui/input-group'
  import Combobox from '$lib/components/Combobox.svelte'
  import { cueSedeLabel } from '$core/format'

  let { store } = $props()
</script>

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Datos de la escuela y cooperadora</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Estos datos se usan en reportes y en la interfaz. Podés cambiarlos después.</p>

    <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Nombre de la escuela</Label>
        <Input bind:value={store.schoolData.escuela_nombre} placeholder="Ej: Escuela N° 12" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Número de escuela</Label>
        <Input bind:value={store.schoolData.escuela_numero} placeholder="Ej: 12" />
      </div>
      <div class="flex flex-col gap-1 sm:col-span-2">
        <Label class="text-xs font-bold text-muted-foreground">CUE (Clave Única de Establecimiento)</Label>
        <Input bind:value={store.schoolData.cue} oninput={() => store.onCueInput()} placeholder="06-XXXXX-00 (00 = sede central)" inputmode="numeric" />
        {#if store.cueWarning}
          <span class="text-xs {cueSedeLabel(store.schoolData.cue) ? 'text-muted-foreground' : 'text-destructive'}">{store.cueWarning}</span>
        {/if}
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Nombre de la cooperadora</Label>
        <Input bind:value={store.schoolData.cooperadora_nombre} placeholder="Ej: Cooperadora Escolar N° 12" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">CUIT cooperadora</Label>
        <Input bind:value={store.schoolData.cuit} oninput={() => store.onCuitInput()} placeholder="30-XXXXXXXX-X" inputmode="numeric" />
        {#if store.cuitWarning}
          <span class="text-xs text-destructive">{store.cuitWarning}</span>
        {/if}
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Domicilio</Label>
        <Input bind:value={store.schoolData.domicilio} placeholder="Calle N° 123" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Localidad</Label>
        <Combobox bind:value={store.schoolData.localidad} items={store.localidades} placeholder="Buscar localidad de PBA…" searchPlaceholder="Escribí el nombre…" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Email</Label>
        <Input bind:value={store.schoolData.email} oninput={() => store.onEmailInput()} placeholder="cooperadora@email.com" inputmode="email" />
        {#if store.emailWarning}
          <span class="text-xs text-destructive">{store.emailWarning}</span>
        {/if}
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Teléfono</Label>
        <InputGroup.Root>
          <InputGroup.Addon class="font-bold text-sm">+54</InputGroup.Addon>
          <InputGroup.Input bind:value={store.schoolData.telefono} oninput={() => store.onTelefonoInput()} placeholder="9 11 1234-5678" inputmode="tel" />
        </InputGroup.Root>
        {#if store.telefonoWarning}
          <span class="text-xs text-destructive">{store.telefonoWarning}</span>
        {/if}
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Color de marca</Label>
        <Input type="color" bind:value={store.schoolData.color_primario} />
      </div>
    </div>
  </Card.Content>
</Card.Root>
