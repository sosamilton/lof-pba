// Datos de ejemplo para el setup wizard (solo uso en desarrollo).
// Consumidos por SetupStore.fillDemoData() para precargar la UI de cada paso.

export const DEMO_MODULES = {
  solo_pia: false,
  gestion_integral: true,
  gestion_etapas: false,
  kiosco: false
}

export const DEMO_ESC_COOP = {
  escuela_nombre: 'Escuela de Educación Secundaria N° 12',
  escuela_numero: '12',
  cue: '0601234500',
  distrito: 'La Plata',
  cooperadora_nombre: 'Cooperadora Escolar EES N° 12',
  cuit: '30123456781',
  domicilio: 'Av. San Martín 1234',
  localidad: 'La Plata',
  email: 'cooperadora.ees12@gmail.com',
  email_escuela: 'ees12@abc.gob.ar',
  telefono_escuela: '9 221 4567-8901',
  telefono: '9 221 4567-8901',
  color_primario: '#16b378'
}

export const DEMO_BANCO = {
  entidad: 'Banco de la Provincia de Buenos Aires',
  tipo_cuenta: 'Cuenta corriente en pesos',
  sucursal: '0123',
  cuenta_corriente: '1234567890',
  cbu: '0140002101234567890126'
}

export const DEMO_KIOSCO = (currentYear) => ({
  posee: false,
  //modalidad: 'Licitado',
  //contrato_desde: `${currentYear}-03-01`,
  //contrato_hasta: `${currentYear + 1}-02-28`
})

export const DEMO_EJERCICIO = (currentYear) => ({
  mes_inicio: 'Marzo',
  anio_inicio: currentYear,
  anio_fin: currentYear + 1
})
