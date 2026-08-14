import { createBaseState, resolveTableIds, fetchRelated } from '$core/grist/stores/gristStore.svelte.js'
import { fetchRecords, subscribeRecords } from '$core/grist/grist.js'
import { createWidgetOptions } from './widgetOptions.svelte.js'
import { createAutoridadRows } from './autoridades/autoridadRows.svelte.js'
import { createAsambleasManager } from './asambleas/asambleasManager.svelte.js'
import { createPersonaSearchDispatcher } from './personaSearchDispatcher.svelte.js'
import { createCeseAutoridad } from './autoridades/ceseAutoridad.svelte.js'
import { createCargarAutoridades } from './autoridades/cargarAutoridades.svelte.js'
import { createReemplazoAutoridad } from './autoridades/reemplazoAutoridad.svelte.js'

const bs = createBaseState()
const widgetOpts = createWidgetOptions()

// Table IDs
let tEjercicios = $state(null)
let tCargos = $state(null)
let tAutoridades = $state(null)
let tAsambleas = $state(null)
let tResoluciones = $state(null)

// Datos principales
let ejercicios = $state([])
let ejercicio = $state(null)
// Ejercicio seleccionado para el tab Histórico (null = ejercicio en curso).
let ejercicioHistorico = $state(null)
let cargos = $state([])
let autoridades = $state([])
let asambleas = $state([])
let pendingWizardTipo = $state(null)

// --- Funciones de carga (permanecen en el store principal) ---
const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  try {
    const tIds = await resolveTableIds(['ejercicios', 'cargos', 'autoridades', 'asambleas', 'resoluciones'])
    tEjercicios = tIds.ejercicios
    tCargos = tIds.cargos
    tAutoridades = tIds.autoridades
    tAsambleas = tIds.asambleas
    tResoluciones = tIds.resoluciones

    // Cargar ejercicios primero para saber cuál está en curso
    ejercicios = await fetchRecords(tEjercicios)
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null
    if (!ejercicio) return
    // Default del histórico: ejercicio en curso
    if (ejercicioHistorico === null) ejercicioHistorico = ejercicio.id

    // Cargar tablas relacionadas en paralelo con fetchRelated.
    // Autoridades: cargar TODAS (sin filtro de ejercicio) para que el
    // tab Histórico pueda mostrar ejercicios anteriores.
    // Asambleas: filtrar por ejercicio en curso (esa tab es del momento).
    const data = await fetchRelated(tIds, {
      cargos: { filter: (c) => c.activo === true || c.cargo_obligatorio === true },
      autoridades: {},
      asambleas: {
        filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
        sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
      },
    })
    cargos = data.cargos || []
    autoridades = data.autoridades || []
    asambleas = data.asambleas || []
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setLoading(false)
  }
}

const loadCargos = async () => {
  cargos = await fetchRecords(tCargos, {
    filter: (c) => c.activo === true || c.cargo_obligatorio === true,
  })
}

const loadAutoridades = async () => {
  // Cargar todas las autoridades (todos los ejercicios) para que el
  // tab Histórico pueda mostrar ejercicios anteriores.
  autoridades = await fetchRecords(tAutoridades)
}

const loadAsambleas = async () => {
  asambleas = await fetchRecords(tAsambleas, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  })
}

// --- Sub-módulos (composición con getters reactivos) ---
const autoridadRows = createAutoridadRows({
  getCargos: () => cargos,
  getAutoridades: () => autoridades,
  getOrganismo: () => widgetOpts.organismo,
  getEjercicioId: () => ejercicio?.id ?? null,
  getEjercicioHistoricoId: () => ejercicioHistorico,
})

const asambleasMgr = createAsambleasManager({
  getTAsambleas: () => tAsambleas,
  getTResoluciones: () => tResoluciones,
  getTAutoridades: () => tAutoridades,
  getEjercicio: () => ejercicio,
  getAsambleas: () => asambleas,
  getAutoridades: () => autoridades,
  loadAsambleas,
  loadAutoridades,
  bs,
})

const personaSearch = createPersonaSearchDispatcher()

const ceseAuth = createCeseAutoridad({
  getTAutoridades: () => tAutoridades,
  loadAutoridades,
  bs,
})

const cargarAuth = createCargarAutoridades({
  getTAsambleas: () => tAsambleas,
  getTAutoridades: () => tAutoridades,
  getEjercicio: () => ejercicio,
  getCargos: () => cargos,
  getAutoridades: () => autoridades,
  getAsambleas: () => asambleas,
  loadAsambleas,
  loadAutoridades,
  personaSearch,
  bs,
})

const reemplazoAuth = createReemplazoAutoridad({
  getTAutoridades: () => tAutoridades,
  getEjercicio: () => ejercicio,
  getCargos: () => cargos,
  getOrganismo: () => widgetOpts.organismo,
  loadAutoridades,
  personaSearch,
  bs,
})

