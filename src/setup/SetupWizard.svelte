<script>
  import { onMount } from 'svelte'
  import { gristReady, listTables, resolveTableId, applyUserActions, invalidateTablesCache, fetchRecords } from '$core/grist'
  import { ensureSchema, initDemoData } from './initAppCoop'
  import { TABLE_PREFERRED_IDS, MODULES } from '$core/utils'
  import { loadConfig, saveConfig, getTablesForModules } from '$core/configuracion'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'

  let step = $state(0)
  let loading = $state(true)
  let installing = $state(false)
  let error = $state('')
  let existingTables = $state([])

  let selectedModules = $state({
    gestion_completa: true,
    kiosco: false,
    tesoreria: true,
    gobierno: true,
    reportes: true
  })

  let schoolData = $state({
    escuela_nombre: '',
    escuela_numero: '',
    cue: '',
    cooperadora_nombre: '',
    cuit: '',
    domicilio: '',
    localidad: '',
    email: '',
    telefono: '',
    color_primario: '#16b378'
  })

  const steps = ['Módulos', 'Escuela y cooperadora', 'Instalar']

  const toggleModule = (key) => {
    if (key === 'gestion_completa') {
      const newVal = !selectedModules.gestion_completa
      selectedModules.gestion_completa = newVal
      if (newVal) {
        selectedModules.tesoreria = true
        selectedModules.gobierno = true
        selectedModules.reportes = true
      }
    } else {
      selectedModules[key] = !selectedModules[key]
    }
  }

  const getSelectedModuleKeys = () =>
    Object.entries(selectedModules).filter(([, v]) => v).map(([k]) => k)

  const getTableCount = () => {
    const tables = getTablesForModules(getSelectedModuleKeys())
    return tables.length
  }

  onMount(async () => {
    try {
      await gristReady()
      existingTables = await listTables()
      const config = await loadConfig()
      if (config?.instalado) {
        schoolData.escuela_nombre = config.escuela_nombre || ''
        schoolData.escuela_numero = config.escuela_numero || ''
        schoolData.cooperadora_nombre = config.cooperadora_nombre || ''
      }
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  })

  const doInstall = async () => {
    installing = true
    error = ''
    try {
      const selectedKeys = getSelectedModuleKeys()
      const existingLower = new Set(existingTables.map((t) => String(t || '').toLowerCase()))

      const schemaResult = await ensureSchema(existingLower)
      if (schemaResult?.errors?.length > 0) {
        error = `Errores de schema: ${schemaResult.errors.join(', ')}`
        return
      }

      const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
      if (tEscuela) {
        let existingEscuela = []
        try { existingEscuela = await fetchRecords(tEscuela) } catch { /* empty */ }
        if (existingEscuela.length === 0) {
          await applyUserActions([['AddRecord', tEscuela, null, {
            escuela_nombre: schoolData.escuela_nombre || '',
            escuela_numero: schoolData.escuela_numero || '',
            cue: schoolData.cue || '',
            cooperadora_nombre: schoolData.cooperadora_nombre || '',
            cuit: schoolData.cuit || '',
            domicilio: schoolData.domicilio || '',
            localidad: schoolData.localidad || '',
            email_cooperadora: schoolData.email || '',
            telefono_cooperadora: schoolData.telefono || ''
          }]])
        }
      }

      const moduleFlags = {}
      for (const key of Object.keys(MODULES)) {
        moduleFlags[`modulo_${key}`] = Boolean(selectedModules[key])
      }

      await saveConfig({
        ...moduleFlags,
        ...schoolData,
        instalado: true,
        fecha_instalacion: new Date().toISOString()
      })

      if (selectedModules.gestion_completa || selectedModules.tesoreria) {
        await initDemoData([
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.ejercicios), seedName: 'ejercicios', batchSize: 10 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cargos), seedName: 'cargos', batchSize: 100 }
        ])
      }

      invalidateTablesCache()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      window.location.reload()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      installing = false
    }
  }

  const canNext = () => {
    if (step === 0) return getSelectedModuleKeys().length > 0
    if (step === 1) return true
    return true
  }
</script>

