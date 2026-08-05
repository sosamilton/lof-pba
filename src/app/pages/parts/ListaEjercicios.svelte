<script>
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import * as Card from '$lib/components/ui/card'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import CheckIcon from '@lucide/svelte/icons/check'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { MESES } from '$core/utils'

  let {
    ejercicios = [],
    nuevoEj = null,
    creating = false,
    busy = false,
    onEditar = () => {},
    onActivar = () => {},
    onEliminar = () => {},
    onCrear = () => {},
  } = $props()

  let showForm = $state(false)

  const toggleForm = () => { showForm = !showForm }
</script>

<div class="flex flex-col gap-3">
  {#each ejercicios as e (e.id)}
    <div class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div class="flex flex-col gap-0.5">
        <div class="text-sm font-semibold">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
        <div class="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
          <span>{e.en_curso ? 'En curso' : 'Inactivo'}</span>
          {#if e.saldo_inicial_total != null}
            <span>· Saldo inicial: <span class="font-semibold text-foreground">${Number(e.saldo_inicial_total).toLocaleString('es-AR')}</span></span>
          {/if}
          {#if e.fecha_inicio}
            <span>· Inicio: {e.fecha_inicio}</span>
          {/if}
          {#if e.fecha_fin}
            <span>· Fin: {e.fecha_fin}</span>
          {/if}
          {#if e.observaciones}
            <span>· {e.observaciones}</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        {#if e.en_curso}
          <Badge variant="default">En curso</Badge>
        {:else}
          <Button variant="ghost" size="sm" onclick={() => onActivar(e.id)} disabled={busy}>
            <CheckIcon data-icon="inline-start" />
            Activar
          </Button>
        {/if}
        <Button variant="outline" size="sm" onclick={() => onEditar(e)} disabled={busy}>
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
        {#if !e.en_curso}
          <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" onclick={() => onEliminar(e)} disabled={busy}>
            <TrashIcon data-icon="inline-start" />
          </Button>
        {/if}
      </div>
    </div>
  {/each}

  {#if showForm}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-base">Nuevo ejercicio</Card.Title>
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
          <Button variant="outline" size="sm" onclick={toggleForm}>Cancelar</Button>
          <Button size="sm" onclick={() => { onCrear(); showForm = false }} disabled={creating}>
            {#if creating}Creando…{:else}Crear y activar{/if}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <Button variant="outline" size="sm" class="w-fit" onclick={toggleForm} disabled={busy || creating}>
      <PlusIcon data-icon="inline-start" />
      Nuevo ejercicio
    </Button>
  {/if}
</div>
