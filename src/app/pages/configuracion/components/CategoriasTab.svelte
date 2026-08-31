<script>
  import * as Card from '$lib/components/ui/card'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import FolderIcon from '@lucide/svelte/icons/folder'
  import InfoIcon from '@lucide/svelte/icons/info'
  import PowerIcon from '@lucide/svelte/icons/power'
  import CollapsibleSection from '$lib/components/CollapsibleSection.svelte'

  let { store } = $props()

  // Estado de UI: qué grupo está expandido
  let gruposAbiertos = $state(new Set())

  // Diálogo de creación
  let dialogCrearOpen = $state(false)
  let crearRubroId = $state('')
  let crearRubroNombre = $state('')
  let crearNombre = $state('')

  // Diálogo de edición
  let dialogEditarOpen = $state(false)
  let editarId = $state(null)
  let editarNombre = $state('')
  let editarRubroNombre = $state('')

  // Diálogo de eliminación
  let dialogEliminarOpen = $state(false)
  let eliminarId = $state(null)
  let eliminarNombre = $state('')
  let eliminarRubroNombre = $state('')

  const toggleGrupo = (grupo) => {
    const next = new Set(gruposAbiertos)
    if (next.has(grupo)) next.delete(grupo)
    else next.add(grupo)
    gruposAbiertos = next
  }

  const abrirCrear = (rubro) => {
    crearRubroId = String(rubro.id)
    crearRubroNombre = rubro.nombre_oficial
    crearNombre = ''
    store.clearMessages()
    dialogCrearOpen = true
  }

  const confirmCrear = async () => {
    const ok = await store.crearSubrubro(Number(crearRubroId), crearNombre)
    if (ok) {
      dialogCrearOpen = false
      crearNombre = ''
    }
  }

  const abrirEditar = (subrubro, rubroNombre) => {
    editarId = subrubro.id
    editarNombre = subrubro.nombre_subrubro
    editarRubroNombre = rubroNombre
    store.clearMessages()
    dialogEditarOpen = true
  }

  const confirmEditar = async () => {
    const ok = await store.editarSubrubro(editarId, editarNombre)
    if (ok) {
      dialogEditarOpen = false
    }
  }

  const abrirEliminar = (subrubro, rubroNombre) => {
    eliminarId = subrubro.id
    eliminarNombre = subrubro.nombre_subrubro
    eliminarRubroNombre = rubroNombre
    store.clearMessages()
    dialogEliminarOpen = true
  }

  const confirmEliminar = async () => {
    const res = await store.eliminarSubrubro(eliminarId)
    if (res.ok) {
      dialogEliminarOpen = false
    }
  }

  // Contar subrubros por rubro para mostrar badges
  const countSubrubros = (rubroId) => {
    return (store.subrubrosPorRubro.get(Number(rubroId)) || []).length
  }

  // Abrir automáticamente los grupos que tienen subrubros al cargar
  $effect(() => {
    if (store.rubros.length > 0 && gruposAbiertos.size === 0) {
      const abiertos = new Set()
      for (const [grupo, rubros] of store.rubrosPorGrupo) {
        const tieneSubrubros = rubros.some((r) => countSubrubros(r.id) > 0)
        if (tieneSubrubros) abiertos.add(grupo)
      }
      if (abiertos.size > 0) gruposAbiertos = abiertos
    }
  })
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-base flex items-center gap-2">
      <FolderIcon class="size-5 text-primary" />
      Plan de cuentas PIA
    </Card.Title>
    <Card.Description>
      Los rubros son las categorías oficiales del formulario PIA y no se pueden modificar.
      Los subrubros te permiten sub-clasificar movimientos dentro de cada rubro.
      Si un rubro tiene un solo campo en el PIA, los subrubros se consolidan automáticamente al generar el reporte.
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-2">
    {#if store.loading}
      <div class="text-sm text-muted-foreground py-4">Cargando categorías…</div>
    {:else if store.rubros.length === 0}
      <div class="text-sm text-muted-foreground py-4">No se encontraron rubros. Verificá el schema desde la pestaña General.</div>
    {:else}
      {#each [...store.rubrosPorGrupo.entries()] as [grupo, rubros] (grupo)}
        <CollapsibleSection
          title={grupo}
          open={gruposAbiertos.has(grupo)}
          onToggle={() => toggleGrupo(grupo)}
        >
          {#snippet badge()}
            <Badge variant="secondary" class="font-mono">{rubros.length}</Badge>
          {/snippet}

          <div class="flex flex-col gap-1">
            {#each rubros as r (r.id)}
              {@const subs = store.subrubrosPorRubro.get(Number(r.id)) || []}
              <div class="rounded-md border border-border/60 bg-card/50">
                <div class="flex items-center gap-2 px-3 py-2">
                  <div class="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div class="flex items-center gap-2 text-sm">
                      <span class="font-mono text-xs text-muted-foreground shrink-0">{r.codigo_rubro}</span>
                      <span class="truncate font-medium">{r.nombre_oficial}</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{r.tipo_rubro}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {#if subs.length > 0}
                      <Badge variant="secondary" class="font-mono">{subs.length} subrubro{subs.length !== 1 ? 's' : ''}</Badge>
                    {/if}
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 px-2"
                      onclick={() => abrirCrear(r)}
                      disabled={store.busy}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Subrubro
                    </Button>
                  </div>
                </div>
                {#if subs.length > 0}
                  <Separator />
                  <div class="flex flex-col gap-0.5 px-3 py-2">
                    {#each subs as s (s.id)}
                      <div class="flex items-center gap-2 py-1 text-sm" class:opacity-50={s.activo === false}>
                        <span class="flex-1 truncate pl-4 text-muted-foreground" class:line-through={s.activo === false}>↳ {s.nombre_subrubro}</span>
                        {#if s.activo === false}
                          <Badge variant="outline" class="h-4 text-[10px]">Inactivo</Badge>
                        {/if}
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0"
                          onclick={() => store.toggleSubrubroActivo(s.id, s.activo !== false ? false : true)}
                          disabled={store.busy}
                          aria-label={s.activo === false ? 'Reactivar subrubro' : 'Desactivar subrubro'}
                          title={s.activo === false ? 'Reactivar' : 'Desactivar'}
                        >
                          <PowerIcon class="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0"
                          onclick={() => abrirEditar(s, r.nombre_oficial)}
                          disabled={store.busy}
                          aria-label="Editar subrubro"
                        >
                          <PencilIcon class="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onclick={() => abrirEliminar(s, r.nombre_oficial)}
                          disabled={store.busy}
                          aria-label="Eliminar subrubro"
                        >
                          <TrashIcon class="size-3.5" />
                        </Button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/each}
    {/if}

    <div class="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 mt-2">
      <InfoIcon class="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <p class="text-xs text-muted-foreground">
        Los subrubros que crees aparecen automáticamente en el formulario de movimientos
        al elegir el rubro padre. Al generar el PIA, si hay más subrubros que espacios
        disponibles en el formulario, los de menor monto se agrupan como "Varios".
      </p>
    </div>
  </Card.Content>
</Card.Root>

<!-- Diálogo: crear subrubro -->
<Dialog.Root bind:open={dialogCrearOpen}>
  <Dialog.Content class="sm:max-w-[440px]">
    <Dialog.Header>
      <Dialog.Title>Nuevo subrubro</Dialog.Title>
      <Dialog.Description>
        Subrubro de <strong>{crearRubroNombre}</strong>. Creá un subrubro para sub-clasificar movimientos.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-1.5 py-2">
      <label for="crear-nombre" class="text-sm font-medium">Nombre del subrubro</label>
      <Input id="crear-nombre" bind:value={crearNombre} placeholder="Ej: Impuestos bancarios" />
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (dialogCrearOpen = false)} disabled={store.busy}>Cancelar</Button>
      <Button onclick={confirmCrear} disabled={store.busy || !crearNombre.trim()}>Crear</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Diálogo: editar subrubro -->
<Dialog.Root bind:open={dialogEditarOpen}>
  <Dialog.Content class="sm:max-w-[440px]">
    <Dialog.Header>
      <Dialog.Title>Editar subrubro</Dialog.Title>
      <Dialog.Description>
        Subrubro de <strong>{editarRubroNombre}</strong>.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-1.5 py-2">
      <label for="editar-nombre" class="text-sm font-medium">Nombre</label>
      <Input id="editar-nombre" bind:value={editarNombre} />
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (dialogEditarOpen = false)} disabled={store.busy}>Cancelar</Button>
      <Button onclick={confirmEditar} disabled={store.busy || !editarNombre.trim()}>Guardar</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Diálogo: eliminar subrubro -->
<ConfirmDialog
  bind:open={dialogEliminarOpen}
  title="¿Eliminar subrubro?"
  description="Se eliminará el subrubro. Si hay movimientos que lo usan, deberás reasignarlos primero."
  confirmLabel="Eliminar"
  variant="destructive"
  busy={store.busy}
  onConfirm={confirmEliminar}
/>
