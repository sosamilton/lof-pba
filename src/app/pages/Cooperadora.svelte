<script>
  import { onMount } from 'svelte'
  import { cooperadoraStore as store } from './cooperadoraStore.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Badge } from '$lib/components/ui/badge'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import LockIcon from '@lucide/svelte/icons/lock'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { emailInstitucionalAlias, parseEmailInstitucionalInput } from '$core/emailInstitucional'
  import FormEscuela from './parts/FormEscuela.svelte'
  import TablaCargos from './parts/TablaCargos.svelte'
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
          <div class="flex flex-col gap-4">
            <div class="grid gap-3 sm:grid-cols-3">
              <div>
                <Label for="banco-entidad">Entidad</Label>
                <Input id="banco-entidad" bind:value={store.banco.entidad} disabled={bancoValidado} class="mt-1" />
              </div>
              <div>
                <Label for="banco-cbu">CBU</Label>
                <Input id="banco-cbu" bind:value={store.banco.cbu} disabled={bancoValidado} oninput={store.onCbuInput} placeholder="00000031-0000000000000001" inputmode="numeric" class="mt-1" />
              </div>
              <div>
                <Label for="banco-cc">Cuenta</Label>
                <Input id="banco-cc" bind:value={store.banco.cuenta_corriente} disabled={bancoValidado} class="mt-1" />
              </div>
              <div>
                <Label for="banco-sucursal">Sucursal</Label>
                <Input id="banco-sucursal" bind:value={store.banco.sucursal} disabled={bancoValidado} class="mt-1" />
              </div>
              <div>
                <Label for="banco-tipo">Tipo de cuenta</Label>
                <Input id="banco-tipo" bind:value={store.banco.tipo_cuenta} disabled={bancoValidado} class="mt-1" />
              </div>
            </div>
            <div class="flex items-center justify-between">
              {#if !bancoValidado}
                <Button variant="outline" size="sm" onclick={store.validarBanco} disabled={store.busy}>
                  <CheckCircleIcon data-icon="inline-start" />
                  Validar y bloquear
                </Button>
              {/if}
            </div>
          </div>
        </Accordion.Content>
      </Accordion.Item>

      <!-- Item 3: Kiosco / Librería -->
      <Accordion.Item value="kiosco">
        <Accordion.Trigger>
          <span class="font-semibold">Kiosco / Librería</span>
        </Accordion.Trigger>
        <Accordion.Content>
          <div class="flex flex-col gap-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <Label for="kiosco-posee">Posee</Label>
                <Select.Root type="single" value={store.kiosco.posee != null ? String(store.kiosco.posee) : undefined} onValueChange={(v) => store.kiosco.posee = v === 'true'}>
                  <Select.Trigger id="kiosco-posee" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="true">Sí</Select.Item>
                    <Select.Item value="false">No</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <Label for="kiosco-modalidad">Modalidad</Label>
                <Select.Root type="single" bind:value={store.kiosco.modalidad} allowDeselect={true}>
                  <Select.Trigger id="kiosco-modalidad" class="mt-1 w-full">
                    <Select.Value placeholder="(sin)" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="Propio">Propio</Select.Item>
                    <Select.Item value="Licitado">Licitado</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
            </div>
            <div class="flex justify-end"><Button onclick={handleSave} disabled={store.busy || (escuelaValidada && !escuelaDirty && !kioscoDirty)}>Guardar</Button></div>
          </div>
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
          <div class="flex flex-col gap-2">
            {#each store.ejercicios as e (e.id)}
              <div class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <div class="flex flex-col gap-0.5">
                  <div class="text-sm font-semibold">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
                  <div class="text-xs text-muted-foreground">
                    {e.en_curso ? 'En curso' : 'Inactivo'}
                    {#if e.saldo_inicial_total != null}
                      · Saldo inicial: <span class="font-semibold text-foreground">${Number(e.saldo_inicial_total).toLocaleString('es-AR')}</span>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  {#if e.en_curso}
                    <Badge variant="default">En curso</Badge>
                    <Button variant="outline" size="sm" onclick={() => abrirEditarSaldos(e)}>
                      <PencilIcon data-icon="inline-start" />
                      Editar saldos
                    </Button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
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
