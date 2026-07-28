<script>
  import { onMount } from 'svelte'
  import { detectGrist, gristReady, isInGrist, listTables } from '../grist'
  import { REQUIRED_TABLES } from '../demoSchema'
  import { ensureSchema, initDemoData } from '../initAppCoop'

  let loading = false
  let error = ''
  let status = null
  let creating = false

  const toKey = (s) => String(s || '').toLowerCase()

  const findTable = (tables, preferredIds) => {
    const hay = new Set((tables || []).map(toKey))
    return preferredIds.find((id) => hay.has(toKey(id))) || null
  }

  const check = async () => {
    loading = true
    error = ''
    try {
      await gristReady()
      const tables = await listTables()
      const resolved = {}
      const missing = []
      for (const t of REQUIRED_TABLES) {
        const hit = findTable(tables, t.preferredIds)
        if (!hit) missing.push(t)
        else resolved[t.key] = hit
      }
      status = { tables, resolved, missing }
    } catch (e) {
      error = e?.message || String(e)
      status = null
    } finally {
      loading = false
    }
  }

  const initAppCoop = async () => {
    creating = true
    error = ''
    try {
      const tablesBefore = status?.tables || (await listTables())
      const existing = new Set(tablesBefore.map((t) => String(t || '').toLowerCase()))
      await ensureSchema(existing)

      const tablesAfter = await listTables()
      const resolve = (ids) => findTable(tablesAfter, ids) || ids[0]

      await initDemoData([
        { tableId: resolve(['escuela']), seedName: 'escuela', batchSize: 10 },
        { tableId: resolve(['datos_banco']), seedName: 'datos_banco', batchSize: 10 },
        { tableId: resolve(['kiosco_libreria']), seedName: 'kiosco_libreria', batchSize: 10 },
        { tableId: resolve(['ejercicios']), seedName: 'ejercicios', batchSize: 10 },
        { tableId: resolve(['cuentas']), seedName: 'cuentas', batchSize: 50 },
        { tableId: resolve(['rubros_pia']), seedName: 'rubros_pia', batchSize: 100 },
        { tableId: resolve(['cargos']), seedName: 'cargos', batchSize: 100 }
      ])
      await check()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      creating = false
    }
  }

  onMount(async () => {
    if (!(await detectGrist())) return
    await check()
  })
</script>

<div class="page">
  <h1>AppCoop</h1>
  {#if isInGrist()}
    <p>Modo widget Grist detectado.</p>
    {#if loading}
      <p>Verificando tablas…</p>
    {:else if status}
      {#if status.missing.length === 0}
        <p>Tablas mínimas OK. Usá el menú para navegar.</p>
        <div class="actions">
          <button class="btn secondary" on:click={check} disabled={creating}>Revalidar</button>
          <button class="btn" on:click={initAppCoop} disabled={creating}>Inicializar plantilla AppCoop</button>
        </div>
      {:else}
        <div class="msg error">
          <div class="msgTitle">Faltan tablas para que la demo funcione</div>
          <div class="msgBody">
            <ul>
              {#each status.missing as t (t.key)}
                <li>{t.label} (<span class="mono">{t.tableId}</span>)</li>
              {/each}
            </ul>
          </div>
          <div class="actions">
            <button class="btn secondary" on:click={check} disabled={creating}>Reintentar</button>
            <button class="btn" on:click={initAppCoop} disabled={creating}>Inicializar plantilla AppCoop</button>
          </div>
        </div>
      {/if}
    {:else}
      <p>Usá el menú para navegar.</p>
    {/if}
  {:else}
    <p>Esta demo está pensada para ejecutarse dentro de Grist como Custom Widget.</p>
    <p>Al abrirla desde un navegador, no tiene acceso a los datos del documento.</p>
    <div class="card">
      <p><strong>Cómo instalarla en un documento Grist</strong></p>
      <ol>
        <li>Abrí tu documento</li>
        <li><span class="mono">Add New</span> → <span class="mono">Add Widget to Page</span> → <span class="mono">Custom</span></li>
        <li>Pegá la URL publicada (GitHub Pages)</li>
        <li>Elegí <span class="mono">Access level</span>: <strong>Full document access</strong></li>
      </ol>
    </div>
  {/if}

  {#if error}
    <div class="msg error" style="margin-top:12px">
      <div class="msgTitle">Error</div>
      <div class="msgBody">{error}</div>
    </div>
  {/if}
</div>

<style>
  .page h1 {
    margin: 0 0 10px 0;
    font-size: 22px;
  }
  .page p {
    margin: 6px 0;
    opacity: 0.85;
  }
  .card {
    margin-top: 12px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    background: rgba(128, 128, 128, 0.08);
  }
  .card ol {
    margin: 8px 0 0 18px;
    padding: 0;
  }
  .card li {
    margin: 6px 0;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.95em;
  }
  .msg {
    margin-top: 12px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
  }
  .msg.error {
    border-color: rgba(176, 0, 32, 0.55);
    background: rgba(176, 0, 32, 0.08);
  }
  .msgTitle {
    font-weight: 800;
    margin-bottom: 6px;
  }
  .msgBody {
    opacity: 0.9;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
  .btn {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 700;
    background: rgba(22, 179, 120, 0.9);
    color: #fff;
  }
  .btn.secondary {
    background: rgba(128, 128, 128, 0.18);
    color: inherit;
  }
</style>
