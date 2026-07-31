import { gristReady, listTables, resolveTableId, applyUserActions, invalidateTablesCache, fetchRecords, addRecords } from '$core/grist'
import { ensureSchema, initDemoData, loadSeedCsv } from './initAppCoop'
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
import { DEMO_MODULES, DEMO_ESC_COOP, DEMO_BANCO, DEMO_KIOSCO, DEMO_EJERCICIO } from './demoData'

const CUENTAS_OPCIONES = ['Banco', 'Efectivo', 'Caja Chica']
const currentYear = new Date().getFullYear()

/** @typedef {'gestion_completa' | 'kiosco' | 'tesoreria' | 'gobierno' | 'reportes'} ModuleKey */
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
 * @property {string} [escuela_numero]
 * @property {string} [cooperadora_nombre]
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
    gestion_completa: true,
    kiosco: false,
    tesoreria: true,
    gobierno: true,
    reportes: true
  }))

  schoolData = $state({
    escuela_nombre: '',
    escuela_numero: '',
    cue: '06',
    cooperadora_nombre: '',
    cuit: '',
    domicilio: '',
    localidad: '',
    email: '',
    telefono: '',
    color_primario: '#16b378'
  })

  cueWarning = $state('')
  cuitWarning = $state('')
  telefonoWarning = $state('')
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
    anio_fin: currentYear + 1
  })

  cargos = $state(/** @type {Cargo[]} */ ([]))
  cargoUid = 0
  federacionAdherida = $state(false)

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
    if (key === 'gestion_completa') {
      const newVal = !this.selectedModules.gestion_completa
      this.selectedModules.gestion_completa = newVal
      if (newVal) {
        this.selectedModules.tesoreria = true
        this.selectedModules.gobierno = true
        this.selectedModules.reportes = true
      }
    } else {
      this.selectedModules[key] = !this.selectedModules[key]
    }
  }

  onCueInput() {
    this.schoolData.cue = formatCue(this.schoolData.cue)
    const c = this.schoolData.cue.replace(/\D/g, '')
    if (c && !isValidCue(c)) {
      this.cueWarning = c.length === 9
        ? 'CUE inválido: debe empezar con 06 (Provincia de Buenos Aires)'
        : `CUE incompleto: ${c.length}/9 dígitos`
    } else if (c && isValidCue(c)) {
      this.cueWarning = cueSedeLabel(c)
    } else {
      this.cueWarning = ''
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

  onTelefonoInput() {
    this.schoolData.telefono = formatTelefonoNational(this.schoolData.telefono)
    const stored = normalizeTelefonoNationalForStorage(this.schoolData.telefono)
    if (stored && !isValidTelefonoNational(this.schoolData.telefono) && this.schoolData.telefono.replace(/\D/g, '').length > 0) {
      this.telefonoWarning = 'Teléfono incompleto'
    } else {
      this.telefonoWarning = ''
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
        this.schoolData.escuela_nombre = config.escuela_nombre || ''
        this.schoolData.escuela_numero = config.escuela_numero || ''
        this.schoolData.cooperadora_nombre = config.cooperadora_nombre || ''
      }
      await this.loadDefaultCargos()
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
        this.onCueInput()
        this.onCuitInput()
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

  hasFieldErrors() {
    return (this.cueWarning && !cueSedeLabel(this.schoolData.cue)) ||
      this.cuitWarning ||
      this.telefonoWarning ||
      this.emailWarning
  }

  canNext() {
    if (this.step === 0) return this.selectedModuleKeys.length > 0
    if (this.step === 1) return !this.hasFieldErrors()
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
      const existingLower = new Set(this.existingTables.map((t) => String(t || '').toLowerCase()))

      const schemaResult = /** @type {SchemaResult} */ (await ensureSchema(existingLower))
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
          const telStored = normalizeTelefonoNationalForStorage(this.schoolData.telefono)
          await applyUserActions([['AddRecord', tEscuela, null, {
            escuela_nombre: this.schoolData.escuela_nombre || '',
            escuela_numero: this.schoolData.escuela_numero || '',
            cue: cueDigits || '',
            cooperadora_nombre: this.schoolData.cooperadora_nombre || '',
            cuit: cuitDigits || '',
            domicilio: this.schoolData.domicilio || '',
            localidad: this.schoolData.localidad || '',
            email_cooperadora: normalizeEmail(this.schoolData.email) || '',
            telefono_cooperadora: telStored || ''
          }]])
        }
      }

      const tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
      if (tBanco) {
        let existingBanco = []
        try { existingBanco = await fetchRecords(tBanco) } catch { /* empty */ }
        if (existingBanco.length === 0) {
          const cbuDigits = this.banco.cbu.replace(/\D/g, '')
          await applyUserActions([['AddRecord', tBanco, null, {
            entidad: this.banco.entidad,
            tipo_cuenta: this.banco.tipo_cuenta,
            sucursal: this.banco.sucursal || '',
            cuenta_corriente: this.banco.cuenta_corriente || '',
            cbu: cbuDigits || '',
            vigente_desde: new Date().toISOString().slice(0, 10)
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

      let cuentaDefaultId = null
      const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
      if (tCuentas) {
        try {
          const cuentasRecs = /** @type {CuentaRecord[]} */ (await fetchRecords(tCuentas))
          const match = cuentasRecs.find((c) => String(c.nombre_cuenta) === this.cuentaDefault)
          if (match) cuentaDefaultId = match.id
        } catch { /* empty */ }
      }

      await saveConfig({
        ...moduleFlags,
        ...this.schoolData,
        cue: this.schoolData.cue.replace(/\D/g, ''),
        cuit: this.schoolData.cuit.replace(/\D/g, ''),
        telefono: normalizeTelefonoNationalForStorage(this.schoolData.telefono),
        email: normalizeEmail(this.schoolData.email),
        cuenta_default_id: cuentaDefaultId,
        instalado: true,
        fecha_instalacion: new Date().toISOString()
      })

      const needsEjercicioCargos = this.selectedModules.gestion_completa || this.selectedModules.tesoreria || this.selectedModules.gobierno

      if (needsEjercicioCargos) {
        const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
        if (tEjercicios) {
          let existingEj = []
          try { existingEj = await fetchRecords(tEjercicios) } catch { /* empty */ }
          if (existingEj.length === 0) {
            await applyUserActions([['AddRecord', tEjercicios, null, {
              anio_inicio: Number(this.ejercicio.anio_inicio) || currentYear,
              anio_fin: Number(this.ejercicio.anio_fin) || currentYear + 1,
              mes_inicio: this.ejercicio.mes_inicio || 'Marzo',
              saldo_inicial_banco: 0,
              saldo_inicial_efectivo: 0,
              saldo_inicial_caja_chica: 0,
              en_curso: true,
              observaciones: 'Ejercicio inicial'
            }]])
          }
        }

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

        await initDemoData([
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 }
        ])
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
