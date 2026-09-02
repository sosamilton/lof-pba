<script>
  import { onMount } from 'svelte'
  import { comunidadStore as store } from './comunidadStore.svelte'
  import { keyboard } from '$core/ui/keyboard.svelte'
  import { normalize } from '$core/utils/utils'
  import { daysSince } from '$core/utils/utils'
  import { formatFecha } from '$core/format/format'
  import { TIPOS_SOCIO, MOTIVOS_BAJA, CATEGORIAS_VINCULO } from '$app/modules/comunidad/constants.js'
  import { filterBySearch, sortByFields } from '$lib/hooks/useListFilter.svelte.js'
  import { useDebounce } from '$lib/hooks/useDebounce.svelte.js'
  import { buildPrefill, personaLabel, localidadesItems } from './personas/personasApi.js'
  import { notifyAfter } from '$core/ui/notify.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import * as Select from '$lib/components/ui/select'
  import * as Field from '$lib/components/ui/field'
  import * as Alert from '$lib/components/ui/alert'
  import { Switch } from '$lib/components/ui/switch'
  import Combobox from '$lib/components/Combobox.svelte'
  import ListFormLayout from '$lib/components/ListFormLayout.svelte'
  import PageScaffold from '$lib/components/PageScaffold.svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import LinkIcon from '@lucide/svelte/icons/link'
  import ReceiptIcon from '@lucide/svelte/icons/receipt'
  import FilterBar from './components/FilterBar.svelte'
  import RecordList from './components/RecordList.svelte'
  import PersonaFormFields from './components/PersonaFormFields.svelte'
  import CuilInput from './components/CuilInput.svelte'
  import EmptyStates from './components/EmptyStates.svelte'
  import FiltroResumen from './components/FiltroResumen.svelte'
  import PersonaMovimientos from './personas/components/PersonaMovimientos.svelte'
  import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
  import { buildResumenSegments } from './resumenSegments.js'
  import { resolverRangoPreset } from './bajasStats.js'
  import { createMorosidadStore } from '$app/modules/tesoreria/shared/morosidadStore.svelte.js'
  import { findEjercicioEnCurso } from '$core/utils/utils'
  import { fetchRecords, resolveTableId } from '$core/data/dataRepository'
  import { TABLE_PREFERRED_IDS } from '$core/utils/utils'
  import { navigate } from '$core/ui/router.svelte'

  // Store de morosidad compartido con Inicio (fuente única de verdad)
  const morosidadStore = createMorosidadStore()

  let q = $state('')
  const qd = useDebounce(() => q)
  let vinculoFilter = $state('') // '', 'socios', 'no-socios'
  let estadoFilter = $state('activos') // 'activos', 'bajas', 'todos'
  let tipoSocioFilter = $state('')
  let tipoPersonaFilter = $state('')
  let categoriaFilter = $state('')
  let esIntegral = $state(false)

  // Resumen contextual: preset de período para bajas + segmento activo
  let presetBajas = $state('ultimo-anio')
  let motivoBajaSegmentActivo = $state('')
  let moraSegmentActivo = $state('') // Fase 2: 'al-dia' | 'mora-1-2' | 'mora-3-mas' | 'sin-datos' | ''

  // Estado de mora del socio seleccionado (para mostrar botón "Cargar cuota")
  let socioSeleccionadoMora = $derived.by(() => {
    if (!esIntegral || !store.form?.socio_id) return null
    const mora = morosidadStore.morosidadPorSocio?.get(Number(store.form.socio_id))
    return mora || null
  })

  // Navega a Movimientos con preset de cuota societaria para el socio actual
  const cargarCuotaSocietaria = () => {
    if (!store.form?.socio_id) return
    const cuota = morosidadStore.importeCuota || 0
    const meses = socioSeleccionadoMora?.mesesAdeudados || 0
    // Importe default: total que adeuda (cuota × meses). Si es 'sin-datos'
    // o no hay cuota, mandar solo 1 cuota como fallback.
    const importeDefault = cuota > 0 && meses > 0 ? cuota * meses : cuota
    window.dispatchEvent(
      new CustomEvent('lof:movimiento-preset', {
        detail: {
          tipo_movimiento: 'Entrada',
          detalle: 'Cuota societaria',
          socio_id: store.form.socio_id,
          persona_id: store.form.id,
          rubro_id: morosidadStore.rubroCuotaId || undefined,
          importe: importeDefault > 0 ? String(importeDefault) : undefined,
          importeCuota: cuota > 0 ? String(cuota) : undefined,
        },
      }),
    )
    navigate('movimientos')
  }

  const isJuridica = (p) => p.tipo_persona === 'Juridica'

  let filtered = $derived(
    sortByFields(
      filterBySearch(
        store.records
          .filter((p) => {
            if (vinculoFilter === 'socios' && !p.esSocio) return false
            if (vinculoFilter === 'no-socios' && p.esSocio) return false
            return true
          })
          .filter((p) => {
            if (!p.esSocio) return true
            if (estadoFilter === 'activos') return !p.fecha_baja
            if (estadoFilter === 'bajas') return Boolean(p.fecha_baja)
            return true
          })
          .filter((p) => (tipoSocioFilter ? String(p.tipo_socio || '') === tipoSocioFilter : true))
          .filter((p) => (tipoPersonaFilter ? (p.tipo_persona || 'Fisica') === tipoPersonaFilter : true))
          .filter((p) => (categoriaFilter ? (p.categoria || '') === categoriaFilter : true))
          .filter((p) => {
            // Filtro por motivo de baja (segmento del resumen contextual)
            if (!motivoBajaSegmentActivo) return true
            if (!p.fecha_baja) return false
            return String(p.motivo_baja || 'Sin motivo') === motivoBajaSegmentActivo
          })
          .filter((p) => {
            // Filtro por estado de mora (segmento del resumen contextual, Fase 2)
            if (!moraSegmentActivo) return true
            if (!p.socio_id) return false
            const mora = morosidadStore.morosidadPorSocio?.get(Number(p.socio_id))
            return mora?.estado === moraSegmentActivo
          }),
        qd.value,
        (p) => [p.dni, p.cuil, p.apellido, p.nombre, p.razon_social, p.email, p.telefono, p.localidad],
      ),
      (p) => [normalize(personaLabel(p))],
    ),
  )

  const handleSave = () => notifyAfter(store, store.save)

  onMount(async () => {
    const unsub = store.subscribe()
    store.load()
    try {
      const config = await loadConfig()
      esIntegral = Boolean(config?.modulo_gestion_integral)
      // Preset de período de bajas guardado por la cooperadora (default 'ultimo-anio')
      if (config?.preset_periodo_bajas) presetBajas = config.preset_periodo_bajas
      // Cargar morosidad por socio solo si gestión integral está activo
      if (esIntegral) {
        const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
        if (tEjercicios) {
          const ejercicios = await fetchRecords(tEjercicios)
          const ejercicioEnCurso = findEjercicioEnCurso(ejercicios)
          if (ejercicioEnCurso) await morosidadStore.load(ejercicioEnCurso, config)
        }
      }
    } catch { /* config opcional */ }
    // Ejecutar acción pendiente (ej: atajo custom que navega a Comunidad
    // y pre-carga el form de persona/socio).
    const pending = keyboard.consumePendingAction()
    if (pending) pending.action()
    // Escuchar presets de persona desde acciones custom de atajos.
    // Si el preset trae `id`, selecciona la persona existente (ej: volver
    // desde Movimientos); si no, crea una nueva con el preset.
    const onPreset = (/** @type {CustomEvent} */ e) => {
      const detail = e.detail || {}
      if (detail.id) {
        const persona = store.records.find((p) => Number(p.id) === Number(detail.id))
        if (persona) {
          store.select(persona)
          return
        }
      }
      store.nuevo(detail)
    }
    window.addEventListener('lof:persona-preset', onPreset)
    // Escuchar presets de filtro desde Inicio (MetricCard clickeables).
    const onFiltroPreset = (/** @type {CustomEvent} */ e) => {
      const { vinculo, estado, categoria } = e.detail || {}
      if (vinculo) vinculoFilter = vinculo
      if (estado) estadoFilter = estado
      if (categoria) categoriaFilter = categoria
    }
    window.addEventListener('lof:comunidad-filtro-preset', onFiltroPreset)
    return () => {
      unsub()
      window.removeEventListener('lof:persona-preset', onPreset)
      window.removeEventListener('lof:comunidad-filtro-preset', onFiltroPreset)
    }
  })

  const vinculoFilterConfig = $derived({
    key: 'vinculo',
    value: vinculoFilter,
    allowDeselect: true,
    triggerClass: 'w-[140px]',
    ariaLabel: 'Filtrar por vínculo',
    placeholder: 'Todos',
    options: [
      { value: 'socios', label: 'Solo socios' },
      { value: 'no-socios', label: 'No socios' },
    ],
    onValueChange: (v) => (vinculoFilter = v),
  })

  const estadoSocioFilterConfig = $derived({
    key: 'estado-socio',
    value: estadoFilter,
    allowDeselect: false,
    triggerClass: 'w-[120px]',
    ariaLabel: 'Filtrar por estado de socio',
    placeholder: 'Estado',
    options: [
      { value: 'activos', label: 'Activos' },
      { value: 'bajas', label: 'Bajas' },
      { value: 'todos', label: 'Todos' },
    ],
    onValueChange: (v) => (estadoFilter = v),
  })

  const tipoSocioFilterConfig = $derived({
    key: 'tipo-socio',
    value: tipoSocioFilter,
    allowDeselect: true,
    triggerClass: 'w-[160px]',
    ariaLabel: 'Filtrar por tipo de socio',
    placeholder: 'Todos los tipos',
    options: TIPOS_SOCIO.map((t) => ({ value: t, label: t })),
    onValueChange: (v) => (tipoSocioFilter = v),
  })

  const tipoPersonaFilterConfig = $derived({
    key: 'tipo-persona',
    value: tipoPersonaFilter,
    allowDeselect: true,
    triggerClass: 'w-[140px]',
    ariaLabel: 'Filtrar por tipo de persona',
    placeholder: 'Todos los tipos',
    options: [
      { value: 'Fisica', label: 'Física' },
      { value: 'Juridica', label: 'Jurídica' },
    ],
    onValueChange: (v) => (tipoPersonaFilter = v),
  })

  const categoriaFilterConfig = $derived({
    key: 'categoria',
    value: categoriaFilter,
    allowDeselect: true,
    triggerClass: 'w-[160px]',
    ariaLabel: 'Filtrar por categoría / vínculo',
    placeholder: 'Categoría / vínculo',
    options: CATEGORIAS_VINCULO.map((cat) => ({ value: cat, label: cat })),
    onValueChange: (v) => (categoriaFilter = v),
  })

  // Filtros visibles según contexto
  let activeFilters = $derived(
    vinculoFilter === 'socios'
      ? [vinculoFilterConfig, estadoSocioFilterConfig, tipoSocioFilterConfig, tipoPersonaFilterConfig, categoriaFilterConfig]
      : [vinculoFilterConfig, tipoPersonaFilterConfig, categoriaFilterConfig],
  )

  // Resumen contextual: se recalcula solo cuando cambian los filtros (no q).
  // Depende de store.records (en memoria) y del preset de bajas. Fase 2
  // sumará morosidadPorSocio desde morosidadStore.
  let rangoBajas = $derived(resolverRangoPreset(presetBajas))

  let resumenContextual = $derived(
    buildResumenSegments(
      { vinculoFilter, estadoFilter, categoriaFilter, motivoBajaSegmentActivo, moraSegmentActivo },
      {
        records: store.records,
        rangoBajas,
        presetBajas,
        morosidadPorSocio: morosidadStore.morosidadPorSocio,
      },
    ),
  )

  // Click en un segmento: toggle del filtro activo (click again = deselect)
  const onResumenSegmentClick = (segId) => {
    // Segmentos de bajas: id = `baja-{motivo}`
    if (segId.startsWith('baja-')) {
      const motivo = segId.slice(5)
      motivoBajaSegmentActivo = motivoBajaSegmentActivo === motivo ? '' : motivo
      return
    }
    // Segmentos de mora (Fase 2): id = 'al-dia' | 'mora-1-2' | 'mora-3-mas' | 'sin-datos'
    if (['al-dia', 'mora-1-2', 'mora-3-mas', 'sin-datos'].includes(segId)) {
      moraSegmentActivo = moraSegmentActivo === segId ? '' : segId
      return
    }
    // Segmentos institucionales: no filtran por ahora (futuro)
  }

  const onPeriodoBajasChange = (v) => {
    presetBajas = v
  }
