import { applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, dateToInput, MESES } from '$core/utils/utils.js'

/**
 * Generación y guardado de la Memoria anual.
 *
 * La Memoria en Buenos Aires es "un simple texto escrito" (FAQ DGCyE)
 * donde la CD describe las actividades del ejercicio. No tiene estructura
 * formal rígida como el balance.
 *
 * El borrador se genera automáticamente compilando:
 * 1. Hechos relevantes del ejercicio (agrupados por categoría)
 * 2. Decisiones institucionales (asambleas, autoridades, resoluciones)
 * 3. Síntesis económica (referencia al balance, sin duplicar)
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTEjercicios - Getter del tableId de ejercicios
 * @param {() => any | null} deps.getEjercicio - Getter del ejercicio en curso
 * @param {() => any[]} deps.getHechos - Getter de hechos relevantes del ejercicio
 * @param {() => any[]} deps.getAsambleas - Getter de asambleas del ejercicio
 * @param {() => any[]} deps.getAutoridades - Getter de autoridades
 * @param {() => any[]} deps.getCargos - Getter de cargos
 * @param {object} deps.bs - Base state
 */

const TIPOS_ASAMBLEA_LABEL = {
  AGO: 'Asamblea General Ordinaria',
  AGE: 'Asamblea General Extraordinaria',
  RCD: 'Reunión de Comisión Directiva',
}

const CATEGORIA_LABEL = {
  'Evento': 'Eventos',
  'Infraestructura': 'Obras de mantenimiento e infraestructura',
  'Equipamiento': 'Equipamiento',
  'Beneficios': 'Beneficios obtenidos',
  'Actividades': 'Actividades',
  'Proyecto educativo': 'Financiamiento de proyectos educativos',
  'Otro': 'Otros',
}

function formatMonto(m) {
  if (m == null || m === '') return ''
  const n = Number(m)
  if (isNaN(n)) return ''
  return `$${n.toLocaleString('es-AR')}`
}

function formatFecha(f) {
  const d = dateToInput(f)
  if (!d) return ''
  const [y, m, day] = d.split('-')
  const mes = MESES[Number(m) - 1] || m
  return `${day} de ${mes.toLowerCase()} de ${y}`
}

/**
 * Genera el texto del borrador de Memoria.
 * @returns {string} Texto de la Memoria
 */
