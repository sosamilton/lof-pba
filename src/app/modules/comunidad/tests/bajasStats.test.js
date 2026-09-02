import { describe, it, expect } from 'vitest'
import {
  resolverRangoPreset,
  contarBajasEnRango,
  agruparBajasPorMotivo,
  PRESETS_PERIODO_BAJAS,
} from '../bajasStats.js'

describe('resolverRangoPreset', () => {
  const ref = new Date('2026-09-01T12:00:00')

  // Helper: compara componentes locales de fecha (ignora zona horaria del runner)
  const expectFecha = (d, anio, mes, dia) => {
    expect(d.getFullYear()).toBe(anio)
    expect(d.getMonth() + 1).toBe(mes)
    expect(d.getDate()).toBe(dia)
  }

  it('ultimo-mes: retrocede 1 mes', () => {
    const { desde, hasta } = resolverRangoPreset('ultimo-mes', ref)
    expectFecha(desde, 2026, 8, 1)
    expectFecha(hasta, 2026, 9, 1)
  })

  it('ultimo-trimestre: retrocede 3 meses', () => {
    const { desde } = resolverRangoPreset('ultimo-trimestre', ref)
    expectFecha(desde, 2026, 6, 1)
  })

  it('ultimo-semestre: retrocede 6 meses', () => {
    const { desde } = resolverRangoPreset('ultimo-semestre', ref)
    expectFecha(desde, 2026, 3, 1)
  })

  it('ultimo-anio: retrocede 1 año', () => {
    const { desde } = resolverRangoPreset('ultimo-anio', ref)
    expectFecha(desde, 2025, 9, 1)
  })

  it('todo: desde es null (sin límite inferior)', () => {
    const { desde, hasta } = resolverRangoPreset('todo', ref)
    expect(desde).toBeNull()
    expect(hasta).toBeInstanceOf(Date)
  })

  it('custom: usa el rango explícito', () => {
    const { desde, hasta } = resolverRangoPreset('custom', ref, {
      desde: new Date('2026-01-15T12:00:00'),
      hasta: new Date('2026-06-30T12:00:00'),
    })
    expectFecha(desde, 2026, 1, 15)
    expectFecha(hasta, 2026, 6, 30)
  })

  it('preset desconocido: desde null (no filtra)', () => {
    const { desde } = resolverRangoPreset(/** @type {any} */ ('desconocido'), ref)
    expect(desde).toBeNull()
  })
})

describe('contarBajasEnRango', () => {
  const records = [
    { fecha_baja: '2026-08-15', motivo_baja: 'Renuncia', esSocio: true },
    { fecha_baja: '2026-07-10', motivo_baja: 'Falta de pago', esSocio: true },
    { fecha_baja: '2025-12-01', motivo_baja: 'Fallecimiento', esSocio: true },
    { fecha_baja: '', motivo_baja: '', esSocio: true }, // sin baja
    { esSocio: false }, // no socio
  ]

  it('cuenta bajas dentro del rango', () => {
    const rango = resolverRangoPreset('ultimo-mes', new Date('2026-09-01T12:00:00'))
    // 2026-08-15 está dentro del último mes desde 2026-09-01
    expect(contarBajasEnRango(records, rango)).toBe(1)
  })

  it('cuenta todas las bajas con preset "todo"', () => {
    const rango = resolverRangoPreset('todo', new Date('2026-09-01T12:00:00'))
    expect(contarBajasEnRango(records, rango)).toBe(3)
  })

  it('cuenta bajas del último año', () => {
    const rango = resolverRangoPreset('ultimo-anio', new Date('2026-09-01T12:00:00'))
    // 2026-08-15 y 2026-07-10 están dentro; 2025-12-01 también (hace 9 meses)
    expect(contarBajasEnRango(records, rango)).toBe(3)
  })

  it('no cuenta registros sin fecha_baja', () => {
    const rango = resolverRangoPreset('todo', new Date('2026-09-01T12:00:00'))
    expect(contarBajasEnRango(records, rango)).toBe(3)
  })

  it('array vacío devuelve 0', () => {
    const rango = resolverRangoPreset('todo')
    expect(contarBajasEnRango([], rango)).toBe(0)
  })
})

describe('agruparBajasPorMotivo', () => {
  const records = [
    { fecha_baja: '2026-08-15', motivo_baja: 'Renuncia' },
    { fecha_baja: '2026-08-20', motivo_baja: 'Renuncia' },
    { fecha_baja: '2026-07-10', motivo_baja: 'Falta de pago' },
    { fecha_baja: '2026-06-05', motivo_baja: '' }, // sin motivo → 'Sin motivo'
  ]

  it('agrupa por motivo y ordena por count descendente', () => {
    const rango = resolverRangoPreset('todo', new Date('2026-09-01T12:00:00'))
    const grupos = agruparBajasPorMotivo(records, rango)
    expect(grupos).toHaveLength(3)
    expect(grupos[0]).toEqual({ motivo: 'Renuncia', count: 2 })
    expect(grupos[1]).toEqual({ motivo: 'Falta de pago', count: 1 })
    expect(grupos[2]).toEqual({ motivo: 'Sin motivo', count: 1 })
  })

  it('filtra por rango', () => {
    // Solo el último mes: solo 2026-08-15 y 2026-08-20 (Renuncia x2)
    const rango = resolverRangoPreset('ultimo-mes', new Date('2026-09-01T12:00:00'))
    const grupos = agruparBajasPorMotivo(records, rango)
    expect(grupos).toHaveLength(1)
    expect(grupos[0]).toEqual({ motivo: 'Renuncia', count: 2 })
  })

  it('array vacío devuelve []', () => {
    const rango = resolverRangoPreset('todo')
    expect(agruparBajasPorMotivo([], rango)).toEqual([])
  })
})

describe('PRESETS_PERIODO_BAJAS', () => {
  it('incluye los 6 presets esperados', () => {
    const values = PRESETS_PERIODO_BAJAS.map((p) => p.value)
    expect(values).toEqual([
      'ultimo-mes',
      'ultimo-trimestre',
      'ultimo-semestre',
      'ultimo-anio',
      'todo',
      'custom',
    ])
  })
})
