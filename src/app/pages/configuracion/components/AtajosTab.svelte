<script>
  import * as Card from '$lib/components/ui/card'
  import * as Select from '$lib/components/ui/select'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Switch } from '$lib/components/ui/switch'
  import { Label } from '$lib/components/ui/label'
  import { shortcuts, eventToBinding, isReserved, reservedInfo, displayBinding, normalizeBinding } from '$core/ui/shortcuts.svelte'
  import { customActions } from '$core/ui/customActions.svelte'
  import KeyboardIcon from '@lucide/svelte/icons/keyboard'
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import AlertIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckIcon from '@lucide/svelte/icons/check'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TrashIcon from '@lucide/svelte/icons/trash-2'
  import SparklesIcon from '@lucide/svelte/icons/sparkles'

  // --- Estado de captura de teclas (built-in) ---
  let capturingId = $state(null)
  let pendingBinding = $state(null)
  let pendingWarning = $state(/** @type {{ type: 'reserved' | 'conflict', label: string, reason: string } | null} */ (null))

  // --- Estado de captura de teclas (custom) ---
  // 'custom:new' o 'custom:<id>' para distinguir de las built-in.
  let customCapturingId = $state(null)
  let customPendingBinding = $state(null)
  let customPendingWarning = $state(/** @type {{ type: 'reserved' | 'conflict', label: string, reason: string } | null} */ (null))

  // --- Estado del formulario de nueva/editar acción custom ---
  let editingCustom = $state(/** @type {{ id?: string, label: string, keys: string, type: 'movimiento' | 'persona', preset: Record<string, any> } | null} */ (null))

  const groupOrder = ['Navegación', 'Acciones']

  const groups = $derived.by(() => {
    const map = /** @type {Record<string, typeof shortcuts.actions>} */ ({})
    for (const a of shortcuts.actions) {
      ;(map[a.group] ||= []).push(a)
    }
    return map
  })

  // --- Captura built-in ---
  const startCapture = (id) => {
    capturingId = id
    pendingBinding = null
    pendingWarning = null
    shortcuts.capturing = true
  }

  const stopCapture = () => {
    capturingId = null
    pendingBinding = null
    pendingWarning = null
    shortcuts.capturing = false
  }

  const onCaptureKey = (/** @type {KeyboardEvent} */ e) => {
    // Solo procesar teclas cuando estamos en modo captura.
    // Fuera de captura, no interferir con Select, Dialog, etc.
    if (!capturingId && !customCapturingId) return

    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      if (capturingId) stopCapture()
      if (customCapturingId) stopCustomCapture()
      return
    }

    if (capturingId) {
      handleBuiltInCapture(e)
      return
    }

    if (customCapturingId) {
      handleCustomCapture(e)
      return
    }
  }

  const handleBuiltInCapture = (e) => {
    const binding = eventToBinding(e)
    if (!binding) return
    pendingBinding = null
    pendingWarning = null

    if (isReserved(binding)) {
      const info = reservedInfo(binding)
      pendingBinding = binding
      pendingWarning = {
        type: 'reserved',
        label: info?.label || 'Reservado',
        reason: info?.reason || 'Esta combinación está reservada por el navegador o el sistema operativo.',
      }
      return
    }

    // Conflictos: built-in + custom
    const conflictId = shortcuts.conflictExcept(capturingId, binding)
    if (conflictId) {
      const other = shortcuts.getAction(conflictId)
      pendingBinding = binding
      pendingWarning = {
        type: 'conflict',
        label: other?.label || 'otra acción',
        reason: `Esta combinación ya la usa "${other?.label}". Si la asignás acá, la otra acción se queda sin atajo (podés reasignarla después).`,
      }
      return
    }
    if (customActions.hasKeys(binding)) {
      pendingBinding = binding
      pendingWarning = {
        type: 'conflict',
        label: 'acción personalizada',
        reason: 'Esta combinación la usa una acción personalizada. Si la asignás acá, la acción personalizada se queda sin atajo.',
      }
      return
    }

    shortcuts.setBinding(capturingId, binding)
    stopCapture()
  }

  const confirmAssign = () => {
    if (capturingId && pendingBinding) shortcuts.setBinding(capturingId, pendingBinding)
    stopCapture()
  }

  const dismissWarning = () => {
    pendingBinding = null
    pendingWarning = null
  }

  const resetOne = (id) => {
    shortcuts.reset(id)
    if (capturingId === id) stopCapture()
  }

  const resetAll = () => {
    shortcuts.resetAll()
    stopCapture()
  }

  // --- Captura custom ---
  const startCustomCapture = (id) => {
    customCapturingId = id
    customPendingBinding = null
    customPendingWarning = null
    shortcuts.capturing = true
  }

  const stopCustomCapture = () => {
    customCapturingId = null
    customPendingBinding = null
    customPendingWarning = null
    shortcuts.capturing = false
  }

  const handleCustomCapture = (e) => {
    const binding = eventToBinding(e)
    if (!binding) return
    customPendingBinding = null
    customPendingWarning = null

    if (isReserved(binding)) {
      const info = reservedInfo(binding)
      customPendingBinding = binding
      customPendingWarning = {
        type: 'reserved',
        label: info?.label || 'Reservado',
        reason: info?.reason || 'Esta combinación está reservada por el navegador o el sistema operativo.',
      }
      return
    }

    // Conflictos: built-in + otras custom (excepto la que se edita)
    const excludeId = customCapturingId === 'custom:new' ? null : customCapturingId
    const conflictId = shortcuts.conflictExcept(null, binding)
    if (conflictId) {
      const other = shortcuts.getAction(conflictId)
      customPendingBinding = binding
      customPendingWarning = {
        type: 'conflict',
        label: other?.label || 'atajo built-in',
        reason: `Esta combinación ya la usa "${other?.label}" (atajo del sistema). Elegí otra.`,
      }
      return
    }
    // Conflictos con otras custom
    for (const a of customActions.actions) {
      if (a.id === excludeId) continue
      if (normalizeBinding(a.keys) === normalizeBinding(binding)) {
        customPendingBinding = binding
        customPendingWarning = {
          type: 'conflict',
          label: a.label,
          reason: `Esta combinación ya la usa tu acción personalizada "${a.label}". Elegí otra.`,
        }
        return
      }
    }

    // Sin conflictos: asignar al form temporal
    if (editingCustom) {
      editingCustom.keys = binding
    }
    stopCustomCapture()
  }

  const confirmCustomAssign = () => {
    if (customPendingBinding && editingCustom) {
      editingCustom.keys = customPendingBinding
    }
    stopCustomCapture()
  }

  const dismissCustomWarning = () => {
    customPendingBinding = null
    customPendingWarning = null
  }

  // --- CRUD acciones custom ---
  // Normaliza el preset para que todos los campos bindables tengan un valor
  // válido (no undefined), evitando errores de Svelte 5 con bind:checked/value.
  const normalizePreset = (preset = {}) => ({
    esSocio: Boolean(preset.esSocio),
    tipo_socio: preset.tipo_socio || '',
    tipo_movimiento: preset.tipo_movimiento || '',
    detalle: preset.detalle || '',
    importe: preset.importe || '',
    localidad: preset.localidad || '',
    domicilio: preset.domicilio || '',
    telefono: preset.telefono || '',
    email: preset.email || '',
  })

  const startNewCustom = () => {
    editingCustom = { label: '', keys: '', type: 'movimiento', preset: normalizePreset() }
  }

  const startEditCustom = (action) => {
    editingCustom = { id: action.id, label: action.label, keys: action.keys, type: action.type, preset: normalizePreset(action.preset) }
  }

  const cancelCustomEdit = () => {
    editingCustom = null
    stopCustomCapture()
  }

  const saveCustom = () => {
    if (!editingCustom) return
    if (!editingCustom.label.trim()) return
    if (!editingCustom.keys) return

    if (editingCustom.id) {
      customActions.update(editingCustom.id, {
        label: editingCustom.label.trim(),
        keys: editingCustom.keys,
        type: editingCustom.type,
        preset: editingCustom.preset,
      })
    } else {
      customActions.create({
        label: editingCustom.label.trim(),
        keys: editingCustom.keys,
        type: editingCustom.type,
        preset: editingCustom.preset,
      })
    }
    editingCustom = null
  }

  const deleteCustom = (id) => {
    customActions.remove(id)
  }

  // Helpers para el form de preset
  const TIPOS_MOVIMIENTO = ['Entrada', 'Salida']
  const TIPOS_SOCIO = ['Activo', 'Honorario', 'Adherente']

  const presetTipoMovimiento = $derived(editingCustom?.type === 'movimiento')
  const canSaveCustom = $derived(!!editingCustom?.label.trim() && !!editingCustom?.keys)
