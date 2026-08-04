<script>
  import { onMount } from 'svelte'
  import { isInGrist } from '$core/grist'
  import { MESES } from '$core/utils'
  import { identidad } from '$core/identidad'
  import { navigate } from '$core/router.svelte'
  import { inicioStore as store } from './inicioStore.svelte.js'
  import { cooperadoraStore } from '$app/pages/cooperadoraStore.svelte.js'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Accordion from '$lib/components/ui/accordion'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import MessageBanner from '$lib/components/MessageBanner.svelte'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import WrenchIcon from '@lucide/svelte/icons/wrench'
  import CopyCheckIcon from '@lucide/svelte/icons/copy-check'
  import UsersIcon from '@lucide/svelte/icons/users'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import TagIcon from '@lucide/svelte/icons/tag'
  import ArrowUpCircleIcon from '@lucide/svelte/icons/arrow-up-circle'
  import WalletIcon from '@lucide/svelte/icons/wallet'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  // Tablero de caja (Fase 2): saldos derivados del ejercicio en curso.
  const saldos = $derived(store.saldos)

  // Secciones del tab Resumen que están expandidas por defecto.
  // 'config' se incluye solo si hay resultados recientes de dedup/repair.
  let resumenAccordion = $state(['resumen-ejecutivo', 'tablero-caja'])

  onMount(() => {
    // Fix F5: cuando se editan saldos desde Cooperadora, recargar el
    // tablero de caja para que refleje los nuevos saldos iniciales.
    cooperadoraStore.setOnSaldosChanged(async (ejercicioActualizado) => {
      if (ejercicioActualizado && store.moduloGestionIntegral) {
        store.saldos.loadFromData({
          movimientos: store.saldos.movimientos,
          ejercicio: ejercicioActualizado,
          cuentas: store.saldos.cuentas,
        })
      }
    })
    // Cargar datos de la cooperadora para el tab "Información institucional".
    cooperadoraStore.load()
    return store.init()
  })
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center gap-2">
    <DatabaseIcon class="size-5 text-primary" />
    <h1 class="text-lg font-bold">{identidad.nombre}</h1>
  </div>

  {#if isInGrist()}
    {#if store.loading}
      <div class="flex flex-col gap-4">
        <Skeleton class="h-8 w-48" />
        <Skeleton class="h-64 w-full" />
      </div>
    {:else if store.status}
      {#if store.status.missing.length === 0 && store.status.schemaDiff?.missingTables?.length === 0 && store.status.schemaDiff?.missingColumns?.length === 0}
        <!-- Dashboard con tabs: Resumen e Información institucional -->
        <Tabs.Root value="resumen">
          <Tabs.List>
            <Tabs.Trigger value="resumen">Resumen</Tabs.Trigger>
            <Tabs.Trigger value="institucional">Información institucional</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="resumen" class="flex flex-col gap-4 mt-2">
            <Accordion.Root type="multiple" bind:value={resumenAccordion}>
              <!-- Resumen ejecutivo -->
              <Accordion.Item value="resumen-ejecutivo">
                <Accordion.Trigger>
                  <span class="font-semibold">Resumen ejecutivo</span>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                    <Card.Root>
                      <Card.Content class="flex flex-col gap-1 pt-4">
                        <div class="flex items-center gap-2 text-muted-foreground">
                          <CalendarIcon class="size-4" />
                          <span class="text-xs font-medium">Ejercicio en curso</span>
                        </div>
                        {#if store.dashLoading}
                          <Skeleton class="h-6 w-32 mt-1" />
                        {:else if store.ejercicioEnCurso}
                          <div class="text-lg font-bold">{store.ejercicioEnCurso.anio_inicio}-{store.ejercicioEnCurso.anio_fin}</div>
                          <div class="text-xs text-muted-foreground">Inicio: {store.ejercicioEnCurso.mes_inicio}</div>
                          {#if store.ejercicioProximoVencer}
                            <Badge variant="destructive" class="mt-1 w-fit">Próximo a vencer</Badge>
                          {/if}
                        {:else}
                          <div class="text-sm text-muted-foreground">Sin ejercicio activo</div>
                        {/if}
                      </Card.Content>
                    </Card.Root>

                    <Card.Root>
                      <Card.Content class="flex flex-col gap-1 pt-4">
                        <div class="flex items-center gap-2 text-muted-foreground">
                          <ShieldCheckIcon class="size-4" />
                          <span class="text-xs font-medium">Cargos obligatorios cubiertos</span>
                        </div>
                        {#if store.dashLoading}
                          <Skeleton class="h-6 w-20 mt-1" />
                        {:else}
                          <div class="text-lg font-bold">{store.cargosCubiertos} / {store.cargosObligatorios}</div>
                          {#if store.cargosCubiertos < store.cargosObligatorios}
                            <Badge variant="secondary" class="mt-1 w-fit">Faltan {store.cargosObligatorios - store.cargosCubiertos}</Badge>
                          {:else}
                            <Badge variant="default" class="mt-1 w-fit">Completo</Badge>
                          {/if}
                        {/if}
                      </Card.Content>
                    </Card.Root>

                    <Card.Root>
                      <Card.Content class="flex flex-col gap-1 pt-4">
                        <div class="flex items-center gap-2 text-muted-foreground">
                          <UsersIcon class="size-4" />
                          <span class="text-xs font-medium">Socios activos</span>
                        </div>
                        {#if store.dashLoading}
                          <Skeleton class="h-6 w-16 mt-1" />
                        {:else}
                          <div class="text-lg font-bold">{store.sociosActivos}</div>
                        {/if}
                      </Card.Content>
                    </Card.Root>

                    <Card.Root>
                      <Card.Content class="flex flex-col gap-1 pt-4">
                        <div class="flex items-center gap-2 text-muted-foreground">
                          <TrendingUpIcon class="size-4" />
                          <span class="text-xs font-medium">Altas/bajas último año</span>
                        </div>
                        {#if store.dashLoading}
                          <Skeleton class="h-6 w-24 mt-1" />
                        {:else}
                          <div class="text-lg font-bold">
                            <span class="text-primary">+{store.altasUltimoAnio}</span>
                            <span class="text-muted-foreground mx-1">/</span>
                            <span class="text-destructive">-{store.bajasUltimoAnio}</span>
                          </div>
                          <div class="text-xs text-muted-foreground">Saldo neto: {store.altasUltimoAnio - store.bajasUltimoAnio}</div>
                        {/if}
                      </Card.Content>
                    </Card.Root>

                    {#if store.vencimientosProximos.length > 0}
                      <Card.Root class="border-destructive/40">
                        <Card.Content class="flex flex-col gap-1 pt-4">
                          <div class="flex items-center gap-2 text-destructive">
                            <AlertCircleIcon class="size-4" />
                            <span class="text-xs font-medium">Vencimientos próximos (60 días)</span>
                          </div>
                          <div class="text-lg font-bold">{store.vencimientosProximos.length}</div>
                          <div class="text-xs text-muted-foreground">mandatos por vencer</div>
                        </Card.Content>
                      </Card.Root>
                    {/if}

                    {#if store.alertaAsamblea}
                      <Card.Root class="border-primary/40">
                        <Card.Content class="flex flex-col gap-1 pt-4">
                          <div class="flex items-center gap-2 text-primary">
                            <AlertCircleIcon class="size-4" />
                            <span class="text-xs font-medium">Asamblea ordinaria</span>
                          </div>
                          <div class="text-sm font-semibold">Recordatorio</div>
                          <div class="text-xs text-muted-foreground">Segunda quincena de mayo: realizar AGO</div>
                        </Card.Content>
                      </Card.Root>
                    {/if}
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              <!-- Tablero de caja -->
              {#if store.moduloGestionIntegral}
                <Accordion.Item value="tablero-caja">
                  <Accordion.Trigger>
                    <span class="font-semibold">Tablero de caja</span>
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <Card.Root class="pt-2 border-0 shadow-none">
                      <Card.Content class="flex flex-col gap-3 pt-4">
                        {#if store.dashLoading}
                          <Skeleton class="h-8 w-40" />
                        {:else}
                          <div class="flex flex-col gap-3">
                            {#if store.tableroError}
                              <div class="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                                <AlertTriangleIcon class="size-4 shrink-0" />
                                {store.tableroError}
                              </div>
                            {/if}
                            <div>
                              <div class="text-xs text-muted-foreground">Saldo total</div>
                              <div class="text-2xl font-bold">${saldos.saldoTotal.toLocaleString('es-AR')}</div>
                            </div>
                            {#if saldos.saldosInicialesEnCero}
                              <div class="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                                <AlertTriangleIcon class="size-4 shrink-0" />
                                Faltan saldos iniciales — los totales no incluyen arrastre.
                              </div>
                            {/if}
                            <div class="grid gap-2 sm:grid-cols-3">
                              {#each saldos.cuentas as c (c.id)}
                                <div class="rounded-md border border-border px-3 py-2">
                                  <div class="text-xs text-muted-foreground">{c.nombre_cuenta}</div>
                                  <div class="text-sm font-semibold">${(saldos.saldosPorCuenta.get(Number(c.id)) || 0).toLocaleString('es-AR')}</div>
                                </div>
                              {/each}
                            </div>
                            <Separator />
                            <div class="grid gap-2 sm:grid-cols-2">
                              <div class="rounded-md border border-border px-3 py-2">
                                <div class="text-xs text-muted-foreground">Ingresos del mes</div>
                                <div class="text-sm font-semibold text-primary">+${saldos.ingresosMes.toLocaleString('es-AR')}</div>
                              </div>
                              <div class="rounded-md border border-border px-3 py-2">
                                <div class="text-xs text-muted-foreground">Egresos del mes</div>
                                <div class="text-sm font-semibold text-destructive">-${saldos.egresosMes.toLocaleString('es-AR')}</div>
                              </div>
                            </div>
                          </div>
                        {/if}
                      </Card.Content>
                    </Card.Root>
                  </Accordion.Content>
                </Accordion.Item>
              {/if}

              <!-- Configuración y administración -->
              <Accordion.Item value="config">
                <Accordion.Trigger>
                  <span class="font-semibold flex items-center gap-2">
                    <SettingsIcon class="size-4" />
                    Configuración y administración
                  </span>
                </Accordion.Trigger>
                <Accordion.Content>
                  <Card.Root class="pt-2 border-0 shadow-none">
                    <Card.Content class="flex flex-col gap-4 pt-4">
                      <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                        <div class="flex flex-col gap-1">
                          <div class="text-sm font-medium">Modalidad de gestión</div>
                          <div class="text-xs text-muted-foreground">Forma en que la cooperadora administra su información</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 justify-end">
                          <Badge variant="secondary" class="font-medium">{store.modalidadGestion}</Badge>
                          {#if store.moduloKiosco}
                            <Badge variant="outline" class="font-medium">Kiosco / Librería</Badge>
                          {/if}
                        </div>
                      </div>

                      <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                        <div>
                          <div class="text-sm font-medium">Generación automática de períodos</div>
                          <div class="text-xs text-muted-foreground">Crea un nuevo ejercicio automáticamente 2 meses antes del vencimiento</div>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                          <Checkbox bind:checked={store.generarPeriodosAuto} onCheckedChange={(v) => store.onPeriodosAutoChange(v)} disabled={store.savingConfig} />
                          <span class="text-sm">{store.generarPeriodosAuto ? 'Activado' : 'Desactivado'}</span>
                        </label>
                      </div>

                      <Separator />

                      <div class="flex items-center gap-2">
                        <CheckCircleIcon class="size-5 text-primary" />
                        <span class="text-sm font-semibold">Plantilla {identidad.nombre} instalada y sincronizada</span>
                      </div>

                      <Separator />

                      <div class="flex flex-wrap items-center gap-2 text-xs">
                        <TagIcon class="size-4 text-muted-foreground" />
                        <span class="text-muted-foreground">Versión actual:</span>
                        <Badge variant="secondary" class="font-mono">v{store.versionActual}</Badge>
                        {#if store.shaActual && store.shaActual !== 'dev'}
                          <span class="text-muted-foreground font-mono">({store.shaActual})</span>
                        {/if}
                      </div>
                      {#if store.versionInstalada}
                        <div class="flex flex-wrap items-center gap-2 text-xs">
                          <span class="text-muted-foreground">Instalada en este documento:</span>
                          <Badge variant="secondary" class="font-mono">v{store.versionInstalada}</Badge>
                          {#if store.shaInstalado && store.shaInstalado !== 'dev'}
                            <span class="text-muted-foreground font-mono">({store.shaInstalado})</span>
                          {/if}
                          {#if store.versionActualizada}
                            <Badge variant="default" class="ml-1"><CheckCircleIcon class="size-3" /> Actualizada</Badge>
                          {:else}
                            <Badge variant="destructive" class="ml-1"><ArrowUpCircleIcon class="size-3" /> Desactualizada</Badge>
                            <span class="text-muted-foreground">Refrescá o reinstalá para actualizar a v{store.versionActual}</span>
                          {/if}
                        </div>
                      {:else}
                        <div class="text-xs text-muted-foreground">Sin versión instalada registrada (instalación previa al versionado).</div>
                      {/if}

                      <div class="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onclick={store.check} disabled={store.creating}>
                          <RefreshIcon data-icon="inline-start" />
                          Revalidar
                        </Button>
                        <Button variant="outline" size="sm" onclick={store.repairSchema} disabled={store.creating}>
                          <WrenchIcon data-icon="inline-start" />
                          Reparar Refs
                        </Button>
                        <Button variant="outline" size="sm" onclick={store.doDedup} disabled={store.migrating || store.creating}>
                          <CopyCheckIcon data-icon="inline-start" />
                          {store.migrating ? 'Procesando…' : 'Deduplicar personas'}
                        </Button>
                      </div>

                      {#if store.dedupResult}
                        <Separator />
                        <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                          <div class="text-sm font-semibold">Deduplicación completada</div>
                          <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
                            <li>Duplicados encontrados: <strong>{store.dedupResult.duplicatesFound}</strong></li>
                            <li>Campos fusionados: <strong>{store.dedupResult.merged}</strong></li>
                            <li>Personas eliminadas: <strong>{store.dedupResult.removed}</strong></li>
                          </ul>
                        </div>
                      {/if}

                      {#if store.repairResult}
                        <Separator />
                        <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                          <div class="text-sm font-semibold">Schema reparado</div>
                          <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
                            <li>Tablas creadas: <strong>{store.repairResult.created}</strong></li>
                            <li>Columnas agregadas: <strong>{store.repairResult.addedColumns}</strong></li>
                            <li>Refs corregidas: <strong>{store.repairResult.repairedRefs}</strong></li>
                          </ul>
                        </div>
                      {/if}
                    </Card.Content>
                  </Card.Root>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>

            {#if store.ejercicioProximoVencer && !store.showNuevoEjercicio}
              <Button onclick={() => store.setShowNuevoEjercicio(true)} disabled={store.creating}>
                <CalendarIcon data-icon="inline-start" />
                Crear nuevo ejercicio
              </Button>
            {/if}
            {#if store.showNuevoEjercicio}
              <Card.Root>
                <Card.Header>
                  <Card.Title class="text-base">Crear nuevo ejercicio</Card.Title>
                </Card.Header>
                <Card.Content class="flex flex-col gap-4">
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
                  <div class="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onclick={() => store.setShowNuevoEjercicio(false)}>Cancelar</Button>
                    <Button size="sm" onclick={store.crearEjercicio} disabled={store.creating}>Crear y activar</Button>
                  </div>
                </Card.Content>
              </Card.Root>
            {/if}
          </Tabs.Content>

          <Tabs.Content value="institucional" class="flex flex-col gap-4 mt-2">
            {#if cooperadoraStore.loading}
              <div class="flex flex-col gap-4">
                <Skeleton class="h-64 w-full" />
              </div>
            {:else}
              <Card.Root>
                <Card.Header>
                  <Card.Title class="text-base flex items-center gap-2">
                    <BuildingIcon class="size-4" />
                    Escuela y cooperadora
                  </Card.Title>
                </Card.Header>
                <Card.Content class="flex flex-col gap-4">
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div class="text-xs text-muted-foreground">Distrito</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.distrito || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Escuela</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.escuela_nombre || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Número</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.escuela_numero || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">CUE</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.cue || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">CUIT</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.cuit || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Cooperadora</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.cooperadora_nombre || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Domicilio</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.domicilio || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Localidad</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.localidad || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Email cooperadora</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.email_cooperadora || '—'}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">Teléfono cooperadora</div>
                      <div class="text-sm font-medium">{cooperadoraStore.escuela?.telefono_cooperadora || '—'}</div>
                    </div>
                  </div>

                  {#if cooperadoraStore.escuela?.datos_validados}
                    <Badge variant="secondary" class="w-fit"><CheckCircleIcon class="size-3" /> Datos validados</Badge>
                  {/if}
                </Card.Content>
              </Card.Root>

              {#if cooperadoraStore.banco?.entidad || cooperadoraStore.banco?.tipo_cuenta}
                <Card.Root>
                  <Card.Header>
                    <Card.Title class="text-base">Datos bancarios</Card.Title>
                  </Card.Header>
                  <Card.Content class="flex flex-col gap-3">
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div class="text-xs text-muted-foreground">Entidad</div>
                        <div class="text-sm font-medium">{cooperadoraStore.banco?.entidad || '—'}</div>
                      </div>
                      <div>
                        <div class="text-xs text-muted-foreground">Tipo de cuenta</div>
                        <div class="text-sm font-medium">{cooperadoraStore.banco?.tipo_cuenta || '—'}</div>
                      </div>
                    </div>
                    {#if cooperadoraStore.banco?.banco_validado}
                      <Badge variant="secondary" class="w-fit"><CheckCircleIcon class="size-3" /> Datos validados</Badge>
                    {/if}
                  </Card.Content>
                </Card.Root>
              {/if}

              {#if store.moduloKiosco}
                <Card.Root>
                  <Card.Header>
                    <Card.Title class="text-base">Kiosco / Librería</Card.Title>
                  </Card.Header>
                  <Card.Content class="flex flex-col gap-3">
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div class="text-xs text-muted-foreground">Posee</div>
                        <div class="text-sm font-medium">{cooperadoraStore.kiosco?.posee ? 'Sí' : 'No'}</div>
                      </div>
                      {#if cooperadoraStore.kiosco?.posee}
                        <div>
                          <div class="text-xs text-muted-foreground">Modalidad</div>
                          <div class="text-sm font-medium">{cooperadoraStore.kiosco?.modalidad || '—'}</div>
                        </div>
                      {/if}
                    </div>
                  </Card.Content>
                </Card.Root>
              {/if}

              <div class="flex justify-end">
                <Button variant="outline" size="sm" onclick={() => navigate('cooperadora')}>
                  <PencilIcon data-icon="inline-start" />
                  Ver más / Editar
                </Button>
              </div>
            {/if}
          </Tabs.Content>
        </Tabs.Root>
      {:else if store.status.missing.length > 0}
        <Card.Root class="border-destructive/40">
          <Card.Content class="flex flex-col gap-4 pt-6">
            <div class="flex items-center gap-2">
              <AlertTriangleIcon class="size-5 text-destructive" />
              <span class="text-sm font-semibold">Faltan tablas para que la app funcione</span>
            </div>
            <ul class="ml-4 list-disc text-sm text-muted-foreground">
              {#each store.status.missing as t (t.key)}
                <li>{t.label} (<span class="font-mono">{t.tableId}</span>)</li>
              {/each}
            </ul>
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onclick={store.check} disabled={store.creating}>Reintentar</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {:else}
        <Card.Root class="border-destructive/40">
          <Card.Content class="flex flex-col gap-4 pt-6">
            <div class="flex items-center gap-2">
              <AlertTriangleIcon class="size-5 text-destructive" />
              <span class="text-sm font-semibold">Hay diferencias con el schema</span>
            </div>
            {#if store.status.schemaDiff?.missingTables?.length}
              <div>
                <p class="text-sm font-medium mb-1">Tablas faltantes:</p>
                <ul class="ml-4 list-disc text-sm text-muted-foreground">
                  {#each store.status.schemaDiff.missingTables as t (t.id)}
                    <li><span class="font-mono">{t.id}</span></li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if store.status.schemaDiff?.missingColumns?.length}
              <div>
                <p class="text-sm font-medium mb-1">Columnas faltantes:</p>
                <ul class="ml-4 list-disc text-sm text-muted-foreground">
                  {#each store.status.schemaDiff.missingColumns as it (it.tableId)}
                    <li><span class="font-mono">{it.tableId}</span>: {it.columns.map((c) => c.id).join(', ')}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onclick={store.check} disabled={store.creating}>Revalidar</Button>
              <Button size="sm" onclick={store.repairSchema} disabled={store.creating}>Reparar schema</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    {/if}
  {:else}
    <Card.Root>
      <Card.Content class="flex flex-col gap-3 pt-6">
        <p class="text-sm text-muted-foreground">Esta app está pensada para ejecutarse dentro de Grist como Custom Widget.</p>
        <p class="text-sm text-muted-foreground">Al abrirla desde un navegador, no tiene acceso a los datos del documento.</p>
        <Separator />
        <p class="text-sm font-semibold">Cómo instalarla en un documento Grist</p>
        <ol class="ml-5 list-decimal text-sm text-muted-foreground">
          <li>Abrí tu documento</li>
          <li><span class="font-mono">Add New</span> → <span class="font-mono">Add Widget to Page</span> → <span class="font-mono">Custom</span></li>
          <li>Pegá la URL publicada (GitHub Pages)</li>
          <li>Elegí <span class="font-mono">Access level</span>: <strong>Full document access</strong></li>
        </ol>
      </Card.Content>
    </Card.Root>
  {/if}

  <MessageBanner error={store.error} />
</div>
