<script>
  import * as Card from '$lib/components/ui/card'
  import * as Select from '$lib/components/ui/select'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Field from '$lib/components/ui/field'
  import { normalize } from '$core/utils/utils'
  import { loadConfig, saveConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
  import SettingsIcon from '@lucide/svelte/icons/settings-2'
  import SaveIcon from '@lucide/svelte/icons/save'
  import ResetIcon from '@lucide/svelte/icons/rotate-ccw'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'

  let {
    rubros = [],
    cuentas = [],
    defaultsMovimiento = null,
    sessionOverride = null,
    onSessionOverride = () => {},
    onResetOverride = () => {},
  } = $props()

  let collapsed = $state(true)
  let saving = $state(false)

  // Valores actuales: override de sesión → defaults persistidos → vacíos.
  // Los IDs se normalizan a String para que coincidan con los values de las
  // options del Select (que usan String(r.id)). Si no coinciden, el Select
  // muestra el ID crudo en lugar del label.
  let current = $derived({
    tipo: sessionOverride?.tipo || defaultsMovimiento?.tipo || 'Entrada',
    rubro_id: String(sessionOverride?.rubro_id || defaultsMovimiento?.rubro_id || ''),
    cuenta_id: String(sessionOverride?.cuenta_id || defaultsMovimiento?.cuenta_id || ''),
    detalle: sessionOverride?.detalle || defaultsMovimiento?.detalle || '',
  })

  let rubrosOptions = $derived(
    rubros
      .slice()
      .sort((a, b) => normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial)))
      .map((r) => ({ value: String(r.id), label: r.nombre_oficial || '(sin nombre)' }))
  )

  let cuentasOptions = $derived(
    cuentas
      .slice()
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
      .map((c) => ({ value: String(c.id), label: c.nombre_cuenta || '(sin nombre)' }))
  )

  function updateField(field, value) {
    onSessionOverride({ ...current, [field]: value })
  }

  async function saveAsDefault() {
    saving = true
    try {
      const config = await loadConfig()
      await saveConfig({
        ...config,
        defaults_movimiento: {
          tipo: current.tipo,
          rubro_id: current.rubro_id || null,
          cuenta_id: current.cuenta_id || null,
          detalle: current.detalle || null,
        },
      })
    } finally {
      saving = false
    }
  }

  function reset() {
    onResetOverride()
  }
</script>

<Card.Root class="mb-4">
  <Card.Content class="pt-5">
    <button
      type="button"
      class="flex w-full items-center justify-between text-left"
      onclick={() => (collapsed = !collapsed)}
    >
      <div class="flex items-center gap-2">
        <SettingsIcon class="size-4 text-muted-foreground" />
        <span class="text-sm font-bold">Configuración rápida de carga</span>
      </div>
      <ChevronDownIcon class="size-4 text-muted-foreground transition-transform {collapsed ? '' : 'rotate-180'}" />
    </button>

    {#if !collapsed}
      <div class="mt-4 flex flex-col gap-3">
        <p class="text-xs text-muted-foreground">
          Pre-cargá los valores que se aplican a cada nuevo movimiento.
          Cambiá en caliente durante la sesión, o guardá como default persistente.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field.Field>
            <Field.FieldLabel for="cr-tipo" class="text-xs">Tipo</Field.FieldLabel>
            <Select.Root type="single" value={current.tipo} onValueChange={(v) => updateField('tipo', v || 'Entrada')}>
              <Select.Trigger id="cr-tipo" class="h-9">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="Entrada">Entrada</Select.Item>
                <Select.Item value="Salida">Salida</Select.Item>
                <Select.Item value="Traspaso">Traspaso</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <Field.Field>
            <Field.FieldLabel for="cr-rubro" class="text-xs">Rubro</Field.FieldLabel>
            <Select.Root type="single" value={current.rubro_id} onValueChange={(v) => updateField('rubro_id', v || '')} allowDeselect={true}>
              <Select.Trigger id="cr-rubro" class="h-9">
                <Select.Value placeholder="Sin rubro" />
              </Select.Trigger>
              <Select.Content>
                {#each rubrosOptions as opt}
                  <Select.Item value={opt.value}>{opt.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <Field.Field>
            <Field.FieldLabel for="cr-cuenta" class="text-xs">Cuenta</Field.FieldLabel>
            <Select.Root type="single" value={current.cuenta_id} onValueChange={(v) => updateField('cuenta_id', v || '')} allowDeselect={true}>
              <Select.Trigger id="cr-cuenta" class="h-9">
                <Select.Value placeholder="Sin cuenta" />
              </Select.Trigger>
              <Select.Content>
                {#each cuentasOptions as opt}
                  <Select.Item value={opt.value}>{opt.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <Field.Field>
            <Field.FieldLabel for="cr-detalle" class="text-xs">Detalle</Field.FieldLabel>
            <Input
              id="cr-detalle"
              value={current.detalle}
              oninput={(e) => updateField('detalle', e.currentTarget.value)}
              placeholder="Ej: Cuota societaria"
              class="h-9"
            />
          </Field.Field>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" onclick={saveAsDefault} disabled={saving}>
            <SaveIcon data-icon="inline-start" />
            Guardar como default
          </Button>
          <Button variant="ghost" size="sm" onclick={reset}>
            <ResetIcon data-icon="inline-start" />
            Resetear
          </Button>
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
