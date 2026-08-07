import { describe, it, expect } from 'vitest'
import {
  calcularSaldosPorCuenta,
  calcularSaldoTotal,
  totalesDesdeDetalle,
  saldosInicialesEnCero,
  saldoInicialEjercicio,
  cierresPorPeriodo,
  periodosConDetalle,
  calcularResumenMensual,
  calcularResumenSemanal,
  isoWeekKey,
  generarPeriodosEjercicio,
} from '../shared/tesoreriaCalc.js'

const cuentas = [
  { id: 1, nombre_cuenta: 'Banco' },
  { id: 2, nombre_cuenta: 'Efectivo' },
  { id: 3, nombre_cuenta: 'Caja Chica' },
]

const ejercicio = {
  id: 10,
  anio_inicio: 2026,
  anio_fin: 2027,
  mes_inicio: 'Marzo',
  saldo_inicial_banco: 1000,
  saldo_inicial_efectivo: 500,
  saldo_inicial_caja_chica: 100,
}

const mov = (overrides) => ({
  periodo: '2026-03',
  tipo_movimiento: 'Entrada',
  importe: 100,
  cuenta_id: 1,
  cuenta_destino_id: null,
  ...overrides,
})

describe('calcularSaldosPorCuenta', () => {
  it('inicializa con saldos iniciales del ejercicio', () => {
    const map = calcularSaldosPorCuenta(cuentas, ejercicio, [])
    expect(map.get(1)).toBe(1000)
    expect(map.get(2)).toBe(500)
    expect(map.get(3)).toBe(100)
  })

  it('suma Entradas a la cuenta', () => {
    const map = calcularSaldosPorCuenta(cuentas, ejercicio, [
      mov({ tipo_movimiento: 'Entrada', importe: 200, cuenta_id: 1 }),
    ])
    expect(map.get(1)).toBe(1200)
  })

  it('resta Salidas de la cuenta', () => {
    const map = calcularSaldosPorCuenta(cuentas, ejercicio, [
      mov({ tipo_movimiento: 'Salida', importe: 300, cuenta_id: 2 }),
    ])
    expect(map.get(2)).toBe(200)
  })

  it('Traspaso: resta de cuenta origen y suma a cuenta destino', () => {
    const map = calcularSaldosPorCuenta(cuentas, ejercicio, [
      mov({ tipo_movimiento: 'Traspaso', importe: 250, cuenta_id: 1, cuenta_destino_id: 2 }),
    ])
    expect(map.get(1)).toBe(750)  // 1000 - 250
    expect(map.get(2)).toBe(750)  // 500 + 250
    // Saldo total no cambia con traspaso
    expect(calcularSaldoTotal(map)).toBe(1600)
  })

  it('saldo total = suma de todos los saldos', () => {
    const map = calcularSaldosPorCuenta(cuentas, ejercicio, [
      mov({ tipo_movimiento: 'Entrada', importe: 100, cuenta_id: 1 }),
      mov({ tipo_movimiento: 'Salida', importe: 50, cuenta_id: 3 }),
    ])
    expect(calcularSaldoTotal(map)).toBe(1000 + 100 + 500 + 100 - 50)
  })

  it('cuenta sin saldo_inicial conocido arranca en 0', () => {
    const map = calcularSaldosPorCuenta(
      [{ id: 4, nombre_cuenta: 'Inversiones' }],
      ejercicio,
      []
    )
    expect(map.get(4)).toBe(0)
  })
})

describe('totalesDesdeDetalle', () => {
  it('suma Entradas y Salidas del período', () => {
    const movs = [
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 200 }),
      mov({ periodo: '2026-03', tipo_movimiento: 'Salida', importe: 50 }),
      mov({ periodo: '2026-04', tipo_movimiento: 'Entrada', importe: 999 }),
    ]
    const t = totalesDesdeDetalle(movs, '2026-03')
    expect(t.ingresos).toBe(300)
    expect(t.egresos).toBe(50)
  })

  it('Traspaso no cuenta como ingreso ni egreso', () => {
    const movs = [
      mov({ periodo: '2026-03', tipo_movimiento: 'Traspaso', importe: 500 }),
    ]
    const t = totalesDesdeDetalle(movs, '2026-03')
    expect(t.ingresos).toBe(0)
    expect(t.egresos).toBe(0)
  })
})

