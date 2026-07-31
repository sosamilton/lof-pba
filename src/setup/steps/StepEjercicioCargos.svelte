<script>
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import EyeOffIcon from '@lucide/svelte/icons/eye-off'
  import { MESES, ORGANISMOS, ORGANISMO_LABELS } from '../setupStore.svelte'

  let { store } = $props()

  // Organismos que siempre se muestran con su lista de cargos.
  const ORGANISMOS_FIJOS = ORGANISMOS.filter((o) => o !== 'Federacion')
</script>

<!-- Ejercicio -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Ejercicio en curso</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Por defecto va de marzo a marzo del año siguiente. Confirmá o ajustá el período.</p>

    <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-3">
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Mes de inicio</Label>
        <select bind:value={store.ejercicio.mes_inicio} class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
          {#each MESES as mes}
            <option value={mes}>{mes}</option>
          {/each}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Año de inicio</Label>
        <Input type="number" bind:value={store.ejercicio.anio_inicio} placeholder="2026" />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs font-bold text-muted-foreground">Año de cierre</Label>
        <Input type="number" bind:value={store.ejercicio.anio_fin} placeholder="2027" />
        {#if Number(store.ejercicio.anio_fin) <= Number(store.ejercicio.anio_inicio)}
          <span class="text-xs text-destructive">El año de cierre debe ser mayor al de inicio</span>
        {/if}
      </div>
    </div>
    <div class="mt-3 p-3 rounded-lg border border-border bg-muted/5 text-[13px] text-muted-foreground">
      Ejercicio: <span class="font-bold text-foreground">{store.ejercicio.mes_inicio} {store.ejercicio.anio_inicio}</span> → <span class="font-bold text-foreground">{store.ejercicio.anio_fin}</span>
    </div>
  </Card.Content>
</Card.Root>

<Separator class="mb-4" />

<!-- Cargos -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Cargos del estatuto</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Los cargos obligatorios no se pueden renombrar ni deshabilitar. Los opcionales podés renombrarlos, reordenarlos y deshabilitarlos.</p>

    <div class="mb-4 p-3 rounded-lg border border-border bg-muted/5 text-[13px] text-muted-foreground">
      Al deshabilitar un cargo opcional, se deja de gestionar en el módulo de gobierno pero se preserva en la base de datos para poder informarlo en la PIA como sin designar.
    </div>

    {#snippet cargoRow(cargo, i, org, grupoLen)}
      <div class="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/5 {!cargo.activo ? 'opacity-50' : ''}">
        <div class="flex flex-col gap-1 flex-1 min-w-[140px]">
          <Label class="text-[11px] text-muted-foreground">
            Cargo {cargo.cargo_obligatorio ? '(obligatorio)' : !cargo.activo ? '(deshabilitado)' : '(opcional)'}
          </Label>
          <Input
            value={cargo.nombre_cargo}
            disabled={cargo.cargo_obligatorio}
            oninput={(e) => { cargo.nombre_cargo = e.target.value; store.cargos = [...store.cargos] }}
            placeholder="Nombre del cargo"
          />
        </div>
        <div class="flex flex-col gap-1 w-[110px]">
          <Label class="text-[11px] text-muted-foreground">Duración (meses)</Label>
          <Input
            type="number"
            value={cargo.duracion_meses}
            oninput={(e) => { cargo.duracion_meses = Number(e.target.value) || 12; store.cargos = [...store.cargos] }}
          />
        </div>
        <div class="flex flex-col gap-1 w-[120px]">
          <Label class="text-[11px] text-muted-foreground">Nivel</Label>
          <select
            value={cargo.nivel}
            onchange={(e) => { cargo.nivel = e.target.value; store.cargos = [...store.cargos] }}
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">—</option>
            <option value="Titular">Titular</option>
            <option value="Suplente">Suplente</option>
          </select>
        </div>
        <div class="flex items-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onclick={() => store.reordenar(org, i, -1)}>
            <ChevronUpIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Bajar" disabled={i === grupoLen - 1} onclick={() => store.reordenar(org, i, 1)}>
            <ChevronDownIcon />
          </Button>
          {#if !cargo.cargo_obligatorio}
            <Button variant="ghost" size="icon" aria-label={cargo.activo ? 'Deshabilitar' : 'Habilitar'} title={cargo.activo ? 'Deshabilitar la gestión del cargo (se preserva para la PIA)' : 'Volver a habilitar la gestión del cargo'} onclick={() => store.toggleCargoActivo(cargo._uid)}>
              {#if cargo.activo}
                <EyeOffIcon />
              {:else}
                <EyeIcon />
              {/if}
            </Button>
          {/if}
        </div>
      </div>
    {/snippet}

    {#each ORGANISMOS_FIJOS as org}
      {@const grupo = store.cargosPorOrganismo(org)}
      <div class="mb-5 last:mb-0">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-extrabold">{ORGANISMO_LABELS[org] || org}</h3>
          <Button variant="outline" size="sm" onclick={() => store.addCargo(org)}>
            <PlusIcon data-icon="inline-start" />
            Agregar cargo
          </Button>
        </div>

        {#if grupo.length === 0}
          <p class="text-[13px] text-muted-foreground italic">Sin cargos en este organismo.</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each grupo as cargo, i (cargo._uid)}
              {@render cargoRow(cargo, i, org, grupo.length)}
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Federación de Cooperadoras: adhesión opcional -->
    <div class="mb-5 last:mb-0">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-extrabold">{ORGANISMO_LABELS['Federacion'] || 'Federación'}</h3>
      </div>

      <label class="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors hover:border-primary/30 {store.federacionAdherida ? 'border-primary/40 bg-primary/5' : 'border-border'} mb-3">
        <Checkbox checked={store.federacionAdherida} onchange={() => store.toggleFederacion()} />
        <div>
          <div class="text-sm font-bold">Adherida a la Federación de Cooperadoras</div>
          <div class="text-[13px] text-muted-foreground mt-0.5">Muchas cooperadoras no están federadas. Marcá esta opción solo si tu cooperadora está adherida.</div>
        </div>
      </label>

      {#if store.federacionAdherida}
        {@const grupoFed = store.cargosPorOrganismo('Federacion')}
        {#if grupoFed.length === 0}
          <p class="text-[13px] text-muted-foreground italic">Sin cargos en este organismo.</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each grupoFed as cargo, i (cargo._uid)}
              {@render cargoRow(cargo, i, 'Federacion', grupoFed.length)}
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </Card.Content>
</Card.Root>
