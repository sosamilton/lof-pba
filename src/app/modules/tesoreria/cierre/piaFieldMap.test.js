import { describe, it, expect } from 'vitest'
import { distribuirEnSlots } from './piaFieldMap'

describe('distribuirEnSlots', () => {
  const pares = [
    ['GASTOS F', 'Texto33'],
    ['GASTOS G', 'Texto34'],
  ]

  it('sin subrubros y sin total: no asigna nada', () => {
    expect(distribuirEnSlots(pares, [], 0)).toEqual([])
  })

  it('sin subrubros pero con total (carga sin elegir subrubro): "Varios" en el primer slot', () => {
    const out = distribuirEnSlots(pares, [], 1500)
    expect(out).toEqual([
      { descField: 'GASTOS F', montoField: 'Texto33', nombre: 'Varios', monto: 1500 },
    ])
  })

  it('1 subrubro con 2 slots libres: va solo en el primero, el segundo queda vacío', () => {
    const subrubros = [{ nombre: 'Comisión mantenimiento', monto: 800 }]
    const out = distribuirEnSlots(pares, subrubros, 800)
    expect(out).toEqual([
      { descField: 'GASTOS F', montoField: 'Texto33', nombre: 'Comisión mantenimiento', monto: 800 },
    ])
  })

  it('2 subrubros con 2 slots libres: uno por fila, sin agrupar', () => {
    const subrubros = [
      { nombre: 'Comisión mantenimiento', monto: 800 },
      { nombre: 'Sellado de cheques', monto: 300 },
    ]
    const out = distribuirEnSlots(pares, subrubros, 1100)
    expect(out).toEqual([
      { descField: 'GASTOS F', montoField: 'Texto33', nombre: 'Comisión mantenimiento', monto: 800 },
      { descField: 'GASTOS G', montoField: 'Texto34', nombre: 'Sellado de cheques', monto: 300 },
    ])
  })

  it('3+ subrubros con 2 slots: el de mayor monto va solo, el resto se agrupa como "Varios" en el último slot', () => {
    const subrubros = [
      { nombre: 'Comisión mantenimiento', monto: 800 },
      { nombre: 'Sellado de cheques', monto: 300 },
      { nombre: 'IVA débitos', monto: 200 },
    ]
    const out = distribuirEnSlots(pares, subrubros, 1300)
    expect(out).toEqual([
      { descField: 'GASTOS F', montoField: 'Texto33', nombre: 'Comisión mantenimiento', monto: 800 },
      { descField: 'GASTOS G', montoField: 'Texto34', nombre: 'Varios', monto: 500 },
    ])
  })

  it('un solo slot (rubro "Otros" con 1 par) y 2+ subrubros: el mayor no se separa, todo se agrupa en "Varios"', () => {
    const unSlot = [['GASTOS D', 'Texto54']]
    const subrubros = [
      { nombre: 'A', monto: 500 },
      { nombre: 'B', monto: 200 },
    ]
    const out = distribuirEnSlots(unSlot, subrubros, 700)
    expect(out).toEqual([
      { descField: 'GASTOS D', montoField: 'Texto54', nombre: 'Varios', monto: 700 },
    ])
  })

  it('sin slots: no asigna nada', () => {
    expect(distribuirEnSlots([], [{ nombre: 'A', monto: 100 }], 100)).toEqual([])
  })
})
