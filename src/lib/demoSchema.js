export const REQUIRED_TABLES = [
  {
    key: 'escuela',
    label: 'Escuela',
    tableId: 'escuela',
    preferredIds: ['Escuela', 'escuela'],
    columns: [
      { id: 'distrito', type: 'Text' },
      { id: 'escuela_nombre', type: 'Text' },
      { id: 'escuela_numero', type: 'Text' },
      { id: 'cue', type: 'Text' },
      { id: 'cuit', type: 'Text' },
      { id: 'cooperadora_nombre', type: 'Text' },
      { id: 'domicilio', type: 'Text' },
      { id: 'localidad', type: 'Text' },
      { id: 'email_cooperadora', type: 'Text' },
      { id: 'telefono_cooperadora', type: 'Text' }
    ]
  },
  {
    key: 'datos_banco',
    label: 'Datos banco',
    tableId: 'datos_banco',
    preferredIds: ['Datos_banco', 'datos_banco', 'DatosBanco'],
    columns: [
      { id: 'entidad', type: 'Text' },
      { id: 'cbu', type: 'Text' },
      { id: 'cuenta_corriente', type: 'Text' }
    ]
  },
  {
    key: 'kiosco_libreria',
    label: 'Kiosco/Librería',
    tableId: 'kiosco_libreria',
    preferredIds: ['Kiosco_libreria', 'kiosco_libreria', 'KioscoLibreria'],
    columns: [
      { id: 'posee', type: 'Toggle' },
      { id: 'modalidad', type: 'Text' }
    ]
  },
  {
    key: 'ejercicios',
    label: 'Ejercicios',
    tableId: 'ejercicios',
    preferredIds: ['Ejercicios', 'ejercicios'],
    columns: [
      { id: 'anio_inicio', type: 'Integer' },
      { id: 'anio_fin', type: 'Integer' },
      { id: 'mes_inicio', type: 'Text' },
      { id: 'saldo_inicial_banco', type: 'Numeric' },
      { id: 'saldo_inicial_efectivo', type: 'Numeric' },
      { id: 'saldo_inicial_caja_chica', type: 'Numeric' },
      { id: 'en_curso', type: 'Toggle' }
    ]
  },
  {
    key: 'cargos',
    label: 'Cargos',
    tableId: 'cargos',
    preferredIds: ['Cargos', 'cargos'],
    columns: [
      { id: 'organismo', type: 'Text' },
      { id: 'nombre_cargo', type: 'Text' },
      { id: 'nivel', type: 'Text' },
      { id: 'orden', type: 'Integer' },
      { id: 'cargo_obligatorio', type: 'Toggle' },
      { id: 'activo', type: 'Toggle' }
    ]
  },
  {
    key: 'personas',
    label: 'Personas',
    tableId: 'personas',
    preferredIds: ['Personas', 'personas'],
    columns: [
      { id: 'dni', type: 'Text' },
      { id: 'cuil', type: 'Text' },
      { id: 'apellido', type: 'Text' },
      { id: 'nombre', type: 'Text' },
      { id: 'domicilio', type: 'Text' },
      { id: 'localidad', type: 'Text' },
      { id: 'telefono', type: 'Text' },
      { id: 'email', type: 'Text' }
    ]
  },
  {
    key: 'socios',
    label: 'Socios',
    tableId: 'socios',
    preferredIds: ['Socios', 'socios'],
    columns: [
      { id: 'persona_id', type: 'Ref:personas' },
      { id: 'dni', type: 'Text' },
      { id: 'cuil', type: 'Text' },
      { id: 'apellido', type: 'Text' },
      { id: 'nombre', type: 'Text' },
      { id: 'domicilio', type: 'Text' },
      { id: 'localidad', type: 'Text' },
      { id: 'telefono', type: 'Text' },
      { id: 'email', type: 'Text' },
      { id: 'tipo_socio', type: 'Text' },
      { id: 'fecha_alta', type: 'Date' },
      { id: 'fecha_baja', type: 'Date' },
      { id: 'motivo_baja', type: 'Text' }
    ]
  },
  {
    key: 'movimientos',
    label: 'Movimientos',
    tableId: 'movimientos',
    preferredIds: ['Movimientos', 'movimientos'],
    columns: [
      { id: 'fecha', type: 'Date' },
      { id: 'tipo_movimiento', type: 'Text' },
      { id: 'importe', type: 'Numeric' },
      { id: 'detalle', type: 'Text' }
    ]
  }
];

