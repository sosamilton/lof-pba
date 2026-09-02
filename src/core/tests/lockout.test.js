import { describe, it, expect } from 'vitest'
import {
  LOCKOUT_THRESHOLD,
  LOCKOUT_MAX_SECONDS,
  getLockoutSeconds,
  shouldLock,
  isLocked,
  getRemainingLockoutSeconds,
} from '$core/security/lockout'

describe('getLockoutSeconds — cálculo de backoff exponencial', () => {
  it('antes del 5º intento no hay lockout (0 segundos)', () => {
    expect(getLockoutSeconds(0)).toBe(0)
    expect(getLockoutSeconds(1)).toBe(0)
    expect(getLockoutSeconds(2)).toBe(0)
    expect(getLockoutSeconds(3)).toBe(0)
    expect(getLockoutSeconds(4)).toBe(0)
  })
  it('5º intento: 30 segundos', () => {
    expect(getLockoutSeconds(5)).toBe(30)
  })
  it('6º intento: 60 segundos', () => {
    expect(getLockoutSeconds(6)).toBe(60)
  })
  it('7º intento: 120 segundos', () => {
    expect(getLockoutSeconds(7)).toBe(120)
  })
  it('8º intento: 240 segundos', () => {
    expect(getLockoutSeconds(8)).toBe(240)
  })
  it('9º intento y siguientes: cap en 300 segundos (5 min)', () => {
    expect(getLockoutSeconds(9)).toBe(300)
    expect(getLockoutSeconds(10)).toBe(300)
    expect(getLockoutSeconds(50)).toBe(300)
  })
})

describe('LOCKOUT_THRESHOLD', () => {
  it('es 5 (backoff desde el 5º intento)', () => {
    expect(LOCKOUT_THRESHOLD).toBe(5)
  })
})

describe('LOCKOUT_MAX_SECONDS', () => {
  it('es 300 (5 minutos)', () => {
    expect(LOCKOUT_MAX_SECONDS).toBe(300)
  })
})

describe('shouldLock', () => {
  it('false si los intentos fallidos son menores al threshold', () => {
    expect(shouldLock(0)).toBe(false)
    expect(shouldLock(4)).toBe(false)
  })
  it('true si los intentos fallidos >= threshold', () => {
    expect(shouldLock(5)).toBe(true)
    expect(shouldLock(10)).toBe(true)
  })
})

describe('isLocked', () => {
  it('false si lockedUntil es null o 0', () => {
    expect(isLocked(null, Date.now())).toBe(false)
    expect(isLocked(0, Date.now())).toBe(false)
  })
  it('false si lockedUntil ya pasó', () => {
    const now = Date.now()
    expect(isLocked(now - 1000, now)).toBe(false)
  })
  it('true si lockedUntil está en el futuro', () => {
    const now = Date.now()
    expect(isLocked(now + 30000, now)).toBe(true)
  })
})

describe('getRemainingLockoutSeconds', () => {
  it('0 si no hay lockout', () => {
    expect(getRemainingLockoutSeconds(null, Date.now())).toBe(0)
    expect(getRemainingLockoutSeconds(0, Date.now())).toBe(0)
  })
  it('0 si el lockout ya expiró', () => {
    const now = Date.now()
    expect(getRemainingLockoutSeconds(now - 1000, now)).toBe(0)
  })
  it('segundos restantes si el lockout está activo', () => {
    const now = Date.now()
    const lockedUntil = now + 30000
    const remaining = getRemainingLockoutSeconds(lockedUntil, now)
    expect(remaining).toBeGreaterThan(25)
    expect(remaining).toBeLessThanOrEqual(30)
  })
})
