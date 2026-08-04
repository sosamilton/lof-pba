import { gristReady, listTables, resolveTableId, applyUserActions, invalidateTablesCache, fetchRecords, addRecords } from '$core/grist'
import { ensureSchema, initDemoData, loadSeedCsv } from './initLof'
import { TABLE_PREFERRED_IDS, MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS } from '$core/utils'
import { loadConfig, saveConfig, getTablesForModules } from '$core/configuracion'
import { parseCsv, csvToObjects, normalizeSeedValue } from '$core/csv'
import {
  formatCue,
  isValidCue,
  cueSedeLabel,
  formatCuil,
  isValidCuil,
  isValidCuilChecksum,
  formatTelefono,
  normalizeTelefonoForStorage,
  isValidTelefono,
  formatTelefonoNational,
  normalizeTelefonoNationalForStorage,
  isValidTelefonoNational,
  normalizeEmail,
  isValidEmail,
  formatCbu,
  isValidCbu,
  isValidCbuChecksum,
} from '$core/format'
import localidadesData from '$core/data/localidades-buenos-aires.json'
import { emailInstitucionalAlias, parseEmailInstitucionalInput } from '$core/emailInstitucional'
import {
  findEscuelaByCue,
  buildPrefillFromFicha,
  cueSearchState,
  fechaDescargaOficial,
  loadEscuelasIndex,
  isIndexLoaded,
} from '$core/escuelas'
import { DEMO_MODULES, DEMO_ESC_COOP, DEMO_BANCO, DEMO_KIOSCO, DEMO_EJERCICIO } from './demoData'

const CUENTAS_OPCIONES = ['Banco', 'Efectivo', 'Caja Chica']
const currentYear = new Date().getFullYear()

