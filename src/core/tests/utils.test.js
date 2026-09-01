import { describe, it, expect } from 'vitest'
import {
  normalize,
  normalizeFields,
  dateToInput,
  addMonths,
  monthKey,
  ageFromBirth,
  isAdult,
  daysSince,
  todayISO,
  TABLE_PREFERRED_IDS,
  getActiveMenuItems
} from '$core/utils/utils'

describe('normalize', () => {
  it('lowercases and trims', () => {
    expect(normalize('  Hello WORLD  ')).toBe('hello world')
  })
  it('handles null/undefined', () => {
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
  it('handles numbers', () => {
    expect(normalize(123)).toBe('123')
  })
})

describe('normalizeFields', () => {
  it('removes empty string values', () => {
    expect(normalizeFields({ a: 'x', b: '', c: 0 })).toEqual({ a: 'x', c: 0 })
  })
  it('removes null values', () => {
    expect(normalizeFields({ a: 'x', b: null, c: 0 })).toEqual({ a: 'x', c: 0 })
  })
  it('handles null', () => {
    expect(normalizeFields(null)).toEqual({})
  })
  it('keeps false values', () => {
    expect(normalizeFields({ active: false })).toEqual({ active: false })
  })
})

describe('dateToInput', () => {
  it('extracts YYYY-MM-DD from ISO', () => {
    expect(dateToInput('2024-03-15T10:30:00Z')).toBe('2024-03-15')
  })
  it('returns empty for falsy', () => {
    expect(dateToInput(null)).toBe('')
    expect(dateToInput('')).toBe('')
  })
  it('converts Grist Date timestamp (seconds since epoch)', () => {
    // 2024-03-15 00:00:00 UTC = 1710460800 segundos
    expect(dateToInput(1710460800)).toBe('2024-03-15')
  })
  it('converts Grist encoded Date array ["d", timestamp]', () => {
    expect(dateToInput(['d', 1710460800])).toBe('2024-03-15')
  })
  it('converts Grist encoded DateTime array ["D", timestamp, tz]', () => {
    expect(dateToInput(['D', 1710460800, 'UTC'])).toBe('2024-03-15')
  })
  it('handles plain YYYY-MM-DD string', () => {
    expect(dateToInput('2024-03-15')).toBe('2024-03-15')
  })
})

describe('addMonths', () => {
  it('adds months correctly', () => {
    expect(addMonths('2024-01-15', 3)).toBe('2024-04-15')
  })
  it('handles year boundary', () => {
    expect(addMonths('2024-11-15', 2)).toBe('2025-01-15')
  })
  it('clamps day to end of month', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  })
  it('returns empty for invalid input', () => {
    expect(addMonths('', 3)).toBe('')
    expect(addMonths('2024-01-15', '')).toBe('')
    expect(addMonths('invalid', 3)).toBe('')
  })
  it('returns same date for 0 months', () => {
    expect(addMonths('2024-06-15', 0)).toBe('2024-06-15')
  })
})

describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2024-03-15')).toBe('2024-03')
  })
  it('returns empty for falsy', () => {
    expect(monthKey(null)).toBe('')
    expect(monthKey('')).toBe('')
  })
})

