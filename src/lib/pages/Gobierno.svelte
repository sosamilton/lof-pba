<script>
  import { onMount } from 'svelte'
  import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId, subscribeRecords, getWidgetOptions, setWidgetOption } from '../grist'
  import { extractRowId, findOrCreatePersona, searchPersonas, personaLabel, normalizeDni, isValidDni } from '../personas'
  import { normalizeFields, dateToInput, addMonths, ORGANISMOS, TIPOS_ASAMBLEA, MODALIDAD_CUOTA, TABLE_PREFERRED_IDS } from '../utils'
  import MessageBanner from '../components/MessageBanner.svelte'
  import EmptyState from '../components/EmptyState.svelte'
  import '../shared.css'

  let loading = $state(true)
  let error = $state('')
  let notice = $state('')

  let tab = $state('comision')
  let organismo = $state('CD')

  let tEjercicios = $state()
  let tCargos = $state()
  let tAutoridades = $state()
  let tAsambleas = $state()
  let tResoluciones = $state()

  let ejercicios = $state([])
  let ejercicio = $state(null)

  let cargos = $state([])
  let autoridades = $state([])
  let rows = $state([])

  let asambleas = $state([])
  let selectedAsambleaId = $state(null)
  let asambleaForm = $state(null)
  let resoluciones = $state([])
  let busy = $state(false)
  let personaSearch = $state('')
  let personaResults = $state([])
  let personaSearching = $state(false)
  let searchTargetRow = $state(null)
  let _searchTimer = null

  const load = async () => {
    loading = true
    error = ''
    notice = ''
    try {
      await gristReady()
      tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
      tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
      tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
      tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)
      tResoluciones = await resolveTableId(TABLE_PREFERRED_IDS.resoluciones)

      ejercicios = await fetchRecords(tEjercicios)
      ejercicio = ejercicios.find((e) => e.en_curso === true) || null

      if (!ejercicio) {
        return
      }

      await loadComision()
      await loadAsambleas()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const loadComision = async () => {
    cargos = await fetchRecords(tCargos, {
      filter: (c) => c.activo === true || c.cargo_obligatorio === true
    })
    autoridades = await fetchRecords(tAutoridades, {
      filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id)
    })

    const cargosOrg = cargos
      .filter((c) => String(c.organismo) === organismo)
      .filter((c) => c.activo === true || c.cargo_obligatorio === true)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

    const authOrg = autoridades
      .filter((a) => String(a.organismo) === organismo)
      .filter((a) => Number(a.ejercicio_id) === Number(ejercicio.id))

    const authByCargo = new Map(authOrg.map((a) => [Number(a.cargo_id), a]))

    rows = cargosOrg.map((c) => {
      const a = authByCargo.get(Number(c.id)) || null
      const duracionMeses = c.duracion_meses ?? ''
      const fechaAsuncion = dateToInput(a?.fecha_asuncion)
      const fechaVenc = dateToInput(a?.fecha_vencimiento) || (fechaAsuncion ? addMonths(fechaAsuncion, duracionMeses) : '')
      return {
        cargoId: c.id,
        cargoNombre: c.nombre_cargo,
        cargoOrden: c.orden,
        cargoObligatorio: Boolean(c.cargo_obligatorio),
        cargoDuracionMeses: duracionMeses,
        id: a?.id || null,
        persona_id: a?.persona_id || null,
        apellido_nombre: a?.apellido_nombre || '',
        dni: a?.dni || '',
        cuil: a?.cuil || '',
        domicilio: a?.domicilio || '',
        localidad: a?.localidad || '',
        fecha_asuncion: fechaAsuncion,
        fecha_cese: dateToInput(a?.fecha_cese),
        fecha_vencimiento: fechaVenc,
        motivo_cese: a?.motivo_cese || '',
        activo: a?.activo ?? true
      }
    })
  }

  const initComision = async () => {
    notice = ''
    error = ''
    try {
      const existingByCargo = new Set(rows.filter((r) => r.id).map((r) => Number(r.cargoId)))
      const toCreate = rows.filter((r) => !existingByCargo.has(Number(r.cargoId)) && r.cargoObligatorio)
      if (toCreate.length === 0) {
        notice = 'No hay cargos obligatorios pendientes de inicializar.'
        return
      }
      const actions = toCreate.map((r) => [
        'AddRecord',
        tAutoridades,
        null,
        {
          organismo,
          cargo_id: r.cargoId,
          ejercicio_id: ejercicio.id,
          activo: true
        }
      ])
      await applyUserActions(actions)
      await loadComision()
      notice = `${toCreate.length} cargo(s) obligatorio(s) inicializado(s). Los opcionales se crean al guardar con datos.`
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const doPersonaSearch = (row) => {
    searchTargetRow = row
    clearTimeout(_searchTimer)
    if (!personaSearch || personaSearch.length < 2) {
      personaResults = []
      return
    }
    _searchTimer = setTimeout(async () => {
      personaSearching = true
      try {
        personaResults = await searchPersonas(personaSearch)
      } catch (e) {
        error = e?.message || String(e)
        personaResults = []
      } finally {
        personaSearching = false
      }
    }, 300)
  }

  const linkPersona = (p) => {
    if (!searchTargetRow) return
    searchTargetRow.persona_id = p.id
    searchTargetRow.apellido_nombre = personaLabel(p)
    searchTargetRow.dni = p.dni || searchTargetRow.dni
    searchTargetRow.cuil = p.cuil || searchTargetRow.cuil
    searchTargetRow.domicilio = p.domicilio || searchTargetRow.domicilio
    searchTargetRow.localidad = p.localidad || searchTargetRow.localidad
    personaSearch = ''
    personaResults = []
    searchTargetRow = null
  }

  const unlinkPersona = (row) => {
    row.persona_id = null
  }

  const saveComision = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tAutoridades) {
        error = 'No se encontró la tabla autoridades. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      const missing = rows.filter((r) => r.cargoObligatorio && r.activo && !r.apellido_nombre.trim())
      if (missing.length > 0) {
        error = `Faltan cargos obligatorios: ${missing.map((r) => r.cargoNombre).join(', ')}`
        return
      }
      const actions = []
      for (const r of rows) {
        if (!r.apellido_nombre.trim() && !r.dni.trim()) continue
        let personaId = r.persona_id
        if (!personaId && r.dni && isValidDni(r.dni)) {
          const persona = await findOrCreatePersona({
            dni: normalizeDni(r.dni),
            cuil: r.cuil || '',
            apellido: r.apellido_nombre.split(',')[0]?.trim() || '',
            nombre: r.apellido_nombre.split(',')[1]?.trim() || ''
          })
          personaId = persona?.id || null
        }
        const autoVenc = r.fecha_asuncion ? addMonths(r.fecha_asuncion, r.cargoDuracionMeses) : ''
        const fechaVencimiento = r.fecha_asuncion ? (r.fecha_vencimiento || autoVenc) : (r.fecha_vencimiento || '')
        const fields = normalizeFields({
          organismo,
          cargo_id: r.cargoId,
          ejercicio_id: ejercicio.id,
          persona_id: personaId || '',
          apellido_nombre: String(r.apellido_nombre || '').trim(),
          dni: String(r.dni || '').trim(),
          cuil: String(r.cuil || '').trim(),
          domicilio: String(r.domicilio || '').trim(),
          localidad: String(r.localidad || '').trim(),
          fecha_asuncion: r.fecha_asuncion || '',
          fecha_cese: r.fecha_cese || '',
          fecha_vencimiento: fechaVencimiento || '',
          motivo_cese: String(r.motivo_cese || '').trim(),
          activo: Boolean(r.activo)
        })
        if (r.id) {
          actions.push(['UpdateRecord', tAutoridades, r.id, fields])
        } else {
          actions.push(['AddRecord', tAutoridades, null, fields])
        }
      }
      if (actions.length === 0) return
      await applyUserActions(actions)
      notice = 'Comisión guardada.'
      await loadComision()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const loadAsambleas = async () => {
    asambleas = await fetchRecords(tAsambleas, {
      filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
      sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))
    })
  }

  const editAsamblea = async (a) => {
    selectedAsambleaId = a?.id || null
    asambleaForm = {
      id: a?.id || null,
      fecha: dateToInput(a?.fecha),
      tipo_asamblea: a?.tipo_asamblea || 'AnualOrdinaria',
      acta_numero: a?.acta_numero || '',
      acta_fojas: a?.acta_fojas || '',
      socios_presentes_cantidad: a?.socios_presentes_cantidad ?? '',
      cuota_social_importe: a?.cuota_social_importe ?? '',
      cuota_social_modalidad: a?.cuota_social_modalidad || 'Mensual',
      caja_chica_importe: a?.caja_chica_importe ?? ''
    }
    if (a?.id && tResoluciones) {
      const recs = await fetchRecords(tResoluciones, {
        filter: (r) => Number(r.asamblea_id) === Number(a.id),
        sort: (x, y) => Number(x.numero || 0) - Number(y.numero || 0)
      })
      resoluciones = recs.map((r) => ({ id: r.id, numero: r.numero ?? '', texto: r.texto || '' }))
    } else {
      resoluciones = []
    }
  }

  const newAsamblea = () => {
    selectedAsambleaId = null
    asambleaForm = {
      id: null,
      fecha: new Date().toISOString().slice(0, 10),
      tipo_asamblea: 'AnualOrdinaria',
      acta_numero: '',
      acta_fojas: '',
      socios_presentes_cantidad: '',
      cuota_social_importe: '',
      cuota_social_modalidad: 'Mensual',
      caja_chica_importe: ''
    }
    resoluciones = []
  }

  const addResolucion = () => {
    const nextNum = resoluciones.length + 1
    resoluciones = [...resoluciones, { id: null, numero: nextNum, texto: '' }]
  }

  const removeResolucion = (idx) => {
    resoluciones = resoluciones.filter((_, i) => i !== idx)
    resoluciones = resoluciones.map((r, i) => ({ ...r, numero: i + 1 }))
  }

  const saveAsamblea = async () => {
    notice = ''
    error = ''
    busy = true
    try {
      if (!tAsambleas) {
        error = 'No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.'
        return
      }
      const f = asambleaForm || {}
      const fields = normalizeFields({
        fecha: f.fecha || '',
        tipo_asamblea: f.tipo_asamblea || '',
        acta_numero: String(f.acta_numero || '').trim(),
        acta_fojas: String(f.acta_fojas || '').trim(),
        ejercicio_id: ejercicio.id,
        socios_presentes_cantidad: f.socios_presentes_cantidad === '' ? '' : Number(f.socios_presentes_cantidad),
        cuota_social_importe: f.cuota_social_importe === '' ? '' : Number(f.cuota_social_importe),
        cuota_social_modalidad: f.cuota_social_modalidad || '',
        caja_chica_importe: f.caja_chica_importe === '' ? '' : Number(f.caja_chica_importe)
      })

      let asambleaId = f.id
      if (f.id) {
        await applyUserActions([['UpdateRecord', tAsambleas, f.id, fields]])
        notice = 'Asamblea guardada.'
      } else {
        const res = await applyUserActions([['AddRecord', tAsambleas, null, fields]])
        asambleaId = extractRowId(res)
        notice = 'Asamblea creada.'
      }

      if (asambleaId != null && tResoluciones) {
        const existing = await fetchRecords(tResoluciones, {
          filter: (r) => Number(r.asamblea_id) === Number(asambleaId)
        })
        const toRemove = existing
          .filter((r) => !resoluciones.some((nr) => nr.id === r.id))
          .map((r) => ['RemoveRecord', tResoluciones, r.id])
        const toUpdate = resoluciones
          .filter((r) => r.id != null && String(r.texto || '').trim())
          .map((r) => ['UpdateRecord', tResoluciones, r.id, {
            numero: Number(r.numero || 0),
            texto: String(r.texto).trim()
          }])
        const toAdd = resoluciones
          .filter((r) => r.id == null && String(r.texto || '').trim())
          .map((r) => ['AddRecord', tResoluciones, null, {
            asamblea_id: asambleaId,
            numero: Number(r.numero || 0),
            texto: String(r.texto).trim()
          }])
        const actions = [...toRemove, ...toUpdate, ...toAdd]
        if (actions.length > 0) await applyUserActions(actions)
      }

      await loadAsambleas()
      if (!f.id) asambleaForm = null
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      busy = false
    }
  }

  const setTab = async (t) => {
    tab = t
    setWidgetOption('gobiernoTab', t)
    if (!ejercicio) return
    if (t === 'comision') await loadComision()
    if (t === 'asambleas') await loadAsambleas()
  }

  onMount(async () => {
    if (!isInGrist()) return
    const opts = await getWidgetOptions()
    if (opts?.gobiernoTab) tab = opts.gobiernoTab
    if (opts?.gobiernoOrganismo) organismo = opts.gobiernoOrganismo
    const unsub = subscribeRecords(() => {
      if (!busy && !loading) load()
    })
    await load()
    return unsub
  })
