<script>
  import { onMount } from 'svelte'
  import { cooperadoraStore as store } from './cooperadoraStore.svelte'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Badge } from '$lib/components/ui/badge'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import LockIcon from '@lucide/svelte/icons/lock'
  import { emailInstitucionalAlias, parseEmailInstitucionalInput } from '$core/emailInstitucional'
  import FormEscuela from './parts/FormEscuela.svelte'
  import FormBanco from './parts/FormBanco.svelte'
  import FormKiosco from './parts/FormKiosco.svelte'
  import TablaCargos from './parts/TablaCargos.svelte'
  import ListaEjercicios from './parts/ListaEjercicios.svelte'
  import DialogEditarSaldos from './parts/DialogEditarSaldos.svelte'

  let dialogSaldosAbierto = $state(false)
  let ejercicioEditandoId = $state(null)

  const abrirEditarSaldos = (e) => {
    store.setEditandoSaldos(e)
    ejercicioEditandoId = e.id
    dialogSaldosAbierto = true
  }

  const cerrarEditarSaldos = () => {
    dialogSaldosAbierto = false
    store.cancelarEdicionSaldos()
    ejercicioEditandoId = null
  }

  const confirmarGuardarSaldos = async () => {
    if (!store.ejercicioEditando) return
    const tiene = await store.tieneMovimientos(ejercicioEditandoId)
    if (tiene) {
      const ok = window.confirm(
        'Modificar el saldo inicial recalculará los saldos de todos los períodos. ¿Continuar?'
      )
      if (!ok) return
    }
    await store.saveSaldosEjercicio()
    if (!store.error) dialogSaldosAbierto = false
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

<PageScaffold title="Cooperadora" loading={store.loading} error={store.error} notice={store.notice}>
  {#snippet skeleton()}
    <div class="flex flex-col gap-4">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-64 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>
  {/snippet}
  <div class="flex flex-col gap-2 w-full">
    <Accordion.Root type="multiple" value={['escuela']}>
      <!-- Item 1: Escuela y cooperadora -->
      <Accordion.Item value="escuela">
        <Accordion.Trigger>
          <span class="font-semibold">Escuela y cooperadora</span>
          {#if escuelaValidada}
            <Badge variant="secondary" class="ml-2"><LockIcon class="size-3" /> Validado</Badge>
          {/if}
        </Accordion.Trigger>
        <Accordion.Content>
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
        </Accordion.Content>
      </Accordion.Item>

      <!-- Item 2: Datos bancarios -->
      <Accordion.Item value="banco">
        <Accordion.Trigger>
          <span class="font-semibold">Datos bancarios</span>
          {#if bancoValidado}
            <Badge variant="secondary" class="ml-2"><LockIcon class="size-3" /> Validado</Badge>
          {/if}
        </Accordion.Trigger>
        <Accordion.Content>
          <FormBanco
            banco={store.banco}
            {bancoValidado}
            busy={store.busy}
            onValidar={store.validarBanco}
          />
        </Accordion.Content>
      </Accordion.Item>

      <!-- Item 3: Kiosco / Librería -->
      <Accordion.Item value="kiosco">
        <Accordion.Trigger>
          <span class="font-semibold">Kiosco / Librería</span>
        </Accordion.Trigger>
        <Accordion.Content>
          <FormKiosco
            kiosco={store.kiosco}
            busy={store.busy}
            onSave={handleSave}
            saveDisabled={escuelaValidada && !escuelaDirty && !kioscoDirty}
          />
        </Accordion.Content>
      </Accordion.Item>

      <!-- Item 4: Comisión Directiva y Cargos -->
      <Accordion.Item value="comision">
        <Accordion.Trigger>
          <span class="font-semibold">Comisión Directiva y Cargos</span>
          {#if escuelaValidada}
            <Badge variant="secondary" class="ml-2"><LockIcon class="size-3" /> Read-only</Badge>
          {/if}
        </Accordion.Trigger>
        <Accordion.Content>
          <TablaCargos {store} {escuelaValidada} tieneAutoridadesVigentes={store.tieneAutoridadesVigentes} />
        </Accordion.Content>
      </Accordion.Item>

      <!-- Item 5: Ejercicios -->
      <Accordion.Item value="ejercicios">
        <Accordion.Trigger>
          <span class="font-semibold">Ejercicios</span>
        </Accordion.Trigger>
        <Accordion.Content>
          <ListaEjercicios ejercicios={store.ejercicios} onEditarSaldos={abrirEditarSaldos} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  </div>

</PageScaffold>

<DialogEditarSaldos
  bind:open={dialogSaldosAbierto}
  ejercicioEditando={store.ejercicioEditando}
  error={store.error}
  busy={store.busy}
  onClose={cerrarEditarSaldos}
  onSave={confirmarGuardarSaldos}
/>
