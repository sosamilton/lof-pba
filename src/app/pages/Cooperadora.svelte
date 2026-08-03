<script>
  import { onMount } from 'svelte'
  import { cooperadoraStore as store } from './cooperadoraStore.svelte'
  import { ORGANISMOS, ORGANISMO_LABELS, NIVELES_CARGO } from '$core/utils'
  import { formatFecha } from '$core/format'
  import { navigate } from '$core/router.svelte'
  import { emailInstitucionalAlias, parseEmailInstitucionalInput, EMAIL_INSTITUCIONAL_DOMAIN } from '$core/emailInstitucional'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import * as Accordion from '$lib/components/ui/accordion'
  import * as Alert from '$lib/components/ui/alert'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Switch } from '$lib/components/ui/switch'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import LockIcon from '@lucide/svelte/icons/lock'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'

  let emailEscuelaAlias = $state('')
  let emailEscuelaDirty = $state(false)
  let escuelaDirty = $state(false)
  let kioscoDirty = $state(false)
  let telefonoMismoQueEscuela = $state(false)

  // Inicializa el checkbox si ambos teléfonos coinciden al cargar.
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

  // Sincroniza el alias desde el store solo en la carga inicial y tras guardar.
  // Durante el tipeo, emailEscuelaDirty evita que el effect sobrescriba lo que el usuario edita.
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
  // El email institucional puede cargarse después de validar el resto de la escuela:
  // si está vacío queda editable aunque los datos estén validados; al guardar queda bloqueado.
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
          <div class="flex flex-col gap-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <Label for="distrito">Distrito</Label>
                <Input id="distrito" bind:value={store.escuela.distrito} disabled={escuelaValidada} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="escuela-nombre">Escuela</Label>
                <Input id="escuela-nombre" bind:value={store.escuela.escuela_nombre} disabled={escuelaValidada} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="escuela-numero">Número</Label>
                <Input id="escuela-numero" bind:value={store.escuela.escuela_numero} disabled={escuelaValidada} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="cue">CUE</Label>
                <Input id="cue" bind:value={store.escuela.cue} disabled={escuelaValidada} oninput={() => { store.onCueInput(); escuelaDirty = true }} placeholder="06-12345-00" inputmode="numeric" class="mt-1" />
              </div>
              <div>
                <Label for="cuit">CUIT</Label>
                <Input id="cuit" bind:value={store.escuela.cuit} disabled={escuelaValidada} oninput={() => { store.onCuitInput(); escuelaDirty = true }} placeholder="20-12345678-9" inputmode="numeric" class="mt-1" />
              </div>
              <div>
                <Label for="coop-nombre">Cooperadora</Label>
                <Input id="coop-nombre" bind:value={store.escuela.cooperadora_nombre} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="coop-dom">Domicilio</Label>
                <Input id="coop-dom" bind:value={store.escuela.domicilio} disabled={escuelaValidada} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="coop-loc">Localidad</Label>
                <Input id="coop-loc" bind:value={store.escuela.localidad} disabled={escuelaValidada} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="coop-email">Email cooperadora</Label>
                <Input id="coop-email" bind:value={store.escuela.email_cooperadora} oninput={() => escuelaDirty = true} class="mt-1" />
              </div>
              <div>
                <Label for="coop-tel">Teléfono cooperadora</Label>
                <Input id="coop-tel" bind:value={store.escuela.telefono_cooperadora} oninput={() => { store.onTelefonoInput(); escuelaDirty = true }} disabled={telefonoMismoQueEscuela} placeholder="+54 9 11 1234-5678" inputmode="tel" class="mt-1" />
                <label class="flex items-center gap-2 mt-1 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={telefonoMismoQueEscuela} onCheckedChange={() => toggleTelefonoMismoQueEscuela()} />
                  Mismo que la escuela
                </label>
              </div>
              <div>
                <Label for="email-escuela">Email institucional</Label>
                <div class="flex items-center gap-1 mt-1">
                  <Input
                    id="email-escuela"
                    value={emailEscuelaAlias}
                    oninput={onEmailEscuelaInput}
                    disabled={emailEscuelaBloqueado}
                    placeholder="escuela"
                    class="flex-1"
                  />
                  <span class="text-sm text-muted-foreground whitespace-nowrap">{EMAIL_INSTITUCIONAL_DOMAIN}</span>
                </div>
                {#if escuelaValidada && !emailEscuelaBloqueado}
                  <p class="mt-1 text-xs text-muted-foreground">Cargá el email institucional; al guardar queda bloqueado.</p>
                {/if}
              </div>
              <div>
                <Label for="tel-escuela">Teléfono escuela</Label>
                <Input id="tel-escuela" bind:value={store.escuela.telefono_escuela} disabled={escuelaValidada} oninput={() => { store.onTelefonoEscuelaInput(); escuelaDirty = true }} placeholder="+54 9 11 1234-5678" inputmode="tel" class="mt-1" />
              </div>
              <div>
                <Label for="color-primario">Color de marca</Label>
                <Input id="color-primario" type="color" value={store.color_primario} oninput={(/** @type {Event} */ e) => { store.setColor_primario(/** @type {HTMLInputElement} */ (e.target)?.value); escuelaDirty = true }} class="mt-1 h-10 w-16 p-1" />
              </div>
            </div>
            <div class="flex items-center justify-between">
              {#if !escuelaValidada}
                <Button variant="outline" size="sm" onclick={store.validarDatos} disabled={store.busy}>
                  <CheckCircleIcon data-icon="inline-start" />
                  Validar y bloquear
                </Button>
              {/if}
              <Button onclick={handleSave} disabled={store.busy || (escuelaValidada && !escuelaDirty)} class="ml-auto">Guardar</Button>
            </div>
          </div>
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
          <div class="flex flex-col gap-4">
            <Tabs.Root value={store.organismo} onValueChange={store.setOrganismo}>
              <Tabs.List>
                {#each ORGANISMOS as org}<Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>{/each}
              </Tabs.List>
            </Tabs.Root>

            {#if store.comisionDirectiva.length > 0}
              <div class="overflow-x-auto rounded-lg border border-border">
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Cargo</Table.Head>
                      <Table.Head>Titular</Table.Head>
                      <Table.Head>CUIL</Table.Head>
                      <Table.Head class="w-[90px]">Asunción</Table.Head>
                      <Table.Head class="w-[90px]">Vence</Table.Head>
                      {#if !escuelaValidada}
                        <Table.Head class="w-[64px]">Orden</Table.Head>
                        <Table.Head class="w-[80px]">Duración</Table.Head>
                        <Table.Head class="w-[70px]">Oblig.</Table.Head>
                        <Table.Head class="w-[90px]"></Table.Head>
                      {/if}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each store.comisionDirectiva as fila (fila.cargoId)}
                      <Table.Row>
                        <Table.Cell class="text-sm font-medium">
                          {#if !escuelaValidada}
                            <Input bind:value={fila.cargo.nombre_cargo} class="h-8 text-sm" />
                          {:else}
                            {fila.cargoNombre}
                          {/if}
                        </Table.Cell>
                        <Table.Cell class="text-sm">{fila.apellido_nombre || '—'}</Table.Cell>
                        <Table.Cell class="text-sm">{fila.cuil || '—'}</Table.Cell>
                        <Table.Cell class="text-sm">{formatFecha(fila.fecha_asuncion) || '—'}</Table.Cell>
                        <Table.Cell class="text-sm">{formatFecha(fila.fecha_vencimiento) || '—'}</Table.Cell>
                        {#if !escuelaValidada}
                          <Table.Cell>
                            <Input type="number" bind:value={fila.cargo.orden} class="h-8 text-sm" />
                          </Table.Cell>
                          <Table.Cell>
                            <Input type="number" bind:value={fila.cargo.duracion_meses} class="h-8 text-sm" />
                          </Table.Cell>
                          <Table.Cell>
                            <Checkbox bind:checked={fila.cargo.cargo_obligatorio} />
                          </Table.Cell>
                          <Table.Cell>
                            <Button variant="outline" size="sm" onclick={() => store.saveCargo(fila.cargo)}>Guardar</Button>
                          </Table.Cell>
                        {/if}
                      </Table.Row>
                    {/each}
                  </Table.Body>
                </Table.Root>
              </div>
            {:else}
              <p class="text-sm text-muted-foreground">No hay cargos cargados para este organismo.</p>
            {/if}

            {#if !escuelaValidada}
              <Separator />
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
                <div class="flex flex-col gap-1"><Label class="text-xs font-medium text-muted-foreground">Obligatorio</Label><Checkbox bind:checked={store.nuevoCargo.cargo_obligatorio} class="mt-1" /></div>
                <div class="flex flex-col gap-1"><Label class="text-xs font-medium text-muted-foreground">Activo</Label><Switch bind:checked={store.nuevoCargo.activo} disabled={store.nuevoCargo.cargo_obligatorio} class="mt-1" /></div>
              </div>
              <div class="flex justify-end"><Button size="sm" onclick={store.addCargo} disabled={store.busy}>Agregar</Button></div>
            {/if}

            {#if !store.tieneAutoridadesVigentes}
              <div class="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
                <AlertTriangleIcon class="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-semibold text-amber-900 dark:text-amber-200">Sin autoridades designadas</span>
                  <span class="text-sm text-amber-700 dark:text-amber-300">No hay autoridades vigentes para el ejercicio en curso.</span>
                  <Button variant="outline" size="sm" class="mt-1 w-fit" onclick={() => navigate('gobierno')}>
                    Ir a Asambleas y Autoridades
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            {/if}
          </div>
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
                <div>
                  <div class="text-sm font-semibold">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
                  <div class="text-xs text-muted-foreground">{e.en_curso ? 'En curso' : 'Inactivo'}</div>
                </div>
                {#if e.en_curso}
                  <Badge variant="default">En curso</Badge>
                {/if}
              </div>
            {/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  </div>

</PageScaffold>
