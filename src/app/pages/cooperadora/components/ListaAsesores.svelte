<script>
  import { onMount } from 'svelte'
  import { asesoresStore as store } from '../asesoresStore.svelte.js'
  import { usePersonaSearch } from '$lib/hooks/usePersonaSearch.svelte.js'
  import { personaLabel } from '$app/modules/comunidad/personas/personasApi.js'
  import { formatFecha } from '$core/format/format'
  import * as Card from '$lib/components/ui/card'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Textarea } from '$lib/components/ui/textarea'
  import PersonaPicker from '$app/modules/gobierno/components/PersonaPicker.svelte'
  import UserIcon from '@lucide/svelte/icons/user'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import XIcon from '@lucide/svelte/icons/x'
  import CheckIcon from '@lucide/svelte/icons/check'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/hooks/useConfirmDialog.svelte.js'

  const ps = usePersonaSearch()

  let dialogAbierto = $state(false)
  let modoDialog = $state('nuevo') // 'nuevo' | 'cesar'

  // Diálogo de confirmación para eliminar asesor.
  const confirm = useConfirmDialog()

  const onEliminar = (id) => {
    confirm.openConfirm({
      title: '¿Eliminar este registro de asesor?',
      description: 'El registro se quitará de la base de datos. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
      onConfirm: () => store.remove(id),
    })
  }

  onMount(() => {
    store.load()
    return store.subscribe()
  })

  // Abrir para registrar un nuevo Director (solo si no hay Director activo)
  const abrirNuevoDirector = () => {
    store.openNuevoDraft('Director')
    modoDialog = 'nuevo'
    dialogAbierto = true
    ps.reset()
  }

  // Abrir para agregar una delegación o designación (requiere Director activo)
  const abrirDelegacion = () => {
    store.openNuevoDraft('Delegacion')
    modoDialog = 'nuevo'
    dialogAbierto = true
    ps.reset()
  }

  // Tipos disponibles según contexto:
  // - Sin Director activo: solo "Director"
  // - Con Director activo y sin delegación activa: "Delegacion" + "DesignacionCoopEscolar"
  // - Con Director activo y con delegación activa: ninguna nueva (hay que cesar primero)
  const tiposDisponibles = $derived(
    !store.directorActivo
      ? store.TIPOS_ORIGEN.filter((t) => t.value === 'Director')
      : !store.delegacionActiva
        ? store.TIPOS_ORIGEN.filter((t) => t.value !== 'Director')
        : []
  )

  const abrirCesar = (asesor) => {
    store.openCesarDraft(asesor)
    modoDialog = 'cesar'
    dialogAbierto = true
  }

  const cerrarDialog = () => {
    store.closeDraft()
    dialogAbierto = false
    ps.reset()
  }

  const onSearch = (val) => {
    ps.query = val
    ps.search()
  }

  // Filtrar resultados por categoría según el tipo de asesor:
  // - Director: solo personas con categoría "Directivo"
  // - Delegacion / DesignacionCoopEscolar: Directivos o Docentes
  //   (art. 18: Vicedirección, Secretaría, u otro docente que estime oportuno)
  const resultadosFiltrados = $derived(
    store.draft?.tipo_origen === 'Director'
      ? ps.results.filter((p) => p.categoria === 'Directivo')
      : store.draft?.tipo_origen === 'Delegacion' || store.draft?.tipo_origen === 'DesignacionCoopEscolar'
        ? ps.results.filter((p) => p.categoria === 'Directivo' || p.categoria === 'Docente')
        : ps.results
  )

  const onPick = (p) => {
    store.setDraftPersona(p)
    ps.reset()
  }

  const onUnlink = () => {
    if (!store.draft) return
    store.draft.persona_id = null
    store.draft.apellido_nombre = ''
    store.draft.dni = ''
  }

  const onGuardar = async () => {
    await store.save()
    if (!store.error) cerrarDialog()
  }

  const tipoLabel = (val) => store.TIPOS_ORIGEN.find((t) => t.value === val)?.label || val
  const motivoLabel = (val) => store.MOTIVOS_CESE.find((m) => m.value === val)?.label || val

  const fmtFecha = formatFecha
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-base flex items-center gap-2">
      <UserIcon class="size-4 text-muted-foreground" />
      Asesor/a de la Cooperadora
    </Card.Title>
    <Card.Description>
      Función institucional derivada de la Dirección del establecimiento (Decreto 4767/72 art. 18).
      No es un cargo electivo: su vigencia depende del ejercicio de la Dirección.
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-4">
    <!-- Director activo (titular) -->
    {#if store.directorActivo}
      <div class="flex items-center justify-between border rounded-lg px-4 py-3 bg-primary/5">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <Badge variant="default">Titular</Badge>
            <span class="font-medium">{store.directorActivo.apellido_nombre}</span>
          </div>
          <span class="text-xs text-muted-foreground">
            {tipoLabel(store.directorActivo.tipo_origen)} · Desde {fmtFecha(store.directorActivo.fecha_asuncion)}
          </span>
        </div>
        <div class="flex gap-2">
          {#if !store.delegacionActiva}
            <Button variant="outline" size="sm" onclick={abrirDelegacion}>
              <PlusIcon data-icon="inline-start" />
              Delegar
            </Button>
          {/if}
          <Button variant="outline" size="sm" onclick={() => abrirCesar(store.directorActivo)}>
            Registrar cese
          </Button>
        </div>
      </div>
    {/if}

    <!-- Delegación/Designación activa (si existe) -->
    {#if store.delegacionActiva}
      <div class="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/30">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <Badge variant="secondary">En ejercicio</Badge>
            <span class="font-medium">{store.delegacionActiva.apellido_nombre}</span>
          </div>
          <span class="text-xs text-muted-foreground">
            {tipoLabel(store.delegacionActiva.tipo_origen)} · Desde {fmtFecha(store.delegacionActiva.fecha_asuncion)}
          </span>
        </div>
        <Button variant="outline" size="sm" onclick={() => abrirCesar(store.delegacionActiva)}>
          Registrar cese
        </Button>
      </div>
    {/if}

    <!-- Sin ningún asesor activo -->
    {#if !store.directorActivo && !store.delegacionActiva}
      <div class="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/30">
        <span class="text-sm text-muted-foreground">Sin asesor activo</span>
        <Button size="sm" onclick={abrirNuevoDirector}>
          <PlusIcon data-icon="inline-start" />
          Registrar Director/a
        </Button>
      </div>
    {/if}

    <!-- Histórico -->
    {#if store.asesores.length > 0}
      <div class="flex flex-col gap-2">
        <h4 class="text-sm font-medium text-muted-foreground">Historial</h4>
        {#each store.asesores as a (a.id)}
          <div class="flex items-center justify-between border rounded-md px-3 py-2">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{a.apellido_nombre}</span>
                {#if a.activo}
                  <Badge variant="default" class="text-xs">Activo</Badge>
                {:else}
                  <Badge variant="secondary" class="text-xs">Inactivo</Badge>
                {/if}
              </div>
              <span class="text-xs text-muted-foreground">
                {tipoLabel(a.tipo_origen)} ·
                {fmtFecha(a.fecha_asuncion)} → {a.fecha_cese ? fmtFecha(a.fecha_cese) : 'presente'}
                {#if a.motivo_cese}· {motivoLabel(a.motivo_cese)}{/if}
              </span>
              {#if a.observaciones}
                <span class="text-xs text-muted-foreground italic">{a.observaciones}</span>
              {/if}
            </div>
            {#if !a.activo}
              <Button variant="ghost" size="sm" class="shrink-0" onclick={() => onEliminar(a.id)} aria-label="Eliminar">
                <TrashIcon data-icon="inline-start" />
              </Button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card.Content>
</Card.Root>

<!-- Dialog alta/cese -->
<Dialog.Root bind:open={dialogAbierto}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{modoDialog === 'nuevo' ? 'Registrar asesor' : 'Registrar cese'}</Dialog.Title>
      <Dialog.Description>
        {modoDialog === 'nuevo'
          ? 'El asesor ejerce la función mientras dure su Designación en la Dirección del establecimiento.'
          : 'Indicá la fecha y motivo de cese del asesor.'}
      </Dialog.Description>
    </Dialog.Header>

    {#if store.draft}
      <div class="flex flex-col gap-4">
        {#if modoDialog === 'nuevo'}
          <!-- Persona -->
          <div class="flex flex-col gap-2">
            <Label>Persona</Label>
            <PersonaPicker
              personaId={store.draft.persona_id}
              apellidoNombre={store.draft.apellido_nombre}
              dni={store.draft.dni}
              searchValue={ps.query}
              searching={ps.searching}
              results={resultadosFiltrados}
              onsearch={onSearch}
              onpick={onPick}
              onunlink={onUnlink}
              showCategoria={true}
            />
          </div>

          <!-- Tipo de origen -->
          <div class="flex flex-col gap-2">
            <Label for="tipo-origen">Tipo de asesor</Label>
            {#if tiposDisponibles.length === 1}
              <!-- Solo hay una opción (Director): mostrar como texto fijo -->
              <Input id="tipo-origen" value={tiposDisponibles[0].label} disabled />
              <p class="text-xs text-muted-foreground">
                Al no haber asesor activo, el primero debe ser el Director/a del establecimiento.
              </p>
            {:else}
              <Select.Root type="single" value={store.draft.tipo_origen} onValueChange={(v) => (store.draft.tipo_origen = v)}>
                <Select.Trigger id="tipo-origen" class="w-full">
                  <Select.Value placeholder="Elegir…" />
                </Select.Trigger>
                <Select.Content>
                  {#each tiposDisponibles as t (t.value)}
                    <Select.Item value={t.value} label={t.label}>{t.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            {/if}
          </div>

          <!-- Fecha asunción -->
          <div class="flex flex-col gap-2">
            <Label for="fecha-asuncion">Fecha de asunción</Label>
            <Input id="fecha-asuncion" type="date" bind:value={store.draft.fecha_asuncion} />
          </div>

          <!-- Observaciones -->
          <div class="flex flex-col gap-2">
            <Label for="obs">Observaciones</Label>
            <Textarea id="obs" bind:value={store.draft.observaciones} placeholder="Notas, acta de delegación, etc." rows={2} />
          </div>
        {:else}
          <!-- Modo cese -->
          <div class="flex flex-col gap-2">
            <Label>Asesor</Label>
            <Input value={store.draft.apellido_nombre} disabled />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="fecha-cese">Fecha de cese</Label>
            <Input id="fecha-cese" type="date" bind:value={store.draft.fecha_cese} />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="motivo-cese">Motivo de cese</Label>
            <Select.Root type="single" value={store.draft.motivo_cese} onValueChange={(v) => (store.draft.motivo_cese = v)}>
              <Select.Trigger id="motivo-cese" class="w-full">
                <Select.Value placeholder="Elegir…" />
              </Select.Trigger>
              <Select.Content>
                {#each store.MOTIVOS_CESE as m (m.value)}
                  <Select.Item value={m.value} label={m.label}>{m.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="obs-cese">Observaciones</Label>
            <Textarea id="obs-cese" bind:value={store.draft.observaciones} placeholder="Notas del cese…" rows={2} />
          </div>
        {/if}

        {#if store.error}
          <p class="text-sm text-destructive">{store.error}</p>
        {/if}
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={cerrarDialog}>Cancelar</Button>
      <Button onclick={onGuardar} disabled={store.busy}>
        <CheckIcon data-icon="inline-start" />
        {store.busy ? 'Guardando…' : 'Guardar'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<ConfirmDialog
  bind:open={confirm.open}
  title={confirm.title}
  description={confirm.description}
  confirmLabel={confirm.confirmLabel}
  variant={confirm.variant}
  busy={store.busy}
  onConfirm={confirm.handleConfirm}
/>
