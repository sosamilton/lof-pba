<script>
  import { Input } from '$lib/components/ui/input'
  import * as Field from '$lib/components/ui/field'
  import * as Select from '$lib/components/ui/select'
  import {
    parseCuil,
    formatCuil,
    parseDni,
    calcularDigitoVerificador,
  } from '$core/format/format.js'

  let {
    value = $bindable(),
    dni = '',
    cuilWarning = '',
    isJuridica = false,
    label = 'CUIT/CUIL',
    onCuilInput = () => {},
  } = $props()

  const PREFIJOS_FISICA = [
    { value: '00', label: '00 - Pendiente' },
    { value: '20', label: '20 - Varón' },
    { value: '23', label: '23 - Mixto/alternativo' },
    { value: '24', label: '24 - Reasignación' },
    { value: '25', label: '25 - Duplicación' },
    { value: '26', label: '26 - Duplicación' },
    { value: '27', label: '27 - Mujer' },
  ]

  const PREFIJOS_JURIDICA = [
    { value: '30', label: '30 - Empresa estándar' },
    { value: '33', label: '33 - Sociedad/asociación' },
    { value: '34', label: '34 - Entidad especial' },
  ]

  const prefijos = $derived(isJuridica ? PREFIJOS_JURIDICA : PREFIJOS_FISICA)

  let cuilPrefix = $derived.by(() => parseCuil(value).slice(0, 2))
  let cuilMiddle = $derived.by(() => parseCuil(value).slice(2, 10))
  let cuilDv = $derived.by(() => parseCuil(value).slice(10, 11))

  // For físicas: the middle part comes from DNI
  let dniMiddle = $derived.by(() => {
    if (isJuridica) return ''
    const d = parseDni(dni)
    if (!d) return ''
    return d.padStart(8, '0')
  })

  const updateCuil = (prefix, middle, dv) => {
    const p = (prefix || '').slice(0, 2)
    const m = (middle || '').slice(0, 8)
    const d = (dv || '').slice(0, 1)
    value = formatCuil(`${p}${m}${d}`)
    onCuilInput()
  }

  const onPrefixChange = (prefix) => {
    if (!prefix) return
    const middle = isJuridica ? cuilMiddle : dniMiddle
    // Auto-calculate DV
    const base = `${prefix}${middle}`.slice(0, 10)
    const dv = base.length === 10 ? String(calcularDigitoVerificador(base)) : ''
    updateCuil(prefix, middle, dv)
  }

  const onMiddleInput = (e) => {
    // Only for jurídicas
    const raw = e?.target?.value || ''
    const middle = parseDni(raw).slice(0, 8)
    const base = `${cuilPrefix}${middle}`.slice(0, 10)
    const dv = base.length === 10 ? String(calcularDigitoVerificador(base)) : cuilDv
    updateCuil(cuilPrefix, middle, dv)
  }

  const onDvInput = (e) => {
    const raw = String(e?.target?.value || '').replace(/\D/g, '').slice(0, 1)
    const middle = isJuridica ? cuilMiddle : dniMiddle
    updateCuil(cuilPrefix, middle, raw)
  }

  // Auto-fill from DNI when DNI changes (físicas)
  $effect(() => {
    if (isJuridica) return
    const d = parseDni(dni)
    if (!d) return
    const newMiddle = d.padStart(8, '0')
    if (newMiddle !== cuilMiddle && cuilPrefix) {
      const base = `${cuilPrefix}${newMiddle}`.slice(0, 10)
      const dv = base.length === 10 ? String(calcularDigitoVerificador(base)) : ''
      updateCuil(cuilPrefix, newMiddle, dv)
    }
  })
</script>

<Field.Field data-invalid={Boolean(cuilWarning)}>
  <Field.FieldLabel for="cuil">{label}</Field.FieldLabel>
  <div class="flex items-center gap-1.5">
    <Select.Root type="single" value={cuilPrefix} onValueChange={onPrefixChange}>
      <Select.Trigger class="w-[60px] justify-center font-mono text-sm">
        {cuilPrefix || '—'}
      </Select.Trigger>
      <Select.Content>
        {#each prefijos as p}
          <Select.Item value={p.value}>{p.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <span class="text-muted-foreground font-medium">-</span>
    {#if isJuridica}
      <Input
        class="w-32 text-center font-mono"
        value={cuilMiddle}
        oninput={onMiddleInput}
        placeholder="12345678"
        inputmode="numeric"
        maxlength="8"
      />
    {:else}
      <div class="flex h-9 w-32 items-center justify-center rounded-md border border-input bg-muted text-muted-foreground font-mono text-sm">
        {dniMiddle || '—'}
      </div>
    {/if}
    <span class="text-muted-foreground font-medium">-</span>
    <Input
      class="w-12 text-center font-mono"
      value={cuilDv}
      oninput={onDvInput}
      placeholder="?"
      inputmode="numeric"
      maxlength="1"
    />
  </div>
  {#if cuilWarning}<Field.FieldError>{cuilWarning}</Field.FieldError>{/if}
</Field.Field>
