<script>
  import { onMount } from 'svelte'
  import { detectGrist, gristReady, isInGrist, listTables, resolveTableId, subscribeRecords } from '../grist'
  import { REQUIRED_TABLES } from '../demoSchema'
  import { ensureSchema, getSchemaDiff, initDemoData } from '../initAppCoop'
  import { runMigration } from '../migracion'
  import { TABLE_PREFERRED_IDS } from '../utils'
  import '../shared.css'

  let loading = $state(false)
  let error = $state('')
  let status = $state(null)
  let creating = $state(false)
  let migrating = $state(false)
  let migrationResult = $state(null)
  let repairResult = $state(null)

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
      const schemaDiff = await getSchemaDiff()
      const resolved = {}
      const missing = []
      for (const t of REQUIRED_TABLES) {
        const hit = findTable(tables, t.preferredIds)
        if (!hit) missing.push(t)
        else resolved[t.key] = hit
      }
      status = { tables, resolved, missing, schemaDiff }
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

      await initDemoData([
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.escuela), seedName: 'escuela', batchSize: 10 },
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.datos_banco), seedName: 'datos_banco', batchSize: 10 },
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria), seedName: 'kiosco_libreria', batchSize: 10 },
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.ejercicios), seedName: 'ejercicios', batchSize: 10 },
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 },
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 },
        { tableId: await resolveTableId(TABLE_PREFERRED_IDS.cargos), seedName: 'cargos', batchSize: 100 }
      ])
      await check()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      creating = false
    }
  }

  const doMigration = async () => {
    const total = (status?.tables || []).length
    if (!confirm(`Se procesarán ${total} tablas. Esto creará personas y vinculará socios/autoridades. ¿Continuar?`)) return
    migrating = true
    error = ''
    migrationResult = null
    try {
      const schemaResult = await ensureSchema(new Set((status?.tables || []).map((t) => String(t || '').toLowerCase())))
      if (schemaResult?.errors?.length > 0) {
        error = `Schema con errores: ${schemaResult.errors.join(', ')}`
        return
      }
      migrationResult = await runMigration()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      migrating = false
    }
  }

  const repairSchema = async () => {
    creating = true
    error = ''
    repairResult = null
    try {
      const result = await ensureSchema(new Set((status?.tables || []).map((t) => String(t || '').toLowerCase())))
      repairResult = result
      await check()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      creating = false
    }
  }

  onMount(async () => {
    if (!(await detectGrist())) return
    const unsub = subscribeRecords(() => {
      if (!creating && !migrating) check()
    })
    await check()
    return unsub
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
        {#if status.schemaDiff?.missingTables?.length === 0 && status.schemaDiff?.missingColumns?.length === 0}
          <p>Plantilla AppCoop instalada y sincronizada. Usá el menú para navegar.</p>
          <div class="actions">
            <button class="btn secondary" onclick={check} disabled={creating}>Revalidar</button>
            <button class="btn" onclick={initAppCoop} disabled={creating}>Cargar datos base (si falta)</button>
            <button class="btn secondary" onclick={repairSchema} disabled={creating}>Reparar Refs</button>
            <button class="btn" onclick={doMigration} disabled={migrating || creating}>
              {migrating ? 'Migrando…' : 'Migrar a personas'}
            </button>
          </div>
          {#if migrationResult}
            <div class="migrationResult">
              <div class="msgTitle">Migración completada</div>
              <ul>
                <li>Personas creadas: <strong>{migrationResult.personasCreadas}</strong></li>
                <li>Personas existentes reutilizadas: <strong>{migrationResult.personasActualizadas}</strong></li>
                <li>Socios vinculados: <strong>{migrationResult.sociosVinculados}</strong></li>
                <li>Autoridades vinculadas: <strong>{migrationResult.autoridadesVinculadas}</strong></li>
                <li>Pendientes: <strong>{migrationResult.pendientes.length}</strong></li>
              </ul>
              {#if migrationResult.pendientes.length > 0}
                <details>
                  <summary>Ver pendientes ({migrationResult.pendientes.length})</summary>
                  <ul class="pendientes">
                    {#each migrationResult.pendientes as p (p.id)}
                      <li>
                        <span class="mono">{p.tabla}:{p.id}</span> — {p.motivo}
                        ({p.apellido || p.apellido_nombre || ''} {p.nombre || ''})
                      </li>
                    {/each}
                  </ul>
                </details>
              {/if}
            </div>
          {/if}
          {#if repairResult}
            <div class="migrationResult">
              <div class="msgTitle">Schema reparado</div>
              <ul>
                <li>Tablas creadas: <strong>{repairResult.created}</strong></li>
                <li>Columnas agregadas: <strong>{repairResult.addedColumns}</strong></li>
                <li>Refs corregidas: <strong>{repairResult.repairedRefs}</strong></li>
              </ul>
              {#if repairResult.repairedRefs > 0}
                <p class="muted">Se corrigieron columnas Ref con mayúsculas/minúsculas incorrectas. Probá guardar de nuevo.</p>
              {/if}
            </div>
          {/if}
        {:else}
          <div class="msg error">
            <div class="msgTitle">Hay diferencias con el schema</div>
            <div class="msgBody">
              {#if status.schemaDiff?.missingTables?.length}
                <div style="margin-bottom:6px">
                  Tablas faltantes:
                  <ul>
                    {#each status.schemaDiff.missingTables as t (t.id)}
                      <li><span class="mono">{t.id}</span></li>
                    {/each}
                  </ul>
                </div>
              {/if}
              {#if status.schemaDiff?.missingColumns?.length}
                <div>
                  Columnas faltantes:
                  <ul>
                    {#each status.schemaDiff.missingColumns as it (it.tableId)}
                      <li>
                        <span class="mono">{it.tableId}</span>: {it.columns.map((c) => c.id).join(', ')}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
            <div class="actions">
              <button class="btn secondary" onclick={check} disabled={creating}>Revalidar</button>
              <button class="btn" onclick={initAppCoop} disabled={creating}>Actualizar schema + datos base</button>
            </div>
          </div>
        {/if}
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
            <button class="btn secondary" onclick={check} disabled={creating}>Reintentar</button>
            <button class="btn" onclick={initAppCoop} disabled={creating}>Instalar plantilla AppCoop</button>
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
  .card ol {
    margin: 8px 0 0 18px;
    padding: 0;
  }
  .card li {
    margin: 6px 0;
  }
  .msgBody {
    opacity: 0.9;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
  .migrationResult {
    margin-top: 12px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.08);
  }
  .migrationResult ul {
    margin: 6px 0 0 18px;
    padding: 0;
  }
  .pendientes {
    font-size: 13px;
    opacity: 0.85;
  }
  .pendientes li {
    margin: 4px 0;
  }
</style>
