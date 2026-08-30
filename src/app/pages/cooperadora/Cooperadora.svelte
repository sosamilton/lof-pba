<script>
  import { onMount } from 'svelte'
  import { cooperadoraStore as store } from './cooperadoraStore.svelte'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import LockIcon from '@lucide/svelte/icons/lock'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import UserCheckIcon from '@lucide/svelte/icons/user-check'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import UserCogIcon from '@lucide/svelte/icons/user-cog'
  import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range'
  import { emailInstitucionalAlias, parseEmailInstitucionalInput } from '$core/format/emailInstitucional'
  import FormEscuela from './components/FormEscuela.svelte'
  import FormBanco from './components/FormBanco.svelte'
  import FormKiosco from './components/FormKiosco.svelte'
  import TablaCargos from './components/TablaCargos.svelte'
  import ListaAsesores from './components/ListaAsesores.svelte'
  import ListaEjercicios from './components/ListaEjercicios.svelte'
  import DialogEditarEjercicio from './components/DialogEditarEjercicio.svelte'
  import DialogCese from '$app/modules/gobierno/autoridades/components/DialogCese.svelte'
  import DialogReemplazo from '$app/modules/gobierno/autoridades/components/DialogReemplazo.svelte'
  import DialogHistorico from './components/DialogHistorico.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/hooks/useConfirmDialog.svelte.js'
  import EstatutoField from './components/EstatutoField.svelte'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import { formatFecha } from '$core/format/format'
  import { extractAttachmentIds, getAttachmentUrl } from '$core/data/dataRepository'

  let dialogEjercicioAbierto = $state(false)
  let ejercicioEditandoId = $state(null)
  let dialogHistoricoAbierto = $state(false)

  // Diálogo de confirmación reutilizable.
  const confirm = useConfirmDialog()
  const openConfirm = (opts) => confirm.openConfirm(opts)

  const abrirEditarEjercicio = (e) => {
    store.setEditandoEjercicio(e)
    ejercicioEditandoId = e.id
    dialogEjercicioAbierto = true
  }

  const cerrarEditarEjercicio = () => {
    dialogEjercicioAbierto = false
    store.cancelarEdicionEjercicio()
    ejercicioEditandoId = null
  }

  const confirmarGuardarEjercicio = async () => {
    if (!store.ejercicioEditando) return
    const tiene = await store.tieneMovimientos(ejercicioEditandoId)
    if (tiene) {
      openConfirm({
        title: 'Modificar saldos iniciales',
        description: 'Modificar los saldos iniciales recalculará los saldos de todos los períodos. ¿Continuar?',
        confirmLabel: 'Guardar y recalcular',
        variant: 'default',
        onConfirm: async () => {
          await store.saveEjercicio()
          if (!store.error) dialogEjercicioAbierto = false
        },
      })
      return
    }
    await store.saveEjercicio()
    if (!store.error) dialogEjercicioAbierto = false
  }

  const confirmarEliminarEjercicio = (e) => {
    openConfirm({
      title: `¿Eliminar el ejercicio ${e.anio_inicio}-${e.anio_fin}?`,
      description: 'Se borrarán todos los movimientos y saldos del ejercicio. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
      onConfirm: () => store.deleteEjercicio(e.id),
    })
  }

  const confirmarActivarEjercicio = (id) => {
    openConfirm({
      title: '¿Marcar este ejercicio como actual?',
      description: 'El ejercicio actual pasará a inactivo y el seleccionado será el nuevo ejercicio en curso.',
      confirmLabel: 'Marcar como actual',
      variant: 'default',
      onConfirm: () => store.setEjercicioEnCurso(id),
    })
  }

  const confirmarValidarDatos = () => {
    openConfirm({
      title: '¿Validar y bloquear los datos de la escuela?',
      description: 'Una vez validados, los datos no podrán editarse desde el sistema. Si necesitás corregir algo, podés modificarlos directamente en las tablas de Grist.',
      confirmLabel: 'Validar y bloquear',
      variant: 'default',
      onConfirm: () => store.validarDatos(),
    })
  }

  const confirmarValidarBanco = () => {
    openConfirm({
      title: '¿Validar y bloquear los datos bancarios?',
      description: 'Una vez validados, los datos no podrán editarse desde el sistema. Si necesitás corregir algo, podés modificarlos directamente en las tablas de Grist.',
      confirmLabel: 'Validar y bloquear',
      variant: 'default',
      onConfirm: () => store.validarBanco(),
    })
  }

  let emailEscuelaAlias = $state('')
  let emailEscuelaDirty = $state(false)
  let escuelaDirty = $state(false)
  let kioscoDirty = $state(false)
  let telefonoMismoQueEscuela = $state(false)

  $effect(() => {
    if (!escuelaDirty) {
      const te = store.escuela?.telefono_escuela || ''
      const tc = store.escuela?.telefono_cooperadora || ''
      telefonoMismoQueEscuela = Boolean(te) && te === tc
    }
  })

  const toggleTelefonoMismoQueEscuela = () => {
    telefonoMismoQueEscuela = !telefonoMismoQueEscuela
    if (telefonoMismoQueEscuela) {
      store.escuela.telefono_cooperadora = store.escuela.telefono_escuela || ''
      escuelaDirty = true
    }
  }

  $effect(() => {
    if (emailEscuelaDirty) return
    emailEscuelaAlias = emailInstitucionalAlias(store.escuela?.email_escuela)
  })

  const onEmailEscuelaInput = (/** @type {Event} */ e) => {
    const { alias, full } = parseEmailInstitucionalInput(/** @type {HTMLInputElement} */ (e.target)?.value)
    emailEscuelaAlias = alias
    store.escuela.email_escuela = full
    emailEscuelaDirty = true
    escuelaDirty = true
  }

  const escuelaValidada = $derived(store.escuela?.datos_validados === true)
  const bancoValidado = $derived(store.banco?.banco_validado === true)
  const emailEscuelaBloqueado = $derived(escuelaValidada && !emailEscuelaDirty && Boolean(emailEscuelaAlias))

  // Estatuto
  const estatutoAttachmentId = $derived(store.estatutoVigenteAttachmentId)
  const estatutoValidado = $derived(store.escuela?.estatuto_validado === true)

  const handleEstatutoChange = async (/** @type {number | null} */ attId) => {
    await store.saveEstatuto(attId)
  }

  const confirmarValidarEstatuto = () => {
    openConfirm({
      title: '¿Validar y bloquear el estatuto?',
      description: 'Una vez validado, el estatuto no podrá reemplazarse desde la app. Para cambiarlo, registrá una Asamblea Extraordinaria con motivo "Reforma estatuto" en Asambleas y Memorias; al guardarla, la edición se habilitará automáticamente.',
      confirmLabel: 'Validar y bloquear',
      variant: 'default',
      onConfirm: () => store.validarEstatuto(),
    })
  }

  const handleSave = async () => {
    await store.saveCooperadora()
    escuelaDirty = false
    kioscoDirty = false
    emailEscuelaDirty = false
  }

  onMount(() => {
    const unsub = store.subscribe()
    store.load()
    return unsub
  })
