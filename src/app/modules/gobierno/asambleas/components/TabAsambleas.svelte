<script>
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import EmptyState from '$lib/components/EmptyState.svelte'
  import { TIPOS_ASAMBLEA, TIPOS_ASAMBLEA_CORTO } from '$app/modules/gobierno/constants.js'
  import { filterBySearch } from '$lib/hooks/useListFilter.svelte.js'
  import { useDebounce } from '$lib/hooks/useDebounce.svelte.js'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import SearchIcon from '@lucide/svelte/icons/search'
  import GavelIcon from '@lucide/svelte/icons/gavel'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckIcon from '@lucide/svelte/icons/check'
  import AsambleaWizard from './AsambleaWizard.svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import ControlledDialog from '$lib/components/ControlledDialog.svelte'

  let { store } = $props()

  let q = $state('')
  const qd = useDebounce(() => q)
  let wizardOpen = $state(false)
  let deleteConfirm = $state(null)

  const openWizard = (tipo) => {
    store.newAsamblea(tipo)
    wizardOpen = true
  }

  $effect(() => {
    if (store.pendingWizardTipo) {
      wizardOpen = true
      store.clearPendingWizard()
    }
  })

  const askDelete = () => {
    if (!store.asambleaForm?.id) return
    if (store.asambleaForm?.verificada) return
    const linkedCount = store.getLinkedAutoridadesCount(store.asambleaForm.id)
    deleteConfirm = {
      asambleaId: store.asambleaForm.id,
      tipo: store.asambleaForm.tipo_asamblea,
      fecha: store.asambleaForm.fecha,
      linkedCount,
      step: linkedCount > 0 ? 1 : 2,
    }
  }

  const confirmDeleteStep = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.step === 1) {
      deleteConfirm.step = 2
    } else {
      const id = deleteConfirm.asambleaId
      deleteConfirm = null
      notifyAfter(store, () => store.deleteAsamblea(id))
    }
  }

  const cancelDelete = () => {
    deleteConfirm = null
  }

  const tipoVariant = (t) => (t === 'AGO' ? 'default' : t === 'AGE' ? 'secondary' : 'outline')

  let filtered = $derived(
    filterBySearch(
      store.asambleas,
      qd.value,
      (a) => [a.fecha, a.tipo_asamblea, a.acta_numero, TIPOS_ASAMBLEA_CORTO[a.tipo_asamblea]],
    ),
  )
</script>

<div class="mb-4 flex flex-wrap items-center gap-3">
  <div class="relative min-w-[200px] flex-1">
    <SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Buscar (fecha, tipo, acta…)" bind:value={q} class="pl-9" />
  </div>
  <Button variant="outline" onclick={() => openWizard('AGO')}>
    <PlusIcon data-icon="inline-start" />
    Ordinaria/Autoridades
  </Button>
  <Button
    variant="outline"
    onclick={() => openWizard('AGE')}
    disabled={!store.tieneAlgunaAutoridad}
    title={store.tieneAlgunaAutoridad ? '' : 'Primero cargá autoridades desde una Asamblea Ordinaria'}
  >
    <PlusIcon data-icon="inline-start" />
    Extraordinaria
  </Button>
  <Button
    variant="outline"
    onclick={() => openWizard('RCD')}
    disabled={!store.tieneAlgunaAutoridad}
    title={store.tieneAlgunaAutoridad ? '' : 'Primero cargá autoridades desde una Asamblea Ordinaria'}
  >
    <PlusIcon data-icon="inline-start" />
    Reunión de CD
  </Button>
  <span class="text-sm text-muted-foreground">{filtered.length} reunión(es)</span>
</div>

{#if store.ejercicioSeleccionado && store.ejercicioSeleccionado !== store.ejercicio?.id}
  <p class="mb-3 text-xs text-muted-foreground">
    Mostrando reuniones de un ejercicio anterior. Las asambleas nuevas se crean en el ejercicio en curso.
  </p>
{/if}

<div class="grid gap-4" style="grid-template-columns: {filtered.length > 0 ? 'minmax(280px, 380px) 1fr' : '1fr'}">
  {#if filtered.length > 0}
    <div class="max-h-[calc(100vh-220px)] overflow-y-auto rounded-lg border border-border bg-card">
      {#each filtered as a (a.id)}
        <button
          type="button"
          class="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent {a.id === store.selectedAsambleaId ? 'bg-primary/10' : ''}"
          onclick={async () => { await store.editAsamblea(a); wizardOpen = true }}
        >
          <div class="flex items-center gap-2">
            <Badge variant={tipoVariant(a.tipo_asamblea)} class="text-[10px]">{a.tipo_asamblea}</Badge>
            <span class="text-sm font-semibold">{a.fecha || '(sin fecha)'}</span>
            {#if a.verificada}
              <Badge variant="secondary" class="text-[10px]">
                <CheckIcon class="size-2.5" data-icon="inline-start" />
                Verificada
              </Badge>
            {/if}
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            {TIPOS_ASAMBLEA_CORTO[a.tipo_asamblea] || a.tipo_asamblea}
            · Acta {a.acta_numero || '-'}
            {#if a.socios_presentes_cantidad != null && a.socios_presentes_cantidad !== ''}· {a.socios_presentes_cantidad} presentes{/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <div>
    {#if wizardOpen}
      <AsambleaWizard {store} bind:wizardOpen {askDelete} />
    {:else if filtered.length > 0}
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <GavelIcon class="size-8 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">Seleccioná una reunión o creá una nueva.</p>
      </div>
    {:else if filtered.length === 0 && q.trim()}
      <EmptyState
        title="Sin coincidencias"
        sub="No se encontraron reuniones con ese criterio."
        actionLabel="+ Ordinaria/Autoridades"
        onaction={() => openWizard('AGO')}
      >
        {#snippet actionIcon()}
          <PlusIcon data-icon="inline-start" />
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        title="Todavía no hay reuniones"
        sub="Creá la primera asamblea ordinaria para cargar las autoridades de la cooperadora."
        actionLabel="+ Ordinaria/Autoridades"
        onaction={() => openWizard('AGO')}
      >
        {#snippet actionIcon()}
          <GavelIcon data-icon="inline-start" />
        {/snippet}
      </EmptyState>
    {/if}
  </div>
</div>

{#if deleteConfirm}
  <ControlledDialog open={true} onClose={cancelDelete} class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <AlertTriangleIcon class="size-5 text-destructive" />
        {#if deleteConfirm.step === 1}
          Eliminar autoridades vinculadas
        {:else}
          Eliminar reunión
        {/if}
      </Dialog.Title>
      <Dialog.Description class="text-xs">
        {#if deleteConfirm.step === 1}
          Esta reunión del {deleteConfirm.fecha} tiene {deleteConfirm.linkedCount} autoridad(es) vinculada(s).
          Para eliminar la reunión, primero debés confirmar la eliminación de las autoridades.
        {:else}
          Se eliminará la reunión del {deleteConfirm.fecha}, sus resoluciones y cualquier autoridad vinculada.
          Esta acción no se puede deshacer.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={cancelDelete}>Cancelar</Button>
      {#if deleteConfirm.step === 1}
        <Button variant="destructive" onclick={confirmDeleteStep}>
          Sí, eliminar {deleteConfirm.linkedCount} autoridad(es)
        </Button>
      {:else}
        <Button variant="destructive" onclick={confirmDeleteStep}>
          Sí, eliminar reunión
        </Button>
      {/if}
    </Dialog.Footer>
  </ControlledDialog>
{/if}
