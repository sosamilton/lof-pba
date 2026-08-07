import { gristReady, listTables, resolveTableId, fetchRecords } from '$core/grist/grist'
import { TABLE_PREFERRED_IDS, MODULES, MESES } from '$core/utils/utils'
import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'
import { loadConfig, getTablesForModules } from '$app/pages/cooperadora/cooperadoraApi.js'
import { emailInstitucionalAlias } from '$core/format/emailInstitucional'
import { loadEscuelasIndex } from '$core/format/escuelas'
import { CUENTAS_OPCIONES, currentYear, localidades, steps } from './setupConstants'
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
    kiosco: false
  }))

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
    mes_inicio: 'Marzo',
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
    cantMovimientos: 2000,
    batchSize: 100,
    cantAsambleas: 1,
  })

  localidades = localidades
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
