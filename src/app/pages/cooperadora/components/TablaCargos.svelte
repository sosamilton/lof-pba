<script>
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Switch } from '$lib/components/ui/switch'
  import * as Select from '$lib/components/ui/select'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Alert from '$lib/components/ui/alert'
  import * as Field from '$lib/components/ui/field'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { ORGANISMOS, ORGANISMO_LABELS, NIVELES_CARGO } from '$app/modules/gobierno/constants.js'
  import { formatFecha } from '$core/format/format'
  import { navigate } from '$core/ui/router.svelte'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import UserXIcon from '@lucide/svelte/icons/user-x'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import SettingsIcon from '@lucide/svelte/icons/settings'

  let {
    store,
    escuelaValidada = false,
    tieneAutoridadesVigentes = true,
  } = $props()

  let mostrarCargosEstatuto = $state(false)
</script>

<div class="flex flex-col gap-4">
  <!-- Selector de organismo -->
  <Tabs.Root value={store.organismo} onValueChange={store.setOrganismo}>
    <Tabs.List>
      {#each ORGANISMOS as org}<Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>{/each}
    </Tabs.List>
  </Tabs.Root>

  {#if store.comisionDirectiva.length > 0}
    <!-- Contador de quórum -->
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <AlertCircleIcon class="size-4" />
      Titulares vigentes: <span class="font-bold text-foreground">{store.quorumTitulares}</span>
    </div>

    <!-- Tabla de autoridades vigentes -->
    <div class="overflow-x-auto rounded-lg border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Cargo</Table.Head>
            <Table.Head>Titular</Table.Head>
            <Table.Head>CUIL</Table.Head>
            <Table.Head class="w-[90px]">Asunción</Table.Head>
            <Table.Head class="w-[90px]">Vence</Table.Head>
            <Table.Head class="w-[100px]">Origen</Table.Head>
            {#if tieneAutoridadesVigentes}
              <Table.Head class="w-[180px] text-right">Acciones</Table.Head>
            {/if}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each store.comisionDirectiva as fila (fila.cargoId)}
            {@const conflicto = fila.persona_id ? store.personaEnOtroCargo(fila.persona_id, fila.id) : null}
            <Table.Row>
              <Table.Cell class="text-sm font-medium">
                <div class="flex flex-col gap-1">
                  {fila.cargoNombre}
                  {#if fila.cargoObligatorio}
                    <Badge variant="secondary">Obligatorio</Badge>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell class="text-sm">
                {#if fila.persona_id || fila.apellido_nombre}
                  <div class="flex flex-col gap-0.5">
                    <span>{fila.apellido_nombre || '(sin nombre)'}</span>
                    {#if fila.dni}<span class="text-xs text-muted-foreground">DNI {fila.dni}</span>{/if}
                    {#if conflicto}
                      <span class="text-xs text-destructive">⚠ Ya figura en: {conflicto.apellido_nombre || 'otro cargo'}</span>
                    {/if}
                  </div>
                {:else}
                  <span class="text-xs text-muted-foreground italic">Vacante</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-sm">{fila.cuil || '—'}</Table.Cell>
              <Table.Cell class="text-sm">{formatFecha(fila.fecha_asuncion) || '—'}</Table.Cell>
              <Table.Cell class="text-sm">{formatFecha(fila.fecha_vencimiento) || '—'}</Table.Cell>
              <Table.Cell>
                {#if fila.tipo_origen === 'ReunionCD'}
                  <Badge variant="outline">RCD</Badge>
                {:else if fila.tipo_origen === 'Asamblea'}
                  <Badge variant="secondary">Asamblea</Badge>
                {:else if fila.persona_id}
                  <Badge variant="ghost">—</Badge>
                {/if}
              </Table.Cell>
              {#if tieneAutoridadesVigentes}
                <Table.Cell class="text-right">
                  {#if fila.persona_id || fila.apellido_nombre}
                    <div class="flex justify-end gap-1">
                      <Button variant="outline" size="sm" class="h-7" onclick={() => store.openCese(fila)}>
                        <UserXIcon data-icon="inline-start" />
                        Cese
                      </Button>
                      <Button variant="ghost" size="sm" class="h-7" onclick={() => store.openReemplazo(fila)}>
                        <RefreshCwIcon data-icon="inline-start" />
                        Reemplazo
                      </Button>
                    </div>
                  {/if}
                </Table.Cell>
              {/if}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>

    <!-- Alerta de quórum bajo -->
    {#if tieneAutoridadesVigentes && store.quorumTitulares < 4}
      <Alert.Root variant="destructive">
        <AlertCircleIcon class="size-4" />
        <Alert.Description>
          Quedan pocos titulares vigentes ({store.quorumTitulares}). Si se pierde el quórum, considerá convocar una Asamblea Ordinaria para elegir nuevas autoridades.
        </Alert.Description>
      </Alert.Root>
    {:else if tieneAutoridadesVigentes}
      <Field.FieldDescription>
        Las renuncias y reemplazos se registran con referencia a un acta de Comisión Directiva (RCD) o, excepcionalmente, a una Asamblea. No requieren convocar una nueva asamblea salvo que se pierda el quórum.
      </Field.FieldDescription>
    {/if}
  {:else}
    <p class="text-sm text-muted-foreground">No hay cargos definidos para este organismo.</p>
  {/if}

  <!-- Estado vacío: sin autoridades designadas -->
  {#if !tieneAutoridadesVigentes && store.comisionDirectiva.length > 0}
    <div class="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
      <AlertTriangleIcon class="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div class="flex flex-col gap-1">
        <span class="text-sm font-semibold text-amber-900 dark:text-amber-200">Sin autoridades designadas</span>
        <span class="text-sm text-amber-700 dark:text-amber-300">No hay autoridades vigentes para el ejercicio en curso. Convocá una asamblea para elegir a las autoridades.</span>
        <Button variant="outline" size="sm" class="mt-1 w-fit" onclick={() => navigate('gobierno')}>
          Ir a Asambleas y Autoridades
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  {/if}

  <!-- Sección plegable: Cargos del estatuto -->
  <Separator />

  <button
    type="button"
    class="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
    onclick={() => (mostrarCargosEstatuto = !mostrarCargosEstatuto)}
  >
    {#if mostrarCargosEstatuto}
      <ChevronDownIcon class="size-4" />
    {:else}
      <ChevronRightIcon class="size-4" />
    {/if}
    <SettingsIcon class="size-4" />
    Cargos del estatuto
  </button>

  {#if mostrarCargosEstatuto}
    <div class="flex flex-col gap-3 rounded-lg border border-border bg-muted/5 p-4">
      <Alert.Root variant="default">
        <AlertCircleIcon class="size-4" />
        <Alert.Description class="text-xs">
          Los cambios al estatuto (agregar, renombrar o eliminar cargos) deben ser aprobados por asamblea. Modificá esto solo si tenés el acta que lo respalda.
        </Alert.Description>
      </Alert.Root>

      {#if store.comisionDirectiva.length > 0}
        <div class="overflow-x-auto rounded-lg border border-border">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Cargo</Table.Head>
                <Table.Head class="w-[64px]">Orden</Table.Head>
                <Table.Head class="w-[80px]">Duración (m)</Table.Head>
                <Table.Head class="w-[70px]">Oblig.</Table.Head>
                <Table.Head class="w-[90px]"></Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each store.comisionDirectiva as fila (fila.cargoId)}
                <Table.Row>
                  <Table.Cell>
                    <Input bind:value={fila.cargo.nombre_cargo} class="h-8 text-sm" />
                  </Table.Cell>
                  <Table.Cell>
                    <Input type="number" bind:value={fila.cargo.orden} class="h-8 text-sm" />
                  </Table.Cell>
                  <Table.Cell>
                    <Input type="number" bind:value={fila.cargo.duracion_meses} class="h-8 text-sm" />
                  </Table.Cell>
                  <Table.Cell>
                    <Switch bind:checked={fila.cargo.cargo_obligatorio} />
                  </Table.Cell>
                  <Table.Cell>
                    <Button variant="outline" size="sm" onclick={() => store.saveCargo(fila.cargo)}>Guardar</Button>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}

      <!-- Agregar nuevo cargo -->
      <div class="text-sm font-semibold">Agregar cargo</div>
      <div class="grid gap-3 sm:grid-cols-3">
        <div><Label for="nc-nombre">Nombre</Label><Input id="nc-nombre" bind:value={store.nuevoCargo.nombre_cargo} class="mt-1" /></div>
        <div><Label for="nc-duracion">Duración (meses)</Label><Input id="nc-duracion" type="number" bind:value={store.nuevoCargo.duracion_meses} class="mt-1" /></div>
        <div>
          <Label for="nc-nivel">Nivel</Label>
          <Select.Root type="single" bind:value={store.nuevoCargo.nivel}>
            <Select.Trigger id="nc-nivel" class="mt-1 w-full">
              <Select.Value placeholder="Elegir…" />
            </Select.Trigger>
            <Select.Content>
              {#each NIVELES_CARGO as n}<Select.Item value={n}>{n}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div><Label for="nc-orden">Orden</Label><Input id="nc-orden" type="number" bind:value={store.nuevoCargo.orden} class="mt-1" /></div>
        <div class="flex flex-col gap-1"><Label class="text-xs font-medium text-muted-foreground">Obligatorio</Label><Switch bind:checked={store.nuevoCargo.cargo_obligatorio} class="mt-1" /></div>
        <div class="flex flex-col gap-1"><Label class="text-xs font-medium text-muted-foreground">Activo</Label><Switch bind:checked={store.nuevoCargo.activo} disabled={store.nuevoCargo.cargo_obligatorio} class="mt-1" /></div>
      </div>
      <div class="flex justify-end"><Button size="sm" onclick={store.addCargo} disabled={store.busy}>Agregar</Button></div>
    </div>
  {/if}
</div>