</script>

<svelte:window onkeydown={onCaptureKey} />

<div class="flex flex-col gap-4">
  <!-- Atajos built-in -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <KeyboardIcon class="size-5" />
        Atajos de teclado
      </Card.Title>
      <Card.Description>
        Personalizá las combinaciones de teclas para navegar y ejecutar acciones.
        Si asignás una combinación que usa el navegador (Ctrl+C, Ctrl+S, etc.)
        o que ya usa otra acción, te avisamos — pero podés confirmar y pisarla
        igual. Siempre podés volver al valor por defecto.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-6 pt-2">
      {#each groupOrder as groupName (groupName)}
        {#if groups[groupName]}
          <section class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold text-muted-foreground">{groupName}</h3>
            <ul class="flex flex-col gap-1">
              {#each groups[groupName] as action (action.id)}
                {@const isCapturing = capturingId === action.id}
                {@const isModified = shortcuts.isModified(action.id)}
                <li class="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <span class="flex-1 text-sm">{action.label}</span>

                  {#if isCapturing}
                    <span class="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <span class="inline-block size-1.5 animate-pulse rounded-full bg-primary"></span>
                      Pulsá una tecla…
                    </span>
                    <Button size="sm" variant="ghost" onclick={stopCapture}>Cancelar</Button>
                  {:else}
                    <kbd class="rounded border border-input bg-muted px-2 py-0.5 text-xs font-mono min-w-[3rem] text-center">
                      {displayBinding(shortcuts.keysFor(action.id))}
                    </kbd>
                    <Button size="sm" variant="outline" onclick={() => startCapture(action.id)}>
                      <PencilIcon class="size-3.5" />
                      Reasignar
                    </Button>
                    {#if isModified}
                      <Button size="sm" variant="ghost" onclick={() => resetOne(action.id)} title="Restablecer valor por defecto">
                        <RotateCcwIcon class="size-3.5" />
                      </Button>
                    {/if}
                  {/if}
                </li>

                {#if isCapturing && pendingWarning}
                  <li class="flex flex-col gap-2 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-950/30">
                    <div class="flex items-start gap-2">
                      <AlertIcon class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div class="flex-1">
                        <p class="font-semibold text-amber-800 dark:text-amber-300">
                          {pendingBinding} {pendingWarning.type === 'reserved' ? `→ ${pendingWarning.label}` : `→ en uso por "${pendingWarning.label}"`}
                        </p>
                        <p class="mt-0.5 text-amber-700 dark:text-amber-400/90">{pendingWarning.reason}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 self-end">
                      <Button size="sm" variant="ghost" onclick={dismissWarning}>Elegir otra</Button>
                      <Button size="sm" variant="destructive" onclick={confirmAssign}>
                        <CheckIcon class="size-3.5" />
                        Asignar igual
                      </Button>
                    </div>
                  </li>
                {/if}
              {/each}
            </ul>
          </section>
        {/if}
      {/each}
    </Card.Content>
    <Card.Footer class="justify-between">
      <p class="text-xs text-muted-foreground">
        Los cambios se guardan en este dispositivo. Presioná <kbd class="rounded border border-input bg-muted px-1 py-0.5 text-[10px] font-mono">{displayBinding(shortcuts.keysFor('action.help'))}</kbd> para ver la ayuda.
      </p>
      <Button size="sm" variant="outline" onclick={resetAll}>
        <RotateCcwIcon class="size-3.5" />
        Restablecer todo
      </Button>
    </Card.Footer>
  </Card.Root>

  <!-- Acciones personalizadas -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <SparklesIcon class="size-5" />
        Acciones personalizadas
      </Card.Title>
      <Card.Description>
        Creá atajos que pre-cargan un formulario con valores fijos. Por ejemplo:
        "Cargar cuota" abre el form de movimiento con el rubro y detalle ya cargados,
        o "Nuevo socio de [localidad]" abre el form de socio con la localidad lista.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4 pt-2">
      {#if customActions.actions.length === 0 && !editingCustom}
        <p class="text-sm text-muted-foreground py-4 text-center">
          Todavía no creaste acciones personalizadas.
        </p>
      {/if}

      {#each customActions.actions as action (action.id)}
        <li class="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <span class="flex-1 text-sm">{action.label}</span>
          <span class="text-xs text-muted-foreground">{action.type === 'movimiento' ? 'Movimiento' : 'Persona'}</span>
          <kbd class="rounded border border-input bg-muted px-2 py-0.5 text-xs font-mono min-w-[3rem] text-center">
            {displayBinding(action.keys)}
          </kbd>
          <Button size="sm" variant="ghost" onclick={() => startEditCustom(action)} title="Editar">
            <PencilIcon class="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onclick={() => deleteCustom(action.id)} title="Eliminar">
            <TrashIcon class="size-3.5" />
          </Button>
        </li>
      {/each}

      {#if editingCustom}
        <div class="rounded-md border-2 border-primary/30 bg-muted/30 p-4 flex flex-col gap-3">
          <h4 class="text-sm font-semibold">
            {editingCustom.id ? 'Editar acción' : 'Nueva acción personalizada'}
          </h4>

          <!-- Label -->
          <div class="flex flex-col gap-1">
            <Label for="custom-label" class="text-xs">Nombre</Label>
            <Input id="custom-label" bind:value={editingCustom.label} placeholder="Ej: Cargar cuota, Nuevo socio, etc." />
          </div>

          <!-- Tecla -->
          <div class="flex flex-col gap-1">
            <Label class="text-xs">Combinación de teclas</Label>
            <div class="flex items-center gap-2">
              {#if customCapturingId === 'custom:new' || (customCapturingId && customCapturingId === editingCustom.id)}
                <span class="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <span class="inline-block size-1.5 animate-pulse rounded-full bg-primary"></span>
                  Pulsá una tecla…
                </span>
                <Button size="sm" variant="ghost" onclick={stopCustomCapture}>Cancelar</Button>
              {:else}
                <kbd class="rounded border border-input bg-muted px-2 py-0.5 text-xs font-mono min-w-[3rem] text-center">
                  {editingCustom.keys ? displayBinding(editingCustom.keys) : '—'}
                </kbd>
                <Button size="sm" variant="outline" onclick={() => startCustomCapture(editingCustom.id || 'custom:new')}>
                  <KeyboardIcon class="size-3.5" />
                  Asignar tecla
                </Button>
              {/if}
            </div>
            {#if customCapturingId && customPendingWarning}
              <div class="flex flex-col gap-2 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-950/30 mt-1">
                <div class="flex items-start gap-2">
                  <AlertIcon class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div class="flex-1">
                    <p class="font-semibold text-amber-800 dark:text-amber-300">
                      {customPendingBinding} {customPendingWarning.type === 'reserved' ? `→ ${customPendingWarning.label}` : `→ en uso por "${customPendingWarning.label}"`}
                    </p>
                    <p class="mt-0.5 text-amber-700 dark:text-amber-400/90">{customPendingWarning.reason}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 self-end">
                  <Button size="sm" variant="ghost" onclick={dismissCustomWarning}>Elegir otra</Button>
                  <Button size="sm" variant="destructive" onclick={confirmCustomAssign}>
                    <CheckIcon class="size-3.5" />
                    Asignar igual
                  </Button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Tipo -->
          <div class="flex flex-col gap-1">
            <Label class="text-xs">Tipo de acción</Label>
            <Select.Root type="single" bind:value={editingCustom.type}>
              <Select.Trigger class="h-9">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="movimiento">Movimiento (tesorería)</Select.Item>
                <Select.Item value="persona">Persona / Socio (comunidad)</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          <!-- Preset: movimiento -->
          {#if presetTipoMovimiento}
            <div class="flex flex-col gap-2 rounded-md border border-border p-3 bg-background">
              <p class="text-xs font-semibold text-muted-foreground">Pre-cargar en el formulario:</p>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex flex-col gap-1">
                  <Label class="text-xs">Tipo de movimiento</Label>
                  <Select.Root
                    type="single"
                    bind:value={editingCustom.preset.tipo_movimiento}
                    allowDeselect={true}
                  >
                    <Select.Trigger class="h-9">
                      <Select.Value placeholder="Sin pre-cargar" />
                    </Select.Trigger>
                    <Select.Content>
                      {#each TIPOS_MOVIMIENTO as t (t)}
                        <Select.Item value={t}>{t}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div class="flex flex-col gap-1">
                  <Label for="preset-detalle" class="text-xs">Detalle</Label>
                  <Input id="preset-detalle" bind:value={editingCustom.preset.detalle} placeholder="Ej: Cuota societaria" />
                </div>
                <div class="flex flex-col gap-1">
                  <Label for="preset-importe" class="text-xs">Importe</Label>
                  <Input id="preset-importe" bind:value={editingCustom.preset.importe} placeholder="Ej: 5000" />
                </div>
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Rubro, subrubro y cuenta se eligen al usar el atajo (dependen del ejercicio activo).
              </p>
            </div>
          {:else}
            <!-- Preset: persona -->
            <div class="flex flex-col gap-2 rounded-md border border-border p-3 bg-background">
              <p class="text-xs font-semibold text-muted-foreground">Pre-cargar en el formulario:</p>
              <div class="flex items-center gap-2">
                <Switch id="preset-socio" bind:checked={editingCustom.preset.esSocio} />
                <Label for="preset-socio" class="text-xs">Crear como socio</Label>
              </div>
              {#if editingCustom.preset.esSocio}
                <div class="flex flex-col gap-1">
                  <Label class="text-xs">Tipo de socio</Label>
                  <Select.Root type="single" bind:value={editingCustom.preset.tipo_socio}>
                    <Select.Trigger class="h-9">
                      <Select.Value placeholder="Activo" />
                    </Select.Trigger>
                    <Select.Content>
                      {#each TIPOS_SOCIO as t (t)}
                        <Select.Item value={t}>{t}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              {/if}
              <div class="grid grid-cols-2 gap-2">
                <div class="flex flex-col gap-1">
                  <Label for="preset-localidad" class="text-xs">Localidad</Label>
                  <Input id="preset-localidad" bind:value={editingCustom.preset.localidad} placeholder="Ej: La Plata" />
                </div>
                <div class="flex flex-col gap-1">
                  <Label for="preset-domicilio" class="text-xs">Domicilio</Label>
                  <Input id="preset-domicilio" bind:value={editingCustom.preset.domicilio} placeholder="Ej: Calle 123" />
                </div>
                <div class="flex flex-col gap-1">
                  <Label for="preset-telefono" class="text-xs">Teléfono</Label>
                  <Input id="preset-telefono" bind:value={editingCustom.preset.telefono} placeholder="Ej: 221 1234567" />
                </div>
                <div class="flex flex-col gap-1">
                  <Label for="preset-email" class="text-xs">Email</Label>
                  <Input id="preset-email" bind:value={editingCustom.preset.email} placeholder="Ej: correo@ejemplo.com" />
                </div>
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Apellido, nombre y DNI no se pre-cargan (cambian en cada alta).
              </p>
            </div>
          {/if}

          <!-- Botones -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onclick={cancelCustomEdit}>Cancelar</Button>
            <Button size="sm" onclick={saveCustom} disabled={!canSaveCustom}>
              <CheckIcon class="size-3.5" />
              {editingCustom.id ? 'Guardar' : 'Crear acción'}
            </Button>
          </div>
        </div>
      {:else}
        <Button variant="outline" onclick={startNewCustom} class="self-start">
          <PlusIcon class="size-4" />
          Nueva acción personalizada
        </Button>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
