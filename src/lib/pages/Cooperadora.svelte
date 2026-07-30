<script>
  import { onMount } from 'svelte'
  import { ensureOneRow, fetchRecords, gristReady, isInGrist, resolveTableId, applyUserActions, subscribeRecords, getWidgetOptions, setWidgetOption } from '../grist'
  import { normalizeFields, ORGANISMOS, ORGANISMO_LABELS, NIVELES_CARGO, MESES, TABLE_PREFERRED_IDS } from '../utils'
  import { notify } from '../stores/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Switch } from '$lib/components/ui/switch'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'

  let loading = $state(true)
  let error = $state('')
  let notice = $state('')
  let busy = $state(false)

  let tEscuela = $state()
  let tBanco = $state()
  let tKiosco = $state()
  let tEjercicios = $state()
  let tCargos = $state()

  let escuela = $state({})
  let banco = $state({})
  let kiosco = $state({})

  let ejercicios = $state([])
  let nuevoEj = $state({
    anio_inicio: '',
    anio_fin: '',
    mes_inicio: 'Marzo',
    saldo_inicial_banco: 0,
    saldo_inicial_efectivo: 0,
    saldo_inicial_caja_chica: 0
  })

  let organismo = $state('CD')
  let cargos = $state([])
  let userName = $state('')
  let nuevoCargo = $state({ nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, cargo_obligatorio: false, activo: true })

  const load = async () => {
    loading = true
    error = ''
    notice = ''

    if (!isInGrist()) {
      loading = false
      return
    }

    try {
      await gristReady()

      tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
      tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
      tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
      tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
      tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)

      escuela = (await ensureOneRow(tEscuela)) || {}
      banco = (await ensureOneRow(tBanco)) || {}
      kiosco = (await ensureOneRow(tKiosco)) || {}

      ejercicios = await fetchRecords(tEjercicios)
      const opts = await getWidgetOptions()
      if (opts?.userName) userName = opts.userName
      await loadCargos()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const loadCargos = async () => {
    const all = await fetchRecords(tCargos)
    cargos = all
      .filter((c) => String(c.organismo) === organismo)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  }

  const updateRecord = async (tableId, rec) => {
    const fields = { ...rec }
    delete fields.id
    await applyUserActions([['UpdateRecord', tableId, rec.id, normalizeFields(fields)]])
  }

  const saveCooperadora = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tEscuela || !tBanco || !tKiosco) {
        error = 'Faltan tablas de configuración. Ejecutá "Actualizar schema" en Inicio.'
        notify.error(error)
        return
      }
      await updateRecord(tEscuela, escuela)
      await updateRecord(tBanco, banco)
      await updateRecord(tKiosco, kiosco)
      if (userName) await setWidgetOption('userName', userName.trim())
      notice = 'Datos guardados.'
      notify.success(notice)
    } catch (e) {
      error = e?.message || String(e)
      notify.error(error)
    } finally {
      busy = false
    }
  }

  const createEjercicio = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tEjercicios) {
        error = 'No se encontró la tabla ejercicios. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      const fields = normalizeFields({
        anio_inicio: nuevoEj.anio_inicio ? Number(nuevoEj.anio_inicio) : null,
        anio_fin: nuevoEj.anio_fin ? Number(nuevoEj.anio_fin) : null,
        mes_inicio: nuevoEj.mes_inicio,
        saldo_inicial_banco: Number(nuevoEj.saldo_inicial_banco || 0),
        saldo_inicial_efectivo: Number(nuevoEj.saldo_inicial_efectivo || 0),
        saldo_inicial_caja_chica: Number(nuevoEj.saldo_inicial_caja_chica || 0),
        en_curso: true
      })

      const toDeactivate = ejercicios.filter((e) => e.en_curso === true).map((e) => e.id)
      const actions = [
        ...toDeactivate.map((id) => ['UpdateRecord', tEjercicios, id, { en_curso: false }]),
        ['AddRecord', tEjercicios, null, fields]
      ]
      await applyUserActions(actions)
      ejercicios = await fetchRecords(tEjercicios)
      notice = 'Ejercicio creado.'
      notify.success(notice)
      nuevoEj = {
        anio_inicio: '',
        anio_fin: '',
        mes_inicio: nuevoEj.mes_inicio || 'Marzo',
        saldo_inicial_banco: 0,
        saldo_inicial_efectivo: 0,
        saldo_inicial_caja_chica: 0
      }
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const setEjercicioEnCurso = async (id) => {
    notice = ''
    error = ''
    busy = true
    try {
      const actions = ejercicios.map((e) => ['UpdateRecord', tEjercicios, e.id, { en_curso: e.id === id }])
      await applyUserActions(actions)
      ejercicios = await fetchRecords(tEjercicios)
      notice = 'Ejercicio actualizado.'
      notify.success(notice)
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const saveCargo = async (c) => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tCargos) {
        error = 'No se encontró la tabla cargos. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      const fields = normalizeFields({
        organismo: c.organismo,
        nombre_cargo: c.nombre_cargo,
        nivel: c.nivel,
        orden: Number(c.orden || 0),
        duracion_meses: c.duracion_meses === '' ? '' : Number(c.duracion_meses || 0),
        cargo_obligatorio: Boolean(c.cargo_obligatorio),
        activo: Boolean(c.activo)
      })
      if (c.cargo_obligatorio) fields.activo = true
      await applyUserActions([['UpdateRecord', tCargos, c.id, fields]])
      await loadCargos()
      notice = 'Cargo guardado.'
      notify.success(notice)
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const addCargo = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tCargos) {
        error = 'No se encontró la tabla cargos. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      if (!String(nuevoCargo.nombre_cargo || '').trim()) {
        error = 'Completá el nombre del cargo.'
        return
      }
      const fields = normalizeFields({
        organismo,
        nombre_cargo: String(nuevoCargo.nombre_cargo).trim(),
        nivel: nuevoCargo.nivel,
        orden: Number(nuevoCargo.orden || 0),
        duracion_meses: nuevoCargo.duracion_meses === '' ? '' : Number(nuevoCargo.duracion_meses || 0),
        cargo_obligatorio: Boolean(nuevoCargo.cargo_obligatorio),
        activo: Boolean(nuevoCargo.activo)
      })
      if (fields.cargo_obligatorio) fields.activo = true
      await applyUserActions([['AddRecord', tCargos, null, fields]])
      nuevoCargo = {
        nombre_cargo: '',
        nivel: nuevoCargo.nivel || 'Titular',
        orden: Number(nuevoCargo.orden || 10) + 1,
        duracion_meses: Number(nuevoCargo.duracion_meses || 12),
        cargo_obligatorio: false,
        activo: true
      }
      await loadCargos()
      notice = 'Cargo agregado.'
      notify.success(notice)
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  onMount(() => {
    const unsub = subscribeRecords(() => {
      if (!busy && !loading) load()
    })
    load()
    return unsub
  })
