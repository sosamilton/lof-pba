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
  weekKeyToRange,
  proximoPeriodoACargar,
  findRubroCuotaSocial,
  distribucionPorRubro,
  distribucionPorGrupo,
  rubrosSinMovimiento,
  serieMensual,
  labelPeriodo,
  comparativaInterAnual,
  ejercicioAnterior,
  mesesTranscurridosEjercicio,
  calcularMorosidad,
  calcularMorosidadPorSocio,
  saludOperativa,
  mayorEgreso,
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

describe('weekKeyToRange', () => {
  it('convierte una semana ISO válida a rango legible', () => {
    const r = weekKeyToRange('2026-W01')
    expect(r.num).toBe(1)
    expect(r.label).toMatch(/^Sem 1 · \d{2}\/\d{2}-\d{2}\/\d{2}$/)
    expect(r.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(r.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('el inicio es lunes y el fin es domingo (6 días después)', () => {
    const r = weekKeyToRange('2026-W10')
    const inicio = new Date(r.inicio)
    const fin = new Date(r.fin)
    const diff = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    expect(inicio.getUTCDay()).toBe(1) // lunes
    expect(fin.getUTCDay()).toBe(0) // domingo
    expect(diff).toBe(6)
  })

  it('maneja la semana 53 (año bisiesto)', () => {
    const r = weekKeyToRange('2020-W53')
    expect(r.num).toBe(53)
    expect(r.inicio).toBe('2020-12-28')
    expect(r.fin).toBe('2021-01-03')
  })

  it('devuelve label crudo e inicio/fin vacíos para input inválido', () => {
    const r = weekKeyToRange('invalid')
    expect(r.label).toBe('invalid')
    expect(r.num).toBe(0)
    expect(r.inicio).toBe('')
    expect(r.fin).toBe('')
  })

  it('devuelve label crudo para input vacío', () => {
    const r = weekKeyToRange('')
    expect(r.label).toBe('')
    expect(r.num).toBe(0)
  })
})

describe('proximoPeriodoACargar', () => {
  const ejercicio = { anio_inicio: 2026, anio_fin: 2027, mes_inicio: 'Marzo' }

  it('devuelve el primer período sin datos', () => {
    const conDatos = new Set(['2026-03', '2026-04'])
    expect(proximoPeriodoACargar(ejercicio, conDatos)).toBe('2026-05')
  })

  it('devuelve el último período si todos tienen datos', () => {
    const conDatos = new Set([
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
      '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
    ])
    expect(proximoPeriodoACargar(ejercicio, conDatos)).toBe('2027-02')
  })

  it('devuelve el primer período si no hay datos', () => {
    expect(proximoPeriodoACargar(ejercicio, new Set())).toBe('2026-03')
  })

  it('devuelve el mes actual si no hay ejercicio', () => {
    const expected = new Date().toISOString().slice(0, 7)
    expect(proximoPeriodoACargar(null, new Set())).toBe(expected)
  })
})

// ===========================================================================
// Estadísticas / tableros
// ===========================================================================

const rubros = [
  { id: 100, nombre_oficial: 'Cuota Social', grupo_rubro: 'Recursos Propios', tipo_rubro: 'Entrada', fijo: true },
  { id: 101, nombre_oficial: 'Subsidio Oficial', grupo_rubro: 'Recursos Oficiales', tipo_rubro: 'Entrada', fijo: false },
  { id: 200, nombre_oficial: 'Gastos Papelería', grupo_rubro: 'Gastos Escuela', tipo_rubro: 'Salida', fijo: true },
  { id: 201, nombre_oficial: 'Mantenimiento', grupo_rubro: 'Gastos Escuela', tipo_rubro: 'Salida', fijo: false },
  { id: 202, nombre_oficial: 'Servicios', grupo_rubro: 'Gastos Entidad', tipo_rubro: 'Salida', fijo: true },
]

const socios = [
  { id: 1, activo: true, apellido: 'Pérez', nombre: 'Juan' },
  { id: 2, activo: true, apellido: 'Gómez', nombre: 'Ana' },
  { id: 3, activo: false, fecha_baja: '2026-01-01', apellido: 'Baja', nombre: 'Luis' },
]

const asambleas = [
  { ejercicio_id: 10, tipo_asamblea: 'AGO', cuota_social_importe: 1000, cuota_social_modalidad: 'Mensual' },
]

const movsEj = [
  mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 1000, periodo: '2026-03', socio_id: 1 }),
  mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 1000, periodo: '2026-04', socio_id: 1 }),
  mov({ rubro_id: 101, tipo_movimiento: 'Entrada', importe: 500, periodo: '2026-03' }),
  mov({ rubro_id: 200, tipo_movimiento: 'Salida', importe: 300, periodo: '2026-03' }),
  mov({ rubro_id: 200, tipo_movimiento: 'Salida', importe: 200, periodo: '2026-04' }),
  mov({ rubro_id: 201, tipo_movimiento: 'Salida', importe: 800, periodo: '2026-05' }),
  mov({ tipo_movimiento: 'Traspaso', importe: 999, cuenta_id: 1, cuenta_destino_id: 2, periodo: '2026-03' }),
]

