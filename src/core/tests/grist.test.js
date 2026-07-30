import { describe, it, expect } from 'vitest'
import { tableDataToRecords } from '$core/grist'

describe('tableDataToRecords', () => {
  it('converts columnar data to record array', () => {
    const data = {
      id: [1, 2, 3],
      nombre: ['Alice', 'Bob', 'Carol'],
      edad: [30, 25, 40]
    }
    expect(tableDataToRecords(data)).toEqual([
      { id: 1, nombre: 'Alice', edad: 30 },
      { id: 2, nombre: 'Bob', edad: 25 },
      { id: 3, nombre: 'Carol', edad: 40 }
    ])
  })

  it('returns empty array for null', () => {
    expect(tableDataToRecords(null)).toEqual([])
  })

  it('returns empty array when id is not array', () => {
    expect(tableDataToRecords({ id: 'not-array' })).toEqual([])
  })

  it('returns empty array for empty data', () => {
    expect(tableDataToRecords({ id: [] })).toEqual([])
  })

  it('handles single column', () => {
    const data = { id: [1], nombre: ['Solo'] }
    expect(tableDataToRecords(data)).toEqual([{ id: 1, nombre: 'Solo' }])
  })
})
