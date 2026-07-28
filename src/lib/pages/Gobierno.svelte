<script>
  import { onMount } from 'svelte'
  import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId } from '../grist'

  let loading = true
  let error = ''
  let notice = ''

  let tab = 'comision'
  let organismo = 'CD'

  let tEjercicios
  let tCargos
  let tAutoridades
  let tAsambleas

  let ejercicios = []
  let ejercicio = null

  let cargos = []
  let autoridades = []
  let rows = []

  let asambleas = []
  let selectedAsambleaId = null
  let asambleaForm = null

  const normalizeFields = (obj) => {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
      if (v === '') continue
      out[k] = v
    }
    return out
  }

  const dateToInput = (v) => (v ? String(v).slice(0, 10) : '')

  const load = async () => {
    loading = true
    error = ''
    notice = ''
    try {
      await gristReady()
      tEjercicios = await resolveTableId(['Ejercicios', 'ejercicios'])
      tCargos = await resolveTableId(['Cargos', 'cargos'])
      tAutoridades = await resolveTableId(['Autoridades', 'autoridades'])
      tAsambleas = await resolveTableId(['Asambleas', 'asambleas'])

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
    cargos = await fetchRecords(tCargos)
    autoridades = await fetchRecords(tAutoridades)

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
      return {
        cargoId: c.id,
        cargoNombre: c.nombre_cargo,
        cargoOrden: c.orden,
        cargoObligatorio: Boolean(c.cargo_obligatorio),
        id: a?.id || null,
        apellido_nombre: a?.apellido_nombre || '',
        dni: a?.dni || '',
        cuil: a?.cuil || '',
        domicilio: a?.domicilio || '',
        localidad: a?.localidad || '',
        fecha_asuncion: dateToInput(a?.fecha_asuncion),
        fecha_cese: dateToInput(a?.fecha_cese),
        fecha_vencimiento: dateToInput(a?.fecha_vencimiento),
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
      const toCreate = rows.filter((r) => !existingByCargo.has(Number(r.cargoId)))
      if (toCreate.length === 0) {
        notice = 'La comisión ya está inicializada.'
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
      notice = 'Comisión inicializada.'
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const saveComision = async () => {
    notice = ''
    error = ''
    try {
      const updates = rows
        .filter((r) => r.id)
        .map((r) => {
          const fields = normalizeFields({
            organismo,
            cargo_id: r.cargoId,
            ejercicio_id: ejercicio.id,
            apellido_nombre: String(r.apellido_nombre || '').trim(),
            dni: String(r.dni || '').trim(),
            cuil: String(r.cuil || '').trim(),
            domicilio: String(r.domicilio || '').trim(),
            localidad: String(r.localidad || '').trim(),
            fecha_asuncion: r.fecha_asuncion || '',
            fecha_cese: r.fecha_cese || '',
            fecha_vencimiento: r.fecha_vencimiento || '',
            motivo_cese: String(r.motivo_cese || '').trim(),
            activo: Boolean(r.activo)
          })
          return ['UpdateRecord', tAutoridades, r.id, fields]
        })
      if (updates.length === 0) return
      await applyUserActions(updates)
      notice = 'Comisión guardada.'
      await loadComision()
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const loadAsambleas = async () => {
    const all = await fetchRecords(tAsambleas)
    asambleas = all
      .filter((a) => Number(a.ejercicio_id) === Number(ejercicio.id))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  }

  const editAsamblea = (a) => {
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
      caja_chica_importe: a?.caja_chica_importe ?? '',
      resolucion_punto_1: a?.resolucion_punto_1 || '',
      resolucion_punto_2: a?.resolucion_punto_2 || '',
      resolucion_punto_3: a?.resolucion_punto_3 || '',
      resolucion_punto_4: a?.resolucion_punto_4 || '',
      resolucion_punto_5: a?.resolucion_punto_5 || '',
      resolucion_punto_6: a?.resolucion_punto_6 || '',
      resolucion_punto_7: a?.resolucion_punto_7 || ''
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
      caja_chica_importe: '',
      resolucion_punto_1: '',
      resolucion_punto_2: '',
      resolucion_punto_3: '',
      resolucion_punto_4: '',
      resolucion_punto_5: '',
      resolucion_punto_6: '',
      resolucion_punto_7: ''
    }
  }

  const saveAsamblea = async () => {
    notice = ''
    error = ''
    try {
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
        caja_chica_importe: f.caja_chica_importe === '' ? '' : Number(f.caja_chica_importe),
        resolucion_punto_1: String(f.resolucion_punto_1 || '').trim(),
        resolucion_punto_2: String(f.resolucion_punto_2 || '').trim(),
        resolucion_punto_3: String(f.resolucion_punto_3 || '').trim(),
        resolucion_punto_4: String(f.resolucion_punto_4 || '').trim(),
        resolucion_punto_5: String(f.resolucion_punto_5 || '').trim(),
        resolucion_punto_6: String(f.resolucion_punto_6 || '').trim(),
        resolucion_punto_7: String(f.resolucion_punto_7 || '').trim()
      })

      if (f.id) {
        await applyUserActions([['UpdateRecord', tAsambleas, f.id, fields]])
        notice = 'Asamblea guardada.'
      } else {
        await applyUserActions([['AddRecord', tAsambleas, null, fields]])
        notice = 'Asamblea creada.'
      }
      await loadAsambleas()
      if (!f.id) asambleaForm = null
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  const setTab = async (t) => {
    tab = t
    if (!ejercicio) return
    if (t === 'comision') await loadComision()
    if (t === 'asambleas') await loadAsambleas()
  }

  onMount(async () => {
    if (!isInGrist()) return
    await load()
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
      <button class:tabActive={tab === 'comision'} on:click={() => setTab('comision')}>Comisión</button>
      <button class:tabActive={tab === 'asambleas'} on:click={() => setTab('asambleas')}>Asambleas</button>
    </div>
  </div>

  {#if ejercicio}
    {#if tab === 'comision'}
      <section class="card">
        <div class="rowHead">
          <div class="tabs">
            <button class:tabActive={organismo === 'CD'} on:click={() => { organismo = 'CD'; loadComision() }}>CD</button>
            <button class:tabActive={organismo === 'CRC'} on:click={() => { organismo = 'CRC'; loadComision() }}>CRC</button>
            <button class:tabActive={organismo === 'Federacion'} on:click={() => { organismo = 'Federacion'; loadComision() }}>Federación</button>
          </div>
          <div class="actions">
            <button class="btn secondary" on:click={initComision}>Inicializar comisión</button>
            <button class="btn" on:click={saveComision}>Guardar comisión</button>
          </div>
        </div>

        {#if rows.length === 0}
          <div class="empty">
            <div class="emptyTitle">No hay cargos activos</div>
            <div class="emptySub">Configurá cargos en “Cooperadora”.</div>
          </div>
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
                <div><input bind:value={r.apellido_nombre} placeholder="Apellido y nombre" /></div>
                <div><input bind:value={r.dni} placeholder="DNI" /></div>
                <div><input bind:value={r.cuil} placeholder="CUIL" /></div>
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
            <button class="btn" on:click={newAsamblea}>Nueva asamblea</button>
            <button class="btn secondary" on:click={loadAsambleas}>Recargar</button>
          </div>
        </div>

        <div class="grid2">
          <div class="list">
            {#if asambleas.length === 0}
              <div class="empty">
                <div class="emptyTitle">No hay asambleas</div>
                <div class="emptySub">Creá una asamblea para registrar actas y resoluciones.</div>
              </div>
            {:else}
              {#each asambleas as a (a.id)}
                <button class:selected={a.id === selectedAsambleaId} on:click={() => editAsamblea(a)}>
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
                  <label>Fecha</label>
                  <input type="date" bind:value={asambleaForm.fecha} />
                </div>
                <div class="row">
                  <label>Tipo</label>
                  <select bind:value={asambleaForm.tipo_asamblea}>
                    <option value="AnualOrdinaria">Anual ordinaria</option>
                    <option value="Extraordinaria">Extraordinaria</option>
                  </select>
                </div>
                <div class="row">
                  <label>Acta N°</label>
                  <input bind:value={asambleaForm.acta_numero} />
                </div>
                <div class="row">
                  <label>Fojas</label>
                  <input bind:value={asambleaForm.acta_fojas} />
                </div>
                <div class="row">
                  <label>Presentes</label>
                  <input type="number" bind:value={asambleaForm.socios_presentes_cantidad} />
                </div>
                <div class="row">
                  <label>Cuota social ($)</label>
                  <input type="number" bind:value={asambleaForm.cuota_social_importe} />
                </div>
                <div class="row">
                  <label>Cuota modalidad</label>
                  <select bind:value={asambleaForm.cuota_social_modalidad}>
                    <option value="Mensual">Mensual</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
                <div class="row">
                  <label>Caja chica ($)</label>
                  <input type="number" bind:value={asambleaForm.caja_chica_importe} />
                </div>
                <div class="row span2">
                  <label>Resolución punto 1</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_1}></textarea>
                </div>
                <div class="row span2">
                  <label>Resolución punto 2</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_2}></textarea>
                </div>
                <div class="row span2">
                  <label>Resolución punto 3</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_3}></textarea>
                </div>
                <div class="row span2">
                  <label>Resolución punto 4</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_4}></textarea>
                </div>
                <div class="row span2">
                  <label>Resolución punto 5</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_5}></textarea>
                </div>
                <div class="row span2">
                  <label>Resolución punto 6</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_6}></textarea>
                </div>
                <div class="row span2">
                  <label>Resolución punto 7</label>
                  <textarea bind:value={asambleaForm.resolucion_punto_7}></textarea>
                </div>
              </div>
              <div class="actions">
                <button class="btn" on:click={saveAsamblea}>Guardar</button>
              </div>
            {:else}
              <div class="muted">Seleccioná una asamblea o creá una nueva.</div>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  {/if}

  {#if error}
    <div class="msg error">{error}</div>
  {/if}
  {#if notice}
    <div class="msg notice">{notice}</div>
  {/if}
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
  .sub {
    opacity: 0.75;
    font-size: 13px;
    margin-top: 2px;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.95em;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tabs button {
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(128, 128, 128, 0.28);
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    color: inherit;
    font-weight: 800;
    font-size: 13px;
  }
  .tabs button.tabActive {
    border-color: rgba(22, 179, 120, 0.45);
    background: rgba(22, 179, 120, 0.14);
  }
  .card {
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.06);
  }
  .rowHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .btn {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 800;
    background: rgba(22, 179, 120, 0.9);
    color: #fff;
  }
  .btn.secondary {
    background: rgba(128, 128, 128, 0.18);
    color: inherit;
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
  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--grist-theme-input-bg, rgba(255, 255, 255, 0.85));
    color: inherit;
  }
  textarea {
    min-height: 68px;
    resize: vertical;
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
  .grid2 {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: 12px;
    align-items: start;
  }
  .list {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    overflow: hidden;
    background: rgba(128, 128, 128, 0.06);
    max-height: calc(100vh - 240px);
    overflow-y: auto;
  }
  .list button {
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 10px 12px;
    cursor: pointer;
    border-top: 1px solid rgba(128, 128, 128, 0.15);
    color: inherit;
  }
  .list button:first-child {
    border-top: 0;
  }
  .list button:hover {
    background: rgba(22, 179, 120, 0.1);
  }
  .list button.selected {
    background: rgba(22, 179, 120, 0.16);
  }
  .name {
    font-weight: 900;
    font-size: 13px;
  }
  .muted {
    opacity: 0.7;
    font-size: 13px;
  }
  .editor {
    border: 1px solid rgba(128, 128, 128, 0.22);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.06);
  }
  .form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
    margin-top: 10px;
  }
  .row label {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 5px;
  }
  .row.span2 {
    grid-column: 1 / -1;
  }
  .empty {
    border: 1px dashed rgba(128, 128, 128, 0.3);
    border-radius: 14px;
    padding: 14px;
    background: rgba(128, 128, 128, 0.04);
  }
  .emptyTitle {
    font-weight: 900;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .emptySub {
    opacity: 0.75;
    font-size: 13px;
  }
  .msg {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(128, 128, 128, 0.22);
  }
  .msg.error {
    border-color: rgba(176, 0, 32, 0.55);
    background: rgba(176, 0, 32, 0.08);
  }
  .msg.notice {
    border-color: rgba(22, 179, 120, 0.45);
    background: rgba(22, 179, 120, 0.12);
  }
  @media (max-width: 1100px) {
    .grid2 {
      grid-template-columns: 1fr;
    }
    .form {
      grid-template-columns: 1fr;
    }
  }
</style>