// Conectar callbacks de personaSearch después de instanciar los sub-módulos
personaSearch.onSetDraftPersona((idx, p) => cargarAuth.setDraftPersona(idx, p))
personaSearch.onSetReemplazoPersona((p) => reemplazoAuth.setReemplazoPersona(p))

// --- Subscribe a cambios de Grist ---
let _unsub = null
const subscribe = (onExternalChange) => {
  if (_unsub) _unsub()
  _unsub = subscribeRecords(() => {
    if (!bs.busy && !bs.loading) {
      if (onExternalChange) onExternalChange()
      load()
    }
  })
  return () => {
    if (_unsub) _unsub()
    _unsub = null
  }
}

export const asambleasAutoridadesStore = {
  // base state
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  setError: bs.setError,
  setNotice: bs.setNotice,
  clearMessages: bs.clearMessages,
  // widget options
  get tab() { return widgetOpts.tab },
  set tab(v) { widgetOpts.setTab(v) },
  get organismo() { return widgetOpts.organismo },
  set organismo(v) { widgetOpts.setOrganismo(v) },
  setTab: (t) => widgetOpts.setTab(t),
  setOrganismo: (o) => widgetOpts.setOrganismo(o),
  initFromOptions: () => widgetOpts.initFromOptions(),
  // datos principales
  get ejercicios() { return ejercicios },
  get ejercicio() { return ejercicio },
  get ejercicioHistorico() { return ejercicioHistorico },
  set ejercicioHistorico(v) { ejercicioHistorico = v },
  get cargos() { return cargos },
  get autoridades() { return autoridades },
  get asambleas() { return asambleas },
  // autoridadRows
  get rows() { return autoridadRows.rows },
  get rowsHistorico() { return autoridadRows.rowsHistorico },
  get quorumTitulares() { return autoridadRows.quorumTitulares },
  get tieneAutoridadesVigentes() { return autoridadRows.tieneAutoridadesVigentes },
  get tieneAlgunaAutoridad() { return autoridadRows.tieneAlgunaAutoridad },
  personaEnOtroCargo: autoridadRows.personaEnOtroCargo,
  // asambleasManager
  get selectedAsambleaId() { return asambleasMgr.selectedAsambleaId },
  get asambleaForm() { return asambleasMgr.asambleaForm },
  get resoluciones() { return asambleasMgr.resoluciones },
  editAsamblea: asambleasMgr.editAsamblea,
  newAsamblea: asambleasMgr.newAsamblea,
  addResolucion: asambleasMgr.addResolucion,
  removeResolucion: asambleasMgr.removeResolucion,
  saveAsamblea: asambleasMgr.saveAsamblea,
  deleteAsamblea: asambleasMgr.deleteAsamblea,
  getLinkedAutoridadesCount: asambleasMgr.getLinkedAutoridadesCount,
  // cargarAutoridades
  get cargarDraft() { return cargarAuth.cargarDraft },
  crearAgoYCargar: async () => {
    const result = await cargarAuth.crearAgoYCargar()
    if (result === 'needsWizard') {
      widgetOpts.setTab('asambleas')
      asambleasMgr.newAsamblea('AGO')
      pendingWizardTipo = 'AGO'
    }
  },
  get pendingWizardTipo() { return pendingWizardTipo },
  clearPendingWizard: () => { pendingWizardTipo = null },
  openCargarAutoridades: cargarAuth.openCargarAutoridades,
  closeCargarAutoridades: cargarAuth.closeCargarAutoridades,
  saveAutoridadesFromAsamblea: cargarAuth.saveAutoridadesFromAsamblea,
  unlinkDraftPersona: cargarAuth.unlinkDraftPersona,
  setCargaMode: cargarAuth.setCargaMode,
  toggleCargoSeleccionado: cargarAuth.toggleCargoSeleccionado,
  // ceseAutoridad
  get ceseTarget() { return ceseAuth.ceseTarget },
  openCese: ceseAuth.openCese,
  closeCese: ceseAuth.closeCese,
  saveCese: ceseAuth.saveCese,
  // reemplazoAutoridad
  get reemplazoTarget() { return reemplazoAuth.reemplazoTarget },
  openReemplazo: reemplazoAuth.openReemplazo,
  closeReemplazo: reemplazoAuth.closeReemplazo,
  saveReemplazo: reemplazoAuth.saveReemplazo,
  // personaSearch
  get personaSearch() { return personaSearch.query },
  set personaSearch(v) { personaSearch.query = v },
  get personaResults() { return personaSearch.results },
  get personaSearching() { return personaSearch.searching },
  get searchTarget() { return personaSearch.searchTarget },
  doPersonaSearch: personaSearch.doPersonaSearch,
  linkPersonaSearch: personaSearch.linkPersonaSearch,
  // carga
  load,
  loadCargos,
  loadAutoridades,
  loadAsambleas,
  // subscribe
  subscribe,
}
