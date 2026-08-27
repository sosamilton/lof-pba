import { gristReady, listTables, resolveTableId, fetchRecords } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS, MODULES, MESES } from '$core/utils/utils'
import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'
import { loadConfig, getTablesForModules } from '$app/pages/cooperadora/cooperadoraApi.js'
import { emailInstitucionalAlias } from '$core/format/emailInstitucional'
import { loadEscuelasIndex } from '$core/format/escuelas'
import { localidadesItems } from '$lib/hooks/localidades.svelte.js'
import { CUENTAS_OPCIONES, currentYear, steps } from './setupConstants'
import {
  onCueInput, onCuitInput, onTelefonoEscuelaInput, onTelefonoInput,
  toggleTelefonoMismoQueEscuela, onEmailInput, onEmailEscuelaInput, onCbuInput,
} from './setupSchoolData'
import {
  cargosPorOrganismo, reordenar, addCargo, removeCargo, toggleCargoActivo,
  syncFederacionCargos, toggleFederacion, loadDefaultCargos,
} from './setupEjercicioCargos'
import { hasFieldErrors, canNext } from './setupValidation'
import { fillDemoData, fillAllDemoData } from './setupDemo'
import { doInstall } from './setupInstaller'

/** @typedef {'carga_consolidada' | 'gestion_integral' | 'kiosco'} ModuleKey */
/** @typedef {'CD' | 'CRC' | 'Federacion'} Organismo */

/**
 * @typedef {Object} Cargo
 * @property {number} _uid
 * @property {Organismo} organismo
 * @property {string} nombre_cargo
 * @property {number} orden
 * @property {number} duracion_meses
 * @property {string} grupo_renovacion - 'A' | 'B' | '' (solo CD; renovación por mitades art. 15)
 * @property {boolean} cargo_obligatorio
 * @property {string} nivel
 * @property {boolean} activo
 */

/**
 * @typedef {Object} PersistedConfig
 * @property {boolean} [instalado]
 * @property {string} [escuela_nombre]
 * @property {string} [cooperadora_nombre]
 * @property {string} [color_primario]
 */

/**
 * @typedef {Object} SchemaResult
 * @property {number} created
 * @property {number} addedColumns
 * @property {number} repairedRefs
 * @property {string[]} [errors]
 */

/**
 * @typedef {Object} CuentaRecord
 * @property {any} id
 * @property {string} [nombre_cuenta]
 */

export class SetupStore {
  step = $state(0)
  loading = $state(true)
  installing = $state(false)
  error = $state('')
  existingTables = $state(/** @type {string[]} */ ([]))

  selectedModules = $state(/** @type {Record<ModuleKey, boolean>} */ ({
    carga_consolidada: false,
    gestion_integral: true,
    kiosco: false,
    colaborador: false,
  }))

  // Modo colaborador: archivo .lof de set de trabajo para inicializar
  workingSetFile = $state(/** @type {File | null} */ (null))

  schoolData = $state({
    escuela_nombre: '',
    escuela_numero: '',
    cue: '06',
    distrito: '',
    cooperadora_nombre: '',
    cuit: '30',
    domicilio: '',
    localidad: '',
    email: '',
    email_escuela: '',
    telefono_escuela: '',
    telefono: '',
    color_primario: '#16b378'
  })

  // Alias del email institucional (sin @abc.gob.ar). El dominio es fijo por política.
  emailEscuelaAlias = $state('')

  // Si la cooperadora usa el mismo teléfono que la escuela, el campo de cooperadora
  // se bloquea y copia el valor del teléfono de la escuela.
  telefonoMismoQueEscuela = $state(false)

  cueWarning = $state('')
  cueState = $state('idle') // 'idle' | 'typing' | 'found' | 'not_found' | 'loading'
  escuelaOficial = $state(null) // ficha del índice oficial si se encontró
  cuitWarning = $state('')
  telefonoWarning = $state('')
  telefonoEscuelaWarning = $state('')
  emailWarning = $state('')
  cbuWarning = $state('')

  banco = $state({
    entidad: 'Banco de la Provincia de Buenos Aires',
    tipo_cuenta: 'Cuenta corriente en pesos',
    sucursal: '',
    cuenta_corriente: '',
    cbu: ''
  })

  kiosco = $state({
    posee: false,
    modalidad: 'Propio',
    contrato_desde: '',
    contrato_hasta: ''
  })

