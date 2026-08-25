import { createGristStore, extendStore } from '$core/data/dataStore.svelte'
import { createRelatedData } from './form/movimientosRelatedData.svelte.js'
import { createFormState } from './form/movimientosFormState.svelte.js'
import { createCierresService } from '../resumen/cierresService.svelte.js'
import { createPersonasSelector } from './form/personasSelector.svelte.js'
import { createFormLogic } from './form/movimientosFormLogic.svelte.js'
import { createCargaPIAService } from '../cargaPia/cargaPIAService.svelte.js'
import { createCargasService } from '../cargaPia/cargasService.svelte.js'

const base = createGristStore({
  tableKey: 'movimientos',
  fetchOptions: {
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  },
  beforeSave: (fields) => {
    const out = { ...fields }
    out.importe = Number(out.importe)
    return out
  },
})

// Sub-módulos (orden: sin dependencias circulares)
const relatedData = createRelatedData({ base })
const formState = createFormState()
const cierresService = createCierresService({ relatedData, base })
const personasSelector = createPersonasSelector({ relatedData, formState })
const formLogic = createFormLogic({ formState, relatedData, base, cierresService })
const cargaPIAService = createCargaPIAService({ relatedData, base, cierresService })
const cargasService = createCargasService({ relatedData, base })

let _relatedUnsub = null

const subscribe = () => {
  if (_relatedUnsub) _relatedUnsub()
  _relatedUnsub = base.subscribe(() => {})
  return () => {
    if (_relatedUnsub) _relatedUnsub()
    _relatedUnsub = null
  }
}

export const movimientosStore = extendStore(base, {
  // relatedData
  get rubros() { return relatedData.rubros },
  get subrubros() { return relatedData.subrubros },
  get cuentas() { return relatedData.cuentas },
  get socios() { return relatedData.socios },
  get personas() { return relatedData.personas },
  get ejercicios() { return relatedData.ejercicios },
  get ejercicio() { return relatedData.ejercicio },
  get userName() { return relatedData.userName },
  get cuentaDefaultId() { return relatedData.cuentaDefaultId },
  get modoGestion() { return relatedData.modoGestion },
  get periodicidad() { return relatedData.periodicidad },
  get cierres() { return relatedData.cierres },
  // formState
  get selectedId() { return formState.selectedId },
  get form() { return formState.form },
  get listOpen() { return formState.listOpen },
  get q() { return formState.q },
  get tipo() { return formState.tipo },
  get filtroCategoria() { return formState.filtroCategoria },
  get advertenciaCierreManual() { return formState.advertenciaCierreManual },
  setQ: (v) => { formState.setQ(v) },
  setTipo: (v) => { formState.setTipo(v) },
  setListOpen: (v) => { formState.setListOpen(v) },
  setFiltroCategoria: (v) => { formState.setFiltroCategoria(v) },
  // personasSelector
  get personasSeleccionables() { return personasSelector.personasSeleccionables },
  get categoriasDisponibles() { return personasSelector.categoriasDisponibles },
  // formLogic
  select: formLogic.select,
  nuevo: formLogic.nuevo,
  nuevoCuotaSocietaria: formLogic.nuevoCuotaSocietaria,
  cancelar: formLogic.cancelar,
  saveMovimiento: formLogic.saveMovimiento,
  onTipoChange: formLogic.onTipoChange,
  onRubroChange: formLogic.onRubroChange,
  // cargaPIAService
  guardarCargaPIA: cargaPIAService.guardarCargaPIA,
  getMovimientosPorRubro: cargaPIAService.getMovimientosPorRubro,
  // cargasService
  get cargas() { return cargasService.cargas },
  loadCargas: cargasService.loadCargas,
  crearCarga: cargasService.crearCarga,
  firmarCarga: cargasService.firmarCarga,
  reabrirCarga: cargasService.reabrirCarga,
  eliminarCarga: cargasService.eliminarCarga,
  getCarga: cargasService.getCarga,
  migrarCargasLegacy: cargasService.migrarCargasLegacy,
  cerrarPeriodo: cargasService.cerrarPeriodo,
  reabrirPeriodo: cargasService.reabrirPeriodo,
  periodoFirmado: cargasService.periodoFirmado,
  // cierresService
  firmarPeriodo: cierresService.firmarPeriodo,
  periodoFirmado: cierresService.periodoFirmado,
  // local
  loadAll: relatedData.loadAll,
  setEjercicio: relatedData.setEjercicio,
  subscribe,
})
