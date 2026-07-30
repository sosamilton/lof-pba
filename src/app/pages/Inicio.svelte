<script>
  import { onMount } from 'svelte'
  import { detectGrist, gristReady, isInGrist, listTables, resolveTableId, subscribeRecords } from '$core/grist'
  import { REQUIRED_TABLES } from '$core/schema'
  import { ensureSchema, getSchemaDiff, initDemoData } from '$setup/initAppCoop'
  import { runMigration, deduplicatePersonas } from '$setup/migracion'
  import { TABLE_PREFERRED_IDS } from '$core/utils'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import MessageBanner from '$lib/components/MessageBanner.svelte'
  import { notify, withNotify } from '$core/notify.svelte'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw'
  import WrenchIcon from '@lucide/svelte/icons/wrench'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import CopyCheckIcon from '@lucide/svelte/icons/copy-check'

  let loading = $state(false)
  let error = $state('')
  let status = $state(null)
  let creating = $state(false)
  let migrating = $state(false)
  let migrationResult = $state(null)
  let dedupResult = $state(null)
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
      await withNotify('Instalando plantilla…', async () => {
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
      }, { success: 'Plantilla instalada', error: 'Error al instalar' })
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
      await withNotify('Migrando a personas…', async () => {
        const schemaResult = await ensureSchema(new Set((status?.tables || []).map((t) => String(t || '').toLowerCase())))
        if (schemaResult?.errors?.length > 0) {
          throw new Error(`Schema con errores: ${schemaResult.errors.join(', ')}`)
        }
        migrationResult = await runMigration()
      }, { success: 'Migración completada', error: 'Error en migración' })
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      migrating = false
    }
  }

  const doDedup = async () => {
    if (!confirm('Se buscarán y fusionarán personas con DNI duplicado. ¿Continuar?')) return
    migrating = true
    error = ''
    dedupResult = null
    try {
      await withNotify('Deduplicando personas…', async () => {
        dedupResult = await deduplicatePersonas()
      }, { success: 'Deduplicación completada', error: 'Error en deduplicación' })
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
      await withNotify('Reparando schema…', async () => {
        repairResult = await ensureSchema(new Set((status?.tables || []).map((t) => String(t || '').toLowerCase())))
      }, { success: 'Schema reparado', error: 'Error al reparar' })
      await check()
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      creating = false
    }
  }

  onMount(async () => {
    const status = await detectGrist()
    if (status !== 'ready') return
    const unsub = subscribeRecords(() => {
      if (!creating && !migrating) check()
    })
    await check()
    return unsub
  })
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center gap-2">
    <DatabaseIcon class="size-5 text-primary" />
    <h1 class="text-lg font-bold">AppCoop</h1>
  </div>

  {#if isInGrist()}
    <p class="text-sm text-muted-foreground">Modo widget Grist detectado.</p>

    {#if loading}
      <div class="flex flex-col gap-4">
        <Skeleton class="h-8 w-48" />
        <Skeleton class="h-64 w-full" />
      </div>
    {:else if status}
      {#if status.missing.length === 0}
        {#if status.schemaDiff?.missingTables?.length === 0 && status.schemaDiff?.missingColumns?.length === 0}
          <Card.Root>
            <Card.Content class="flex flex-col gap-4 pt-6">
              <div class="flex items-center gap-2">
                <CheckCircleIcon class="size-5 text-primary" />
                <span class="text-sm font-semibold">Plantilla AppCoop instalada y sincronizada</span>
              </div>
              <p class="text-sm text-muted-foreground">Usá el menú para navegar.</p>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onclick={check} disabled={creating}>
                  <RefreshIcon data-icon="inline-start" />
                  Revalidar
                </Button>
                <Button variant="outline" size="sm" onclick={initAppCoop} disabled={creating}>
                  Cargar datos base
                </Button>
                <Button variant="outline" size="sm" onclick={repairSchema} disabled={creating}>
                  <WrenchIcon data-icon="inline-start" />
                  Reparar Refs
                </Button>
                <Button size="sm" onclick={doMigration} disabled={migrating || creating}>
                  <ArrowUpIcon data-icon="inline-start" />
                  {migrating ? 'Migrando…' : 'Migrar a personas'}
                </Button>
                <Button variant="outline" size="sm" onclick={doDedup} disabled={migrating || creating}>
                  <CopyCheckIcon data-icon="inline-start" />
                  {migrating ? 'Procesando…' : 'Deduplicar personas'}
                </Button>
              </div>

              {#if migrationResult}
                <Separator />
                <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <div class="text-sm font-semibold">Migración completada</div>
                  <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
                    <li>Personas creadas: <strong>{migrationResult.personasCreadas}</strong></li>
                    <li>Personas existentes reutilizadas: <strong>{migrationResult.personasActualizadas}</strong></li>
                    <li>Socios vinculados: <strong>{migrationResult.sociosVinculados}</strong></li>
                    <li>Autoridades vinculadas: <strong>{migrationResult.autoridadesVinculadas}</strong></li>
                    <li>Pendientes: <strong>{migrationResult.pendientes.length}</strong></li>
                  </ul>
                  {#if migrationResult.pendientes.length > 0}
                    <details class="mt-2">
                      <summary class="text-sm cursor-pointer">Ver pendientes ({migrationResult.pendientes.length})</summary>
                      <ul class="mt-2 ml-4 list-disc text-xs text-muted-foreground">
                        {#each migrationResult.pendientes as p (p.id)}
                          <li>
                            <span class="font-mono">{p.tabla}:{p.id}</span> — {p.motivo}
                            ({p.apellido || p.apellido_nombre || ''} {p.nombre || ''})
                          </li>
                        {/each}
                      </ul>
                    </details>
                  {/if}
                </div>
              {/if}

              {#if dedupResult}
                <Separator />
                <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <div class="text-sm font-semibold">Deduplicación completada</div>
                  <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
                    <li>Duplicados encontrados: <strong>{dedupResult.duplicatesFound}</strong></li>
                    <li>Campos fusionados: <strong>{dedupResult.merged}</strong></li>
                    <li>Personas eliminadas: <strong>{dedupResult.removed}</strong></li>
                  </ul>
                </div>
              {/if}

              {#if repairResult}
                <Separator />
                <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <div class="text-sm font-semibold">Schema reparado</div>
                  <ul class="mt-2 ml-4 list-disc text-sm text-muted-foreground">
                    <li>Tablas creadas: <strong>{repairResult.created}</strong></li>
                    <li>Columnas agregadas: <strong>{repairResult.addedColumns}</strong></li>
                    <li>Refs corregidas: <strong>{repairResult.repairedRefs}</strong></li>
                  </ul>
                </div>
              {/if}
            </Card.Content>
          </Card.Root>
        {:else}
          <Card.Root class="border-destructive/40">
            <Card.Content class="flex flex-col gap-4 pt-6">
              <div class="flex items-center gap-2">
                <AlertTriangleIcon class="size-5 text-destructive" />
                <span class="text-sm font-semibold">Hay diferencias con el schema</span>
              </div>
              {#if status.schemaDiff?.missingTables?.length}
                <div>
                  <p class="text-sm font-medium mb-1">Tablas faltantes:</p>
                  <ul class="ml-4 list-disc text-sm text-muted-foreground">
                    {#each status.schemaDiff.missingTables as t (t.id)}
                      <li><span class="font-mono">{t.id}</span></li>
                    {/each}
                  </ul>
                </div>
              {/if}
              {#if status.schemaDiff?.missingColumns?.length}
                <div>
                  <p class="text-sm font-medium mb-1">Columnas faltantes:</p>
                  <ul class="ml-4 list-disc text-sm text-muted-foreground">
                    {#each status.schemaDiff.missingColumns as it (it.tableId)}
                      <li><span class="font-mono">{it.tableId}</span>: {it.columns.map((c) => c.id).join(', ')}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onclick={check} disabled={creating}>Revalidar</Button>
                <Button size="sm" onclick={initAppCoop} disabled={creating}>Actualizar schema + datos base</Button>
              </div>
            </Card.Content>
          </Card.Root>
        {/if}
      {:else}
        <Card.Root class="border-destructive/40">
          <Card.Content class="flex flex-col gap-4 pt-6">
            <div class="flex items-center gap-2">
              <AlertTriangleIcon class="size-5 text-destructive" />
              <span class="text-sm font-semibold">Faltan tablas para que la app funcione</span>
            </div>
            <ul class="ml-4 list-disc text-sm text-muted-foreground">
              {#each status.missing as t (t.key)}
                <li>{t.label} (<span class="font-mono">{t.tableId}</span>)</li>
              {/each}
            </ul>
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onclick={check} disabled={creating}>Reintentar</Button>
              <Button size="sm" onclick={initAppCoop} disabled={creating}>Instalar plantilla AppCoop</Button>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    {/if}
  {:else}
    <Card.Root>
      <Card.Content class="flex flex-col gap-3 pt-6">
        <p class="text-sm text-muted-foreground">Esta app está pensada para ejecutarse dentro de Grist como Custom Widget.</p>
        <p class="text-sm text-muted-foreground">Al abrirla desde un navegador, no tiene acceso a los datos del documento.</p>
        <Separator />
        <p class="text-sm font-semibold">Cómo instalarla en un documento Grist</p>
        <ol class="ml-5 list-decimal text-sm text-muted-foreground">
          <li>Abrí tu documento</li>
          <li><span class="font-mono">Add New</span> → <span class="font-mono">Add Widget to Page</span> → <span class="font-mono">Custom</span></li>
          <li>Pegá la URL publicada (GitHub Pages)</li>
          <li>Elegí <span class="font-mono">Access level</span>: <strong>Full document access</strong></li>
        </ol>
      </Card.Content>
    </Card.Root>
  {/if}

  <MessageBanner error={error} />
</div>