  cuentaDefault = $state('Banco')

  ejercicio = $state({
    // El ejercicio económico de las cooperadoras escolares bonaerenses es
    // fijo: 01/05 → 30/04 (Decreto 4767/72). No es personalizable.
    mes_inicio: 'Mayo',
    anio_inicio: currentYear,
    anio_fin: currentYear + 1,
    // Saldos iniciales del ejercicio (punto de partida del sistema).
    // Solo se piden al usuario en modos gestion_integral / carga_consolidada
    // (panel en StepEjercicioCargos).
    saldo_inicial_banco: 0,
    saldo_inicial_efectivo: 0,
    saldo_inicial_caja_chica: 0
  })

  cargos = $state(/** @type {Cargo[]} */ ([]))
  cargoUid = 0
  federacionAdherida = $state(false)

  // Solo dev: cargar datos de prueba (personas, socios, movimientos) tras instalar.
  isDev = import.meta.env.DEV
  cargarDatosPrueba = $state(false)
  datosPruebaProgress = $state('')

  // Solo dev: precargar datos demo en todos los pasos automáticamente (reemplaza
  // el botón "Precargar datos demo" que aparece en cada paso).
  precargarDemoPorDefecto = $state(false)

  // Solo dev: configuración de cantidades para el generador de datos de prueba.
  // Valores por defecto = los que usa generarDatosPrueba si no se pasa config.
  datosPruebaConfig = $state({
    cantPersonas: 500,
    cantSocios: 400,
    cantMovimientos: 500,
    batchSize: 100,
    cantAsambleas: 1,
    cantEjercicios: 1,
    cantHechos: 10,
  })

  // Solo dev: si false, solo el input de ejercicios es editable y el resto
  // se auto-sugiere según la cantidad de ejercicios + modo de gestión.
  customizarDatosPrueba = $state(false)

  // Estimación de movimientos según el modo seleccionado.
  // - Integral: cuota social mensual por socio activo + movimientos extra, por ejercicio.
  // - Consolidada: rubros (~20) × cuentas (3) × períodos (12) × 0.7 (30% vacíos) × ejercicios
  get movimientosEstimados() {
    const cantEj = Number(this.datosPruebaConfig.cantEjercicios) || 1
    if (this.selectedModules.carga_consolidada) {
      const periodos = 12 // Mayo-Mayo = 12 períodos
      const rubros = 20 // aproximado de rubros PIA Entrada+Salida
      const cuentas = 3 // Banco, Efectivo, Caja Chica
      const estimadoPorEj = Math.round(rubros * cuentas * periodos * 0.7)
      return estimadoPorEj * cantEj
    }
    // Gestión integral: cuota social mensual por socio activo (~85%) + extra
    const cantSocios = Number(this.datosPruebaConfig.cantSocios) || 400
    const sociosActivos = Math.floor(cantSocios * 0.85)
    const periodos = 12
    const cuotaSocial = sociosActivos * periodos * cantEj
    const extra = Number(this.datosPruebaConfig.cantMovimientos) || 0
    return cuotaSocial + extra
  }

  // Descripción de los datos de prueba según el modo.
  get datosPruebaDescripcion() {
    const cantEj = Number(this.datosPruebaConfig.cantEjercicios) || 1
    const totalAsambleas = (Number(this.datosPruebaConfig.cantAsambleas) || 1) * cantEj
    const totalHechos = (Number(this.datosPruebaConfig.cantHechos) || 10) * cantEj
    const hechosTxt = ` · ${totalHechos} hechos relevantes, ${cantEj} memoria(s)`
    if (this.selectedModules.carga_consolidada) {
      const periodos = 12
      const firmados = Math.floor(periodos * 0.7)
      const abiertos = periodos - firmados
      const ejTxt = cantEj > 1 ? ` en ${cantEj} ejercicios` : ''
      return `${this.movimientosEstimados} movimientos PIA${ejTxt} (${firmados} períodos firmados, ${abiertos} abiertos por ejercicio) · ${this.datosPruebaConfig.cantPersonas} personas, ${this.datosPruebaConfig.cantSocios} socios · ${totalAsambleas} asamblea(s), autoridades CD/CRC con continuidad parcial${hechosTxt}`
    }
    const ejTxt = cantEj > 1 ? ` en ${cantEj} ejercicios` : ''
    return `${this.movimientosEstimados} movimientos${ejTxt} (cuota social mensual por socio + extra) · ${this.datosPruebaConfig.cantPersonas} personas, ${this.datosPruebaConfig.cantSocios} socios · ${totalAsambleas} asamblea(s), autoridades CD/CRC con continuidad parcial${hechosTxt}`
  }

