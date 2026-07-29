<script>
  import { onMount } from 'svelte'
  import { gristReady, listTables, resolveTableId, applyUserActions, invalidateTablesCache, fetchRecords } from '../grist'
  import { ensureSchema, initDemoData } from '../initAppCoop'
  import { TABLE_PREFERRED_IDS, MODULES } from '../utils'
  import { loadConfig, saveConfig, getTablesForModules } from '../configuracion'
  import '../shared.css'

  let step = $state(0)
  let loading = $state(true)
  let installing = $state(false)
  let error = $state('')
  let existingTables = $state([])

  let selectedModules = $state({
    gestion_completa: true,
    kiosco: false,
    tesoreria: true,
    gobierno: true,
    reportes: true
  })

  let schoolData = $state({
    escuela_nombre: '',
    escuela_numero: '',
    cue: '',
    cooperadora_nombre: '',
    cuit: '',
    domicilio: '',
    localidad: '',
    email: '',
    telefono: '',
    color_primario: '#16b378'
  })

  const steps = ['Módulos', 'Escuela y cooperadora', 'Instalar']

  const toggleModule = (key) => {
    if (key === 'gestion_completa') {
      const newVal = !selectedModules.gestion_completa
      selectedModules.gestion_completa = newVal
      if (newVal) {
        selectedModules.tesoreria = true
        selectedModules.gobierno = true
        selectedModules.reportes = true
      }
    } else {
      selectedModules[key] = !selectedModules[key]
    }
  }

  const getSelectedModuleKeys = () =>
    Object.entries(selectedModules).filter(([, v]) => v).map(([k]) => k)

  const getTableCount = () => {
    const tables = getTablesForModules(getSelectedModuleKeys())
    return tables.length
  }

  onMount(async () => {
    try {
      await gristReady()
      existingTables = await listTables()
      const config = await loadConfig()
      if (config?.instalado) {
        schoolData.escuela_nombre = config.escuela_nombre || ''
        schoolData.escuela_numero = config.escuela_numero || ''
        schoolData.cooperadora_nombre = config.cooperadora_nombre || ''
      }
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  })

  const doInstall = async () => {
    installing = true
    error = ''
    try {
      const selectedKeys = getSelectedModuleKeys()
      const existingLower = new Set(existingTables.map((t) => String(t || '').toLowerCase()))

      const schemaResult = await ensureSchema(existingLower)
      if (schemaResult?.errors?.length > 0) {
        error = `Errores de schema: ${schemaResult.errors.join(', ')}`
        return
      }

      const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
      if (tEscuela) {
        let existingEscuela = []
        try { existingEscuela = await fetchRecords(tEscuela) } catch { /* empty */ }
        if (existingEscuela.length === 0) {
          await applyUserActions([['AddRecord', tEscuela, null, {
            escuela_nombre: schoolData.escuela_nombre || '',
            escuela_numero: schoolData.escuela_numero || '',
            cue: schoolData.cue || '',
            cooperadora_nombre: schoolData.cooperadora_nombre || '',
            cuit: schoolData.cuit || '',
            domicilio: schoolData.domicilio || '',
            localidad: schoolData.localidad || '',
            email_cooperadora: schoolData.email || '',
            telefono_cooperadora: schoolData.telefono || ''
          }]])
        }
      }

      const moduleFlags = {}
      for (const key of Object.keys(MODULES)) {
        moduleFlags[`modulo_${key}`] = Boolean(selectedModules[key])
      }

      await saveConfig({
        ...moduleFlags,
        ...schoolData,
        instalado: true,
        fecha_instalacion: new Date().toISOString()
      })

      if (selectedModules.gestion_completa || selectedModules.tesoreria) {
        await initDemoData([
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.ejercicios), seedName: 'ejercicios', batchSize: 10 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 },
          { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cargos), seedName: 'cargos', batchSize: 100 }
        ])
      }

      invalidateTablesCache()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      window.location.reload()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      installing = false
    }
  }

  const canNext = () => {
    if (step === 0) return getSelectedModuleKeys().length > 0
    if (step === 1) return true
    return true
  }
</script>