</script>

{#if !isInGrist()}
  <h1>Gobierno</h1>
  <p>Esta pantalla solo funciona dentro de Grist.</p>
{:else if loading}
  <p>Cargando…</p>
{:else}
  <div class="head">
    <div>
      <h1>Gobierno</h1>
      <div class="sub">
        {#if ejercicio}
          Ejercicio en curso: <span class="mono">{ejercicio.anio_inicio}-{ejercicio.anio_fin}</span>
        {:else}
          No hay ejercicio en curso. Activá uno en “Cooperadora”.
        {/if}
      </div>
    </div>
    <div class="tabs">
      <button class:tabActive={tab === 'comision'} onclick={() => setTab('comision')}>Comisión</button>
      <button class:tabActive={tab === 'asambleas'} onclick={() => setTab('asambleas')}>Asambleas</button>
    </div>
  </div>

  {#if ejercicio}
    {#if tab === 'comision'}
      <section class="card">
        <div class="rowHead">
          <div class="tabs">
            <button class:tabActive={organismo === 'CD'} onclick={() => { organismo = 'CD'; setWidgetOption('gobiernoOrganismo', 'CD'); loadComision() }}>Comisión Directiva</button>
            <button class:tabActive={organismo === 'CRC'} onclick={() => { organismo = 'CRC'; setWidgetOption('gobiernoOrganismo', 'CRC'); loadComision() }}>Comisión Revisora de Cuentas</button>
            <button class:tabActive={organismo === 'Federacion'} onclick={() => { organismo = 'Federacion'; setWidgetOption('gobiernoOrganismo', 'Federacion'); loadComision() }}>Federación</button>
          </div>
          <div class="actions">
            <button class="btn secondary" onclick={initComision}>Inicializar comisión</button>
            <button class="btn" onclick={saveComision}>Guardar comisión</button>
          </div>
        </div>

        {#if rows.length === 0}
          <EmptyState title="No hay cargos activos" sub="Configurá cargos en “Cooperadora”." />
        {:else}
          <div class="gridTable">
            <div class="thead">
              <div>Cargo</div>
              <div>Apellido y nombre</div>
              <div>DNI</div>
              <div>CUIL</div>
              <div>Asunción</div>
              <div>Vence</div>
            </div>
            {#each rows as r (r.cargoId)}
              <div class="trow">
                <div class="cargo">
                  <div class="cargoName">{r.cargoNombre}</div>
                  {#if r.cargoObligatorio}
                    <div class="badge">Obligatorio</div>
                  {/if}
                </div>
                <div>
                  {#if r.persona_id}
                    <input bind:value={r.apellido_nombre} placeholder="Apellido y nombre" />
                    <button class="btn secondary small" onclick={() => unlinkPersona(r)}>Desvincular</button>
                  {:else}
                    <input bind:value={r.apellido_nombre} placeholder="Apellido y nombre" onfocus={() => searchTargetRow = r} />
                    <input bind:value={personaSearch} oninput={() => doPersonaSearch(r)} placeholder="Buscar persona…" />
                    {#if personaSearching && searchTargetRow === r}<span class="muted">Buscando…</span>{/if}
                    {#if personaResults.length > 0 && searchTargetRow === r}
                      <div class="personaResults">
                        {#each personaResults as p (p.id)}
                          <button class="personaResult" onclick={() => linkPersona(p)}>
                            {personaLabel(p)} · DNI {p.dni || '-'}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  {/if}
                </div>
                <div><input bind:value={r.dni} placeholder="DNI" disabled={!!r.persona_id} /></div>
                <div><input bind:value={r.cuil} placeholder="CUIL" disabled={!!r.persona_id} /></div>
                <div><input type="date" bind:value={r.fecha_asuncion} /></div>
                <div><input type="date" bind:value={r.fecha_vencimiento} /></div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      <section class="card">
        <div class="rowHead">
          <h2>Asambleas</h2>
          <div class="actions">
            <button class="btn" onclick={newAsamblea}>Nueva asamblea</button>
            <button class="btn secondary" onclick={loadAsambleas}>Recargar</button>
          </div>
        </div>

        <div class="grid2">
          <div class="list">
            {#if asambleas.length === 0}
              <EmptyState title="No hay asambleas" sub="Creá una asamblea para registrar actas y resoluciones." />
            {:else}
              {#each asambleas as a (a.id)}
                <button class:selected={a.id === selectedAsambleaId} onclick={() => editAsamblea(a)}>
                  <div class="name">{a.fecha || '(sin fecha)'} · {a.tipo_asamblea}</div>
                  <div class="sub">Acta {a.acta_numero || '-'} · {a.socios_presentes_cantidad ?? '-'} presentes</div>
                </button>
              {/each}
            {/if}
          </div>

          <div class="editor">
            {#if asambleaForm}
              <h2>{asambleaForm.id ? 'Editar asamblea' : 'Nueva asamblea'}</h2>
              <div class="form">
                <div class="row">
                  <label>Fecha<input type="date" bind:value={asambleaForm.fecha} /></label>
                </div>
                <div class="row">
                  <label>Tipo<select bind:value={asambleaForm.tipo_asamblea}>
                    <option value="AnualOrdinaria">Anual ordinaria</option>
                    <option value="Extraordinaria">Extraordinaria</option>
                  </select></label>
                </div>
                <div class="row">
                  <label>Acta N°<input bind:value={asambleaForm.acta_numero} /></label>
                </div>
                <div class="row">
                  <label>Fojas<input bind:value={asambleaForm.acta_fojas} /></label>
                </div>
                <div class="row">
                  <label>Presentes<input type="number" bind:value={asambleaForm.socios_presentes_cantidad} /></label>
                </div>
                <div class="row">
                  <label>Cuota social ($)<input type="number" bind:value={asambleaForm.cuota_social_importe} /></label>
                </div>
                <div class="row">
                  <label>Cuota modalidad<select bind:value={asambleaForm.cuota_social_modalidad}>
                    <option value="Mensual">Mensual</option>
                    <option value="Anual">Anual</option>
                  </select></label>
                </div>
                <div class="row span2">
                  <label>Caja chica ($)<input type="number" bind:value={asambleaForm.caja_chica_importe} /></label>
                </div>
                {#each resoluciones as res, idx}
                  <div class="row span2 resolucion-row">
                    <label>Punto {idx + 1}<textarea bind:value={res.texto}></textarea></label>
                    <button class="btn secondary small" onclick={() => removeResolucion(idx)}>Quitar</button>
                  </div>
                {/each}
                <div class="row">
                  <button class="btn secondary" onclick={addResolucion}>+ Agregar resolución</button>
                </div>
              </div>
              <div class="actions">
                <button class="btn" onclick={saveAsamblea}>Guardar</button>
              </div>
            {:else}
              <div class="muted">Seleccioná una asamblea o creá una nueva.</div>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  {/if}

  <MessageBanner {error} {notice} />
{/if}

<style>
  h1 {
    margin: 0 0 10px 0;
    font-size: 18px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .gridTable {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 12px;
    overflow-x: auto;
    background: rgba(128, 128, 128, 0.03);
  }
  .thead,
  .trow {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.2fr) 120px 160px 140px 140px;
    gap: 8px;
    align-items: center;
    padding: 10px;
    min-width: 980px;
  }
  .thead {
    background: rgba(128, 128, 128, 0.12);
    font-size: 12px;
    font-weight: 900;
  }
  .trow {
    border-top: 1px solid rgba(128, 128, 128, 0.18);
  }
  .cargoName {
    font-weight: 900;
    font-size: 13px;
  }
  .badge {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.12);
    font-size: 12px;
    font-weight: 900;
    width: fit-content;
  }
  .form {
    margin-top: 10px;
  }
  .resolucion-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .resolucion-row label {
    flex: 1;
  }
  .personaResults {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .personaResult {
    text-align: left;
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 8px;
    padding: 6px 8px;
    cursor: pointer;
    background: transparent;
    color: inherit;
    font-size: 12px;
  }
  .personaResult:hover {
    background: rgba(22, 179, 120, 0.1);
  }
</style>