  get localidades() { return localidadesItems.current }
  steps = steps

  get selectedModuleKeys() {
    return Object.entries(this.selectedModules).filter(([, v]) => v).map(([k]) => k)
  }

  get tableCount() {
    const tables = getTablesForModules(this.selectedModuleKeys)
    return tables.length
  }

  toggleModule(/** @type {ModuleKey} */ key) {
    const mod = MODULES[key]
    if (!mod?.implemented) return
    if (mod?.optional) {
      this.selectedModules[key] = !this.selectedModules[key]
    } else {
      for (const k of /** @type {ModuleKey[]} */ (Object.keys(MODULES))) {
        if (!MODULES[k]?.optional) this.selectedModules[k] = false
      }
      this.selectedModules[key] = true
      // Auto-ajustar defaults de datos de prueba según el modo seleccionado
      this.ajustarDatosPruebaSegunModo()
    }
  }

  /**
   * Ajusta los defaults de datosPruebaConfig según el modo de gestión.
   * - gestion_integral: más socios (cuota social mensual), movimientos extra moderados
   * - carga_consolidada: menos socios, movimientos calculados por fórmula PIA
   */
  ajustarDatosPruebaSegunModo() {
    if (this.selectedModules.carga_consolidada) {
      // Carga consolidada: los movimientos se calculan automáticamente
      // (rubros × cuentas × períodos). No se necesita cantMovimientos.
      // Menos socios porque no hay cuota social individual.
      this.datosPruebaConfig.cantPersonas = 200
      this.datosPruebaConfig.cantSocios = 150
      this.datosPruebaConfig.cantMovimientos = 0 // se ignora en consolidada
    } else if (this.selectedModules.gestion_integral) {
      // Gestión integral: socios con cuota social mensual + movimientos extra
      this.datosPruebaConfig.cantPersonas = 500
      this.datosPruebaConfig.cantSocios = 400
      this.datosPruebaConfig.cantMovimientos = 500 // extra además de cuota social
    }
    // Si no hay customización, re-sugerir según ejercicios
    if (!this.customizarDatosPrueba) this.sugerirSegunEjercicios()
  }

  /**
   * Sugiere valores razonables para todos los campos según la cantidad
   * de ejercicios y el modo de gestión. Solo se llama cuando
   * customizarDatosPrueba === false.
   */
  sugerirSegunEjercicios() {
    const cantEj = Number(this.datosPruebaConfig.cantEjercicios) || 1
    if (this.selectedModules.carga_consolidada) {
      // Carga consolidada: volúmenes más modestos
      // Más ejercicios → más personas para tener variedad en autoridades
      this.datosPruebaConfig.cantPersonas = 150 + cantEj * 50
      this.datosPruebaConfig.cantSocios = 100 + cantEj * 30
      this.datosPruebaConfig.cantAsambleas = 1 // 1 AGO por ejercicio es lo típico
      this.datosPruebaConfig.batchSize = cantEj >= 3 ? 150 : 100
      this.datosPruebaConfig.cantHechos = 10
    } else if (this.selectedModules.gestion_integral) {
      // Gestión integral: más socios para que la cuota social genere volumen
      this.datosPruebaConfig.cantPersonas = 300 + cantEj * 100
      this.datosPruebaConfig.cantSocios = 250 + cantEj * 75
      // Movimientos extra: más ejercicios → más variedad de gastos
      this.datosPruebaConfig.cantMovimientos = 300 + cantEj * 200
      this.datosPruebaConfig.cantAsambleas = 1
      this.datosPruebaConfig.batchSize = cantEj >= 3 ? 150 : 100
      this.datosPruebaConfig.cantHechos = 10
    }
  }

  // --- Handlers de input (delegan a setupSchoolData.js) ---
  onCueInput() { onCueInput(this) }
  onCuitInput() { onCuitInput(this) }
  onTelefonoEscuelaInput() { onTelefonoEscuelaInput(this) }
  onTelefonoInput() { onTelefonoInput(this) }
  toggleTelefonoMismoQueEscuela() { toggleTelefonoMismoQueEscuela(this) }
  onEmailInput() { onEmailInput(this) }
  onEmailEscuelaInput(/** @type {Event} */ e) { onEmailEscuelaInput(this, e) }
  onCbuInput() { onCbuInput(this) }

