<script>
  // Campo de información de solo lectura: label + valor.
  // Patrón repetido ×10 en InstitucionalTab.
  let {
    label = '',
    value = '',
    placeholder = '—',
  } = $props()
</script>

<div>
  <div class="text-xs text-muted-foreground">{label}</div>
  <div class="text-sm font-medium">{value || placeholder}</div>
</div>