describe('saldosInicialesEnCero', () => {
  it('true si los 3 saldos están en 0 y hay movimientos', () => {
    expect(saldosInicialesEnCero(
      { saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 },
      [mov()]
    )).toBe(true)
  })

  it('false si algún saldo inicial no es 0', () => {
    expect(saldosInicialesEnCero(
      { saldo_inicial_banco: 100, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 },
      [mov()]
    )).toBe(false)
  })

  it('false si no hay movimientos', () => {
    expect(saldosInicialesEnCero(
      { saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 },
      []
    )).toBe(false)
  })
})

describe('saldoInicialEjercicio', () => {
  it('suma los 3 saldos iniciales', () => {
    expect(saldoInicialEjercicio(ejercicio)).toBe(1600)
  })
  it('0 si no hay ejercicio', () => {
    expect(saldoInicialEjercicio(null)).toBe(0)
  })
})

describe('regla "detalle gana" (calcularResumenMensual)', () => {
  it('usa movimientos cuando hay detalle, ignora cierre manual', () => {
    const movs = [
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
      mov({ periodo: '2026-03', tipo_movimiento: 'Salida', importe: 30 }),
    ]
    const cierres = [
      { ejercicio_id: 10, periodo: '2026-03', es_carga_manual: true, total_ingresos_calc: 9999, total_egresos_calc: 8888 },
    ]
    const rows = calcularResumenMensual(movs, cierres, ejercicio)
    const mar = rows.find((r) => r.periodo === '2026-03')
    expect(mar).toBeDefined()
    expect(mar.origen).toBe('detalle')
    expect(mar.ingresos).toBe(100)
    expect(mar.egresos).toBe(30)
  })

  it('usa cierre manual cuando no hay detalle', () => {
    const cierres = [
      { ejercicio_id: 10, periodo: '2026-04', es_carga_manual: true, total_ingresos_calc: 500, total_egresos_calc: 200 },
    ]
    const rows = calcularResumenMensual([], cierres, ejercicio)
    const abr = rows.find((r) => r.periodo === '2026-04')
    expect(abr).toBeDefined()
    expect(abr.origen).toBe('manual')
    expect(abr.ingresos).toBe(500)
    expect(abr.egresos).toBe(200)
  })

  it('ignora cierres que no son del ejercicio seleccionado', () => {
    const cierres = [
      { ejercicio_id: 99, periodo: '2026-04', es_carga_manual: true, total_ingresos_calc: 500, total_egresos_calc: 200 },
    ]
    const rows = calcularResumenMensual([], cierres, ejercicio)
    const abr = rows.find((r) => r.periodo === '2026-04')
    expect(abr).toBeDefined()
    expect(abr.origen).toBe('vacio')
    expect(abr.ingresos).toBe(0)
  })

  it('ignora cierres sin es_carga_manual=true', () => {
    const cierres = [
      { ejercicio_id: 10, periodo: '2026-04', es_carga_manual: false, total_ingresos_calc: 500, total_egresos_calc: 200 },
    ]
    const rows = calcularResumenMensual([], cierres, ejercicio)
    const abr = rows.find((r) => r.periodo === '2026-04')
    expect(abr).toBeDefined()
    expect(abr.origen).toBe('vacio')
    expect(abr.ingresos).toBe(0)
  })
})

describe('arrastre de saldo (calcularResumenMensual)', () => {
  it('primer período usa saldo_inicial_* del ejercicio', () => {
    const movs = [
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
    ]
    const rows = calcularResumenMensual(movs, [], ejercicio)
    expect(rows[0].saldoInicial).toBe(1600)
    expect(rows[0].saldoPeriodo).toBe(1700)
  })

  it('segundo período arranca con el saldo final del primero', () => {
    const movs = [
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
      mov({ periodo: '2026-04', tipo_movimiento: 'Salida', importe: 50 }),
    ]
    const rows = calcularResumenMensual(movs, [], ejercicio)
    expect(rows[0].saldoInicial).toBe(1600)
    expect(rows[0].saldoPeriodo).toBe(1700)
    expect(rows[1].saldoInicial).toBe(1700)
    expect(rows[1].saldoPeriodo).toBe(1650)
  })

  it('3 períodos encadenan arrastre correctamente', () => {
    const movs = [
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
      mov({ periodo: '2026-04', tipo_movimiento: 'Entrada', importe: 200 }),
      mov({ periodo: '2026-05', tipo_movimiento: 'Salida', importe: 50 }),
    ]
    const rows = calcularResumenMensual(movs, [], ejercicio)
    expect(rows[0].saldoPeriodo).toBe(1700)
    expect(rows[1].saldoInicial).toBe(1700)
    expect(rows[1].saldoPeriodo).toBe(1900)
    expect(rows[2].saldoInicial).toBe(1900)
    expect(rows[2].saldoPeriodo).toBe(1850)
  })
})