export function generarBorradorMemoria({ getEjercicio, getHechos, getAsambleas, getAutoridades, getCargos }) {
  const ej = getEjercicio()
  if (!ej) return 'No hay ejercicio en curso.'

  const hechos = getHechos() || []
  const asambleas = getAsambleas() || []
  const autoridades = getAutoridades() || []
  const cargos = getCargos() || []

  const lineas = []

  // Encabezado
  const anioInicio = ej.anio_inicio || ''
  const anioFin = ej.anio_fin || ''
  const mesInicioNum = Number(ej.mes_inicio) || 5
  const mesInicioNombre = MESES[mesInicioNum - 1] || 'mayo'
  const mesFinNombre = MESES[(mesInicioNum - 1 + 11) % 12]?.toLowerCase() || 'abril'

  lineas.push(`# Memoria Anual — Ejercicio ${anioInicio}-${anioFin}`)
  lineas.push('')
  lineas.push(`**Período:** 1° de ${mesInicioNombre.toLowerCase()} de ${anioInicio} al 30 de ${mesFinNombre} de ${anioFin}`)
  lineas.push('')
  lineas.push('En cumplimiento con las disposiciones legales y estatutarias vigentes, la Comisión Directiva pone a consideración de la Asamblea General Ordinaria lo actuado durante el ejercicio.')
  lineas.push('')

  // 1. Hechos relevantes agrupados por categoría
  if (hechos.length > 0) {
    lineas.push('## Actividades y hechos relevantes')
    lineas.push('')

    // Agrupar por categoría
    const porCategoria = {}
    for (const h of hechos) {
      const cat = h.categoria || 'Otro'
      if (!porCategoria[cat]) porCategoria[cat] = []
      porCategoria[cat].push(h)
    }

    // Ordenar categorías según el orden predefinido
    const ordenCategorias = ['Evento', 'Infraestructura', 'Equipamiento', 'Beneficios', 'Actividades', 'Proyecto educativo', 'Otro']
    for (const cat of ordenCategorias) {
      if (!porCategoria[cat]) continue
      const label = CATEGORIA_LABEL[cat] || cat
      lineas.push(`### ${label}`)
      for (const h of porCategoria[cat]) {
        const fecha = formatFecha(h.fecha)
        const monto = h.monto != null && h.monto !== '' ? ` (${formatMonto(h.monto)})` : ''
        lineas.push(`- ${fecha ? fecha + ' — ' : ''}${h.descripcion || '(sin descripción)'}${monto}`)
      }
      lineas.push('')
    }
  }

  // 2. Decisiones institucionales (asambleas y autoridades)
  const asambleasEjercicio = asambleas.filter((a) => Number(a.ejercicio_id) === Number(ej.id))
  if (asambleasEjercicio.length > 0) {
    lineas.push('## Decisiones institucionales')
    lineas.push('')

    for (const a of asambleasEjercicio) {
      const tipo = TIPOS_ASAMBLEA_LABEL[a.tipo_asamblea] || a.tipo_asamblea
      const fecha = formatFecha(a.fecha)
      const acta = a.acta_numero ? ` (Acta N° ${a.acta_numero})` : ''
      lineas.push(`### ${tipo} del ${fecha}${acta}`)
      lineas.push('')

      // Autoridades elegidas en esta asamblea
      const autsAsamblea = autoridades.filter(
        (au) => Number(au.asamblea_id) === Number(a.id) && au.activo !== false,
      )
      if (autsAsamblea.length > 0) {
        const cargoMap = {}
        for (const c of cargos) cargoMap[String(c.id)] = c.nombre_cargo || ''
        lineas.push('Autoridades designadas:')
        lineas.push('')
        for (const au of autsAsamblea) {
          const cargo = cargoMap[String(au.cargo_id)] || `Cargo #${au.cargo_id}`
          lineas.push(`- **${cargo}:** ${au.apellido_nombre || '(sin nombre)'}`)
        }
        lineas.push('')
      }
    }
  }

  // 3. Síntesis económica (referencia, sin duplicar)
  lineas.push('## Síntesis económica')
  lineas.push('')
  const saldoInicial = ej.saldo_inicial_total != null ? formatMonto(ej.saldo_inicial_total) : '(no informado)'
  lineas.push(`**Saldo inicial del ejercicio:** ${saldoInicial}`)
  lineas.push('')
  lineas.push('El detalle de ingresos, egresos y saldo final se encuentra en el Balance (estado de recursos y gastos) que se presenta junto con esta Memoria.')
  lineas.push('')

  // Cierre
  lineas.push('---')
  lineas.push('')
  lineas.push('Se invita a los socios a revisar la documentación completa (Balance, Inventario, Informe de la Comisión Revisora de Cuentas) que se acompaña a la presente Memoria.')
  lineas.push('')
  lineas.push('**Comisión Directiva**')

  return lineas.join('\n')
}

/**
 * Guarda la Memoria en el ejercicio.
 */
export async function guardarMemoria({ getTEjercicios, getEjercicio, texto, estado, bs }) {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    const ej = getEjercicio()
    if (!ej?.id) {
      bs.setError('No hay ejercicio en curso.')
      return false
    }
    const tEjercicios = getTEjercicios()
    const fields = normalizeFields({
      memoria_texto: texto || '',
      memoria_estado: estado || 'borrador',
      memoria_fecha_generacion: new Date().toISOString(),
    })
    await applyUserActions([['UpdateRecord', tEjercicios, ej.id, fields]])
    bs.setNotice('Memoria guardada.')
    return true
  } catch (e) {
    bs.setError(e?.message || String(e))
    return false
  } finally {
    bs.setBusy(false)
  }
}
