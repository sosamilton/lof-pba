<script>
  import { onMount } from 'svelte'
  import { cooperadoraStore as store } from './cooperadoraStore.svelte'
  import { ORGANISMOS, ORGANISMO_LABELS, NIVELES_CARGO, MESES } from '$core/utils'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Switch } from '$lib/components/ui/switch'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import Combobox from '$lib/components/Combobox.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'

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
  <div class="flex flex-col gap-4 max-w-3xl">
    <!-- Escuela y cooperadora -->
    <Card.Root>
      <Card.Header><Card.Title class="text-base">Escuela y cooperadora</Card.Title></Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div><Label for="distrito">Distrito</Label><Input id="distrito" bind:value={store.escuela.distrito} class="mt-1" /></div>
          <div><Label for="escuela-nombre">Escuela</Label><Input id="escuela-nombre" bind:value={store.escuela.escuela_nombre} class="mt-1" /></div>
          <div><Label for="escuela-numero">Número</Label><Input id="escuela-numero" bind:value={store.escuela.escuela_numero} class="mt-1" /></div>
          <div><Label for="cue">CUE</Label><Input id="cue" bind:value={store.escuela.cue} class="mt-1" /></div>
          <div><Label for="cuit">CUIT</Label><Input id="cuit" bind:value={store.escuela.cuit} class="mt-1" /></div>
          <div><Label for="coop-nombre">Cooperadora</Label><Input id="coop-nombre" bind:value={store.escuela.cooperadora_nombre} class="mt-1" /></div>
          <div><Label for="coop-dom">Domicilio</Label><Input id="coop-dom" bind:value={store.escuela.domicilio} class="mt-1" /></div>
          <div><Label for="coop-loc">Localidad</Label><Input id="coop-loc" bind:value={store.escuela.localidad} class="mt-1" /></div>
          <div><Label for="coop-email">Email</Label><Input id="coop-email" bind:value={store.escuela.email_cooperadora} class="mt-1" /></div>
          <div><Label for="coop-tel">Teléfono</Label><Input id="coop-tel" bind:value={store.escuela.telefono_cooperadora} class="mt-1" /></div>
        </div>
        <div class="flex justify-end"><Button onclick={store.saveCooperadora} disabled={store.busy}>Guardar</Button></div>
      </Card.Content>
    </Card.Root>

    <!-- Datos bancarios -->
    <Card.Root>
      <Card.Header><Card.Title class="text-base">Datos bancarios</Card.Title></Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-3">
          <div><Label for="banco-entidad">Entidad</Label><Input id="banco-entidad" bind:value={store.banco.entidad} class="mt-1" /></div>
          <div><Label for="banco-cbu">CBU</Label><Input id="banco-cbu" bind:value={store.banco.cbu} class="mt-1" /></div>
          <div><Label for="banco-cc">Cuenta</Label><Input id="banco-cc" bind:value={store.banco.cuenta_corriente} class="mt-1" /></div>
        </div>
        <div class="flex justify-end"><Button onclick={store.saveCooperadora} disabled={store.busy}>Guardar</Button></div>
      </Card.Content>
    </Card.Root>

    <!-- Kiosco / Librería -->
    <Card.Root>
      <Card.Header><Card.Title class="text-base">Kiosco / Librería</Card.Title></Card.Header>
      <Card.Content class="flex flex-col gap-4">
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
        <div class="flex justify-end"><Button onclick={store.saveCooperadora} disabled={store.busy}>Guardar</Button></div>
      </Card.Content>
    </Card.Root>

    <!-- Usuario -->
    <Card.Root>
      <Card.Header><Card.Title class="text-base">Usuario y preferencias</Card.Title></Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div><Label for="user-name">Nombre de usuario (para registros)</Label><Input id="user-name" bind:value={store.userName} placeholder="Ej: Juan Pérez" class="mt-1" /></div>
        <div>
          <Label for="cuenta-default">Cuenta/caja por defecto</Label>
          <Combobox
            bind:value={store.cuentaDefaultId}
            items={store.cuentas.map((c) => ({ value: c.id, label: c.nombre_cuenta }))}
            placeholder="(Ninguna)"
            searchPlaceholder="Buscar cuenta…"
            class="mt-1"
          />
        </div>
        <div class="flex justify-end"><Button onclick={store.saveCooperadora} disabled={store.busy}>Guardar</Button></div>
      </Card.Content>
    </Card.Root>

    <Separator class="my-2" />

    <!-- Ejercicios -->
    <Card.Root>
      <Card.Header><Card.Title class="text-base">Ejercicios</Card.Title></Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          {#each store.ejercicios as e (e.id)}
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div>
                <div class="text-sm font-semibold">{e.anio_inicio}-{e.anio_fin} · {e.mes_inicio}</div>
                <div class="text-xs text-muted-foreground">{e.en_curso ? 'En curso' : 'Inactivo'}</div>
              </div>
              <Button variant="outline" size="sm" disabled={e.en_curso} onclick={() => store.setEjercicioEnCurso(e.id)}>Activar</Button>
            </div>
          {/each}
        </div>
        <Separator />
        <div class="text-sm font-semibold">Nuevo ejercicio</div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div><Label for="ej-desde">Año desde</Label><Input id="ej-desde" type="number" bind:value={store.nuevoEj.anio_inicio} class="mt-1" /></div>
          <div><Label for="ej-hasta">Año hasta</Label><Input id="ej-hasta" type="number" bind:value={store.nuevoEj.anio_fin} class="mt-1" /></div>
          <div>
            <Label for="ej-mes">Mes inicio</Label>
            <Select.Root type="single" bind:value={store.nuevoEj.mes_inicio}>
              <Select.Trigger id="ej-mes" class="mt-1 w-full">
                <Select.Value placeholder="Mes…" />
              </Select.Trigger>
              <Select.Content>
                {#each MESES as m}<Select.Item value={m}>{m}</Select.Item>{/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div><Label for="ej-banco">Saldo banco</Label><Input id="ej-banco" type="number" bind:value={store.nuevoEj.saldo_inicial_banco} class="mt-1" /></div>
          <div><Label for="ej-efectivo">Saldo efectivo</Label><Input id="ej-efectivo" type="number" bind:value={store.nuevoEj.saldo_inicial_efectivo} class="mt-1" /></div>
          <div><Label for="ej-caja">Saldo caja chica</Label><Input id="ej-caja" type="number" bind:value={store.nuevoEj.saldo_inicial_caja_chica} class="mt-1" /></div>
        </div>
        <div class="flex justify-end"><Button size="sm" onclick={store.createEjercicio} disabled={store.busy}>Crear y activar</Button></div>
      </Card.Content>
    </Card.Root>

    <!-- Cargos -->
    <Card.Root>
      <Card.Header><Card.Title class="text-base">Cargos (base)</Card.Title></Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <Tabs.Root value={store.organismo} onValueChange={store.setOrganismo}>
          <Tabs.List>
            {#each ORGANISMOS as org}<Tabs.Trigger value={org}>{ORGANISMO_LABELS[org]}</Tabs.Trigger>{/each}
          </Tabs.List>
        </Tabs.Root>

        {#if store.cargos.length > 0}
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
                {#each store.cargos as c (c.id)}
                  <Table.Row>
                    <Table.Cell><Input type="number" bind:value={c.orden} class="h-8 text-sm" /></Table.Cell>
                    <Table.Cell><Input bind:value={c.nombre_cargo} class="h-8 text-sm" /></Table.Cell>
                    <Table.Cell><Input type="number" bind:value={c.duracion_meses} class="h-8 text-sm" /></Table.Cell>
                    <Table.Cell>
                      <Select.Root type="single" bind:value={c.nivel}>
                        <Select.Trigger class="h-8 w-full">
                          <Select.Value placeholder="…" />
                        </Select.Trigger>
                        <Select.Content>
                          {#each NIVELES_CARGO as n}<Select.Item value={n}>{n}</Select.Item>{/each}
                        </Select.Content>
                      </Select.Root>
                    </Table.Cell>
                    <Table.Cell><Checkbox bind:checked={c.cargo_obligatorio} /></Table.Cell>
                    <Table.Cell><Switch bind:checked={c.activo} disabled={c.cargo_obligatorio} /></Table.Cell>
                    <Table.Cell><Button variant="outline" size="sm" onclick={() => store.saveCargo(c)}>Guardar</Button></Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {/if}

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
      </Card.Content>
    </Card.Root>
  </div>

</PageScaffold>