describe('TABLE_PREFERRED_IDS', () => {
  it('has resoluciones table', () => {
    expect(TABLE_PREFERRED_IDS.resoluciones).toBeDefined()
    expect(Array.isArray(TABLE_PREFERRED_IDS.resoluciones)).toBe(true)
  })
  it('all entries are arrays with at least 2 elements', () => {
    for (const [key, ids] of Object.entries(TABLE_PREFERRED_IDS)) {
      expect(Array.isArray(ids), `${key} should be array`).toBe(true)
      expect(ids.length, `${key} should have at least 2 elements`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('ageFromBirth', () => {
  it('returns null for empty/invalid', () => {
    expect(ageFromBirth(null)).toBeNull()
    expect(ageFromBirth('')).toBeNull()
    expect(ageFromBirth('invalid')).toBeNull()
  })
  it('calculates age correctly for adult', () => {
    const today = new Date()
    const year = today.getFullYear() - 30
    const iso = `${year}-06-15`
    expect(ageFromBirth(iso)).toBe(30)
  })
  it('handles birthday not yet passed this year', () => {
    const today = new Date()
    const year = today.getFullYear() - 30
    const futureMonth = today.getMonth() + 2 > 11 ? 0 : today.getMonth() + 2
    const iso = `${year}-${String(futureMonth + 1).padStart(2, '0')}-15`
    expect(ageFromBirth(iso)).toBe(29)
  })
})

describe('isAdult', () => {
  it('returns null for empty', () => {
    expect(isAdult(null)).toBeNull()
    expect(isAdult('')).toBeNull()
  })
  it('returns true for 18+', () => {
    const year = new Date().getFullYear() - 20
    expect(isAdult(`${year}-01-01`)).toBe(true)
  })
  it('returns false for minor', () => {
    const year = new Date().getFullYear() - 15
    expect(isAdult(`${year}-01-01`)).toBe(false)
  })
})

describe('daysSince', () => {
  it('returns null for empty/invalid', () => {
    expect(daysSince(null)).toBeNull()
    expect(daysSince('')).toBeNull()
    expect(daysSince('invalid')).toBeNull()
  })
  it('returns 0 for today', () => {
    // Usar todayISO() (fecha local) en vez de toISOString() (UTC): en
    // timezones detrás de UTC (ej. Argentina), toISOString() ya da la
    // fecha de mañana entre las 21:00 y 23:59 hora local, lo que rompía
    // este test de forma intermitente según la hora de ejecución.
    const today = todayISO()
    expect(daysSince(today)).toBe(0)
  })
  it('returns positive for past date', () => {
    const iso = '2020-01-01'
    const result = daysSince(iso)
    expect(result).toBeGreaterThan(1000)
  })
})

describe('getActiveMenuItems — filtrado por rol', () => {
  const baseConfigIntegral = {
    instalado: true,
    modulo_gestion_integral: true,
    modulo_carga_consolidada: false,
  }
  const baseConfigConsolidada = {
    instalado: true,
    modulo_gestion_integral: false,
    modulo_carga_consolidada: true,
  }

  it('super_admin ve todas las rutas en gestión integral', () => {
    const items = getActiveMenuItems({ ...baseConfigIntegral, rol_dispositivo: 'super_admin' })
    const routes = items.map((i) => i.route)
    expect(routes).toContain('cooperadora')
    expect(routes).toContain('movimientos')
    expect(routes).toContain('gobierno')
    expect(routes).toContain('resumen')
    expect(routes).toContain('cierre')
    expect(routes).toContain('configuracion')
  })

  it('tesorero no ve cooperadora pero sí configuracion y rutas operativas', () => {
    const items = getActiveMenuItems({ ...baseConfigIntegral, rol_dispositivo: 'tesorero' })
    const routes = items.map((i) => i.route)
    expect(routes).not.toContain('cooperadora')
    expect(routes).toContain('configuracion')
    expect(routes).toContain('movimientos')
    expect(routes).toContain('comunidad')
    expect(routes).toContain('gobierno')
    expect(routes).toContain('resumen')
    expect(routes).toContain('cierre')
  })

  it('admin ve cooperadora y configuracion', () => {
    const items = getActiveMenuItems({ ...baseConfigIntegral, rol_dispositivo: 'admin' })
    const routes = items.map((i) => i.route)
    expect(routes).toContain('cooperadora')
    expect(routes).toContain('configuracion')
  })

  it('migración legacy: modo_colaborador=true sin rol → comportamiento de tesorero', () => {
    const items = getActiveMenuItems({ ...baseConfigIntegral, modo_colaborador: true })
    const routes = items.map((i) => i.route)
    expect(routes).not.toContain('cooperadora')
    expect(routes).toContain('configuracion')
    expect(routes).toContain('movimientos')
  })

  it('sin rol y sin modo_colaborador → super_admin (menú completo)', () => {
    const items = getActiveMenuItems(baseConfigIntegral)
    const routes = items.map((i) => i.route)
    expect(routes).toContain('cooperadora')
  })

  it('config null → solo inicio', () => {
    const items = getActiveMenuItems(null)
    expect(items).toEqual([{ route: 'inicio', label: 'Inicio' }])
  })

  it('carga consolidada con tesorero: no ve cooperadora, ve rutas operativas', () => {
    const items = getActiveMenuItems({ ...baseConfigConsolidada, rol_dispositivo: 'tesorero' })
    const routes = items.map((i) => i.route)
    expect(routes).not.toContain('cooperadora')
    expect(routes).toContain('movimientos')
    expect(routes).toContain('comunidad')
  })

  it('el rol se respeta incluso si modo_colaborador=true (rol explícito tiene prioridad)', () => {
    const items = getActiveMenuItems({
      ...baseConfigIntegral,
      modo_colaborador: true,
      rol_dispositivo: 'admin',
    })
    const routes = items.map((i) => i.route)
    // admin ve cooperadora aunque modo_colaborador=true
    expect(routes).toContain('cooperadora')
  })
})