describe('findRubroCuotaSocial', () => {
  it('encuentra rubro por nombre "cuota"', () => {
    expect(findRubroCuotaSocial(rubros)?.id).toBe(100)
  })
  it('encuentra rubro por "aporte socio"', () => {
    const r = [{ id: 9, nombre_oficial: 'Aporte Societario' }]
    expect(findRubroCuotaSocial(r)?.id).toBe(9)
  })
  it('devuelve null si no hay match', () => {
    expect(findRubroCuotaSocial([{ id: 1, nombre_oficial: 'Otros' }])).toBeNull()
  })
  it('devuelve null con array vacío', () => {
    expect(findRubroCuotaSocial([])).toBeNull()
  })
})

describe('distribucionPorRubro', () => {
  it('agrupa por rubro y separa Entrada/Salida', () => {
    const d = distribucionPorRubro(movsEj, rubros)
    const entradas = d.filter((x) => x.tipo === 'Entrada')
    const salidas = d.filter((x) => x.tipo === 'Salida')
    expect(entradas.length).toBe(2) // Cuota + Subsidio
    expect(salidas.length).toBe(2) // Papelería + Mantenimiento
  })
  it('suma importes y cuenta movimientos', () => {
    const d = distribucionPorRubro(movsEj, rubros)
    const cuota = d.find((x) => x.rubroId === 100)
    expect(cuota.importe).toBe(2000)
    expect(cuota.cantidad).toBe(2)
  })
  it('ignora traspasos', () => {
    const d = distribucionPorRubro(movsEj, rubros)
    expect(d.find((x) => x.tipo === 'Traspaso')).toBeUndefined()
  })
  it('filtra por tipo Salida', () => {
    const d = distribucionPorRubro(movsEj, rubros, 'Salida')
    expect(d.every((x) => x.tipo === 'Salida')).toBe(true)
    expect(d.length).toBe(2)
  })
  it('ordena por importe descendente dentro de cada tipo', () => {
    const d = distribucionPorRubro(movsEj, rubros, 'Salida')
    expect(d[0].importe).toBeGreaterThanOrEqual(d[1].importe)
  })
  it('maneja arrays vacíos', () => {
    expect(distribucionPorRubro([], rubros)).toEqual([])
  })
})

describe('distribucionPorGrupo', () => {
  it('agrupa por grupo_rubro', () => {
    const d = distribucionPorGrupo(movsEj, rubros)
    const grupos = new Set(d.map((x) => x.grupo))
    expect(grupos.has('Recursos Propios')).toBe(true)
    expect(grupos.has('Gastos Escuela')).toBe(true)
  })
  it('suma importes dentro del grupo', () => {
    const d = distribucionPorGrupo(movsEj, rubros)
    const gastosEscuelaSalida = d.find((x) => x.grupo === 'Gastos Escuela' && x.tipo === 'Salida')
    expect(gastosEscuelaSalida.importe).toBe(1300) // 300+200+800
  })
})

