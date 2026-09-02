import { describe, it, expect } from 'vitest'
import {
  shouldRunSnapshot,
  calculateNextRun,
  getSnapshotFilename,
  PERIODICITY,
} from '$core/security/snapshotScheduler.svelte'

describe('PERIODICITY', () => {
  it('define semanal, mensual y anual', () => {
    expect(PERIODICITY.WEEKLY).toBe('weekly')
    expect(PERIODICITY.MONTHLY).toBe('monthly')
    expect(PERIODICITY.YEARLY).toBe('yearly')
  })
})

describe('shouldRunSnapshot — mensual', () => {
  it('true si nunca se corrió (lastRun null)', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    expect(shouldRunSnapshot(null, PERIODICITY.MONTHLY, now)).toBe(true)
  })
  it('true si el último run fue hace más de 1 mes', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    const lastRun = new Date('2026-07-15T10:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.MONTHLY, now)).toBe(true)
  })
  it('false si el último run fue hace menos de 1 mes', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    const lastRun = new Date('2026-08-15T10:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.MONTHLY, now)).toBe(false)
  })
  it('false si el último run fue hoy', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    const lastRun = new Date('2026-09-01T08:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.MONTHLY, now)).toBe(false)
  })
})

describe('shouldRunSnapshot — anual', () => {
  it('true si nunca se corrió', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    expect(shouldRunSnapshot(null, PERIODICITY.YEARLY, now)).toBe(true)
  })
  it('true si el último run fue hace más de 1 año', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    const lastRun = new Date('2025-01-01T10:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.YEARLY, now)).toBe(true)
  })
  it('false si el último run fue hace 3 meses', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    const lastRun = new Date('2026-06-01T10:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.YEARLY, now)).toBe(false)
  })
})

describe('shouldRunSnapshot — semanal', () => {
  it('true si nunca se corrió', () => {
    const now = new Date('2026-09-01T10:00:00Z')
    expect(shouldRunSnapshot(null, PERIODICITY.WEEKLY, now)).toBe(true)
  })
  it('true si el último run fue hace más de 7 días', () => {
    const now = new Date('2026-09-10T10:00:00Z')
    const lastRun = new Date('2026-09-01T10:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.WEEKLY, now)).toBe(true)
  })
  it('false si el último run fue hace 3 días', () => {
    const now = new Date('2026-09-04T10:00:00Z')
    const lastRun = new Date('2026-09-01T10:00:00Z').toISOString()
    expect(shouldRunSnapshot(lastRun, PERIODICITY.WEEKLY, now)).toBe(false)
  })
})

describe('calculateNextRun', () => {
  it('mensual: suma 1 mes al lastRun', () => {
    const lastRun = '2026-08-15T10:00:00Z'
    const next = calculateNextRun(lastRun, PERIODICITY.MONTHLY)
    expect(next).toBe('2026-09-15T10:00:00.000Z')
  })
  it('anual: suma 1 año al lastRun', () => {
    const lastRun = '2026-08-15T10:00:00Z'
    const next = calculateNextRun(lastRun, PERIODICITY.YEARLY)
    expect(next).toBe('2027-08-15T10:00:00.000Z')
  })
  it('semanal: suma 7 días al lastRun', () => {
    const lastRun = '2026-09-01T10:00:00Z'
    const next = calculateNextRun(lastRun, PERIODICITY.WEEKLY)
    expect(next).toBe('2026-09-08T10:00:00.000Z')
  })
  it('null lastRun devuelve null', () => {
    expect(calculateNextRun(null, PERIODICITY.MONTHLY)).toBeNull()
  })
})

describe('getSnapshotFilename', () => {
  it('genera filename con fecha y sufijo snapshot', () => {
    const date = new Date('2026-09-01T10:00:00Z')
    const filename = getSnapshotFilename(date)
    expect(filename).toContain('snapshot')
    expect(filename).toContain('2026-09-01')
    expect(filename.endsWith('.lof')).toBe(true)
  })
  it('genera filenames diferentes para fechas diferentes', () => {
    const d1 = new Date('2026-09-01T10:00:00Z')
    const d2 = new Date('2026-10-01T10:00:00Z')
    expect(getSnapshotFilename(d1)).not.toBe(getSnapshotFilename(d2))
  })
})