describe('isoWeekKey', () => {
  it('calcula semana ISO correctamente', () => {
    // 2026-01-01 es jueves → semana 01 de 2026
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
  })
  it('devuelve string vacío para fecha inválida', () => {
    expect(isoWeekKey('')).toBe('')
    expect(isoWeekKey('not-a-date')).toBe('')
  })
})

describe('calcularResumenSemanal', () => {
  it('agrupa por semana y arranca con saldo inicial del ejercicio', () => {
    const movs = [
      mov({ fecha: '2026-03-02', periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
      mov({ fecha: '2026-03-09', periodo: '2026-03', tipo_movimiento: 'Salida', importe: 30 }),
    ]
    const rows = calcularResumenSemanal(movs, ejercicio)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].saldoInicial).toBe(1600)
    expect(rows[0].origen).toBe('detalle')
  })
})

describe('periodosConDetalle', () => {
  it('devuelve set de períodos con movimientos', () => {
    const set = periodosConDetalle([
      mov({ periodo: '2026-03' }),
      mov({ periodo: '2026-03' }),
      mov({ periodo: '2026-04' }),
    ])
    expect(set.size).toBe(2)
    expect(set.has('2026-03')).toBe(true)
    expect(set.has('2026-04')).toBe(true)
  })
})

describe('cierresPorPeriodo', () => {
  it('filtra por ejercicio y es_carga_manual', () => {
    const cierres = [
      { ejercicio_id: 10, periodo: '2026-03', es_carga_manual: true },
      { ejercicio_id: 10, periodo: '2026-04', es_carga_manual: false },
      { ejercicio_id: 99, periodo: '2026-05', es_carga_manual: true },
    ]
    const map = cierresPorPeriodo(cierres, 10)
    expect(map.size).toBe(1)
    expect(map.has('2026-03')).toBe(true)
  })
})

describe('generarPeriodosEjercicio', () => {
  it('genera 12 períodos para ejercicio Marzo 2026 → Febrero 2027', () => {
    const ej = { id: 1, anio_inicio: 2026, anio_fin: 2027, mes_inicio: 'Marzo' }
    const periodos = generarPeriodosEjercicio(ej)
    expect(periodos).toHaveLength(12)
    expect(periodos[0]).toBe('2026-03')
    expect(periodos[periodos.length - 1]).toBe('2027-02')
  })

  it('genera 12 períodos para ejercicio Enero 2026 → Diciembre 2026', () => {
    const ej = { id: 1, anio_inicio: 2026, anio_fin: 2027, mes_inicio: 'Enero' }
    const periodos = generarPeriodosEjercicio(ej)
    expect(periodos).toHaveLength(12)
    expect(periodos[0]).toBe('2026-01')
    expect(periodos[periodos.length - 1]).toBe('2026-12')
  })

  it('devuelve array vacío si no hay ejercicio', () => {
    expect(generarPeriodosEjercicio(null)).toEqual([])
  })
})

describe('calcularResumenMensual: períodos fuera del ejercicio', () => {
  it('ignora movimientos con períodos fuera del rango del ejercicio', () => {
    const ej = { id: 10, anio_inicio: 2026, anio_fin: 2027, mes_inicio: 'Marzo',
      saldo_inicial_banco: 1000, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0 }
    const movs = [
      mov({ periodo: '2026-01', tipo_movimiento: 'Entrada', importe: 500 }),
      mov({ periodo: '2026-02', tipo_movimiento: 'Entrada', importe: 300 }),
      mov({ periodo: '2026-03', tipo_movimiento: 'Entrada', importe: 100 }),
    ]
    const rows = calcularResumenMensual(movs, [], ej)
    expect(rows).toHaveLength(12)
    expect(rows[0].periodo).toBe('2026-03')
    expect(rows[0].ingresos).toBe(100)
    expect(rows[1].periodo).toBe('2026-04')
    expect(rows[1].origen).toBe('vacio')
  })
})
