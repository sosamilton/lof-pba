import { createBaseState, resolveTableIds, fetchRelated } from '$core/data/dataStore.svelte'
import { fetchRecords, subscribeRecords } from '$core/data/dataRepository'
import { createWidgetOptions } from './widgetOptions.svelte.js'
import { createAutoridadRows } from './autoridades/autoridadRows.svelte.js'
import { createAsambleasManager } from './asambleas/asambleasManager.svelte.js'
import { createPersonaSearchDispatcher } from './personaSearchDispatcher.svelte.js'
import { createCeseAutoridad } from './autoridades/ceseAutoridad.svelte.js'
import { createCargarAutoridades } from './autoridades/cargarAutoridades.svelte.js'
import { createReemplazoAutoridad } from './autoridades/reemplazoAutoridad.svelte.js'
import { createHechosRelevantesManager } from './memoria/hechosRelevantesManager.svelte.js'
import { generarBorradorMemoria, guardarMemoria } from './memoria/memoriaManager.svelte.js'
import { cooperadoraStore } from '$app/pages/cooperadora/cooperadoraStore.svelte'

const bs = createBaseState()
const widgetOpts = createWidgetOptions()

// Table IDs
let tEjercicios = $state(null)
let tCargos = $state(null)
let tAutoridades = $state(null)
let tAsambleas = $state(null)
let tResoluciones = $state(null)
let tHechos = $state(null)

// Datos principales
let ejercicios = $state([])
let ejercicio = $state(null)
// Ejercicio seleccionado para el tab Histórico (null = ejercicio en curso).
let ejercicioHistorico = $state(null)
let ejercicioSeleccionado = $state(null)
let cargos = $state([])
let autoridades = $state([])
let asambleas = $state([])
let hechosRelevantes = $state([])
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

    // hechos_relevantes es opcional: la tabla puede no existir todavía
    // (si el usuario no corrió "Actualizar schema"). No romper el load.
    try {
      const tIdsHechos = await resolveTableIds(['hechos_relevantes'])
      tHechos = tIdsHechos.hechos_relevantes || null
    } catch {
      tHechos = null
    }

    // Cargar ejercicios primero para saber cuál está en curso
    ejercicios = await fetchRecords(tEjercicios)
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null
    if (!ejercicio) return
    // Default del histórico: ejercicio en curso
    if (ejercicioHistorico === null) ejercicioHistorico = ejercicio.id
    // Default del selector de asambleas/hechos: ejercicio en curso
    if (ejercicioSeleccionado === null) ejercicioSeleccionado = ejercicio.id

    // Cargar tablas relacionadas en paralelo con fetchRelated.
    // Autoridades: cargar TODAS (sin filtro de ejercicio) para que el
    // tab Histórico pueda mostrar ejercicios anteriores.
    // Asambleas: filtrar por ejercicio seleccionado.
    const data = await fetchRelated(tIds, {
      cargos: { filter: (c) => c.activo === true || c.cargo_obligatorio === true },
      autoridades: {},
      asambleas: {
        filter: (a) => Number(a.ejercicio_id) === Number(ejercicioSeleccionado),
        sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
      },
    })
    cargos = data.cargos || []
    autoridades = data.autoridades || []
    asambleas = data.asambleas || []

    // Cargar hechos relevantes del ejercicio seleccionado
    if (tHechos) {
      hechosRelevantes = await fetchRecords(tHechos, {
        filter: (h) => Number(h.ejercicio_id) === Number(ejercicioSeleccionado),
        sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
      })
    }
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
  const ejId = ejercicioSeleccionado ?? ejercicio?.id
  if (!ejId) return
  asambleas = await fetchRecords(tAsambleas, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejId),
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  })
}

const loadHechos = async () => {
  if (!tHechos) return
  const ejId = ejercicioSeleccionado ?? ejercicio?.id
  if (!ejId) return
  hechosRelevantes = await fetchRecords(tHechos, {
    filter: (h) => Number(h.ejercicio_id) === Number(ejId),
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
  // Al guardar una AGE con motivo "Reforma estatuto", desbloquear la edición
  // de los cargos del estatuto Y del PDF del estatuto en Institucional.
  // El asambleaId se pasa para vincularlo al nuevo registro de estatuto.
  onReformaEstatuto: (asambleaId) => {
    cooperadoraStore.desbloquearCargos()
    return cooperadoraStore.desbloquearEstatuto(asambleaId)
  },
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

const hechosMgr = createHechosRelevantesManager({
  getTHechos: () => tHechos,
  getEjercicio: () => ejercicio,
  loadHechos,
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
  get ejercicioSeleccionado() { return ejercicioSeleccionado },
  set ejercicioSeleccionado(v) {
    if (v === ejercicioSeleccionado) return
    ejercicioSeleccionado = v
    // Recargar asambleas y hechos del nuevo ejercicio seleccionado
    loadAsambleas()
    loadHechos()
  },
  get cargos() { return cargos },
  get autoridades() { return autoridades },
  get asambleas() { return asambleas },
  // autoridadRows
  get rows() { return autoridadRows.rows },
  get rowsHistorico() { return autoridadRows.rowsHistorico },
  get quorumTitulares() { return autoridadRows.quorumTitulares },
  get tieneAutoridadesVigentes() { return autoridadRows.tieneAutoridadesVigentes },
  get tieneAlgunaAutoridad() { return autoridadRows.tieneAlgunaAutoridad },
  get grupoAVencerCD() { return autoridadRows.grupoAVencerCD },
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
  verificarAsamblea: asambleasMgr.verificarAsamblea,
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
  setDraftPersona: cargarAuth.setDraftPersona,
  setCargaMode: cargarAuth.setCargaMode,
  toggleCargoSeleccionado: cargarAuth.toggleCargoSeleccionado,
  selectAllCargos: cargarAuth.selectAllCargos,
  deselectAllCargos: cargarAuth.deselectAllCargos,
  toggleOrganismoCargos: cargarAuth.toggleOrganismoCargos,
  organismoSelectState: cargarAuth.organismoSelectState,
  globalSelectState: cargarAuth.globalSelectState,
  setGrupoCortoSorteo: cargarAuth.setGrupoCortoSorteo,
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
  loadHechos,
  // hechos relevantes
  get hechosRelevantes() { return hechosRelevantes },
  get hechoForm() { return hechosMgr.hechoForm },
  get hechoEditingId() { return hechosMgr.editingId },
  get hechoCategorias() { return hechosMgr.CATEGORIAS },
  newHecho: hechosMgr.newHecho,
  editHecho: hechosMgr.editHecho,
  closeHechoForm: hechosMgr.closeForm,
  saveHecho: hechosMgr.saveHecho,
  deleteHecho: hechosMgr.deleteHecho,
  // memoria
  get memoriaTexto() { return ejercicio?.memoria_texto || '' },
  get memoriaEstado() { return ejercicio?.memoria_estado || '' },
  generarMemoria: () => generarBorradorMemoria({
    getEjercicio: () => ejercicio,
    getHechos: () => hechosRelevantes,
    getAsambleas: () => asambleas,
    getAutoridades: () => autoridades,
    getCargos: () => cargos,
  }),
  guardarMemoria: (texto, estado) => guardarMemoria({
    getTEjercicios: () => tEjercicios,
    getEjercicio: () => ejercicio,
    texto,
    estado,
    bs,
  }),
  // subscribe
  subscribe,
}