{#if loading}
  <div class="max-w-[680px] mx-auto px-4 py-6">
    <p class="text-sm text-muted-foreground">Verificando estado del documento…</p>
  </div>
{:else}
  <main class="max-w-[680px] mx-auto px-4 py-6">
    <div class="mb-5">
      <h1 class="text-[22px] font-bold mb-1.5">Configuración inicial de AppCoop</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">Elegí qué módulos instalar y configurá los datos de tu escuela y cooperadora.</p>
    </div>

    <!-- Progress dots -->
    <div class="flex items-center gap-1 mb-5">
      {#each steps as s, i}
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="size-6 rounded-full flex items-center justify-center text-xs font-bold border {step === i ? 'border-primary/50 bg-primary/15' : step > i ? 'border-primary/50 bg-primary/20 text-primary' : 'border-border bg-muted/5'}">{i + 1}</span>
          <span class="text-[13px] font-bold {step === i ? 'opacity-100' : 'opacity-70'} max-[600px]:hidden">{s}</span>
        </div>
        {#if i < steps.length - 1}
          <div class="flex-1 h-0.5 min-w-[20px] {step > i ? 'bg-primary/40' : 'bg-border'}"></div>
        {/if}
      {/each}
    </div>

    {#if step === 0}
      <Card.Root class="mb-4">
        <Card.Content class="pt-6">
          <h2 class="text-[17px] font-bold mb-1.5">¿Qué módulos necesitás?</h2>
          <p class="text-[13px] text-muted-foreground mb-4">Seleccioná los módulos a instalar. Cada módulo crea las tablas necesarias.</p>

          <div class="flex flex-col gap-2.5">
            {#each Object.entries(MODULES) as [key, mod]}
              <label class="flex items-start gap-2.5 p-3 rounded-xl border bg-muted/5 cursor-pointer transition-colors hover:border-primary/30 {selectedModules[key] ? 'border-primary/40 bg-primary/5' : 'border-border'}">
                <Checkbox checked={selectedModules[key]} onchange={() => toggleModule(key)} class="mt-0.5" />
                <div>
                  <div class="font-extrabold text-sm">{mod.label}</div>
                  <div class="text-[13px] text-muted-foreground mt-0.5">{mod.description}</div>
                  <div class="text-xs text-muted-foreground/70 mt-1">{mod.tables.length} tabla(s)</div>
                </div>
              </label>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {:else if step === 1}
      <Card.Root class="mb-4">
        <Card.Content class="pt-6">
          <h2 class="text-[17px] font-bold mb-1.5">Datos de la escuela y cooperadora</h2>
          <p class="text-[13px] text-muted-foreground mb-4">Estos datos se usan en reportes y en la interfaz. Podés cambiarlos después.</p>

          <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Nombre de la escuela</Label>
              <Input bind:value={schoolData.escuela_nombre} placeholder="Ej: Escuela N° 12" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Número de escuela</Label>
              <Input bind:value={schoolData.escuela_numero} placeholder="Ej: 12" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">CUE</Label>
              <Input bind:value={schoolData.cue} placeholder="Clave Única de Establecimiento" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Nombre de la cooperadora</Label>
              <Input bind:value={schoolData.cooperadora_nombre} placeholder="Ej: Cooperadora Escolar N° 12" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">CUIT cooperadora</Label>
              <Input bind:value={schoolData.cuit} placeholder="30-XXXXXXXX-X" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Domicilio</Label>
              <Input bind:value={schoolData.domicilio} placeholder="Calle N° 123" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Localidad</Label>
              <Input bind:value={schoolData.localidad} placeholder="Ciudad / Partido" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Email</Label>
              <Input bind:value={schoolData.email} placeholder="cooperadora@email.com" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Teléfono</Label>
              <Input bind:value={schoolData.telefono} placeholder="+54 ..." />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Color de marca</Label>
              <Input type="color" bind:value={schoolData.color_primario} />
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {:else if step === 2}
      <Card.Root class="mb-4">
        <Card.Content class="pt-6">
          <h2 class="text-[17px] font-bold mb-1.5">Revisá y instalá</h2>
          <p class="text-[13px] text-muted-foreground mb-4">Se crearán las tablas necesarias y se guardará la configuración.</p>

          <div class="flex flex-col gap-3.5">
            <div class="p-3 rounded-lg border border-border bg-muted/5">
              <div class="font-extrabold text-[13px] mb-1.5">Módulos seleccionados</div>
              <ul class="m-0 pl-4.5 list-disc">
                {#each getSelectedModuleKeys() as key}
                  <li class="text-[13px] my-0.5">{MODULES[key].label}</li>
                {/each}
              </ul>
            </div>
            <div class="p-3 rounded-lg border border-border bg-muted/5">
              <div class="font-extrabold text-[13px] mb-1.5">Tablas a crear</div>
              <div class="text-xl font-black">{getTableCount()} tablas</div>
            </div>
            {#if schoolData.escuela_nombre || schoolData.cooperadora_nombre}
              <div class="p-3 rounded-lg border border-border bg-muted/5">
                <div class="font-extrabold text-[13px] mb-1.5">Escuela</div>
                <div class="text-[13px] text-muted-foreground">
                  {schoolData.escuela_nombre || 'Sin nombre'}
                  {#if schoolData.escuela_numero}· N° {schoolData.escuela_numero}{/if}
                </div>
                <div class="text-[13px] text-muted-foreground">{schoolData.cooperadora_nombre || ''}</div>
              </div>
            {/if}
          </div>

          {#if installing}
            <div class="flex items-center gap-3 mt-4 p-3.5 rounded-xl border border-primary/30 bg-primary/5">
              <div class="size-5 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin shrink-0"></div>
              <p class="text-sm m-0">Instalando tablas y configuración…</p>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    {/if}

    {#if error}
      <Alert variant="destructive" class="mt-3.5">
        <AlertDescription>
          <div class="font-extrabold text-[13px]">Error</div>
          <div class="text-[13px] mt-1 text-muted-foreground">{error}</div>
        </AlertDescription>
      </Alert>
    {/if}

    <div class="flex justify-end gap-2.5">
      {#if step > 0 && !installing}
        <Button variant="outline" onclick={() => step -= 1}>Atrás</Button>
      {/if}
      {#if step < steps.length - 1}
        <Button onclick={() => step += 1} disabled={!canNext()}>Siguiente</Button>
      {:else}
        <Button onclick={doInstall} disabled={installing}>
          {installing ? 'Instalando…' : 'Instalar ahora'}
        </Button>
      {/if}
    </div>
  </main>
{/if}