</script>

<PageScaffold title="Comunidad" loading={store.loading} error={store.error} notice={store.notice}>
  <FilterBar
    bind:q
    count={filtered.length}
    countLabel="personas"
    searchPlaceholder="Buscar (nombre, DNI, razón social…)"
    searchAriaLabel="Buscar personas"
    newLabel="Nueva persona"
    onNew={() => store.nuevo(buildPrefill(q))}
    onReload={store.load}
    showReload
    filters={activeFilters}
  >
    {#snippet newIcon()}
      <UserPlusIcon data-icon="inline-start" />
    {/snippet}
  </FilterBar>

  <FiltroResumen
    segments={resumenContextual.segments}
    periodSelector={resumenContextual.periodSelector
      ? { ...resumenContextual.periodSelector, onChange: onPeriodoBajasChange }
      : null}
    loading={store.loading}
    onSegmentClick={onResumenSegmentClick}
  />

  <ListFormLayout
    showForm={Boolean(store.form)}
    hasItems={filtered.length > 0}
    onBack={() => store.cancelar()}
    backLabel="Volver a comunidad"
  >
    {#snippet list()}
      <div class="min-w-0">
        <RecordList
          items={filtered}
          selectedId={store.form?.id}
          onSelect={(p) => store.select(p)}
          itemLabel={(p) => isJuridica(p) ? (p.razon_social || '(sin razón social)') : `${p.apellido}, ${p.nombre}`}
          itemSub={(p) => isJuridica(p) ? `CUIT ${p.cuil || '-'}` : `DNI ${p.dni || '-'} · ${p.localidad || ''}`}
          itemBadges={(p) => {
            const badges = []
            if (p.esSocio) {
              badges.push(p.fecha_baja
                ? { text: 'Socio baja', variant: 'outline' }
                : { text: `Socio ${p.tipo_socio || 'Activo'}`, variant: 'secondary' })
            } else {
              badges.push({ text: 'No socio', variant: 'outline' })
            }
            badges.push(isJuridica(p) ? { text: 'Jurídica', variant: 'outline' } : { text: 'Física', variant: 'outline' })
            return badges
          }}
        />
      </div>
    {/snippet}
    {#snippet detail()}
      {#if store.form}
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">
              {store.form.id ? 'Editar persona' : 'Nueva persona'}
            </Card.Title>
          </Card.Header>
          <Card.Content class="flex flex-col gap-4">
            {#if store.linkedPersona}
              <div class="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                <LinkIcon class="size-3.5 text-primary" />
                <span class="text-sm font-medium">Persona vinculada: {store.linkedPersona.apellido || ''}, {store.linkedPersona.nombre || store.linkedPersona.razon_social || ''}</span>
              </div>
            {/if}

            <!-- Toolbar -->
            <div class="flex flex-wrap justify-end gap-2">
              {#if store.form.id && store.esSocio}
                {#if store.form.fecha_baja}
                  <Button variant="outline" size="sm" onclick={store.reactivar}>Reactivar socio</Button>
                {/if}
                <Button variant="outline" size="sm" onclick={store.toggleBaja}>
                  {store.showBaja ? 'Ocultar baja' : 'Dar de baja'}
                </Button>
              {:else if !store.form.id}
                <Button variant="ghost" size="sm" onclick={store.cancelar}>Cancelar</Button>
              {/if}
            </div>

            {#if esIntegral && socioSeleccionadoMora && socioSeleccionadoMora.estado !== 'al-dia'}
              <div class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <ReceiptIcon class="size-4 text-primary shrink-0" />
                <div class="flex-1 text-sm">
                  {#if socioSeleccionadoMora.estado === 'sin-datos'}
                    Sin pagos registrados de cuota social.
                  {:else if socioSeleccionadoMora.estado === 'mora-1-2'}
                    Adeuda {socioSeleccionadoMora.mesesAdeudados} {socioSeleccionadoMora.mesesAdeudados === 1 ? 'mes' : 'meses'} de cuota social.
                  {:else}
                    Adeuda {socioSeleccionadoMora.mesesAdeudados}+ meses de cuota social.
                  {/if}
                </div>
                <Button variant="default" size="sm" onclick={cargarCuotaSocietaria}>
                  <ReceiptIcon data-icon="inline-start" />
                  Agregar pago
                </Button>
              </div>
            {/if}

            <Separator />

            <!-- Form persona -->
            <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
              <Field.Field class="sm:col-span-2">
                <Field.FieldLabel for="tipo_persona">Tipo de persona</Field.FieldLabel>
                <Select.Root type="single" bind:value={store.form.tipo_persona}>
                  <Select.Trigger id="tipo_persona" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="Fisica">Física</Select.Item>
                    <Select.Item value="Juridica">Jurídica</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field.Field>

              <Field.Field class="sm:col-span-2">
                <Field.FieldLabel for="categoria">Categoría / vínculo</Field.FieldLabel>
                <Select.Root type="single" bind:value={store.form.categoria} allowDeselect={true}>
                  <Select.Trigger id="categoria" class="mt-1 w-full">
                    <Select.Value placeholder="Elegir…" />
                  </Select.Trigger>
                  <Select.Content>
                    {#each CATEGORIAS_VINCULO as cat}
                      <Select.Item value={cat}>{cat}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </Field.Field>

              {#if store.form.tipo_persona === 'Juridica'}
                <Field.Field class="sm:col-span-2">
                  <Field.FieldLabel for="razon_social">Razón social</Field.FieldLabel>
                  <Input id="razon_social" bind:value={store.form.razon_social} />
                </Field.Field>
                <CuilInput bind:value={store.form.cuil} cuilWarning={store.cuilWarning} isJuridica={true} label="CUIT" onCuilInput={store.onCuilInput} />
                <Field.Field>
                  <Field.FieldLabel for="domicilio">Domicilio</Field.FieldLabel>
                  <Input id="domicilio" bind:value={store.form.domicilio} />
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="localidad">Localidad</Field.FieldLabel>
                  <Combobox
                    bind:value={store.form.localidad}
                    items={localidadesItems.current}
                    placeholder="Elegir localidad…"
                    searchPlaceholder="Buscar localidad de PBA…"
                  />
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.telefonoWarning)}>
                  <Field.FieldLabel for="telefono">Teléfono</Field.FieldLabel>
                  <Input id="telefono" bind:value={store.form.telefono} oninput={store.onTelefonoInput} aria-invalid={Boolean(store.telefonoWarning)} placeholder="9 11 1234-5678" inputmode="tel" />
                  {#if store.telefonoWarning}<Field.FieldError>{store.telefonoWarning}</Field.FieldError>{/if}
                </Field.Field>
                <Field.Field data-invalid={Boolean(store.emailWarning)}>
                  <Field.FieldLabel for="email">Email</Field.FieldLabel>
                  <Input id="email" type="email" bind:value={store.form.email} oninput={store.onEmailInput} aria-invalid={Boolean(store.emailWarning)} placeholder="nombre@ejemplo.com" inputmode="email" />
                  {#if store.emailWarning}<Field.FieldError>{store.emailWarning}</Field.FieldError>{/if}
                </Field.Field>
              {:else}
                <PersonaFormFields
                  form={store.form}
                  dniWarning={store.dniWarning}
                  cuilWarning={store.cuilWarning}
                  telefonoWarning={store.telefonoWarning}
                  emailWarning={store.emailWarning}
                  onDniInput={store.onDniInput}
                  onCuilInput={store.onCuilInput}
                  onTelefonoInput={store.onTelefonoInput}
                  onEmailInput={store.onEmailInput}
                  fechaNacimientoWarning={store.edadWarning}
                  onFechaNacimientoInput={store.onFechaNacimientoInput}
                />
              {/if}
            </Field.FieldGroup>

            <!-- Toggle socio -->
            <Separator />
            <div class="flex items-center gap-3">
              <Switch checked={store.esSocio} onCheckedChange={(v) => store.esSocio = v} />
              <span class="text-sm font-medium">Es socio</span>
            </div>

            {#if store.esSocio}
              <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
                <Field.Field>
                  <Field.FieldLabel for="tipo">Tipo de socio</Field.FieldLabel>
                  <Select.Root type="single" bind:value={store.form.tipo_socio}>
                    <Select.Trigger id="tipo" class="mt-1 w-full">
                      <Select.Value placeholder="Elegir…" />
                    </Select.Trigger>
                    <Select.Content>
                      {#each TIPOS_SOCIO as t}
                        <Select.Item value={t}>{t}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </Field.Field>
                <Field.Field>
                  <Field.FieldLabel for="fecha-alta">Fecha alta</Field.FieldLabel>
                  <Input id="fecha-alta" type="date" bind:value={store.form.fecha_alta} />
                </Field.Field>
                {#if store.form.id && store.form.fecha_baja && !store.showBaja}
                  <Field.Field class="sm:col-span-2">
                    <Alert.Root variant="destructive">
                      <Alert.Title>Socio dado de baja</Alert.Title>
                      <Alert.Description>
                        Fecha de baja: {formatFecha(store.form.fecha_baja)}{#if store.form.motivo_baja} · Motivo: {store.form.motivo_baja === 'CambioEscuela' ? 'Cambio de escuela' : store.form.motivo_baja}{/if}
                        <br />
                        <Button variant="outline" size="sm" class="mt-2" onclick={store.toggleBaja}>Editar baja</Button>
                        <Button variant="outline" size="sm" class="mt-2 ml-2" onclick={store.reactivar}>Reactivar socio</Button>
                      </Alert.Description>
                    </Alert.Root>
                  </Field.Field>
                {/if}
              </Field.FieldGroup>

              {#if store.form.id && store.form.tipo_socio === 'Activo' && !store.form.fecha_baja}
                {@const dias = daysSince(store.form.fecha_alta)}
                {#if dias == null || dias < 0}
                  <!-- Fecha de alta inválida o futura: no hay antigüedad calculable, no mostrar nada. -->
                {:else if dias < 30}
                  <Alert.Root>
                    <Alert.Title>Antigüedad insuficiente para votar</Alert.Title>
                    <Alert.Description>
                      Faltan {30 - dias} días para alcanzar los 30 días mínimos.
                    </Alert.Description>
                  </Alert.Root>
                {:else}
                  <Alert.Root>
                    <Alert.Title>Habilitado electoralmente</Alert.Title>
                    <Alert.Description>
                      Socio activo con antigüedad ≥ 30 días.
                    </Alert.Description>
                  </Alert.Root>
                {/if}
              {/if}

              {#if store.form.id && store.showBaja}
                <Alert.Root variant="destructive">
                  <Alert.Title>Dar de baja al socio</Alert.Title>
                  <Alert.Description>
                    Completá los datos de la baja. Al guardar, el socio pasará a estado inactivo.
                  </Alert.Description>
                </Alert.Root>
                <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
                  <Field.Field>
                    <Field.FieldLabel for="fecha-baja">Fecha de baja</Field.FieldLabel>
                    <Input id="fecha-baja" type="date" bind:value={store.form.fecha_baja} />
                  </Field.Field>
                  <Field.Field data-disabled={!store.form.fecha_baja}>
                    <Field.FieldLabel for="motivo-baja">Motivo de baja</Field.FieldLabel>
                    <Select.Root type="single" bind:value={store.form.motivo_baja} allowDeselect={true}>
                      <Select.Trigger id="motivo-baja" class="mt-1 w-full" disabled={!store.form.fecha_baja}>
                        <Select.Value placeholder="Elegir motivo…" />
                      </Select.Trigger>
                      <Select.Content>
                        {#each MOTIVOS_BAJA as m}
                          <Select.Item value={m}>{m === 'CambioEscuela' ? 'Cambio de escuela' : m}</Select.Item>
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </Field.Field>
                </Field.FieldGroup>
              {/if}
            {/if}

            <div class="flex gap-2">
              <Button onclick={handleSave}>Guardar</Button>
            </div>
          </Card.Content>
        </Card.Root>

        {#if esIntegral && store.form.id}
          <PersonaMovimientos personaId={store.form.id} />
        {/if}
      {:else}
        <EmptyStates
          filteredCount={filtered.length}
          hasQuery={Boolean(q.trim())}
          entityLabel="persona"
          entityArticle="una"
          onNew={() => store.nuevo()}
          onNewFromQuery={() => store.nuevo(buildPrefill(q))}
          selectPrompt="Seleccioná una persona o creá una nueva."
        >
          {#snippet actionIcon()}
            <UserPlusIcon data-icon="inline-start" />
          {/snippet}
        </EmptyStates>
      {/if}
    {/snippet}
  </ListFormLayout>

</PageScaffold>
