<script>
  import * as Alert from '$lib/components/ui/alert'
  import { Button } from '$lib/components/ui/button'
  import { navigate } from '$core/ui/router.svelte'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'

  let { data } = $props()

  // --- Validaciones de datos obligatorios para el PIA/Nómina ---
  const alertas = $derived.by(() => {
    if (!data) return []
    const out = []

    // 1. Sin asesor designado
    if (!data.asesor?.apellido_nombre) {
      out.push({
        nivel: 'error',
        titulo: 'Sin asesor designado',
        desc: 'No hay un asesor activo para este ejercicio. El asesor es una función institucional derivada de la Dirección del establecimiento (Decreto 4767/72 art. 18).',
        accion: 'Cargar asesor',
        ruta: 'cooperadora',
      })
    }

    // 2. Sin autoridades de Comisión Directiva
    if (!data.autoridadesCD || data.autoridadesCD.length === 0) {
      out.push({
        nivel: 'error',
        titulo: 'Sin Comisión Directiva designada',
        desc: 'No hay autoridades de Comisión Directiva cargadas para este ejercicio. La nómina de cargos es obligatoria para el PIA y la Nómina.',
        accion: 'Cargar autoridades',
        ruta: 'gobierno',
      })
    }

    // 3. Sin autoridades del CRC
    if (!data.autoridadesCRC || data.autoridadesCRC.length === 0) {
      out.push({
        nivel: 'error',
        titulo: 'Sin Comisión Revisora de Cuentas (CRC)',
        desc: 'No hay autoridades del CRC designadas para este ejercicio. El CRC tiene 3 roles: Titular Docente, Titular y Suplente.',
        accion: 'Cargar autoridades',
        ruta: 'gobierno',
      })
    }

    // 4. Sin asamblea AGO
    if (!data.asamblea) {
      out.push({
        nivel: 'error',
        titulo: 'Sin asamblea AGO',
        desc: 'No se encontró una asamblea AGO para este ejercicio. Los datos del acta, fecha y resoluciones quedarán vacíos en el PIA.',
        accion: 'Cargar asamblea',
        ruta: 'gobierno',
      })
    }

    // 5. Sin movimientos / sin totales
    if (!data.totalEntradas && !data.totalSalidas) {
      out.push({
        nivel: 'error',
        titulo: 'Sin movimientos cargados',
        desc: 'No hay movimientos (entradas ni salidas) para este ejercicio. El cuadro de Recursos y Gastos del PIA quedará vacío.',
        accion: 'Cargar movimientos',
        ruta: 'movimientos',
      })
    } else if (!data.totalEntradas) {
      out.push({
        nivel: 'warning',
        titulo: 'Sin entradas registradas',
        desc: 'No hay movimientos de entrada para este ejercicio. El cuadro de Recursos del PIA quedará vacío.',
        accion: 'Cargar movimientos',
        ruta: 'movimientos',
      })
    } else if (!data.totalSalidas) {
      out.push({
        nivel: 'warning',
        titulo: 'Sin salidas registradas',
        desc: 'No hay movimientos de salida para este ejercicio. El cuadro de Gastos del PIA quedará vacío.',
        accion: 'Cargar movimientos',
        ruta: 'movimientos',
      })
    }

    // 6. Sin socios
    if (!data.totalSocios) {
      out.push({
        nivel: 'warning',
        titulo: 'Sin socios cargados',
        desc: 'No hay socios activos para este ejercicio. Los totales de socios en el PIA quedarán en cero.',
        accion: 'Cargar socios',
        ruta: 'socios',
      })
    }

    // 7. Sin datos bancarios
    if (!data.banco?.nombre_banco) {
      out.push({
        nivel: 'warning',
        titulo: 'Sin datos bancarios',
        desc: 'No se cargaron los datos del banco (nombre, sucursal, cuenta, CBU). Estos datos aparecen en el PIA.',
        accion: 'Cargar datos bancarios',
        ruta: 'cooperadora',
      })
    }

    // 8. Sin federación (Titular + Suplente)
    if (!data.autoridadesFed || data.autoridadesFed.length === 0) {
      out.push({
        nivel: 'warning',
        titulo: 'Sin representantes ante la Federación',
        desc: 'No hay Titular ni Suplente ante la Federación designados. Estos campos quedarán vacíos en el PIA.',
        accion: 'Cargar representantes',
        ruta: 'gobierno',
      })
    }

    return out
  })

  const hayAlertas = $derived(alertas.length > 0)
  const hayErrores = $derived(alertas.some((a) => a.nivel === 'error'))
</script>

{#if hayAlertas}
  <div class="flex flex-col gap-2">
    {#if hayErrores}
      <Alert.Root variant="destructive">
        <AlertTriangleIcon data-icon="inline-start" />
        <Alert.Title>Faltan datos obligatorios</Alert.Title>
        <Alert.Description>
          Hay {alertas.filter((a) => a.nivel === 'error').length} dato(s) obligatorio(s) faltante(s)
          y {alertas.filter((a) => a.nivel === 'warning').length} advertencia(s).
          Generá el PIA igual, pero los campos correspondientes quedarán vacíos.
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#each alertas as a (a.titulo)}
      <Alert.Root variant={a.nivel === 'error' ? 'destructive' : 'default'}>
        <AlertTriangleIcon data-icon="inline-start" />
        <Alert.Title>{a.titulo}</Alert.Title>
        <Alert.Description class="flex items-center justify-between gap-2">
          <span>{a.desc}</span>
          <Button
            variant="outline"
            size="sm"
            class="shrink-0"
            onclick={() => navigate(a.ruta)}
          >
            {a.accion}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </Alert.Description>
      </Alert.Root>
    {/each}
  </div>
{:else}
  <Alert.Root>
    <CheckCircleIcon data-icon="inline-start" />
    <Alert.Title>Datos completos</Alert.Title>
    <Alert.Description>
      Todos los datos obligatorios para el PIA y la Nómina están cargados.
      Podés previsualizar y generar los formularios.
    </Alert.Description>
  </Alert.Root>
{/if}
