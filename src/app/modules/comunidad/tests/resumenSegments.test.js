import { describe, it, expect } from 'vitest'
import { buildResumenSegments } from '../resumenSegments.js'
import { resolverRangoPreset } from '../bajasStats.js'

describe('buildResumenSegments — bajas', () => {
  const records = [
    { fecha_baja: '2026-08-15', motivo_baja: 'Renuncia', esSocio: true },
    { fecha_baja: '2026-08-20', motivo_baja: 'Renuncia', esSocio: true },
    { fecha_baja: '2026-07-10', motivo_baja: 'Falta de pago', esSocio: true },
    { fecha_baja: '2026-06-05', motivo_baja: 'Fallecimiento', esSocio: true },
  ]

  it('devuelve segmentos por motivo + periodSelector', () => {
    const rango = resolverRangoPreset('todo', new Date('2026-09-01T12:00:00'))
    const result = buildResumenSegments(
      { vinculoFilter: 'socios', estadoFilter: 'bajas', categoriaFilter: '' },
      { records, rangoBajas: rango, presetBajas: 'todo' },
    )
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.periodSelector).not.toBeNull()
    expect(result.periodSelector.value).toBe('todo')

    const renuncia = result.segments.find((s) => s.id === 'baja-Renuncia')
    expect(renuncia).toBeDefined()
    expect(renuncia.count).toBe(2)
    expect(renuncia.variant).toBe('secondary')
  })

  it('marca el segmento activo cuando motivoBajaSegmentActivo coincide', () => {
    const rango = resolverRangoPreset('todo', new Date('2026-09-01T12:00:00'))
    const result = buildResumenSegments(
      { vinculoFilter: 'socios', estadoFilter: 'bajas', categoriaFilter: '', motivoBajaSegmentActivo: 'Renuncia' },
      { records, rangoBajas: rango, presetBajas: 'todo' },
    )
    const renuncia = result.segments.find((s) => s.id === 'baja-Renuncia')
    expect(renuncia.active).toBe(true)

    const falta = result.segments.find((s) => s.id === 'baja-Falta de pago')
    expect(falta.active).toBe(false)
  })

  it('incluye motivos conocidos con count 0', () => {
    const rango = resolverRangoPreset('todo', new Date('2026-09-01T12:00:00'))
    const result = buildResumenSegments(
      { vinculoFilter: 'socios', estadoFilter: 'bajas', categoriaFilter: '' },
      { records: [], rangoBajas: rango, presetBajas: 'todo' },
    )
    // MOTIVOS_BAJA = ['Renuncia', 'Falta de pago', 'Fallecimiento', 'CambioEscuela', 'Otro']
    const ids = result.segments.map((s) => s.id)
    expect(ids).toContain('baja-Renuncia')
    expect(ids).toContain('baja-Falta de pago')
    expect(ids).toContain('baja-Fallecimiento')
    expect(ids).toContain('baja-CambioEscuela')
    expect(ids).toContain('baja-Otro')
  })

  it('sin rangoBajas devuelve segments vacíos', () => {
    const result = buildResumenSegments(
      { vinculoFilter: 'socios', estadoFilter: 'bajas', categoriaFilter: '' },
      { records, rangoBajas: undefined },
    )
    expect(result.segments).toEqual([])
    expect(result.periodSelector).toBeNull()
  })
})

describe('buildResumenSegments — institucional/proveedores', () => {
  const records = [
    { categoria: 'Docente', esSocio: true },
    { categoria: 'Docente', esSocio: false },
    { categoria: 'Docente', esSocio: true },
    { categoria: 'Proveedor', esSocio: false },
    { categoria: 'Socio', esSocio: true }, // no cuenta para Docente
  ]

  it('Docente: 3 cargados, 2 también socios, 1 no socio', () => {
    const result = buildResumenSegments(
      { vinculoFilter: '', estadoFilter: 'activos', categoriaFilter: 'Docente' },
      { records },
    )
    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]).toMatchObject({ id: 'inst-total', count: 3 })
    expect(result.segments[1]).toMatchObject({ id: 'inst-socios', count: 2 })
    expect(result.segments[2]).toMatchObject({ id: 'inst-no-socios', count: 1 })
    expect(result.periodSelector).toBeNull()
  })

  it('Proveedor: 1 cargado, 0 socios', () => {
    const result = buildResumenSegments(
      { vinculoFilter: '', estadoFilter: 'activos', categoriaFilter: 'Proveedor' },
      { records },
    )
    expect(result.segments[0]).toMatchObject({ id: 'inst-total', count: 1 })
    expect(result.segments[1]).toMatchObject({ id: 'inst-socios', count: 0 })
    expect(result.segments[2]).toMatchObject({ id: 'inst-no-socios', count: 1 })
  })

  it('categoría sin registros: todo en 0', () => {
    const result = buildResumenSegments(
      { vinculoFilter: '', estadoFilter: 'activos', categoriaFilter: 'Directivo' },
      { records },
    )
    expect(result.segments[0]).toMatchObject({ id: 'inst-total', count: 0 })
    expect(result.segments[1]).toMatchObject({ id: 'inst-socios', count: 0 })
  })
})

describe('buildResumenSegments — sin contexto aplicable', () => {
  it('sin filtros: segments vacíos', () => {
    const result = buildResumenSegments(
      { vinculoFilter: '', estadoFilter: 'activos', categoriaFilter: '' },
      { records: [] },
    )
    expect(result.segments).toEqual([])
    expect(result.periodSelector).toBeNull()
  })

  it('no-socios sin categoría: segments vacíos', () => {
    const result = buildResumenSegments(
      { vinculoFilter: 'no-socios', estadoFilter: 'activos', categoriaFilter: '' },
      { records: [] },
    )
    expect(result.segments).toEqual([])
  })
})

describe('buildResumenSegments — cumplimiento (Fase 2, sin morosidad)', () => {
  it('socios activos sin morosidadPorSocio: segments vacíos', () => {
    const result = buildResumenSegments(
      { vinculoFilter: 'socios', estadoFilter: 'activos', categoriaFilter: '' },
      { records: [] },
    )
    expect(result.segments).toEqual([])
  })
})
