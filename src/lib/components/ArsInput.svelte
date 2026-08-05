<script>
  // Input de importe con formato pesos argentinos.
  // Muestra "$ 1.234,56" al perder el foco y el número raw al editar.
  // El valor bindeado (value) siempre es un string numérico raw ("1234.56").

  let { value = $bindable(''), disabled = false, class: cls = '' } = $props()

  let editing = $state(false)
  let text = $state('')

  // Cuando no está editando, sincronizar text desde value (formateado).
  $effect(() => {
    if (!editing) {
      const n = Number(value || 0)
      text = n > 0
        ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''
    }
  })

  const onFocus = () => {
    editing = true
    text = String(value || '')
  }

  const onBlur = () => {
    editing = false
    // value ya está actualizado desde onInput; el $effect formatea text.
  }

  /**
   * Parsea un string en formato ARS o plano a número.
   * "1.234,56" → 1234.56  (coma decimal, puntos miles)
   * "1234.56"  → 1234.56  (punto decimal)
   * "1234,56"  → 1234.56  (coma decimal)
   * "1.234"    → 1234     (punto de miles, sin decimal)
   */
  const parseARS = (raw) => {
    let s = String(raw || '').replace(/[^\d.,-]/g, '')
    if (!s) return 0
    if (s.includes(',')) {
      // Coma = decimal, puntos = miles
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Sin coma: si hay múltiples puntos, son separadores de miles
      const dots = s.split('.').length - 1
      if (dots > 1) s = s.replace(/\./g, '')
    }
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  const onInput = (e) => {
    text = e.target.value
    const n = parseARS(text)
    value = n > 0 ? String(n) : ''
  }
</script>

<input
  type="text"
  bind:value={text}
  {disabled}
  onfocus={onFocus}
  onblur={onBlur}
  oninput={onInput}
  class={cls}
  placeholder="$ 0,00"
  inputmode="decimal"
/>