/** @typedef {'solo_pia' | 'gestion_integral' | 'gestion_etapas' | 'kiosco'} ModuleKey */
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
    solo_pia: false,
    gestion_integral: true,
    gestion_etapas: false,
    kiosco: false
  }))

  schoolData = $state({
    escuela_nombre: '',
    escuela_numero: '',
    cue: '06',
    distrito: '',
    cooperadora_nombre: '',
    cuit: '',
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
    // Solo se piden al usuario en modos gestion_integral / gestion_etapas
    // (panel en StepEjercicioCargos). En solo_pia quedan en 0.
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
  })

  localidades = localidadesData.map((l) => ({ value: l, label: l }))
  steps = ['Módulos', 'Escuela y cooperadora', 'Banco y kiosco', 'Ejercicio y cargos', 'Instalar']

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

  onCueInput() {
    this.schoolData.cue = formatCue(this.schoolData.cue)
    const c = this.schoolData.cue.replace(/\D/g, '')
    const state = cueSearchState(c)
    this.cueState = state

    if (state === 'loading') {
      this.cueWarning = 'Cargando registro oficial…'
      this.escuelaOficial = null
      return
    }
    if (state === 'idle') {
      this.cueWarning = ''
      this.escuelaOficial = null
      return
    }
    if (state === 'typing') {
      this.cueWarning = `CUE incompleto: ${c.length}/8-9 dígitos`
      this.escuelaOficial = null
      return
    }
    // CUE completo (8 o 9 dígitos válidos)
    if (!c.startsWith('06')) {
      this.cueWarning = 'CUE inválido: debe empezar con 06 (Provincia de Buenos Aires)'
      this.escuelaOficial = null
      return
    }
    if (state === 'found') {
      const ficha = findEscuelaByCue(c)
      this.escuelaOficial = ficha
      // Precargar campos de la escuela con datos oficiales.
      const prefill = buildPrefillFromFicha(ficha)
      this.schoolData.escuela_nombre = prefill.escuela_nombre
      this.schoolData.escuela_numero = prefill.escuela_numero
      this.schoolData.distrito = prefill.distrito
      this.schoolData.localidad = prefill.localidad
      this.schoolData.domicilio = prefill.domicilio
      this.cueWarning = cueSedeLabel(c)
    } else {
      // not_found: CUE válido pero no está en el índice oficial.
      this.escuelaOficial = null
      const fecha = fechaDescargaOficial() || 'fecha actual'
      this.cueWarning = `Establecimiento no registrado en el registro oficial a la fecha (${fecha}). Cargá la información igualmente.`
    }
  }

  onCuitInput() {
    this.schoolData.cuit = formatCuil(this.schoolData.cuit)
    const c = this.schoolData.cuit.replace(/\D/g, '')
    if (c && isValidCuil(c) && !isValidCuilChecksum(c)) {
      this.cuitWarning = 'CUIT inválido (dígito verificador incorrecto)'
    } else {
      this.cuitWarning = ''
    }
  }

  onTelefonoEscuelaInput() {
    this.schoolData.telefono_escuela = formatTelefonoNational(this.schoolData.telefono_escuela)
    const stored = normalizeTelefonoNationalForStorage(this.schoolData.telefono_escuela)
    if (stored && !isValidTelefonoNational(this.schoolData.telefono_escuela) && this.schoolData.telefono_escuela.replace(/\D/g, '').length > 0) {
      this.telefonoEscuelaWarning = 'Teléfono incompleto'
    } else {
      this.telefonoEscuelaWarning = ''
    }
    // Si la cooperadora usa el mismo teléfono, se sincroniza automáticamente.
    if (this.telefonoMismoQueEscuela) {
      this.schoolData.telefono = this.schoolData.telefono_escuela
      this.telefonoWarning = this.telefonoEscuelaWarning
    }
  }

  onTelefonoInput() {
    if (this.telefonoMismoQueEscuela) {
      // El teléfono de cooperadora está bloqueado y copia al de la escuela.
      this.schoolData.telefono = this.schoolData.telefono_escuela
      return
    }
    this.schoolData.telefono = formatTelefonoNational(this.schoolData.telefono)
    const stored = normalizeTelefonoNationalForStorage(this.schoolData.telefono)
    if (stored && !isValidTelefonoNational(this.schoolData.telefono) && this.schoolData.telefono.replace(/\D/g, '').length > 0) {
      this.telefonoWarning = 'Teléfono incompleto'
    } else {
      this.telefonoWarning = ''
    }
  }

  // Toggle del checkbox "mismo que la escuela" para el teléfono de cooperadora.
  toggleTelefonoMismoQueEscuela() {
    this.telefonoMismoQueEscuela = !this.telefonoMismoQueEscuela
    if (this.telefonoMismoQueEscuela) {
      this.schoolData.telefono = this.schoolData.telefono_escuela
      this.telefonoWarning = this.telefonoEscuelaWarning
    } else {
      this.onTelefonoInput()
    }
  }

  onEmailInput() {
    this.schoolData.email = normalizeEmail(this.schoolData.email)
    if (this.schoolData.email && !isValidEmail(this.schoolData.email)) {
      this.emailWarning = 'Email inválido'
    } else {
      this.emailWarning = ''
    }
  }

  // Email institucional: el usuario solo carga el alias; el dominio @abc.gob.ar es fijo.
  // Lee el valor del input (event) en vez del estado, porque con `value` (one-way binding)
  // el estado no se actualiza automáticamente al tipear.
  onEmailEscuelaInput(/** @type {Event} */ e) {
    const raw = /** @type {HTMLInputElement} */ (e?.target)?.value ?? ''
    const { alias, full } = parseEmailInstitucionalInput(raw)
    this.emailEscuelaAlias = alias
    this.schoolData.email_escuela = full
  }

  onCbuInput() {
    this.banco.cbu = formatCbu(this.banco.cbu)
    const c = this.banco.cbu.replace(/\D/g, '')
    if (c && c.length < 22) {
      this.cbuWarning = `CBU incompleto: ${c.length}/22 dígitos`
    } else if (c && c.length === 22 && !isValidCbuChecksum(c)) {
      this.cbuWarning = 'CBU con dígito verificador incorrecto (revisá, pero podés continuar)'
    } else {
      this.cbuWarning = ''
    }
  }

  cargosPorOrganismo(/** @type {Organismo} */ org) {
    return this.cargos
      .filter((c) => c.organismo === org)
      .sort((a, b) => a.orden - b.orden)
  }

  reordenar(/** @type {Organismo} */ org, /** @type {number} */ index, /** @type {number} */ dir) {
    const grupo = this.cargosPorOrganismo(org)
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= grupo.length) return
    const a = grupo[index]
    const b = grupo[newIndex]
    const tmpOrden = a.orden
    a.orden = b.orden
    b.orden = tmpOrden
    this.cargos = [...this.cargos]
  }

  addCargo(/** @type {Organismo} */ org) {
    const grupo = this.cargosPorOrganismo(org)
    const nuevo = {
      _uid: ++this.cargoUid,
      organismo: org,
      nombre_cargo: '',
      orden: grupo.length + 1,
      duracion_meses: 12,
      cargo_obligatorio: false,
      nivel: 'Titular',
      activo: true
    }
    this.cargos = [...this.cargos, nuevo]
  }

  removeCargo(/** @type {number} */ uid) {
    const removed = this.cargos.find((c) => c._uid === uid)
    if (!removed || removed.cargo_obligatorio) return
    const grupo = this.cargosPorOrganismo(removed.organismo)
    const idx = grupo.findIndex((c) => c._uid === uid)
    grupo.slice(idx + 1).forEach((c) => (c.orden -= 1))
    this.cargos = this.cargos.filter((c) => c._uid !== uid)
  }

  // Oculta/muestra un cargo no obligatorio (toggle de `activo`).
  // Los cargos ocultos no aparecen en el módulo gobierno pero se guardan en Grist
  // para que la PIA pueda informarlos como nulo/sin designar.
  toggleCargoActivo(/** @type {number} */ uid) {
    this.cargos = this.cargos.map((c) =>
      c._uid === uid && !c.cargo_obligatorio ? { ...c, activo: !c.activo } : c
    )
  }

  // Sincroniza el estado `activo` de los cargos de Federación según la adhesión.
  syncFederacionCargos() {
    this.cargos = this.cargos.map((c) =>
      c.organismo === 'Federacion'
        ? { ...c, activo: this.federacionAdherida }
        : c
    )
  }

  toggleFederacion() {
    this.federacionAdherida = !this.federacionAdherida
    this.syncFederacionCargos()
  }

  async loadDefaultCargos() {
    try {
      const csv = await loadSeedCsv('cargos')
      const rows = parseCsv(csv)
      const objs = csvToObjects(rows).map((o) => {
        /** @type {Record<string, any>} */
        const out = {}
        for (const [k, v] of Object.entries(o)) {
          const nv = normalizeSeedValue(v)
          if (nv === undefined) continue
          out[k] = nv
        }
        return out
      })
      this.cargos = objs.map((c) => ({
        _uid: ++this.cargoUid,
        organismo: c.organismo || 'CD',
        nombre_cargo: c.nombre_cargo || '',
        orden: Number(c.orden) || 0,
        duracion_meses: Number(c.duracion_meses) || 12,
        cargo_obligatorio: Boolean(c.cargo_obligatorio),
        nivel: c.nivel || '',
        activo: c.activo !== false
      }))
    } catch (e) {
      // Mínimo del Estatuto Modelo (Decreto 4767/72) + cargos opcionales del PIA.
      this.cargos = [
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Presidente/a', orden: 1, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Vicepresidente/a', orden: 2, duracion_meses: 12, cargo_obligatorio: false, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Secretario/a', orden: 3, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Prosecretario/a', orden: 4, duracion_meses: 12, cargo_obligatorio: false, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Tesorero/a', orden: 5, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Protesorero/a', orden: 6, duracion_meses: 12, cargo_obligatorio: false, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Titular 1', orden: 7, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Titular 2', orden: 8, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Titular 3', orden: 9, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Suplente 1', orden: 10, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Suplente', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CD', nombre_cargo: 'Vocal Suplente 2', orden: 11, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Suplente', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CRC', nombre_cargo: 'Revisor/a Titular Docente', orden: 1, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CRC', nombre_cargo: 'Revisor/a Titular Socio', orden: 2, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Titular', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CRC', nombre_cargo: 'Revisor/a Suplente', orden: 3, duracion_meses: 12, cargo_obligatorio: true, nivel: 'Suplente', activo: true },
        { _uid: ++this.cargoUid, organismo: 'CRC', nombre_cargo: 'Asesor/a', orden: 4, duracion_meses: 12, cargo_obligatorio: false, nivel: '', activo: true },
      ]
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

  // Rellena los campos del paso actual con datos de ejemplo (solo desarrollo).
  fillDemoData() {
    switch (this.step) {
      case 0: // Módulos
        this.selectedModules = { ...DEMO_MODULES }
        break
      case 1: // Escuela y cooperadora
        this.schoolData = { ...DEMO_ESC_COOP }
        this.emailEscuelaAlias = emailInstitucionalAlias(DEMO_ESC_COOP.email_escuela)
        this.telefonoMismoQueEscuela = false
        this.onCueInput()
        this.onCuitInput()
        this.onTelefonoEscuelaInput()
        this.onTelefonoInput()
        this.onEmailInput()
        break
      case 2: // Banco y kiosco
        this.banco = { ...DEMO_BANCO }
        this.onCbuInput()
        this.cuentaDefault = 'Efectivo'
        this.kiosco = { ...DEMO_KIOSCO(currentYear) }
        break
      case 3: // Ejercicio y cargos
        this.ejercicio = { ...DEMO_EJERCICIO(currentYear) }
        // Los cargos ya se cargan por defecto en init(); si están vacíos, forzamos la carga.
        if (this.cargos.length === 0) {
          this.loadDefaultCargos()
        }
        // Marcamos adhesión a la Federación para que se vean sus cargos en el demo.
        this.federacionAdherida = true
        this.syncFederacionCargos()
        break
      case 4: // Instalar (pantalla de revisión, nada que precargar)
        break
    }
  }

  // Rellena TODOS los pasos (0-3) con datos de ejemplo de una sola vez.
  // Se usa cuando el usuario activa "precargar datos demo por defecto" en el
  // primer paso (dev), reemplazando al botón "Precargar datos demo" por paso.
  // El salto al paso 4 (Instalar) lo maneja el onchange del checkbox en StepModulos.
  fillAllDemoData() {
    const stepActual = this.step
    for (let s = 0; s <= 3; s++) {
      this.step = s
      this.fillDemoData()
    }
    this.step = stepActual
  }

  // Avanza al siguiente paso. Si precargarDemoPorDefecto está activo, salta
  // directo al último paso (Instalar) porque los pasos intermedios ya están
  // rellenados con datos demo.
  next() {
    if (this.precargarDemoPorDefecto) {
      this.step = this.steps.length - 1
    } else {
      this.step += 1
    }
  }

  hasFieldErrors() {
    // CUE: solo es error si está en estado 'typing' (incompleto) o si
    // es inválido (no empieza con 06). 'not_found' NO es error: el usuario puede
    // cargar manualmente. 'found' tampoco: datos oficiales precargados.
    const cueIsError = this.cueState === 'typing' ||
      (this.cueState === 'not_found' && !this.schoolData.cue.replace(/\D/g, '').startsWith('06'))
    return cueIsError ||
      this.cuitWarning ||
      this.telefonoEscuelaWarning ||
      this.telefonoWarning ||
      this.emailWarning
  }

  canNext() {
    if (this.step === 0) return this.selectedModuleKeys.some((k) => !MODULES[k]?.optional)
    if (this.step === 1) {
      // El CUE debe estar resuelto (found o not_found); no se avanza si está
      // idle o typing. Si not_found, debe haber al menos nombre de escuela.
      if (this.cueState !== 'found' && this.cueState !== 'not_found') return false
      if (this.cueState === 'not_found' && !String(this.schoolData.escuela_nombre || '').trim()) return false
      return !this.hasFieldErrors()
    }
    if (this.step === 2) {
      const cbuDigits = this.banco.cbu.replace(/\D/g, '')
      if (cbuDigits && cbuDigits.length !== 22) return false
      return true
    }
    if (this.step === 3) {
      if (!this.ejercicio.mes_inicio) return false
      if (Number(this.ejercicio.anio_fin) <= Number(this.ejercicio.anio_inicio)) return false
      const sinNombre = this.cargos.some((c) => !c.cargo_obligatorio && c.activo && !c.nombre_cargo.trim())
      if (sinNombre) return false
      if (this.kiosco.posee && this.kiosco.modalidad === 'Licitado') {
        if (this.kiosco.contrato_desde && this.kiosco.contrato_hasta && this.kiosco.contrato_hasta < this.kiosco.contrato_desde) return false
      }
      return true
    }
    return true
  }

  async doInstall() {
    this.installing = true
    this.error = ''
    try {
      // Invalidar cache de tablas para que ensureSchema vea el estado real de Grist.
      invalidateTablesCache()

      const schemaResult = /** @type {SchemaResult} */ (await ensureSchema())
      const schemaErrors = schemaResult?.errors
      if (schemaErrors && schemaErrors.length > 0) {
        this.error = `Errores de schema: ${schemaErrors.join(', ')}`
        return
      }

      const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
      if (tEscuela) {
        let existingEscuela = []
        try { existingEscuela = await fetchRecords(tEscuela) } catch { /* empty */ }
        if (existingEscuela.length === 0) {
          const cueDigits = this.schoolData.cue.replace(/\D/g, '')
          const cuitDigits = this.schoolData.cuit.replace(/\D/g, '')
          const telEscuelaStored = normalizeTelefonoNationalForStorage(this.schoolData.telefono_escuela)
          const telStored = normalizeTelefonoNationalForStorage(this.schoolData.telefono)
          // datos_validados = true solo si la escuela se encontró en el índice
          // oficial (CUE matcheado). Si se cargó manualmente (not_found), false.
          const escuelaValidada = this.cueState === 'found'
          try {
            await applyUserActions([['AddRecord', tEscuela, null, {
              escuela_nombre: this.schoolData.escuela_nombre || '',
              escuela_numero: this.schoolData.escuela_numero || '',
              cue: cueDigits || '',
              distrito: this.schoolData.distrito || '',
              cooperadora_nombre: this.schoolData.cooperadora_nombre || '',
              cuit: cuitDigits || '',
              domicilio: this.schoolData.domicilio || '',
              localidad: this.schoolData.localidad || '',
              email_cooperadora: normalizeEmail(this.schoolData.email) || '',
              telefono_cooperadora: telStored || '',
              email_escuela: this.schoolData.email_escuela || '',
              telefono_escuela: telEscuelaStored || '',
              datos_validados: escuelaValidada
            }]])
          } catch (recErr) {
            const msg = String(recErr?.message || recErr || '')
            if (msg.includes('KeyError')) {
              throw new Error(
                `No se pudo crear el registro de escuela porque faltan columnas en la tabla de Grist. ` +
                `Abrí el documento de Grist, andá a la tabla "escuela" y agregá manualmente las columnas ` +
                `que falten (ej: email_escuela, telefono_escuela). Detalle: ${msg}`
              )
            }
            throw recErr
          }
        }
      }

      const tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
      if (tBanco) {
        let existingBanco = []
        try { existingBanco = await fetchRecords(tBanco) } catch { /* empty */ }
        if (existingBanco.length === 0) {
          const cbuDigits = this.banco.cbu.replace(/\D/g, '')
          const bancoValidado = Boolean(cbuDigits && isValidCbuChecksum(cbuDigits))
          await applyUserActions([['AddRecord', tBanco, null, {
            entidad: this.banco.entidad,
            tipo_cuenta: this.banco.tipo_cuenta,
            sucursal: this.banco.sucursal || '',
            cuenta_corriente: this.banco.cuenta_corriente || '',
            cbu: cbuDigits || '',
            vigente_desde: new Date().toISOString().slice(0, 10),
            banco_validado: bancoValidado
          }]])
        }
      }

      const tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
      if (tKiosco) {
        let existingKiosco = []
        try { existingKiosco = await fetchRecords(tKiosco) } catch { /* empty */ }
        if (existingKiosco.length === 0) {
          await applyUserActions([['AddRecord', tKiosco, null, {
            posee: Boolean(this.kiosco.posee),
            modalidad: this.kiosco.posee ? (this.kiosco.modalidad || 'Propio') : null,
            contrato_desde: this.kiosco.posee && this.kiosco.modalidad === 'Licitado' ? (this.kiosco.contrato_desde || null) : null,
            contrato_hasta: this.kiosco.posee && this.kiosco.modalidad === 'Licitado' ? (this.kiosco.contrato_hasta || null) : null
          }]])
        }
      }

      /** @type {Record<string, boolean>} */
      const moduleFlags = {}
      for (const key of /** @type {ModuleKey[]} */ (Object.keys(MODULES))) {
        moduleFlags[`modulo_${key}`] = Boolean(this.selectedModules[key])
      }

      await saveConfig({
        ...moduleFlags,
        // Solo cache de UI: lo que AppShell necesita al arranque sin cargar
        // la tabla escuela completa. Los datos operacionales viven en escuela.
        escuela_nombre: this.schoolData.escuela_nombre || '',
        cooperadora_nombre: this.schoolData.cooperadora_nombre || '',
        color_primario: this.schoolData.color_primario || '#16b378',
        cuenta_default_id: null,
        instalado: true,
        fecha_instalacion: new Date().toISOString(),
        // Versión del bundle que se instaló: permite comparar contra la versión
        // actual (horneada en el bundle que corre) y detectar si la app instalada
        // quedó desactualizada respecto del deploy más reciente.
        version_instalada: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
        sha_instalado: typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'
      })

      const needsEjercicio = this.selectedModules.gestion_integral || this.selectedModules.solo_pia || this.selectedModules.gestion_etapas
      const needsCargos = this.selectedModules.gestion_integral

      if (needsEjercicio) {
        const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
        if (tEjercicios) {
          let existingEj = []
          try { existingEj = await fetchRecords(tEjercicios) } catch { /* empty */ }
          if (existingEj.length === 0) {
            await applyUserActions([['AddRecord', tEjercicios, null, {
              anio_inicio: Number(this.ejercicio.anio_inicio) || currentYear,
              anio_fin: Number(this.ejercicio.anio_fin) || currentYear + 1,
              mes_inicio: this.ejercicio.mes_inicio || 'Marzo',
              saldo_inicial_banco: Number(this.ejercicio.saldo_inicial_banco) || 0,
              saldo_inicial_efectivo: Number(this.ejercicio.saldo_inicial_efectivo) || 0,
              saldo_inicial_caja_chica: Number(this.ejercicio.saldo_inicial_caja_chica) || 0,
              en_curso: true,
              observaciones: 'Ejercicio inicial'
            }]])
          }
        }
      }

      if (needsCargos) {
        const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
        if (tCargos) {
          let existingCargos = []
          try { existingCargos = await fetchRecords(tCargos) } catch { /* empty */ }
          if (existingCargos.length === 0 && this.cargos.length > 0) {
            const records = this.cargos.map((c) => ({
              organismo: c.organismo,
              nombre_cargo: c.nombre_cargo,
              orden: c.orden,
              duracion_meses: Number(c.duracion_meses) || 12,
              cargo_obligatorio: Boolean(c.cargo_obligatorio),
              nivel: c.nivel || null,
              activo: Boolean(c.activo)
            }))
            await addRecords(tCargos, records)
          }
        }
      }

      const seeds = []
      if (this.selectedModules.gestion_integral) {
        seeds.push({ tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 })
      }
      if (needsEjercicio) {
        seeds.push({ tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 })
      }
      if (seeds.length > 0) {
        await initDemoData(seeds)
      }

      // Buscar la cuenta default ahora que los seeds ya cargaron las cuentas
      if (this.cuentaDefault) {
        try {
          const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
          if (tCuentas) {
            const cuentasRecs = /** @type {CuentaRecord[]} */ (await fetchRecords(tCuentas))
            const match = cuentasRecs.find((c) => String(c.nombre_cuenta) === this.cuentaDefault)
            if (match) {
              await saveConfig({ cuenta_default_id: match.id })
            }
          }
        } catch { /* empty */ }
      }

      // Solo dev: generar datos de prueba si el usuario lo solicitó.
      if (import.meta.env.DEV && this.cargarDatosPrueba) {
        this.datosPruebaProgress = 'Generando datos de prueba...'
        try {
          const { generarDatosPrueba } = await import('./generadorDemo')
          await generarDatosPrueba({
            cantPersonas: Number(this.datosPruebaConfig.cantPersonas) || 500,
            cantSocios: Number(this.datosPruebaConfig.cantSocios) || 400,
            cantMovimientos: Number(this.datosPruebaConfig.cantMovimientos) || 2000,
            batchSize: Number(this.datosPruebaConfig.batchSize) || 100,
            onProgress: (msg) => { this.datosPruebaProgress = msg },
          })
        } catch (e) {
          console.error('[demo] Error generando datos de prueba:', e)
          this.error = `Datos de prueba: ${/** @type {Error} */ (e)?.message || String(e)}`
        }
      }

      invalidateTablesCache()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      window.location.reload()
    } catch (e) {
      this.error = (/** @type {Error} */ (e))?.message || String(e)
    } finally {
      this.installing = false
    }
  }
}

export const CUENTAS_OPCIONES_EXPORT = CUENTAS_OPCIONES
export { MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS }
