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
  import OrganismoTabs from '$app/modules/gobierno/autoridades/components/OrganismoTabs.svelte'
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
  import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import LockIcon from '@lucide/svelte/icons/lock'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import CheckIcon from '@lucide/svelte/icons/check'
  import InfoIcon from '@lucide/svelte/icons/info'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/hooks/useConfirmDialog.svelte.js'

  let {
    store,
    escuelaValidada = false,
    tieneAutoridadesVigentes = true,
  } = $props()

  const esFederacion = $derived(store.organismo === 'Federacion')

  let mostrarCargosEstatuto = $state(false)

  // Diálogo de confirmación reutilizable (reemplaza confirm() nativo).
  const confirm = useConfirmDialog()
  const openConfirm = (opts) => confirm.openConfirm(opts)

  // Cargos del organismo seleccionado, ordenados por `orden`.
  // A diferencia de `comisionDirectiva` (que filtra activos), acá mostramos
  // todos los cargos del estatuto, incluidos los suspendidos, para poder
  // reactivarlos o eliminarlos.
  let cargosEstatuto = $derived(
    [...(store.cargos || [])].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  )

  const orgLabel = $derived(ORGANISMO_LABELS[store.organismo] || store.organismo)

  // Explicación del régimen de renovación por organismo.
  const ORGANISMO_RENOVACION = {
    CD: 'La CD dura 2 años y se renueva por mitades cada año (art. 15, Decreto 4767/72). Los cargos se reparten en Grupo A y B que alternan renovación.',
    CRC: 'La CRC dura 1 año: todos sus cargos se renuevan juntos en cada Asamblea Ordinaria. No hay grupos de renovación.',
    Federacion: 'Los representantes ante la Federación duran 1 año y se renuevan juntos en cada Asamblea Ordinaria (si la cooperadora está federada).',
  }

  const confirmarVerificarCargos = () => {
    openConfirm({
      title: '¿Verificar los cargos del estatuto?',
      description: 'Quedarán bloqueados y solo podrán modificarse tras registrar una Asamblea Extraordinaria con reforma del estatuto. Si necesitás corregir un error de carga, podés editarlos directamente en las tablas de Grist.',
      confirmLabel: 'Verificar y bloquear',
      variant: 'default',
      onConfirm: () => store.validarCargos(),
    })
  }

  const confirmarEliminarCargo = (cargo) => {
    openConfirm({
      title: `¿Eliminar el cargo "${cargo.nombre_cargo}"?`,
      description: 'El cargo se quitará del estatuto. Si había una autoridad designada, su registro se conservará en el historial.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
      onConfirm: () => store.deleteCargo(cargo.id),
    })
  }

  const confirmarToggleFederacion = () => {
    const activando = !store.federacion_adherida
    openConfirm({
      title: activando ? '¿Activar la participación en la Federación?' : '¿Desactivar la participación en la Federación?',
      description: activando
        ? 'Se habilitarán los cargos de representación ante la Federación. Podrás designar autoridades para esos cargos.'
        : 'Se desactivarán todos los cargos de la Federación. Las autoridades designadas pasarán al historial.',
      confirmLabel: activando ? 'Activar' : 'Desactivar',
      variant: activando ? 'default' : 'destructive',
      onConfirm: () => store.toggleFederacion(),
    })
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Selector de organismo -->
  <OrganismoTabs bind:value={store.organismo} class="min-w-0 w-full" />
  {#if esFederacion}
    <!-- Toggle de adhesión a la Federación -->
    <div class="flex items-center gap-2.5 p-3 rounded-xl border transition-colors {store.federacion_adherida ? 'border-primary/40 bg-primary/5' : 'border-border'}">
      <Switch checked={store.federacion_adherida} onCheckedChange={() => confirmarToggleFederacion()} disabled={store.busy} aria-label="Adherida a la Federación de Cooperadoras" />
      <div>
        <div class="text-sm font-bold">Adherida a la Federación de Cooperadoras</div>
        <div class="text-[13px] text-muted-foreground mt-0.5">Activá esta opción si tu cooperadora está adherida; al hacerlo se habilitan los cargos correspondientes.</div>
      </div>
    </div>
  {/if}

  {#if esFederacion && !store.federacion_adherida}
    <!-- Mensaje: cooperadora no federada -->
    <div class="flex items-start gap-3 rounded-lg border border-border bg-muted/5 px-4 py-3">
      <InfoIcon class="size-5 shrink-0 text-muted-foreground" />
      <div class="flex flex-col gap-1">
        <span class="text-sm font-semibold">Esta cooperadora no está adherida a la Federación</span>
        <span class="text-sm text-muted-foreground">Si tu cooperadora está federada, activá el switch de arriba para habilitar los cargos de representación.</span>
      </div>
    </div>
  {:else if store.comisionDirectiva.length > 0}
    <!-- Panel explicativo de renovación por organismo -->
    {#if ORGANISMO_RENOVACION[store.organismo]}
      <div class="flex items-start gap-2 rounded-lg border border-border bg-muted/5 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
        <InfoIcon class="size-3.5 shrink-0 mt-0.5" />
        <span>{ORGANISMO_RENOVACION[store.organismo]}</span>
      </div>
    {/if}

    <!-- Contador de quórum -->
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <AlertCircleIcon class="size-4" />
      Titulares vigentes: <span class="font-bold text-foreground">{store.quorumTitulares}</span>
      {#if store.organismo === 'CD' && store.grupoAVencerCD}
        <span class="ml-2 flex items-center gap-1">
          <RefreshCwIcon class="size-3" />
          Le toca renovar al <strong class="text-foreground">Grupo {store.grupoAVencerCD}</strong> en la próxima asamblea.
        </span>
      {/if}
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
                  <div class="flex items-center gap-1.5">
                    {fila.cargoNombre}
                    {#if fila.cargoGrupoRenovacion && store.organismo === 'CD'}
                      <Badge variant="outline" class="text-[10px] py-0 px-1.5 {fila.cargoGrupoRenovacion === store.grupoAVencerCD ? 'border-primary text-primary' : ''}">
                        Grupo {fila.cargoGrupoRenovacion}
                      </Badge>
                    {/if}
                  </div>
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
          Ir a Asambleas y Memorias
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  {/if}

  <!-- Sección plegable: Cargos del estatuto -->
  <Separator />

  <div class="flex items-center justify-between gap-2">
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
      {#if store.cargos_validados}
        <Badge variant="secondary"><LockIcon class="size-3" /> Verificado</Badge>
      {/if}
    </button>
    {#if mostrarCargosEstatuto && !store.cargos_validados && cargosEstatuto.length > 0}
      <Button variant="outline" size="sm" onclick={confirmarVerificarCargos} disabled={store.busy}>
        <CheckIcon data-icon="inline-start" />
        Verificar cargos
      </Button>
    {/if}
  </div>

  {#if mostrarCargosEstatuto}
    <div class="flex flex-col gap-3 rounded-lg border border-border bg-muted/5 p-4">
      {#if store.cargos_validados}
        <Alert.Root variant="default">
          <LockIcon class="size-4" />
          <Alert.Description class="text-xs">
            Los cargos del estatuto están <strong>verificados y bloqueados</strong>. Para modificar la estructura (agregar, renombrar, eliminar o reordenar cargos) registrá una <strong>Asamblea Extraordinaria</strong> con motivo <strong>Reforma estatuto</strong> en Asambleas y Memorias; al guardarla, la edición se habilitará automáticamente.
          </Alert.Description>
        </Alert.Root>
      {:else}
        <Alert.Root variant="default">
          <AlertCircleIcon class="size-4" />
          <Alert.Description class="text-xs">
            Los cambios al estatuto (agregar, renombrar o eliminar cargos) deben ser aprobados por asamblea. Modificá esto solo si tenés el acta que lo respalda. Cuando termines, <strong>verificá</strong> los cargos para bloquear la edición.
          </Alert.Description>
        </Alert.Root>
      {/if}

      {#if cargosEstatuto.length > 0}
        <div class="flex flex-col gap-2">
          {#each cargosEstatuto as cargo, i (cargo.id)}
            <div class="flex flex-wrap items-end gap-2 p-2.5 rounded-lg border border-border bg-background {!cargo.activo ? 'opacity-60' : ''}">
              <div class="flex flex-col gap-1 flex-1 min-w-[160px]">
                <Label class="text-[11px] text-muted-foreground">
                  {cargo.cargo_obligatorio ? 'Cargo obligatorio por estatuto' : 'Cargo opcional'}
                </Label>
                <Input
                  value={cargo.nombre_cargo}
                  disabled={store.cargos_validados || cargo.cargo_obligatorio}
                  oninput={(e) => { cargo.nombre_cargo = e.target.value }}
                  class="h-8 text-sm"
                  placeholder="Nombre del cargo"
                />
              </div>
              <div class="flex flex-col gap-1 w-[100px]">
                <Label class="text-[11px] text-muted-foreground">Duración (m)</Label>
                <Input
                  type="number"
                  value={cargo.duracion_meses}
                  disabled={store.cargos_validados}
                  oninput={(e) => { cargo.duracion_meses = Number(e.target.value) || 12 }}
                  class="h-8 text-sm"
                />
              </div>
              <div class="flex flex-col gap-1 w-[110px]">
                <Label class="text-[11px] text-muted-foreground">Nivel</Label>
                <select
                  value={cargo.nivel}
                  disabled={store.cargos_validados}
                  onchange={(e) => { cargo.nivel = e.target.value }}
                  class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">—</option>
                  <option value="Titular">Titular</option>
                  <option value="Suplente">Suplente</option>
                </select>
              </div>
              {#if store.organismo === 'CD'}
                <div class="flex flex-col gap-1 w-[100px]">
                  <Label class="text-[11px] text-muted-foreground">Grupo renov.</Label>
                  <select
                    value={cargo.grupo_renovacion || ''}
                    disabled={store.cargos_validados}
                    onchange={(e) => { cargo.grupo_renovacion = e.target.value }}
                    class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">—</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>
              {/if}
              <div class="flex flex-col gap-1 w-[120px]">
                <Label class="text-[11px] text-muted-foreground">Gestión</Label>
                {#if cargo.cargo_obligatorio}
                  <div class="flex items-center h-8">
                    <Badge variant="secondary" class="text-[10px] gap-1 py-0.5 px-1.5">
                      <LockIcon class="size-3" />
                      Obligatorio
                    </Badge>
                  </div>
                {:else}
                  <div class="flex items-center gap-2 h-8">
                    <Switch
                      checked={cargo.activo}
                      disabled={store.cargos_validados}
                      onCheckedChange={() => store.toggleCargoActivo(cargo.id)}
                      aria-label={cargo.activo ? 'Suspender la gestión del cargo' : 'Reactivar la gestión del cargo'}
                    />
                    <span class="text-[11px] font-medium {cargo.activo ? 'text-foreground' : 'text-muted-foreground'}">{cargo.activo ? 'Se gestiona' : 'Suspendido'}</span>
                  </div>
                {/if}
              </div>
              <div class="flex items-end gap-1">
                <Button variant="ghost" size="icon" class="size-8" aria-label="Subir"
                  disabled={store.cargos_validados || i === 0 || (i === 1 && store.esPresidente(cargosEstatuto[0]))}
                  onclick={() => store.reordenarCargo(cargo.id, -1)}>
                  <ChevronUpIcon class="size-4" />
                </Button>
                <Button variant="ghost" size="icon" class="size-8" aria-label="Bajar"
                  disabled={store.cargos_validados || i === cargosEstatuto.length - 1 || (i === 0 && store.esPresidente(cargo))}
                  onclick={() => store.reordenarCargo(cargo.id, 1)}>
                  <ChevronDownIcon class="size-4" />
                </Button>
                {#if !cargo.cargo_obligatorio}
                  <Button variant="ghost" size="icon" class="size-8 text-destructive hover:text-destructive" aria-label="Eliminar"
                    disabled={store.cargos_validados}
                    onclick={() => confirmarEliminarCargo(cargo)}>
                    <TrashIcon class="size-4" />
                  </Button>
                {/if}
                <Button variant="outline" size="sm" class="h-8"
                  disabled={store.cargos_validados}
                  onclick={() => store.saveCargo(cargo)}>
                  Guardar
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-muted-foreground italic">No hay cargos definidos para {orgLabel}.</p>
      {/if}

      <!-- Agregar nuevo cargo (solo si no está validado) -->
      {#if !store.cargos_validados}
        <Separator />
        <div class="text-sm font-semibold flex items-center gap-1">
          <PlusIcon class="size-4" />
          Agregar cargo a {orgLabel}
        </div>
        <div class="grid gap-3 sm:grid-cols-4">
          <div class="flex flex-col gap-1">
            <Label for="nc-nombre" class="text-xs font-bold text-muted-foreground">Nombre</Label>
            <Input id="nc-nombre" bind:value={store.nuevoCargo.nombre_cargo} class="h-8 text-sm" placeholder="Vocal Titular 4" />
          </div>
          <div class="flex flex-col gap-1">
            <Label for="nc-duracion" class="text-xs font-bold text-muted-foreground">Duración (meses)</Label>
            <Input id="nc-duracion" type="number" bind:value={store.nuevoCargo.duracion_meses} class="h-8 text-sm" />
          </div>
          <div class="flex flex-col gap-1">
            <Label for="nc-nivel" class="text-xs font-bold text-muted-foreground">Nivel</Label>
            <Select.Root type="single" bind:value={store.nuevoCargo.nivel}>
              <Select.Trigger id="nc-nivel" class="h-8 text-sm">
                <Select.Value placeholder="Elegir…" />
              </Select.Trigger>
              <Select.Content>
                {#each NIVELES_CARGO as n}<Select.Item value={n}>{n}</Select.Item>{/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex items-end">
            <Button size="sm" onclick={store.addCargo} disabled={store.busy} class="w-full">
              <PlusIcon data-icon="inline-start" />
              Agregar
            </Button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirm.open}
  title={confirm.title}
  description={confirm.description}
  confirmLabel={confirm.confirmLabel}
  variant={confirm.variant}
  busy={store.busy}
  onConfirm={confirm.handleConfirm}
/>
