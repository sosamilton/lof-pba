import { describe, it, expect } from 'vitest'
import {
  normalize,
  normalizeFields,
  dateToInput,
  addMonths,
  monthKey,
  TABLE_PREFERRED_IDS
} from '../utils.js'

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
