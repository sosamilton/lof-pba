<script>
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { MESES } from '$core/utils'
  import CalendarIcon from '@lucide/svelte/icons/calendar'

  let {
    show = false,
    proximoVencer = false,
    nuevoEj = null,
    creating = false,
    onShow = () => {},
    onCancel = () => {},
    onCreate = () => {},
  } = $props()
</script>

{#if proximoVencer && !show}
  <Button onclick={onShow} disabled={creating}>
    <CalendarIcon data-icon="inline-start" />
    Crear nuevo ejercicio
  </Button>
{/if}
{#if show}
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base">Crear nuevo ejercicio</Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div><Label for="ej-desde">Año desde</Label><Input id="ej-desde" type="number" bind:value={nuevoEj.anio_inicio} class="mt-1" /></div>
        <div><Label for="ej-hasta">Año hasta</Label><Input id="ej-hasta" type="number" bind:value={nuevoEj.anio_fin} class="mt-1" /></div>
        <div>
          <Label for="ej-mes">Mes inicio</Label>
          <Select.Root type="single" bind:value={nuevoEj.mes_inicio}>
            <Select.Trigger id="ej-mes" class="mt-1 w-full">
              <Select.Value placeholder="Mes…" />
            </Select.Trigger>
            <Select.Content>
              {#each MESES as m}<Select.Item value={m}>{m}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div><Label for="ej-banco">Saldo banco</Label><Input id="ej-banco" type="number" bind:value={nuevoEj.saldo_inicial_banco} class="mt-1" /></div>
        <div><Label for="ej-efectivo">Saldo efectivo</Label><Input id="ej-efectivo" type="number" bind:value={nuevoEj.saldo_inicial_efectivo} class="mt-1" /></div>
        <div><Label for="ej-caja">Saldo caja chica</Label><Input id="ej-caja" type="number" bind:value={nuevoEj.saldo_inicial_caja_chica} class="mt-1" /></div>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="outline" size="sm" onclick={onCancel}>Cancelar</Button>
        <Button size="sm" onclick={onCreate} disabled={creating}>Crear y activar</Button>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
