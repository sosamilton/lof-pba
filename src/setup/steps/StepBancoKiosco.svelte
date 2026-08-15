<script>
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { Separator } from '$lib/components/ui/separator'
  import { CUENTAS_OPCIONES_EXPORT as CUENTAS_OPCIONES } from '../setupStore.svelte'

  let { store } = $props()
</script>

<!-- Banco -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Cuenta bancaria</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Por normativa de la Provincia de Buenos Aires, las cooperadoras escolares operan con una cuenta corriente en pesos en el Banco Provincia. Solo necesitás cargar el CBU.</p>

    <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Entidad bancaria</Label>
        <Input value={store.banco.entidad} disabled class="opacity-70" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Tipo de cuenta</Label>
        <Input value={store.banco.tipo_cuenta} disabled class="opacity-70" />
      </div>
      <div class="flex flex-col gap-1 sm:col-span-2">
        <Label class="text-xs font-bold text-muted-foreground">CBU (22 dígitos)</Label>
        <Input bind:value={store.banco.cbu} oninput={() => store.onCbuInput()} placeholder="01400000-00000000000000" inputmode="numeric" />
        {#if store.cbuWarning}
          <span class="text-xs {store.cbuWarning.includes('dígito verificador') ? 'text-yellow-600' : 'text-destructive'}">{store.cbuWarning}</span>
        {/if}
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Sucursal (opcional)</Label>
        <Input bind:value={store.banco.sucursal} placeholder="Ej: 000" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">N° de cuenta (opcional)</Label>
        <Input bind:value={store.banco.cuenta_corriente} placeholder="N° de cuenta corriente" />
      </div>
    </div>

    <div class="mt-4 p-3 rounded-lg border border-border bg-muted/5 text-[13px] text-muted-foreground">
      <p class="m-0">La cuenta del Banco Provincia está <strong>100% bonificada</strong> para cooperadoras escolares (convenio DGCyE). No se pueden usar bancos privados ni billeteras virtuales institucionalmente.</p>
    </div>
  </Card.Content>
</Card.Root>

<Separator class="mb-4" />

<!-- Cuenta default para movimientos -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Cuenta preferida para movimientos</h2>
    <p class="text-[13px] text-muted-foreground mb-4">¿En qué cuenta se registran los movimientos por defecto? Podés cambiarlo en cada movimiento.</p>

    <div class="flex flex-col gap-2">
      {#each CUENTAS_OPCIONES as c}
        <label class="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors hover:border-primary/30 {store.cuentaDefault === c ? 'border-primary/40 bg-primary/5' : 'border-border'}">
          <input type="radio" name="cuentaDefault" value={c} bind:group={store.cuentaDefault} class="size-4 accent-primary" />
          <span class="text-sm font-bold">{c}</span>
        </label>
      {/each}
    </div>
  </Card.Content>
</Card.Root>

<Separator class="mb-4" />

<!-- Kiosco / librería -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Kiosco / librería</h2>
    <p class="text-[13px] text-muted-foreground mb-4">¿La cooperadora gestiona un kiosco o librería escolar en este ejercicio?</p>

    <div class="flex items-center gap-2.5 p-3 rounded-xl border transition-colors {store.kiosco.posee ? 'border-primary/40 bg-primary/5' : 'border-border'} mb-3">
      <Switch bind:checked={store.kiosco.posee} />
      <span class="text-sm font-bold">Tiene kiosco o librería</span>
    </div>

    {#if store.kiosco.posee}
      <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-2">
        <div class="flex flex-col gap-1 sm:col-span-2">
          <Label class="text-xs font-bold text-muted-foreground">Modalidad de gestión</Label>
          <div class="flex gap-2">
            {#each ['Propio', 'Licitado'] as mod}
              <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors hover:border-primary/30 {store.kiosco.modalidad === mod ? 'border-primary/40 bg-primary/5' : 'border-border'} flex-1">
                <input type="radio" name="modalidad" value={mod} bind:group={store.kiosco.modalidad} class="size-4 accent-primary" />
                <span class="text-sm font-bold">{mod}</span>
              </label>
            {/each}
          </div>
        </div>
        {#if store.kiosco.modalidad === 'Licitado'}
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground">Contrato desde</Label>
            <Input type="date" bind:value={store.kiosco.contrato_desde} />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-bold text-muted-foreground">Contrato hasta</Label>
            <Input type="date" bind:value={store.kiosco.contrato_hasta} />
            {#if store.kiosco.contrato_desde && store.kiosco.contrato_hasta && store.kiosco.contrato_hasta < store.kiosco.contrato_desde}
              <span class="text-xs text-destructive">La fecha de fin no puede ser anterior al inicio</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