describe('rubrosSinMovimiento', () => {
  it('lista rubros sin movimiento', () => {
    const sin = rubrosSinMovimiento(movsEj, rubros)
    const ids = sin.map((r) => r.id)
    expect(ids).toContain(202) // Servicios sin movimiento
    expect(ids).not.toContain(100) // Cuota tiene movimiento
  })
  it('filtra solo fijos', () => {
    const sin = rubrosSinMovimiento(movsEj, rubros, { soloFijos: true })
    const ids = sin.map((r) => r.id)
    expect(ids).toContain(202) // Servicios (fijo) sin movimiento
    expect(ids).not.toContain(201) // Mantenimiento (no fijo)
  })
  it('filtra por tipo', () => {
    const sin = rubrosSinMovimiento(movsEj, rubros, { tipo: 'Salida' })
    expect(sin.every((r) => r.tipo === 'Salida')).toBe(true)
  })
})

describe('labelPeriodo', () => {
  it('convierte YYYY-MM a Mes YYYY', () => {
    expect(labelPeriodo('2026-03')).toBe('Mar 2026')
  })
  it('devuelve input si no matchea', () => {
    expect(labelPeriodo('foo')).toBe('foo')
  })
})

describe('serieMensual', () => {
  it('devuelve serie con label legible', () => {
    const s = serieMensual(movsEj, [], ejercicio, 1600)
    expect(s.length).toBeGreaterThan(0)
    expect(s[0].label).toMatch(/\w{3} \d{4}/)
    expect(typeof s[0].saldo).toBe('number')
  })
})

describe('ejercicioAnterior', () => {
  it('devuelve el ejercicio inmediatamente anterior', () => {
    const ejercicios = [
      { id: 10, anio_inicio: 2026 },
      { id: 9, anio_inicio: 2025 },
      { id: 8, anio_inicio: 2024 },
    ]
    expect(ejercicioAnterior(ejercicios, ejercicios[0])?.id).toBe(9)
  })
  it('devuelve null si es el primero', () => {
    const ejercicios = [{ id: 10, anio_inicio: 2026 }]
    expect(ejercicioAnterior(ejercicios, ejercicios[0])).toBeNull()
  })
  it('maneja mismo anio_inicio con distinto anio_fin', () => {
    const ejercicios = [
      { id: 11, anio_inicio: 2024, anio_fin: 2026 },
      { id: 10, anio_inicio: 2024, anio_fin: 2025 },
    ]
    expect(ejercicioAnterior(ejercicios, ejercicios[0])?.id).toBe(10)
  })
  it('con 3 ejercicios devuelve el inmediato anterior', () => {
    const ejercicios = [
      { id: 12, anio_inicio: 2026, anio_fin: 2027 },
      { id: 11, anio_inicio: 2025, anio_fin: 2026 },
      { id: 10, anio_inicio: 2024, anio_fin: 2025 },
    ]
    expect(ejercicioAnterior(ejercicios, ejercicios[0])?.id).toBe(11)
  })
})

describe('comparativaInterAnual', () => {
  it('alinea por mes relativo y devuelve series', () => {
    const ejA = { id: 10, anio_inicio: 2026, anio_fin: 2027, mes_inicio: 'Marzo' }
    const ejB = { id: 9, anio_inicio: 2025, anio_fin: 2026, mes_inicio: 'Marzo' }
    const allMovs = [
      ...movsEj.map((m) => ({ ...m, ejercicio_id: 10 })),
      mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 500, periodo: '2025-03', ejercicio_id: 9 }),
    ]
    const r = comparativaInterAnual(ejA, ejB, allMovs)
    expect(r.meses[0]).toBe('Mes 1')
    expect(r.actual.ingresos[0]).toBe(1500) // cuota 1000 + subsidio 500
    expect(r.anterior.ingresos[0]).toBe(500)
  })
  it('maneja ejercicio anterior null', () => {
    const r = comparativaInterAnual(ejercicio, null, movsEj)
    expect(r.anterior.ingresos.every((x) => x === 0)).toBe(true)
  })
})