</script>

<PageScaffold title="Institucional" loading={store.loading} error={store.error} notice={store.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-64 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>
  {/snippet}
  <div class="flex flex-col gap-4 w-full">
    <Tabs.Root value="datos-generales" class="min-w-0">
      <Tabs.List class="mb-4">
        <Tabs.Trigger value="datos-generales" class="px-3">
          <BuildingIcon data-icon="inline-start" />
          Datos generales
        </Tabs.Trigger>
        <Tabs.Trigger value="cargos" class="px-3">
          <UserCheckIcon data-icon="inline-start" />
          Autoridades
        </Tabs.Trigger>
        <Tabs.Trigger value="asesor" class="px-3">
          <UserCogIcon data-icon="inline-start" />
          Asesor institucional
        </Tabs.Trigger>
        <Tabs.Trigger value="ejercicios" class="px-3">
          <CalendarRangeIcon data-icon="inline-start" />
          Ejercicios
        </Tabs.Trigger>
        <Tabs.Trigger value="estatuto" class="px-3">
          <FileTextIcon data-icon="inline-start" />
          Estatuto
        </Tabs.Trigger>
      </Tabs.List>

      <!-- Tab: Datos generales (escuela, banco, kiosco) -->
      <Tabs.Content value="datos-generales" class="flex flex-col gap-4">
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base flex items-center gap-2">
              Escuela y cooperadora
              {#if escuelaValidada}
                <Badge variant="secondary"><LockIcon class="size-3" /> Validado</Badge>
              {/if}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <FormEscuela
              escuela={store.escuela}
              {escuelaValidada}
              {escuelaDirty}
              {emailEscuelaAlias}
              {emailEscuelaBloqueado}
              {telefonoMismoQueEscuela}
              busy={store.busy}
              onCueInput={store.onCueInput}
              onCuitInput={store.onCuitInput}
              onTelefonoInput={store.onTelefonoInput}
              onTelefonoEscuelaInput={store.onTelefonoEscuelaInput}
              onEmailEscuelaInput={onEmailEscuelaInput}
              onDirty={() => { escuelaDirty = true }}
              onToggleTelefono={toggleTelefonoMismoQueEscuela}
              onValidar={confirmarValidarDatos}
              onSave={handleSave}
            />
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base flex items-center gap-2">
              Datos bancarios
              {#if bancoValidado}
                <Badge variant="secondary"><LockIcon class="size-3" /> Validado</Badge>
              {/if}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <FormBanco
              banco={store.banco}
              {bancoValidado}
              busy={store.busy}
              onValidar={confirmarValidarBanco}
            />
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">Kiosco / Librería</Card.Title>
          </Card.Header>
          <Card.Content>
            <FormKiosco
              kiosco={store.kiosco}
              busy={store.busy}
              onSave={handleSave}
              saveDisabled={escuelaValidada && !escuelaDirty && !kioscoDirty}
            />
          </Card.Content>
        </Card.Root>
      </Tabs.Content>

      <!-- Tab: Autoridades (vigentes + cargos del estatuto) -->
      <Tabs.Content value="cargos" class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold">Autoridades vigentes</h2>
            {#if escuelaValidada}
              <Badge variant="secondary"><LockIcon class="size-3" /> Validado</Badge>
            {/if}
          </div>
          {#if store.tieneAutoridadesVigentes}
            <Button variant="outline" size="sm" onclick={() => (dialogHistoricoAbierto = true)}>
              <HistoryIcon data-icon="inline-start" />
              Ver histórico
            </Button>
          {/if}
        </div>
        <TablaCargos {store} {escuelaValidada} tieneAutoridadesVigentes={store.tieneAutoridadesVigentes} />
      </Tabs.Content>

      <!-- Tab: Asesor institucional -->
      <Tabs.Content value="asesor" class="flex flex-col gap-4">
        <ListaAsesores />
      </Tabs.Content>

      <!-- Tab: Ejercicios -->
      <Tabs.Content value="ejercicios" class="flex flex-col gap-4">
        <ListaEjercicios
          ejercicios={store.ejercicios}
          nuevoEj={store.nuevoEj}
          creating={store.busy}
          busy={store.busy}
          onEditar={abrirEditarEjercicio}
          onActivar={confirmarActivarEjercicio}
          onEliminar={confirmarEliminarEjercicio}
          onCrear={store.createEjercicio}
        />
      </Tabs.Content>

      <!-- Tab: Estatuto -->
      <Tabs.Content value="estatuto" class="flex flex-col gap-4">
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base flex items-center gap-2">
              Estatuto de la cooperadora
              {#if estatutoValidado}
                <Badge variant="secondary"><LockIcon class="size-3" /> Validado</Badge>
              {/if}
            </Card.Title>
            <Card.Description>
              Subí el PDF del estatuto de la cooperadora. Una vez validado, queda bloqueado para evitar cambios accidentales. Para reemplazarlo, registrá una Asamblea Extraordinaria con motivo "Reforma estatuto" en Asambleas y Memorias.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <EstatutoField
              attachmentId={estatutoAttachmentId}
              validado={estatutoValidado}
              busy={store.busy}
              onchange={handleEstatutoChange}
              onValidar={confirmarValidarEstatuto}
            />
          </Card.Content>
        </Card.Root>

        {#if store.estatutos.length > 0}
          <Card.Root>
            <Card.Header>
              <Card.Title class="text-base flex items-center gap-2">
                <HistoryIcon data-icon="inline-start" />
                Historial de versiones
              </Card.Title>
              <Card.Description>
                Versiones anteriores del estatuto conservadas para auditoría.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <div class="flex flex-col gap-2">
                {#each store.estatutos as est}
                  {@const attId = extractAttachmentIds(est.estatuto)[0] ?? null}
                  {@const isVigente = Number(est.id) === Number(store.escuela?.estatuto_actual_id)}
                  <div class="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                    <FileTextIcon class="size-4 text-muted-foreground shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm truncate">
                        {formatFecha(est.fecha_desde) || 'Sin fecha'}
                        {#if est.notas}<span class="text-muted-foreground"> — {est.notas}</span>{/if}
                      </p>
                    </div>
                    {#if isVigente}
                      <Badge variant="secondary" class="shrink-0">Vigente</Badge>
                    {/if}
                    {#if attId}
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 w-7 p-0 shrink-0"
                        onclick={async () => {
                          try {
                            const url = await getAttachmentUrl(attId)
                            window.open(url, '_blank', 'noopener,noreferrer')
                          } catch (e) { console.error(e) }
                        }}
                        aria-label="Descargar versión"
                        title="Descargar/ver"
                      >
                        <DownloadIcon class="size-4" />
                      </Button>
                    {/if}
                  </div>
                {/each}
              </div>
            </Card.Content>
          </Card.Root>
        {/if}
      </Tabs.Content>
    </Tabs.Root>
  </div>

</PageScaffold>

<DialogEditarEjercicio
  bind:open={dialogEjercicioAbierto}
  ejercicioEditando={store.ejercicioEditando}
  error={store.error}
  busy={store.busy}
  onClose={cerrarEditarEjercicio}
  onSave={confirmarGuardarEjercicio}
/>

<DialogCese {store} />
<DialogReemplazo {store} />
<DialogHistorico bind:open={dialogHistoricoAbierto} {store} />

<ConfirmDialog
  bind:open={confirm.open}
  title={confirm.title}
  description={confirm.description}
  confirmLabel={confirm.confirmLabel}
  variant={confirm.variant}
  busy={store.busy}
  onConfirm={confirm.handleConfirm}
/>