{#if loading}
  <div class="page">
    <p class="muted">Verificando estado del documento…</p>
  </div>
{:else}
  <main class="wrap">
    <div class="header">
      <h1>Configuración inicial de AppCoop</h1>
      <p class="lead">Elegí qué módulos instalar y configurá los datos de tu escuela y cooperadora.</p>
    </div>

    <div class="progress">
      {#each steps as s, i}
        <div class="dot" class:active={step === i} class:done={step > i}>
          <span class="dotN">{i + 1}</span>
          <span class="dotLabel">{s}</span>
        </div>
        {#if i < steps.length - 1}
          <div class="dotLine" class:done={step > i}></div>
        {/if}
      {/each}
    </div>

    {#if step === 0}
      <section class="card">
        <h2>¿Qué módulos necesitás?</h2>
        <p class="sub">Seleccioná los módulos a instalar. Cada módulo crea las tablas necesarias.</p>

        <div class="modules">
          {#each Object.entries(MODULES) as [key, mod]}
            <label class="module" class:checked={selectedModules[key]}>
              <input type="checkbox" checked={selectedModules[key]} onchange={() => toggleModule(key)} />
              <div class="moduleBody">
                <div class="moduleTitle">{mod.label}</div>
                <div class="moduleDesc">{mod.description}</div>
                <div class="moduleTables">{mod.tables.length} tabla(s)</div>
              </div>
            </label>
          {/each}
        </div>
      </section>
    {:else if step === 1}
      <section class="card">
        <h2>Datos de la escuela y cooperadora</h2>
        <p class="sub">Estos datos se usan en reportes y en la interfaz. Podés cambiarlos después.</p>

        <div class="formGrid">
          <label>
            <span>Nombre de la escuela</span>
            <input bind:value={schoolData.escuela_nombre} placeholder="Ej: Escuela N° 12" />
          </label>
          <label>
            <span>Número de escuela</span>
            <input bind:value={schoolData.escuela_numero} placeholder="Ej: 12" />
          </label>
          <label>
            <span>CUE</span>
            <input bind:value={schoolData.cue} placeholder="Clave Única de Establecimiento" />
          </label>
          <label>
            <span>Nombre de la cooperadora</span>
            <input bind:value={schoolData.cooperadora_nombre} placeholder="Ej: Cooperadora Escolar N° 12" />
          </label>
          <label>
            <span>CUIT cooperadora</span>
            <input bind:value={schoolData.cuit} placeholder="30-XXXXXXXX-X" />
          </label>
          <label>
            <span>Domicilio</span>
            <input bind:value={schoolData.domicilio} placeholder="Calle N° 123" />
          </label>
          <label>
            <span>Localidad</span>
            <input bind:value={schoolData.localidad} placeholder="Ciudad / Partido" />
          </label>
          <label>
            <span>Email</span>
            <input bind:value={schoolData.email} placeholder="cooperadora@email.com" />
          </label>
          <label>
            <span>Teléfono</span>
            <input bind:value={schoolData.telefono} placeholder="+54 ..." />
          </label>
          <label>
            <span>Color de marca</span>
            <input type="color" bind:value={schoolData.color_primario} />
          </label>
        </div>
      </section>
    {:else if step === 2}
      <section class="card">
        <h2>Revisá y instalá</h2>
        <p class="sub">Se crearán las tablas necesarias y se guardará la configuración.</p>

        <div class="summary">
          <div class="summarySection">
            <div class="summaryTitle">Módulos seleccionados</div>
            <ul>
              {#each getSelectedModuleKeys() as key}
                <li>{MODULES[key].label}</li>
              {/each}
            </ul>
          </div>
          <div class="summarySection">
            <div class="summaryTitle">Tablas a crear</div>
            <div class="summaryCount">{getTableCount()} tablas</div>
          </div>
          {#if schoolData.escuela_nombre || schoolData.cooperadora_nombre}
            <div class="summarySection">
              <div class="summaryTitle">Escuela</div>
              <div class="summaryText">
                {schoolData.escuela_nombre || 'Sin nombre'}
                {#if schoolData.escuela_numero}· N° {schoolData.escuela_numero}{/if}
              </div>
              <div class="summaryText">{schoolData.cooperadora_nombre || ''}</div>
            </div>
          {/if}
        </div>

        {#if installing}
          <div class="installing">
            <div class="spinner"></div>
            <p>Instalando tablas y configuración…</p>
          </div>
        {/if}
      </section>
    {/if}

    {#if error}
      <div class="msg error">
        <div class="msgTitle">Error</div>
        <div class="msgBody">{error}</div>
      </div>
    {/if}

    <div class="nav">
      {#if step > 0 && !installing}
        <button class="btn secondary" onclick={() => step -= 1}>Atrás</button>
      {/if}
      {#if step < steps.length - 1}
        <button class="btn" onclick={() => step += 1} disabled={!canNext()}>Siguiente</button>
      {:else}
        <button class="btn" onclick={doInstall} disabled={installing}>
          {installing ? 'Instalando…' : 'Instalar ahora'}
        </button>
      {/if}
    </div>
  </main>
{/if}

<style>
  .wrap {
    max-width: 680px;
    margin: 0 auto;
    padding: 24px 18px;
  }

  .header {
    margin-bottom: 20px;
  }

  h1 {
    margin: 0 0 6px 0;
    font-size: 22px;
  }

  .lead {
    margin: 0;
    opacity: 0.8;
    font-size: 14px;
    line-height: 1.5;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 20px;
  }

  .dot {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .dotN {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    border: 1px solid rgba(128, 128, 128, 0.3);
    background: rgba(128, 128, 128, 0.06);
  }

  .dot.active .dotN {
    border-color: rgba(22, 179, 120, 0.5);
    background: rgba(22, 179, 120, 0.15);
  }

  .dot.done .dotN {
    border-color: rgba(22, 179, 120, 0.5);
    background: rgba(22, 179, 120, 0.2);
    color: #16b378;
  }

  .dotLabel {
    font-size: 13px;
    font-weight: 700;
    opacity: 0.7;
  }

  .dot.active .dotLabel {
    opacity: 1;
  }

  .dotLine {
    flex: 1;
    height: 2px;
    background: rgba(128, 128, 128, 0.2);
    min-width: 20px;
  }

  .dotLine.done {
    background: rgba(22, 179, 120, 0.4);
  }

  .card {
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.04);
    padding: 20px;
    margin-bottom: 16px;
  }

  h2 {
    margin: 0 0 6px 0;
    font-size: 17px;
  }

  .sub {
    margin: 0 0 16px 0;
    font-size: 13px;
    opacity: 0.7;
  }

  .modules {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .module {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(128, 128, 128, 0.18);
    background: rgba(128, 128, 128, 0.03);
    cursor: pointer;
    transition: border-color 120ms, background 120ms;
  }

  .module:hover {
    border-color: rgba(22, 179, 120, 0.3);
  }

  .module.checked {
    border-color: rgba(22, 179, 120, 0.4);
    background: rgba(22, 179, 120, 0.06);
  }

  .module input[type="checkbox"] {
    margin-top: 3px;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .moduleTitle {
    font-weight: 800;
    font-size: 14px;
  }

  .moduleDesc {
    font-size: 13px;
    opacity: 0.75;
    margin-top: 2px;
  }

  .moduleTables {
    font-size: 12px;
    opacity: 0.55;
    margin-top: 4px;
  }

  .formGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .formGrid label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .formGrid label span {
    font-size: 12px;
    font-weight: 700;
    opacity: 0.75;
  }

  .formGrid input {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    background: rgba(128, 128, 128, 0.04);
    color: inherit;
    font-size: 14px;
  }

  .formGrid input:focus {
    outline: none;
    border-color: rgba(22, 179, 120, 0.5);
  }

  .formGrid label:nth-last-child(1) {
    grid-column: span 1;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .summarySection {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(128, 128, 128, 0.15);
    background: rgba(128, 128, 128, 0.03);
  }

  .summaryTitle {
    font-weight: 800;
    font-size: 13px;
    margin-bottom: 6px;
  }

  .summary ul {
    margin: 0;
    padding-left: 18px;
  }

  .summary li {
    font-size: 13px;
    margin: 3px 0;
  }

  .summaryCount {
    font-size: 20px;
    font-weight: 900;
  }

  .summaryText {
    font-size: 13px;
    opacity: 0.8;
  }

  .installing {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(22, 179, 120, 0.3);
    background: rgba(22, 179, 120, 0.06);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(22, 179, 120, 0.2);
    border-top-color: #16b378;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .installing p {
    margin: 0;
    font-size: 14px;
  }

  .nav {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .msg {
    margin-top: 14px;
    padding: 12px;
    border-radius: 12px;
  }

  .msg.error {
    border: 1px solid rgba(220, 50, 50, 0.3);
    background: rgba(220, 50, 50, 0.06);
  }

  .msgTitle {
    font-weight: 800;
    font-size: 13px;
  }

  .msgBody {
    font-size: 13px;
    margin-top: 4px;
    opacity: 0.85;
  }

  @media (max-width: 600px) {
    .formGrid {
      grid-template-columns: 1fr;
    }
    .dotLabel {
      display: none;
    }
  }
</style>
