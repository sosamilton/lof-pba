<script>
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'

  let {
    banco,
    bancoValidado = false,
    busy = false,
    onValidar = () => {},
  } = $props()
</script>

<div class="flex flex-col gap-4">
  <div class="grid gap-3 sm:grid-cols-3">
    <div>
      <Label for="banco-entidad">Entidad</Label>
      <Input id="banco-entidad" bind:value={banco.entidad} disabled={bancoValidado} class="mt-1" />
    </div>
    <div>
      <Label for="banco-cbu">CBU</Label>
      <Input id="banco-cbu" bind:value={banco.cbu} disabled={bancoValidado} oninput={banco.onCbuInput} placeholder="00000031-0000000000000001" inputmode="numeric" class="mt-1" />
    </div>
    <div>
      <Label for="banco-cc">Cuenta</Label>
      <Input id="banco-cc" bind:value={banco.cuenta_corriente} disabled={bancoValidado} class="mt-1" />
    </div>
    <div>
      <Label for="banco-sucursal">Sucursal</Label>
      <Input id="banco-sucursal" bind:value={banco.sucursal} disabled={bancoValidado} class="mt-1" />
    </div>
    <div>
      <Label for="banco-tipo">Tipo de cuenta</Label>
      <Input id="banco-tipo" bind:value={banco.tipo_cuenta} disabled={bancoValidado} class="mt-1" />
    </div>
  </div>
  <div class="flex items-center justify-between">
    {#if !bancoValidado}
      <Button variant="outline" size="sm" onclick={onValidar} disabled={busy}>
        <CheckCircleIcon data-icon="inline-start" />
        Validar y bloquear
      </Button>
    {/if}
  </div>
</div>