</script>

{#if !isInGrist()}
  <h1 class="text-lg font-bold">Cooperadora</h1>
  <p class="text-sm text-muted-foreground">Esta pantalla solo funciona dentro de Grist.</p>
{:else if loading}
  <div class="flex flex-col gap-4">
    <Skeleton class="h-8 w-48" />
    <div class="grid gap-4 lg:grid-cols-2">
      <Skeleton class="h-96" />
      <Skeleton class="h-96" />
    </div>
  </div>
{:else}
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Columna 1: Datos de la cooperadora -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-base">Cooperadora</Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <Label for="distrito">Distrito</Label>
            <Input id="distrito" bind:value={escuela.distrito} class="mt-1" />
          </div>
          <div>
            <Label for="escuela-nombre">Escuela</Label>
            <Input id="escuela-nombre" bind:value={escuela.escuela_nombre} class="mt-1" />
          </div>
          <div>
            <Label for="escuela-numero">Número</Label>
            <Input id="escuela-numero" bind:value={escuela.escuela_numero} class="mt-1" />
          </div>
          <div>
            <Label for="cue">CUE</Label>
            <Input id="cue" bind:value={escuela.cue} class="mt-1" />
          </div>
          <div>
            <Label for="cuit">CUIT</Label>
            <Input id="cuit" bind:value={escuela.cuit} class="mt-1" />
          </div>
          <div>
            <Label for="coop-nombre">Cooperadora</Label>
            <Input id="coop-nombre" bind:value={escuela.cooperadora_nombre} class="mt-1" />
          </div>
          <div>
            <Label for="coop-dom">Domicilio</Label>
            <Input id="coop-dom" bind:value={escuela.domicilio} class="mt-1" />
          </div>
          <div>
            <Label for="coop-loc">Localidad</Label>
            <Input id="coop-loc" bind:value={escuela.localidad} class="mt-1" />
          </div>
          <div>
            <Label for="coop-email">Email</Label>
            <Input id="coop-email" bind:value={escuela.email_cooperadora} class="mt-1" />
          </div>
          <div>
            <Label for="coop-tel">Teléfono</Label>
            <Input id="coop-tel" bind:value={escuela.telefono_cooperadora} class="mt-1" />
          </div>
        </div>

        <Separator />

        <div class="text-sm font-semibold">Banco</div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <Label for="banco-entidad">Entidad</Label>
            <Input id="banco-entidad" bind:value={banco.entidad} class="mt-1" />
          </div>
          <div>
            <Label for="banco-cbu">CBU</Label>
            <Input id="banco-cbu" bind:value={banco.cbu} class="mt-1" />
          </div>
          <div>
            <Label for="banco-cc">Cuenta</Label>
            <Input id="banco-cc" bind:value={banco.cuenta_corriente} class="mt-1" />
          </div>
        </div>

        <Separator />

        <div class="text-sm font-semibold">Kiosco</div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <Label for="kiosco-posee">Posee</Label>
            <select id="kiosco-posee" bind:value={kiosco.posee} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value={true}>Sí</option>
              <option value={false}>No</option>
            </select>
          </div>
          <div>
            <Label for="kiosco-modalidad">Modalidad</Label>
            <select id="kiosco-modalidad" bind:value={kiosco.modalidad} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">(sin)</option>
              <option value="Propio">Propio</option>
              <option value="Licitado">Licitado</option>
            </select>
          </div>
        </div>

        <Separator />

        <div class="text-sm font-semibold">Usuario</div>
        <div>
          <Label for="user-name">Nombre de usuario (para registros)</Label>
          <Input id="user-name" bind:value={userName} placeholder="Ej: Juan Pérez" class="mt-1" />
        </div>

        <div class="flex justify-end">
          <Button onclick={saveCooperadora} disabled={busy}>Guardar datos</Button>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Columna 2: Ejercicios y cargos -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-base">Ejercicios y comisión</Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <!-- Lista de ejercicios -->
        <div class="flex flex-col gap-2">
          {#each ejercicios as e (e.id)}
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div>
                <div class="text-sm font-semibold">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
                <div class="text-xs text-muted-foreground">{e.en_curso ? 'En curso' : 'Inactivo'}</div>
              </div>
              <Button variant="outline" size="sm" disabled={e.en_curso} onclick={() => setEjercicioEnCurso(e.id)}>Activar</Button>
            </div>
          {/each}
        </div>

        <Separator />

        <div class="text-sm font-semibold">Nuevo ejercicio</div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <Label for="ej-desde">Año desde</Label>
            <Input id="ej-desde" type="number" bind:value={nuevoEj.anio_inicio} class="mt-1" />
          </div>
          <div>
            <Label for="ej-hasta">Año hasta</Label>
            <Input id="ej-hasta" type="number" bind:value={nuevoEj.anio_fin} class="mt-1" />
          </div>
          <div>
            <Label for="ej-mes">Mes inicio</Label>
            <select id="ej-mes" bind:value={nuevoEj.mes_inicio} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {#each MESES as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </div>
          <div>
            <Label for="ej-banco">Saldo banco</Label>
            <Input id="ej-banco" type="number" bind:value={nuevoEj.saldo_inicial_banco} class="mt-1" />
          </div>
          <div>
            <Label for="ej-efectivo">Saldo efectivo</Label>
            <Input id="ej-efectivo" type="number" bind:value={nuevoEj.saldo_inicial_efectivo} class="mt-1" />
          </div>
          <div>
            <Label for="ej-caja">Saldo caja chica</Label>
            <Input id="ej-caja" type="number" bind:value={nuevoEj.saldo_inicial_caja_chica} class="mt-1" />
          </div>
        </div>
        <div class="flex justify-end">
          <Button size="sm" onclick={createEjercicio} disabled={busy}>Crear y activar</Button>
        </div>

        <Separator />

        <!-- Cargos -->
        <div class="text-sm font-semibold">Cargos (base)</div>
        <Tabs.Root bind:value={organismo} onValueChange={(v) => { organismo = v; loadCargos() }}>
          <Tabs.List>
            {#each ORGANISMOS as org}
              <Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>
            {/each}
          </Tabs.List>
        </Tabs.Root>

        {#if cargos.length > 0}
          <div class="overflow-x-auto rounded-lg border border-border">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head class="w-[64px]">Orden</Table.Head>
                  <Table.Head>Cargo</Table.Head>
                  <Table.Head class="w-[100px]">Duración</Table.Head>
                  <Table.Head class="w-[120px]">Nivel</Table.Head>
                  <Table.Head class="w-[90px]">Oblig.</Table.Head>
                  <Table.Head class="w-[70px]">Activo</Table.Head>
                  <Table.Head class="w-[90px]"></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each cargos as c (c.id)}
                  <Table.Row>
                    <Table.Cell><Input type="number" bind:value={c.orden} class="h-8 text-sm" /></Table.Cell>
                    <Table.Cell><Input bind:value={c.nombre_cargo} class="h-8 text-sm" /></Table.Cell>
                    <Table.Cell><Input type="number" bind:value={c.duracion_meses} class="h-8 text-sm" /></Table.Cell>
                    <Table.Cell>
                      <select bind:value={c.nivel} class="h-8 rounded-md border border-input bg-background px-2 text-sm">
                        {#each NIVELES_CARGO as n}
                          <option value={n}>{n}</option>
                        {/each}
                      </select>
                    </Table.Cell>
                    <Table.Cell><Checkbox bind:checked={c.cargo_obligatorio} /></Table.Cell>
                    <Table.Cell><Switch bind:checked={c.activo} disabled={c.cargo_obligatorio} /></Table.Cell>
                    <Table.Cell><Button variant="outline" size="sm" onclick={() => saveCargo(c)}>Guardar</Button></Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {/if}

        <div class="text-sm font-semibold">Agregar cargo</div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <Label for="nc-nombre">Nombre</Label>
            <Input id="nc-nombre" bind:value={nuevoCargo.nombre_cargo} class="mt-1" />
          </div>
          <div>
            <Label for="nc-duracion">Duración (meses)</Label>
            <Input id="nc-duracion" type="number" bind:value={nuevoCargo.duracion_meses} class="mt-1" />
          </div>
          <div>
            <Label for="nc-nivel">Nivel</Label>
            <select id="nc-nivel" bind:value={nuevoCargo.nivel} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {#each NIVELES_CARGO as n}
                <option value={n}>{n}</option>
              {/each}
            </select>
          </div>
          <div>
            <Label for="nc-orden">Orden</Label>
            <Input id="nc-orden" type="number" bind:value={nuevoCargo.orden} class="mt-1" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-medium text-muted-foreground">Obligatorio</Label>
            <Checkbox bind:checked={nuevoCargo.cargo_obligatorio} class="mt-1" />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs font-medium text-muted-foreground">Activo</Label>
            <Switch bind:checked={nuevoCargo.activo} disabled={nuevoCargo.cargo_obligatorio} class="mt-1" />
          </div>
        </div>
        <div class="flex justify-end">
          <Button size="sm" onclick={addCargo} disabled={busy}>Agregar</Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  {#if error}
    <Alert variant="destructive" class="mt-4">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {/if}
{/if}