  // --- Cargos (delegan a setupEjercicioCargos.js) ---
  cargosPorOrganismo(/** @type {Organismo} */ org) { return cargosPorOrganismo(this, org) }
  reordenar(/** @type {Organismo} */ org, /** @type {number} */ index, /** @type {number} */ dir) { reordenar(this, org, index, dir) }
  addCargo(/** @type {Organismo} */ org) { addCargo(this, org) }
  removeCargo(/** @type {number} */ uid) { removeCargo(this, uid) }
  toggleCargoActivo(/** @type {number} */ uid) { toggleCargoActivo(this, uid) }
  syncFederacionCargos() { syncFederacionCargos(this) }
  toggleFederacion() { toggleFederacion(this) }
  async loadDefaultCargos() { await loadDefaultCargos(this) }

  // --- Validación (delegan a setupValidation.js) ---
  hasFieldErrors() { return hasFieldErrors(this) }
  canNext() { return canNext(this) }

  // --- Demo (delegan a setupDemo.js, DEV-only) ---
  fillDemoData() { fillDemoData(this) }
  fillAllDemoData() { fillAllDemoData(this) }

  // --- Backup restore ---
  restoring = $state(false)
  restoreError = $state('')
  restoreResult = $state(null)

  async restoreFromBackup(/** @type {File} */ file) {
    this.restoring = true
    this.restoreError = ''
    this.restoreResult = null
    try {
      const { importBackup } = await import('$core/data/backup.js')
      const result = await importBackup(file)
      this.restoreResult = result
      // Saltar directamente al último paso (instalar)
      // El backup ya tiene todos los datos, solo falta recargar.
      this.step = this.steps.length - 1
    } catch (e) {
      this.restoreError = e?.message || String(e)
    } finally {
      this.restoring = false
    }
  }

  // --- Instalación (delega a setupInstaller.js) ---
  async doInstall() { await doInstall(this) }

  // --- Navegación del wizard ---
  next() {
    if (this.precargarDemoPorDefecto) {
      this.step = this.steps.length - 1
    } else {
      this.step += 1
    }
  }

  async init() {
    try {
      await gristReady()
      this.existingTables = await listTables()
      const config = /** @type {PersistedConfig} */ (await loadConfig())
      if (config?.instalado) {
        // Cache de UI desde configuracion (arranque rápido).
        this.schoolData.escuela_nombre = config.escuela_nombre || ''
        this.schoolData.cooperadora_nombre = config.cooperadora_nombre || ''
        this.schoolData.color_primario = config.color_primario || '#16b378'
        // Datos operacionales desde la tabla escuela (source of truth).
        const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
        if (tEscuela) {
          try {
            const recs = await fetchRecords(tEscuela)
            if (recs.length > 0) {
              const esc = recs[0]
              this.schoolData.escuela_numero = esc.escuela_numero || ''
              this.schoolData.cue = esc.cue || ''
              this.schoolData.distrito = esc.distrito || ''
              this.schoolData.cuit = esc.cuit || ''
              this.schoolData.domicilio = esc.domicilio || ''
              this.schoolData.localidad = esc.localidad || ''
              this.schoolData.email = esc.email_cooperadora || ''
              this.schoolData.email_escuela = esc.email_escuela || ''
              this.schoolData.telefono_escuela = esc.telefono_escuela || ''
              this.schoolData.telefono = esc.telefono_cooperadora || ''
              if (esc.email_escuela) {
                this.emailEscuelaAlias = emailInstitucionalAlias(esc.email_escuela)
              }
            }
          } catch { /* tabla escuela puede no existir todavía */ }
        }
      }
      await this.loadDefaultCargos()
      // Pre-cargar el índice de escuelas en segundo plano (code-split chunk).
      // Se carga mientras el usuario está en el step 0; al llegar al step 1
      // ya debería estar disponible para el lookup por CUE.
      loadEscuelasIndex().catch(() => { /* índice opcional, no bloquea el setup */ })
    } catch (e) {
      this.error = (/** @type {Error} */ (e))?.message || String(e)
    } finally {
      this.loading = false
    }
  }
}

export const CUENTAS_OPCIONES_EXPORT = CUENTAS_OPCIONES
export { MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS }
