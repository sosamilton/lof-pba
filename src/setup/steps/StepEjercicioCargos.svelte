<script>
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import { Badge } from '$lib/components/ui/badge'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import LockIcon from '@lucide/svelte/icons/lock'
  import { MESES, ORGANISMOS, ORGANISMO_LABELS } from '../setupStore.svelte'

  let { store } = $props()

  // Organismos que siempre se muestran con su lista de cargos.
  const ORGANISMOS_FIJOS = ORGANISMOS.filter((o) => o !== 'Federacion')

  // Descripción corta de cada organismo, para dar contexto al usuario.
  const ORGANISMO_DESCRIPCIONES = {
    CD: 'Conduce la cooperadora: presidente, vicepresidente, tesorero, secretario, vocales.',
    CRC: 'Controla y revisa las cuentas y los movimientos financieros.',
    Federacion: 'Órgano al que adherís si tu cooperadora está federada.',
  }
</script>

<!-- Ejercicio -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Ejercicio en curso</h2>
    <p class="text-[13px] text-muted-foreground mb-4">El ejercicio es el período anual de gestión de la cooperadora. Por defecto va de marzo a marzo del año siguiente; confirmá o ajustá las fechas.</p>

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

{#if store.selectedModules.gestion_integral || store.selectedModules.carga_consolidada}
  <!-- Saldo inicial del ejercicio -->
  <Card.Root class="mb-4">
    <Card.Content class="pt-6">
      <h2 class="text-[17px] font-bold mb-1.5">Saldo inicial</h2>
      <p class="text-[13px] text-muted-foreground mb-4">Es el punto de partida del sistema: lo que tenías en banco, efectivo y caja chica al comenzar el ejercicio. Si recién empezás, dejalo en 0. Si venías con planilla, poné los saldos que tenías al iniciar.</p>

      <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-3">
        <div class="flex flex-col gap-1">
          <Label class="text-xs font-bold text-muted-foreground" for="saldo_inicial_banco">Banco</Label>
          <Input id="saldo_inicial_banco" type="number" bind:value={store.ejercicio.saldo_inicial_banco} placeholder="0" />
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-xs font-bold text-muted-foreground" for="saldo_inicial_efectivo">Efectivo</Label>
          <Input id="saldo_inicial_efectivo" type="number" bind:value={store.ejercicio.saldo_inicial_efectivo} placeholder="0" />
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-xs font-bold text-muted-foreground" for="saldo_inicial_caja_chica">Caja chica</Label>
          <Input id="saldo_inicial_caja_chica" type="number" bind:value={store.ejercicio.saldo_inicial_caja_chica} placeholder="0" />
        </div>
      </div>
    </Card.Content>
  </Card.Root>
{/if}

<Separator class="mb-4" />

<!-- Cargos -->
<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Cargos del estatuto</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Estos son los cargos que ocupan las autoridades de tu cooperadora según el estatuto: la <strong class="text-foreground">Comisión Directiva</strong> (CD), la <strong class="text-foreground">Comisión Revisora de Cuentas</strong> (CRC) y, si estás adherida, la <strong class="text-foreground">Federación</strong> de Cooperadoras.</p>

    <div class="mb-4 p-3 rounded-lg border border-border bg-muted/5 text-[13px] text-muted-foreground leading-relaxed">
      <span class="font-bold text-foreground">Cargos obligatorios</span> (etiqueta <Badge variant="secondary" class="text-[10px] py-0 px-1.5 align-middle">Obligatorio</Badge>): los exige el estatuto, no se pueden renombrar ni suspender.
      <br />
      <span class="font-bold text-foreground">Cargos opcionales</span>: podés renombrarlos, reordenarlos o suspenderlos con el switch <span class="font-bold text-foreground">Gestión</span>. Al suspender un cargo opcional deja de usarse en el día a día de la cooperadora, pero se conserva en la base de datos para poder informarlo en la Planilla de Inversión Anual (PIA) como «sin designar».
    </div>

    {#snippet cargoRow(cargo, i, org, grupoLen)}
      <div class="flex flex-wrap items-end gap-2 p-2.5 rounded-lg border border-border bg-muted/5 {!cargo.activo ? 'opacity-60' : ''}">
        <div class="flex flex-col gap-1 flex-1 min-w-[140px]">
          <Label class="text-[11px] text-muted-foreground">
            {cargo.cargo_obligatorio ? 'Cargo obligatorio por estatuto' : 'Cargo opcional'}
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
          <span class="text-[10px] text-muted-foreground leading-tight">Duración del mandato.</span>
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
          <span class="text-[10px] text-muted-foreground leading-tight">Titular o suplente.</span>
        </div>
        {#if cargo.cargo_obligatorio}
          <div class="flex flex-col gap-1 w-[130px]">
            <Label class="text-[11px] text-muted-foreground">Gestión</Label>
            <div class="flex items-center h-9">
              <Badge variant="secondary" class="text-[10px] gap-1 py-0.5 px-1.5">
                <LockIcon class="size-3" />
                Obligatorio
              </Badge>
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-1 w-[130px]">
            <Label class="text-[11px] text-muted-foreground">Gestión</Label>
            <div class="flex items-center gap-2 h-9">
              <Switch
                checked={cargo.activo}
                onCheckedChange={() => store.toggleCargoActivo(cargo._uid)}
                aria-label={cargo.activo ? 'Suspender la gestión del cargo' : 'Reactivar la gestión del cargo'}
              />
              <span class="text-[11px] font-medium {cargo.activo ? 'text-foreground' : 'text-muted-foreground'}">{cargo.activo ? 'Se gestiona' : 'Suspendido'}</span>
            </div>
          </div>
        {/if}
        <div class="flex items-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onclick={() => store.reordenar(org, i, -1)}>
            <ChevronUpIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Bajar" disabled={i === grupoLen - 1} onclick={() => store.reordenar(org, i, 1)}>
            <ChevronDownIcon />
          </Button>
        </div>
      </div>
    {/snippet}

    {#each ORGANISMOS_FIJOS as org}
      {@const grupo = store.cargosPorOrganismo(org)}
      <div class="mb-5 last:mb-0">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-sm font-extrabold">{ORGANISMO_LABELS[org] || org}</h3>
          <Button variant="outline" size="sm" onclick={() => store.addCargo(org)}>
            <PlusIcon data-icon="inline-start" />
            Agregar cargo
          </Button>
        </div>
        {#if ORGANISMO_DESCRIPCIONES[org]}
          <p class="text-[12px] text-muted-foreground mb-2 leading-relaxed">{ORGANISMO_DESCRIPCIONES[org]}</p>
        {/if}

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
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-sm font-extrabold">{ORGANISMO_LABELS['Federacion'] || 'Federación'}</h3>
      </div>
      <p class="text-[12px] text-muted-foreground mb-2 leading-relaxed">{ORGANISMO_DESCRIPCIONES['Federacion']}</p>

      <div class="flex items-center gap-2.5 p-3 rounded-xl border transition-colors {store.federacionAdherida ? 'border-primary/40 bg-primary/5' : 'border-border'} mb-3">
        <Switch checked={store.federacionAdherida} onCheckedChange={() => store.toggleFederacion()} aria-label="Adherida a la Federación de Cooperadoras" />
        <div>
          <div class="text-sm font-bold">Adherida a la Federación de Cooperadoras</div>
          <div class="text-[13px] text-muted-foreground mt-0.5">Muchas cooperadoras no están federadas. Activá esta opción solo si tu cooperadora está adherida; al hacerlo se habilitan los cargos correspondientes.</div>
        </div>
      </div>

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
