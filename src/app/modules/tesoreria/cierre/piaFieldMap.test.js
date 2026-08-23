import { describe, it, expect } from 'vitest'
import { distribuirEnSlots, buildPiaFieldMap } from './piaFieldMap'

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

describe('buildPiaFieldMap - RESUMEN ANUAL (Texto44-48)', () => {
  // Datos mínimos para que buildPiaFieldMap no falle
  const baseData = {
    escuela: {}, banco: null, ejercicio: {}, asamblea: null,
    autoridadesCD: [], autoridadesCRC: [], autoridadesFed: [],
    cargosMap: new Map(), rubros: [], subrubros: [],
    totalesPorRubro: new Map(), totalesPorSubrubro: new Map(),
    kiosco: null, totalSocios: 0, sociosActivos: 0, sociosHonorarios: 0, sociosAdherentes: 0,
  }

  it('llena Texto44-48 con los totales del resumen anual', () => {
    const fields = buildPiaFieldMap({
      ...baseData,
      totalEntradas: 10000,
      totalSalidas: 6000,
      saldoEjercicioAnterior: 2000,
      saldoBanco: 6000,
      saldoEfectivo: 500,
    })
    // Texto44 = TOTAL ENTRADAS (resumen)
    expect(fields['Texto44']).toBe('10.000,00')
    // Texto45 = SALDO EJERCICIO ANTERIOR
    expect(fields['Texto45']).toBe('2.000,00')
    // Texto46 = TOTAL GENERAL (entradas + saldo anterior)
    expect(fields['Texto46']).toBe('12.000,00')
    // Texto47 = TOTAL SALIDAS (resumen)
    expect(fields['Texto47']).toBe('6.000,00')
    // Texto48 = SALDO PROXIMO (total general - total salidas)
    expect(fields['Texto48']).toBe('6.000,00')
  })

  it('con saldo anterior 0: TOTAL GENERAL = TOTAL ENTRADAS', () => {
    const fields = buildPiaFieldMap({
      ...baseData,
      totalEntradas: 5000,
      totalSalidas: 3000,
      saldoEjercicioAnterior: 0,
      saldoBanco: 2000,
      saldoEfectivo: 0,
    })
    expect(fields['Texto44']).toBe('5.000,00')
    expect(fields['Texto45']).toBe('')
    expect(fields['Texto46']).toBe('5.000,00')
    expect(fields['Texto47']).toBe('3.000,00')
    expect(fields['Texto48']).toBe('2.000,00')
  })
})

describe('buildPiaFieldMap - GP-OTROS con 2 slots (GASTOS D/E)', () => {
  const rubroGpOtros = {
    id: 100, codigo_rubro: 'GP-OTROS', campo_pdf: 'GASTOS D|Texto54;GASTOS E|Texto55',
  }
  const baseData = {
    escuela: {}, banco: null, ejercicio: {}, asamblea: null,
    autoridadesCD: [], autoridadesCRC: [], autoridadesFed: [],
    cargosMap: new Map(), totalesPorRubro: new Map(), totalesPorSubrubro: new Map(),
    kiosco: null, totalSocios: 0, sociosActivos: 0, sociosHonorarios: 0, sociosAdherentes: 0,
    totalEntradas: 0, totalSalidas: 0, saldoEjercicioAnterior: 0,
    saldoBanco: 0, saldoEfectivo: 0,
  }

  it('2 subrubros: uno en GASTOS D, otro en GASTOS E', () => {
    const subrubros = [
      { id: 1, rubro_id: 100, nombre_subrubro: 'Impuestos bancarios' },
      { id: 2, rubro_id: 100, nombre_subrubro: 'Mantenimiento' },
    ]
    const totalesPorSubrubro = new Map([[1, 5000], [2, 2000]])
    const fields = buildPiaFieldMap({
      ...baseData, rubros: [rubroGpOtros], subrubros,
      totalesPorSubrubro,
    })
    expect(fields['GASTOS D']).toBe('Impuestos bancarios')
    expect(fields['Texto54']).toBe('5.000,00')
    expect(fields['GASTOS E']).toBe('Mantenimiento')
    expect(fields['Texto55']).toBe('2.000,00')
  })

  it('3 subrubros: top 1 individual, resto agrupado como Varios en GASTOS E', () => {
    const subrubros = [
      { id: 1, rubro_id: 100, nombre_subrubro: 'Impuestos bancarios' },
      { id: 2, rubro_id: 100, nombre_subrubro: 'Mantenimiento' },
      { id: 3, rubro_id: 100, nombre_subrubro: 'Papelería' },
    ]
    const totalesPorSubrubro = new Map([[1, 5000], [2, 2000], [3, 1000]])
    const fields = buildPiaFieldMap({
      ...baseData, rubros: [rubroGpOtros], subrubros,
      totalesPorSubrubro,
    })
    expect(fields['GASTOS D']).toBe('Impuestos bancarios')
    expect(fields['Texto54']).toBe('5.000,00')
    expect(fields['GASTOS E']).toBe('Varios')
    expect(fields['Texto55']).toBe('3.000,00')
  })
})