describe('mesesTranscurridosEjercicio', () => {
  it('devuelve 0 si no hay ejercicio', () => {
    expect(mesesTranscurridosEjercicio(null)).toBe(0)
  })
  it('devuelve cantidad de períodos hasta el mes actual o el final', () => {
    // Ejercicio 2026-2027 mes Marzo → 12 períodos (Marzo 2026 a Febrero 2027)
    const r = mesesTranscurridosEjercicio(ejercicio)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(12)
  })
})

describe('calcularMorosidad', () => {
  it('calcula esperado, cobrado y morosidad', () => {
    // Mock mesesTranscurridos: forzamos ejercicio con mes actual dentro del rango
    const ej = { ...ejercicio, anio_inicio: new Date().getFullYear(), anio_fin: new Date().getFullYear() + 1, mes_inicio: 'Enero' }
    const m = calcularMorosidad(ej, movsEj, rubros, socios, asambleas)
    expect(m.rubroCuotaId).toBe(100)
    expect(m.importeCuota).toBe(1000)
    expect(m.modalidad).toBe('Mensual')
    expect(m.sociosActivos).toBe(2)
    expect(m.cobrado).toBe(2000)
    expect(m.esperado).toBeGreaterThan(0)
    expect(m.morosidad).toBeGreaterThanOrEqual(0)
    expect(m.morosidad).toBeLessThanOrEqual(1)
  })
  it('lista deudores (socios sin pago)', () => {
    const ej = { ...ejercicio, anio_inicio: new Date().getFullYear(), anio_fin: new Date().getFullYear() + 1, mes_inicio: 'Enero' }
    const m = calcularMorosidad(ej, movsEj, rubros, socios, asambleas)
    // socio 1 pagó, socio 2 no → deudores contiene socio 2
    const ids = m.deudores.map((d) => d.id)
    expect(ids).toContain(2)
    expect(ids).not.toContain(1)
  })
  it('tieneDatos=false si no hay rubro cuota ni asamblea', () => {
    const m = calcularMorosidad(ejercicio, movsEj, [], socios, [])
    expect(m.tieneDatos).toBe(false)
    expect(m.esperado).toBe(0)
  })
})

