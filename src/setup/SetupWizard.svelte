<script>
  import { onMount } from 'svelte'
  import { gristReady, listTables, resolveTableId, applyUserActions, invalidateTablesCache, fetchRecords, addRecords } from '$core/grist'
  import { ensureSchema, initDemoData, loadSeedCsv } from './initAppCoop'
  import { TABLE_PREFERRED_IDS, MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS } from '$core/utils'
  import { loadConfig, saveConfig, getTablesForModules } from '$core/configuracion'
  import { parseCsv, csvToObjects, normalizeSeedValue } from '$core/csv'
  import {
    formatCue,
    isValidCue,
    cueSedeLabel,
    formatCuil,
    isValidCuil,
    isValidCuilChecksum,
    formatTelefono,
    normalizeTelefonoForStorage,
    isValidTelefono,
    normalizeEmail,
    isValidEmail,
  } from '$core/format'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Separator } from '$lib/components/ui/separator'
  import Combobox from '$lib/components/Combobox.svelte'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import localidadesData from '$core/data/localidades-buenos-aires.json'

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

  // Warnings de validación en vivo (campos formateados)
  let cueWarning = $state('')
  let cuitWarning = $state('')
  let telefonoWarning = $state('')
  let emailWarning = $state('')

  // Ejercicio actual: por defecto marzo → marzo del año siguiente
  const currentYear = new Date().getFullYear()
  let ejercicio = $state({
    mes_inicio: 'Marzo',
    anio_inicio: currentYear,
    anio_fin: currentYear + 1
  })

  // Cargos: se cargan los defaults del seed y el usuario los edita
  let cargos = $state([])
  let cargoUid = 0

  const localidades = localidadesData.map((l) => ({ value: l, label: l }))

  const steps = ['Módulos', 'Escuela y cooperadora', 'Ejercicio y cargos', 'Instalar']

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

  // ---------- Formateo en vivo de campos ----------
  const onCueInput = () => {
    schoolData.cue = formatCue(schoolData.cue)
    const c = schoolData.cue.replace(/\D/g, '')
    if (c && !isValidCue(c)) {
      cueWarning = c.length === 9
        ? 'CUE inválido: debe empezar con 06 (Provincia de Buenos Aires)'
        : `CUE incompleto: ${c.length}/9 dígitos`
    } else if (c && isValidCue(c)) {
      cueWarning = cueSedeLabel(c)
    } else {
      cueWarning = ''
    }
  }

  const onCuitInput = () => {
    schoolData.cuit = formatCuil(schoolData.cuit)
    const c = schoolData.cuit.replace(/\D/g, '')
    if (c && isValidCuil(c) && !isValidCuilChecksum(c)) {
      cuitWarning = 'CUIT inválido (dígito verificador incorrecto)'
    } else {
      cuitWarning = ''
    }
  }

  const onTelefonoInput = () => {
    schoolData.telefono = formatTelefono(schoolData.telefono)
    const stored = normalizeTelefonoForStorage(schoolData.telefono)
    if (stored && !isValidTelefono(stored) && stored.length > 0) {
      telefonoWarning = 'Teléfono incompleto'
    } else {
      telefonoWarning = ''
    }
  }

  const onEmailInput = () => {
    schoolData.email = normalizeEmail(schoolData.email)
    if (schoolData.email && !isValidEmail(schoolData.email)) {
      emailWarning = 'Email inválido'
    } else {
      emailWarning = ''
    }
  }

  // ---------- Cargos ----------
  const loadDefaultCargos = async () => {
    try {
      const csv = await loadSeedCsv('cargos')
      const rows = parseCsv(csv)
      const objs = csvToObjects(rows).map((o) => {
        const out = {}
        for (const [k, v] of Object.entries(o)) {
          const nv = normalizeSeedValue(v)
          if (nv === undefined) continue
          out[k] = nv
        }
        return out
      })
      cargos = objs.map((c) => ({
        _uid: ++cargoUid,
        organismo: c.organismo || 'CD',
        nombre_cargo: c.nombre_cargo || '',
        orden: Number(c.orden) || 0,
        duracion_meses: Number(c.duracion_meses) || 12,
        cargo_obligatorio: Boolean(c.cargo_obligatorio),
        nivel: c.nivel || '',
        activo: c.activo !== false
      }))
    } catch (e) {
      // Si no se puede cargar el seed, usar mínimos obligatorios
      cargos = [
        { _uid: ++cargoUid, organismo: 'CD', nombre_cargo: 'Presidente', orden: 1, duracion_meses: 12, cargo_obligatorio: true, nivel: '', activo: true },
        { _uid: ++cargoUid, organismo: 'CD', nombre_cargo: 'Vicepresidente', orden: 2, duracion_meses: 12, cargo_obligatorio: true, nivel: '', activo: true },
        { _uid: ++cargoUid, organismo: 'CD', nombre_cargo: 'Secretario', orden: 3, duracion_meses: 12, cargo_obligatorio: true, nivel: '', activo: true },
        { _uid: ++cargoUid, organismo: 'CD', nombre_cargo: 'Tesorero', orden: 4, duracion_meses: 12, cargo_obligatorio: true, nivel: '', activo: true },
      ]
    }
  }

  const cargosPorOrganismo = (org) => cargos
    .filter((c) => c.organismo === org)
    .sort((a, b) => a.orden - b.orden)

  const reordenar = (org, index, dir) => {
    const grupo = cargosPorOrganismo(org)
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= grupo.length) return
    const a = grupo[index]
    const b = grupo[newIndex]
    const tmpOrden = a.orden
    a.orden = b.orden
    b.orden = tmpOrden
    cargos = [...cargos]
  }

  const addCargo = (org) => {
    const grupo = cargosPorOrganismo(org)
    const nuevo = {
      _uid: ++cargoUid,
      organismo: org,
      nombre_cargo: '',
      orden: grupo.length + 1,
      duracion_meses: 12,
      cargo_obligatorio: false,
      nivel: 'Titular',
      activo: true
    }
    cargos = [...cargos, nuevo]
  }

  const removeCargo = (uid) => {
    const removed = cargos.find((c) => c._uid === uid)
    if (!removed || removed.cargo_obligatorio) return
    // Reordenar el grupo del eliminado
    const grupo = cargosPorOrganismo(removed.organismo)
    const idx = grupo.findIndex((c) => c._uid === uid)
    grupo.slice(idx + 1).forEach((c) => (c.orden -= 1))
    cargos = cargos.filter((c) => c._uid !== uid)
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
      await loadDefaultCargos()
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
          const cueDigits = schoolData.cue.replace(/\D/g, '')
          const cuitDigits = schoolData.cuit.replace(/\D/g, '')
          const telStored = normalizeTelefonoForStorage(schoolData.telefono)
          await applyUserActions([['AddRecord', tEscuela, null, {
            escuela_nombre: schoolData.escuela_nombre || '',
            escuela_numero: schoolData.escuela_numero || '',
            cue: cueDigits || '',
            cooperadora_nombre: schoolData.cooperadora_nombre || '',
            cuit: cuitDigits || '',
            domicilio: schoolData.domicilio || '',
            localidad: schoolData.localidad || '',
            email_cooperadora: normalizeEmail(schoolData.email) || '',
            telefono_cooperadora: telStored || ''
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
        cue: schoolData.cue.replace(/\D/g, ''),
        cuit: schoolData.cuit.replace(/\D/g, ''),
        telefono: normalizeTelefonoForStorage(schoolData.telefono),
        email: normalizeEmail(schoolData.email),
        instalado: true,
        fecha_instalacion: new Date().toISOString()
      })

      const needsEjercicioCargos = selectedModules.gestion_completa || selectedModules.tesoreria || selectedModules.gobierno

      if (needsEjercicioCargos) {
        // Ejercicio real desde la configuración del usuario
        const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
        if (tEjercicios) {
          let existingEj = []
          try { existingEj = await fetchRecords(tEjercicios) } catch { /* empty */ }
          if (existingEj.length === 0) {
            await applyUserActions([['AddRecord', tEjercicios, null, {
              anio_inicio: Number(ejercicio.anio_inicio) || currentYear,
              anio_fin: Number(ejercicio.anio_fin) || currentYear + 1,
              mes_inicio: ejercicio.mes_inicio || 'Marzo',
              saldo_inicial_banco: 0,
              saldo_inicial_efectivo: 0,
              saldo_inicial_caja_chica: 0,
              en_curso: true,
              observaciones: 'Ejercicio inicial'
            }]])
          }
        }

        // Cargos desde la configuración del usuario (base + nuevos + orden)
        const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
        if (tCargos) {
          let existingCargos = []
          try { existingCargos = await fetchRecords(tCargos) } catch { /* empty */ }
          if (existingCargos.length === 0 && cargos.length > 0) {
            const records = cargos.map((c) => ({
              organismo: c.organismo,
              nombre_cargo: c.nombre_cargo,
              orden: c.orden,
              duracion_meses: Number(c.duracion_meses) || 12,
              cargo_obligatorio: Boolean(c.cargo_obligatorio),
              nivel: c.nivel || null,
              activo: Boolean(c.activo)
            }))
            await addRecords(tCargos, records)
          }
        }

        // Seeds de catálogos (cuentas y rubros PIA)
        await initDemoData([
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 }
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

  const hasFieldErrors = () =>
    (cueWarning && !cueSedeLabel(schoolData.cue)) ||
    cuitWarning ||
    telefonoWarning ||
    emailWarning

  const canNext = () => {
    if (step === 0) return getSelectedModuleKeys().length > 0
    if (step === 1) return !hasFieldErrors()
    if (step === 2) {
      if (!ejercicio.mes_inicio) return false
      if (Number(ejercicio.anio_fin) <= Number(ejercicio.anio_inicio)) return false
      // Validar que los cargos opcionales tengan nombre
      const sinNombre = cargos.some((c) => !c.cargo_obligatorio && !c.nombre_cargo.trim())
      if (sinNombre) return false
      return true
    }
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
      <p class="text-sm text-muted-foreground leading-relaxed">Elegí qué módulos instalar, configurá los datos de tu escuela y cooperadora, el ejercicio en curso y los cargos del estatuto.</p>
    </div>

    <!-- Progress dots -->
    <div class="flex items-center gap-1 mb-5">
      {#each steps as s, i}
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="size-6 rounded-full flex items-center justify-center text-xs font-bold border {step === i ? 'border-primary/50 bg-primary/15' : step > i ? 'border-primary/50 bg-primary/20 text-primary' : 'border-border bg-muted/5'}">{i + 1}</span>
          <span class="text-[13px] font-bold {step === i ? 'opacity-100' : 'opacity-70'} max-[600px]:hidden">{s}</span>
        </div>
        {#if i < steps.length - 1}
          <div class="flex-1 h-0.5 min-w-[12px] {step > i ? 'bg-primary/40' : 'bg-border'}"></div>
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
            <div class="flex flex-col gap-1 sm:col-span-2">
              <Label class="text-xs font-bold text-muted-foreground">CUE (Clave Única de Establecimiento)</Label>
              <Input value={schoolData.cue} oninput={onCueInput} placeholder="06-XXXXX-00 (9 dígitos, empieza con 06)" />
              {#if cueWarning}
                <span class="text-xs {cueSedeLabel(schoolData.cue) ? 'text-muted-foreground' : 'text-destructive'}">{cueWarning}</span>
              {/if}
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Nombre de la cooperadora</Label>
              <Input bind:value={schoolData.cooperadora_nombre} placeholder="Ej: Cooperadora Escolar N° 12" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">CUIT cooperadora</Label>
              <Input value={schoolData.cuit} oninput={onCuitInput} placeholder="30-XXXXXXXX-X" />
              {#if cuitWarning}
                <span class="text-xs text-destructive">{cuitWarning}</span>
              {/if}
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Domicilio</Label>
              <Input bind:value={schoolData.domicilio} placeholder="Calle N° 123" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Localidad</Label>
              <Combobox bind:value={schoolData.localidad} items={localidades} placeholder="Buscar localidad de PBA…" searchPlaceholder="Escribí el nombre…" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Email</Label>
              <Input value={schoolData.email} oninput={onEmailInput} placeholder="cooperadora@email.com" />
              {#if emailWarning}
                <span class="text-xs text-destructive">{emailWarning}</span>
              {/if}
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Teléfono</Label>
              <Input value={schoolData.telefono} oninput={onTelefonoInput} placeholder="+54 11 1234-5678" />
              {#if telefonoWarning}
                <span class="text-xs text-destructive">{telefonoWarning}</span>
              {/if}
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Color de marca</Label>
              <Input type="color" bind:value={schoolData.color_primario} />
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {:else if step === 2}
      <!-- Ejercicio -->
      <Card.Root class="mb-4">
        <Card.Content class="pt-6">
          <h2 class="text-[17px] font-bold mb-1.5">Ejercicio en curso</h2>
          <p class="text-[13px] text-muted-foreground mb-4">Por defecto va de marzo a marzo del año siguiente. Confirmá o ajustá el período.</p>

          <div class="grid gap-3 max-[600px]:grid-cols-1 sm:grid-cols-3">
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Mes de inicio</Label>
              <select bind:value={ejercicio.mes_inicio} class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {#each MESES as mes}
                  <option value={mes}>{mes}</option>
                {/each}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Año de inicio</Label>
              <Input type="number" bind:value={ejercicio.anio_inicio} placeholder="2026" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs font-bold text-muted-foreground">Año de cierre</Label>
              <Input type="number" bind:value={ejercicio.anio_fin} placeholder="2027" />
              {#if Number(ejercicio.anio_fin) <= Number(ejercicio.anio_inicio)}
                <span class="text-xs text-destructive">El año de cierre debe ser mayor al de inicio</span>
              {/if}
            </div>
          </div>
          <div class="mt-3 p-3 rounded-lg border border-border bg-muted/5 text-[13px] text-muted-foreground">
            Ejercicio: <span class="font-bold text-foreground">{ejercicio.mes_inicio} {ejercicio.anio_inicio}</span> → <span class="font-bold text-foreground">{ejercicio.anio_fin}</span>
          </div>
        </Card.Content>
      </Card.Root>

      <Separator class="mb-4" />

      <!-- Cargos -->
      <Card.Root class="mb-4">
        <Card.Content class="pt-6">
          <h2 class="text-[17px] font-bold mb-1.5">Cargos del estatuto</h2>
          <p class="text-[13px] text-muted-foreground mb-4">Los cargos obligatorios no se pueden renombrar, solo ajustar su duración. Los opcionales podés crearlos, renombrarlos, reordenarlos y eliminarlos.</p>

          {#each ORGANISMOS as org}
            {@const grupo = cargosPorOrganismo(org)}
            <div class="mb-5 last:mb-0">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-extrabold">{ORGANISMO_LABELS[org] || org}</h3>
                <Button variant="outline" size="sm" onclick={() => addCargo(org)}>
                  <PlusIcon data-icon="inline-start" />
                  Agregar cargo
                </Button>
              </div>

              {#if grupo.length === 0}
                <p class="text-[13px] text-muted-foreground italic">Sin cargos en este organismo.</p>
              {:else}
                <div class="flex flex-col gap-2">
                  {#each grupo as cargo, i (cargo._uid)}
                    <div class="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/5">
                      <div class="flex flex-col gap-1 flex-1 min-w-[140px]">
                        <Label class="text-[11px] text-muted-foreground">Cargo {!cargo.cargo_obligatorio ? '(opcional)' : ''}</Label>
                        <Input
                          value={cargo.nombre_cargo}
                          disabled={cargo.cargo_obligatorio}
                          oninput={(e) => { cargo.nombre_cargo = e.target.value; cargos = [...cargos] }}
                          placeholder="Nombre del cargo"
                        />
                      </div>
                      <div class="flex flex-col gap-1 w-[110px]">
                        <Label class="text-[11px] text-muted-foreground">Duración (meses)</Label>
                        <Input
                          type="number"
                          value={cargo.duracion_meses}
                          oninput={(e) => { cargo.duracion_meses = Number(e.target.value) || 12; cargos = [...cargos] }}
                        />
                      </div>
                      <div class="flex flex-col gap-1 w-[120px]">
                        <Label class="text-[11px] text-muted-foreground">Nivel</Label>
                        <select
                          value={cargo.nivel}
                          onchange={(e) => { cargo.nivel = e.target.value; cargos = [...cargos] }}
                          class="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">—</option>
                          <option value="Titular">Titular</option>
                          <option value="Suplente">Suplente</option>
                        </select>
                      </div>
                      <div class="flex items-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onclick={() => reordenar(org, i, -1)}>
                          <ChevronUpIcon />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Bajar" disabled={i === grupo.length - 1} onclick={() => reordenar(org, i, 1)}>
                          <ChevronDownIcon />
                        </Button>
                        {#if !cargo.cargo_obligatorio}
                          <Button variant="ghost" size="icon" aria-label="Eliminar" onclick={() => removeCargo(cargo._uid)}>
                            <TrashIcon />
                          </Button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
    {:else if step === 3}
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
            <div class="p-3 rounded-lg border border-border bg-muted/5">
              <div class="font-extrabold text-[13px] mb-1.5">Ejercicio</div>
              <div class="text-[13px] text-muted-foreground">{ejercicio.mes_inicio} {ejercicio.anio_inicio} → {ejercicio.anio_fin}</div>
            </div>
            <div class="p-3 rounded-lg border border-border bg-muted/5">
              <div class="font-extrabold text-[13px] mb-1.5">Cargos</div>
              <div class="text-[13px] text-muted-foreground">{cargos.length} cargo(s) configurado(s)</div>
            </div>
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
