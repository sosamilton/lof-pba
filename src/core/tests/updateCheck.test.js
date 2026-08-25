import { describe, it, expect } from 'vitest'
import { updateCheck } from '../utils/updateCheck.svelte.js'

describe('updateCheck.compareVersions', () => {
  it('compara versiones semver básicas', () => {
    expect(updateCheck.compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(updateCheck.compareVersions('0.1.0', '0.1.1')).toBe(-1)
    expect(updateCheck.compareVersions('0.1.1', '0.1.0')).toBe(1)
    expect(updateCheck.compareVersions('0.1.0', '0.2.0')).toBe(-1)
    expect(updateCheck.compareVersions('1.0.0', '0.9.9')).toBe(1)
  })

  it('ignora el prefijo v', () => {
    expect(updateCheck.compareVersions('v0.1.0', '0.1.0')).toBe(0)
    expect(updateCheck.compareVersions('v1.0.0', 'v0.9.0')).toBe(1)
  })

  it('maneja pre-release suffixes', () => {
    // sin pre-release > con pre-release (0.1.0 > 0.1.0-dev)
    expect(updateCheck.compareVersions('0.1.0', '0.1.0-dev')).toBe(1)
    expect(updateCheck.compareVersions('0.1.0-dev', '0.1.0')).toBe(-1)
    // mismo pre-release = igual
    expect(updateCheck.compareVersions('0.1.0-dev', '0.1.0-dev')).toBe(0)
  })

  it('maneja versiones con distinta cantidad de partes', () => {
    expect(updateCheck.compareVersions('1.0', '1.0.0')).toBe(0)
    expect(updateCheck.compareVersions('1.0.0.1', '1.0.0')).toBe(1)
  })

  it('maneja entradas inválidas sin crashear', () => {
    expect(updateCheck.compareVersions('', '0.1.0')).toBe(0)
    expect(updateCheck.compareVersions(null, null)).toBe(0)
    expect(updateCheck.compareVersions('abc', '0.1.0')).toBe(0)
  })
})
