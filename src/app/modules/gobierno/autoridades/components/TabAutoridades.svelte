<script>
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import * as Table from '$lib/components/ui/table'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Alert from '$lib/components/ui/alert'
  import * as Field from '$lib/components/ui/field'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import OrganismoTabs from './OrganismoTabs.svelte'
  import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'
  import { formatFecha } from '$core/format/format'
  import UserXIcon from '@lucide/svelte/icons/user-x'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle'
  import UsersIcon from '@lucide/svelte/icons/users'
  import GavelIcon from '@lucide/svelte/icons/gavel'

  let { store } = $props()
</script>

<Card.Root>
  <Card.Header>
    <div class="flex flex-col gap-3 min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <OrganismoTabs bind:value={store.organismo} class="min-w-0" />
      <div class="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <AlertCircleIcon class="size-4" />
        Titulares vigentes: <span class="font-bold text-foreground">{store.quorumTitulares}</span>
      </div>
    </div>
  </Card.Header>
  <Card.Content>
    {#if store.rows.length === 0}
      <EmptyState
        title="Sin cargos para este organismo"
        sub="Configurá los cargos del estatuto en 'Institucional' para gestionar las autoridades aquí."
      >
        {#snippet icon()}
          <UsersIcon class="size-8 text-muted-foreground" />
        {/snippet}
      </EmptyState>
    {:else if !store.tieneAutoridadesVigentes}
      <EmptyState
        title="Sin autoridades asignadas"
        sub="No hay personas ocupando cargos en {ORGANISMO_LABELS[store.organismo]}. Convocá una Asamblea General Ordinaria para elegir a las autoridades y cargarlas desde ahí."
        actionLabel="+ Ordinaria/Autoridades"
        onaction={store.crearAgoYCargar}
      >
        {#snippet icon()}
          <GavelIcon class="size-8 text-muted-foreground" />
        {/snippet}
        {#snippet actionIcon()}
          <GavelIcon data-icon="inline-start" />
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto rounded-lg border border-border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Cargo</Table.Head>
              <Table.Head>Persona</Table.Head>
              <Table.Head class="w-[130px]">Asunción</Table.Head>
              <Table.Head class="w-[130px]">Vence</Table.Head>
              <Table.Head class="w-[120px]">Origen</Table.Head>
              <Table.Head class="w-[200px] text-right">Acciones</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each store.rows as r (r.cargoId)}
              {@const conflicto = r.persona_id ? store.personaEnOtroCargo(r.persona_id, r.id) : null}
              <Table.Row>
                <Table.Cell>
                  <div class="flex flex-col gap-1">
                    <span class="text-sm font-bold">{r.cargoNombre}</span>
                    {#if r.cargoObligatorio}
                      <Badge variant="secondary">Obligatorio</Badge>
                    {/if}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {#if r.persona_id || r.apellido_nombre}
                    <div class="flex flex-col gap-0.5">
                      <span class="text-sm">{r.apellido_nombre || '(sin nombre)'}</span>
                      {#if r.dni}<span class="text-xs text-muted-foreground">DNI {r.dni}</span>{/if}
                      {#if conflicto}
                        <span class="text-xs text-destructive">⚠ Ya figura en: {conflicto.apellido_nombre || 'otro cargo'}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-xs text-muted-foreground italic">Vacante</span>
                  {/if}
                </Table.Cell>
                <Table.Cell><span class="text-xs">{formatFecha(r.fecha_asuncion) || '-'}</span></Table.Cell>
                <Table.Cell><span class="text-xs">{formatFecha(r.fecha_vencimiento) || '-'}</span></Table.Cell>
                <Table.Cell>
                  {#if r.tipo_origen === 'ReunionCD'}
                    <Badge variant="outline">RCD</Badge>
                  {:else if r.tipo_origen === 'Asamblea'}
                    <Badge variant="secondary">Asamblea</Badge>
                  {:else if r.persona_id}
                    <Badge variant="ghost">—</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right">
                  {#if r.persona_id || r.apellido_nombre}
                    <div class="flex justify-end gap-1">
                      <Button variant="outline" size="sm" class="h-7" onclick={() => store.openCese(r)}>
                        <UserXIcon data-icon="inline-start" />
                        Cese
                      </Button>
                      <Button variant="ghost" size="sm" class="h-7" onclick={() => store.openReemplazo(r)}>
                        <RefreshCwIcon data-icon="inline-start" />
                        Reemplazo
                      </Button>
                    </div>
                  {/if}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
      {#if store.quorumTitulares < 4}
        <Alert.Root variant="destructive" class="mt-3">
          <AlertCircleIcon class="size-4" />
          <Alert.Description>
            Quedan pocos titulares vigentes ({store.quorumTitulares}). Si se pierde el quórum, considerá convocar una Asamblea Ordinaria para elegir nuevas autoridades.
          </Alert.Description>
        </Alert.Root>
      {:else}
        <Field.FieldDescription class="mt-3">
          Las renuncias y reemplazos se registran con referencia a un acta de Comisión Directiva (RCD) o, excepcionalmente, a una Asamblea. No requieren convocar una nueva asamblea salvo que se pierda el quórum.
        </Field.FieldDescription>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
