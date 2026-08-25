import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

// Test del PouchRepository — verifica que la interfaz funciona correctamente.
// PouchDB en Vitest usa el adapter IndexedDB via fake-indexeddb.

import {
  fetchRecords,
  applyUserActions,
  ensureOneRow,
  extractAttachmentIds,
  toAttachmentCellValue,
  resolveTableId,
  _resetForTesting,
} from '../data/pouchRepository.js'

describe('PouchRepository', () => {
  beforeEach(async () => {
    await _resetForTesting()
  })

  it('AddRecord y fetchRecords básico', async () => {
    await applyUserActions([
      ['AddRecord', 'personas', null, { dni: '12345678', apellido: 'Perez', nombre: 'Juan' }],
    ])

    const records = await fetchRecords('personas')
    expect(records).toHaveLength(1)
    expect(records[0].dni).toBe('12345678')
    expect(records[0].apellido).toBe('Perez')
    expect(records[0].id).toBe(1)
  })

  it('UpdateRecord modifica un registro existente', async () => {
    await applyUserActions([
      ['AddRecord', 'personas', null, { dni: '12345678', apellido: 'Perez' }],
    ])

    const [rec] = await fetchRecords('personas')
    await applyUserActions([
      ['UpdateRecord', 'personas', rec.id, { apellido: 'Gonzalez' }],
    ])

    const [updated] = await fetchRecords('personas')
    expect(updated.apellido).toBe('Gonzalez')
    expect(updated.dni).toBe('12345678') // no se perdió
  })

  it('RemoveRecord elimina un registro', async () => {
    await applyUserActions([
      ['AddRecord', 'personas', null, { dni: '12345678' }],
    ])

    const [rec] = await fetchRecords('personas')
    await applyUserActions([
      ['RemoveRecord', 'personas', rec.id],
    ])

    const records = await fetchRecords('personas')
    expect(records).toHaveLength(0)
  })

  it('BulkAddRecord crea múltiples registros', async () => {
    await applyUserActions([
      ['BulkAddRecord', 'personas', [null, null, null], {
        dni: ['111', '222', '333'],
        apellido: ['A', 'B', 'C'],
      }],
    ])

    const records = await fetchRecords('personas')
    expect(records).toHaveLength(3)
    expect(records.map((r) => r.dni).sort()).toEqual(['111', '222', '333'])
  })

  it('fetchRecords con filter', async () => {
    await applyUserActions([
      ['BulkAddRecord', 'personas', [null, null], {
        dni: ['111', '222'],
        apellido: ['Perez', 'Gomez'],
      }],
    ])

    const filtered = await fetchRecords('personas', {
      filter: (r) => r.apellido === 'Perez',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].apellido).toBe('Perez')
  })

  it('fetchRecords con sort', async () => {
    await applyUserActions([
      ['BulkAddRecord', 'personas', [null, null, null], {
        dni: ['333', '111', '222'],
        apellido: ['C', 'A', 'B'],
      }],
    ])

    const sorted = await fetchRecords('personas', {
      sort: (a, b) => a.apellido.localeCompare(b.apellido),
    })
    expect(sorted.map((r) => r.apellido)).toEqual(['A', 'B', 'C'])
  })

  it('fetchRecords con limit', async () => {
    await applyUserActions([
      ['BulkAddRecord', 'personas', [null, null, null], {
        dni: ['1', '2', '3'],
      }],
    ])

    const limited = await fetchRecords('personas', { limit: 2 })
    expect(limited).toHaveLength(2)
  })

  it('ensureOneRow crea una fila si la tabla está vacía', async () => {
    const row = await ensureOneRow('escuela')
    expect(row).toBeTruthy()
    expect(row.id).toBe(1)

    // Segunda llamada no crea otra fila
    const row2 = await ensureOneRow('escuela')
    const all = await fetchRecords('escuela')
    expect(all).toHaveLength(1)
  })

  it('resolveTableId devuelve el primer preferred ID', async () => {
    const tid = await resolveTableId(['Escuela', 'escuela'])
    expect(tid).toBe('Escuela')
  })

  it('extractAttachmentIds normaliza formatos de Grist y PouchDB', () => {
    expect(extractAttachmentIds(null)).toEqual([])
    expect(extractAttachmentIds(42)).toEqual([42])
    expect(extractAttachmentIds([1, 2, 3])).toEqual([1, 2, 3])
    expect(extractAttachmentIds(['L', 1, 2])).toEqual([1, 2])
    expect(extractAttachmentIds([['L', 1], ['L', 2]])).toEqual([1, 2])
  })

  it('toAttachmentCellValue genera formato Grist', () => {
    expect(toAttachmentCellValue([1, 2])).toEqual(['L', 1, 2])
  })

  it('IDs se auto-incrementan por tabla', async () => {
    await applyUserActions([['AddRecord', 'personas', null, { dni: '1' }]])
    await applyUserActions([['AddRecord', 'personas', null, { dni: '2' }]])
    await applyUserActions([['AddRecord', 'movimientos', null, { monto: 100 }]])

    const personas = await fetchRecords('personas')
    const movimientos = await fetchRecords('movimientos')
    expect(personas.map((r) => r.id)).toEqual([1, 2])
    expect(movimientos[0].id).toBe(1) // contador independiente por tabla
  })

  it('createTables es no-op', async () => {
    const result = await applyUserActions([['AddTable', 'nueva_tabla', []]])
    expect(result[0].noop).toBe(true)
  })
})