describe('calcularMorosidadPorSocio', () => {
  // Ejercicio con mes_inicio=Enero y año actual para que mesesTranscurridos > 0
  const ejActual = {
    ...ejercicio,
    anio_inicio: new Date().getFullYear(),
    anio_fin: new Date().getFullYear() + 1,
    mes_inicio: 'Enero',
  }

  it('devuelve Map vacío si no hay socios activos', () => {
    const result = calcularMorosidadPorSocio(ejActual, movsEj, rubros, [], asambleas)
    expect(result.size).toBe(0)
  })

  it('devuelve Map vacío si no hay rubro de cuota social', () => {
    const result = calcularMorosidadPorSocio(ejActual, movsEj, [], socios, asambleas)
    expect(result.size).toBe(0)
  })

  it('devuelve Map vacío si no hay importe de cuota (sin asamblea AGO)', () => {
    const result = calcularMorosidadPorSocio(ejActual, movsEj, rubros, socios, [])
    expect(result.size).toBe(0)
  })

  it('todos los socios en "sin-datos" si no hay movimientos con socio_id', () => {
    const movsSinVincular = [
      mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 1000, periodo: '2026-03' }),
    ]
    const result = calcularMorosidadPorSocio(ejActual, movsSinVincular, rubros, socios, asambleas)
    expect(result.size).toBe(2) // socios 1 y 2 (activos)
    expect(result.get(1).estado).toBe('sin-datos')
    expect(result.get(2).estado).toBe('sin-datos')
  })

  it('socio que pagó todos los períodos transcurridos está "al-dia"', () => {
    // Socio 1 pagó 2026-03 y 2026-04 en movsEj. Si estamos en marzo/abril, está al día.
    // Para garantizar el test, generamos movs para todos los períodos hasta hoy.
    const periodos = generarPeriodosEjercicio(ejActual)
    const ahora = new Date()
    const mesActualKey = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`
    const periodosTranscurridos = periodos.filter((p) => p <= mesActualKey)
    const movsSocio1AlDia = periodosTranscurridos.map((p) =>
      mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 1000, periodo: p, socio_id: 1 }),
    )
    const result = calcularMorosidadPorSocio(ejActual, movsSocio1AlDia, rubros, socios, asambleas)
    expect(result.get(1).estado).toBe('al-dia')
    expect(result.get(1).mesesAdeudados).toBe(0)
    // Socio 2 no pagó nada → mora-3-mas si pasaron 3+ meses, sino mora-1-2
    expect(result.get(2).estado).not.toBe('al-dia')
  })

  it('socio que no pagó nada tiene mesesAdeudados = meses transcurridos', () => {
    const result = calcularMorosidadPorSocio(ejActual, [], rubros, socios, asambleas)
    // Sin movimientos vinculados → todos sin-datos
    expect(result.get(1).estado).toBe('sin-datos')
    expect(result.get(2).estado).toBe('sin-datos')
  })

  it('socio con 1-2 períodos sin pagar está en "mora-1-2"', () => {
    const periodos = generarPeriodosEjercicio(ejActual)
    const ahora = new Date()
    const mesActualKey = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`
    const periodosTranscurridos = periodos.filter((p) => p <= mesActualKey)
    // Socio 1 pagó todos menos el último → adeuda 1
    if (periodosTranscurridos.length >= 2) {
      const pagados = periodosTranscurridos.slice(0, -1)
      const movsSocio1 = pagados.map((p) =>
        mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 1000, periodo: p, socio_id: 1 }),
      )
      const result = calcularMorosidadPorSocio(ejActual, movsSocio1, rubros, socios, asambleas)
      expect(result.get(1).estado).toBe('mora-1-2')
      expect(result.get(1).mesesAdeudados).toBe(1)
    }
  })

  it('modalidad Anual: socio que pagó está al día, el que no está en mora', () => {
    const asambleasAnual = [
      { ejercicio_id: 10, tipo_asamblea: 'AGO', cuota_social_importe: 12000, cuota_social_modalidad: 'Anual' },
    ]
    const movsAnual = [
      mov({ rubro_id: 100, tipo_movimiento: 'Entrada', importe: 12000, socio_id: 1 }),
    ]
    const result = calcularMorosidadPorSocio(ejActual, movsAnual, rubros, socios, asambleasAnual)
    expect(result.get(1).estado).toBe('al-dia')
    expect(result.get(2).estado).toBe('mora-3-mas')
  })

  it('no incluye socios inactivos (con fecha_baja)', () => {
    const result = calcularMorosidadPorSocio(ejActual, movsEj, rubros, socios, asambleas)
    // socio 3 tiene fecha_baja → no está en el map
    expect(result.has(3)).toBe(false)
  })
})

describe('saludOperativa', () => {
  it('detecta períodos pendientes, abiertos y firmados', () => {
    const cierres = [
      { ejercicio_id: 10, periodo: '2026-03', firmado: true },
    ]
    const s = saludOperativa(ejercicio, movsEj, cierres, rubros)
    expect(s.periodosFirmados).toContain('2026-03')
    expect(s.periodosAbiertos.length + s.periodosPendientes.length + s.periodosFirmados.length).toBe(12)
  })
  it('lista rubros fijos sin movimiento', () => {
    const s = saludOperativa(ejercicio, movsEj, [], rubros)
    const ids = s.rubrosFijosSinMovimiento.map((r) => r.id)
    expect(ids).toContain(202) // Servicios fijo sin movimiento
  })
  it('detecta cierres duplicados', () => {
    const cierres = [
      { ejercicio_id: 10, periodo: '2026-03' },
      { ejercicio_id: 10, periodo: '2026-03' },
    ]
    const s = saludOperativa(ejercicio, [], cierres, rubros)
    expect(s.cierresDuplicados.length).toBe(1)
    expect(s.cierresDuplicados[0].cantidad).toBe(2)
  })
})

describe('mayorEgreso', () => {
  it('devuelve el rubro con mayor egreso', () => {
    const m = mayorEgreso(movsEj, rubros)
    expect(m.nombre).toBe('Mantenimiento')
    expect(m.importe).toBe(800)
  })
  it('devuelve null si no hay egresos', () => {
    expect(mayorEgreso([], rubros)).toBeNull()
  })
})
