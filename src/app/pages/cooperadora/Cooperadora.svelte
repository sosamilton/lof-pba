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

  let dialogEjercicioAbierto = $state(false)
  let ejercicioEditandoId = $state(null)
  let dialogHistoricoAbierto = $state(false)

  // Diálogo de confirmación reutilizable.
  let confirmOpen = $state(false)
  let confirmTitle = $state('')
  let confirmDescription = $state('')
  let confirmLabel = $state('Confirmar')
  let confirmVariant = $state('destructive')
  let pendingAction = $state(() => {})

  const openConfirm = (opts) => {
    confirmTitle = opts.title
    confirmDescription = opts.description || ''
    confirmLabel = opts.confirmLabel || 'Confirmar'
    confirmVariant = opts.variant || 'destructive'
    pendingAction = opts.onConfirm
    confirmOpen = true
  }

  const handleConfirm = async () => {
    confirmOpen = false
    const fn = pendingAction
    pendingAction = () => {}
    await fn()
  }

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
      title: '¿Activar este ejercicio como en curso?',
      description: 'El ejercicio actual pasará a inactivo y el seleccionado será el nuevo ejercicio en curso.',
      confirmLabel: 'Activar',
      variant: 'default',
      onConfirm: () => store.setEjercicioEnCurso(id),
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
    <Tabs.Root value="datos-generales">
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
              colorPrimario={store.color_primario}
              busy={store.busy}
              onCueInput={store.onCueInput}
              onCuitInput={store.onCuitInput}
              onTelefonoInput={store.onTelefonoInput}
              onTelefonoEscuelaInput={store.onTelefonoEscuelaInput}
              onEmailEscuelaInput={onEmailEscuelaInput}
              onColorChange={(v) => { store.setColor_primario(v); escuelaDirty = true }}
              onDirty={() => { escuelaDirty = true }}
              onToggleTelefono={toggleTelefonoMismoQueEscuela}
              onValidar={store.validarDatos}
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
              onValidar={store.validarBanco}
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
  bind:open={confirmOpen}
  title={confirmTitle}
  description={confirmDescription}
  confirmLabel={confirmLabel}
  variant={confirmVariant}
  busy={store.busy}
  onConfirm={handleConfirm}
/>
