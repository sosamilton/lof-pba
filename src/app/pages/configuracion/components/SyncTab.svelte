<script>
  import { onMount } from 'svelte'
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import CloudIcon from '@lucide/svelte/icons/cloud'
  import CloudOffIcon from '@lucide/svelte/icons/cloud-off'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert'
  import PlugIcon from '@lucide/svelte/icons/plug'
  import PlugZapIcon from '@lucide/svelte/icons/plug-zap'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import EyeOffIcon from '@lucide/svelte/icons/eye-off'
  import { syncStore as sync } from '../syncStore.svelte.js'

  // Componente autocontenido: no recibe props.
  let _props = $props()

  // Estado local de edición
  let url = $state('')
  let user = $state('')
  let password = $state('')
  let autoSync = $state(true)
  let enabled = $state(false)
  let saving = $state(false)
  let savedMsg = $state('')
  let testing = $state(false)
  let testResult = $state(null)
  let showPassword = $state(false)
  let statusUnsub = null
  let currentStatus = $state('idle')

  onMount(async () => {
    await sync.load()
    const cfg = sync.config
    url = cfg.sync_url
    user = cfg.sync_user
    password = cfg.sync_password
    autoSync = cfg.sync_auto
    enabled = cfg.sync_enabled
    statusUnsub = sync.subscribe((s) => { currentStatus = s })
    return () => { statusUnsub?.() }
  })

  const save = async () => {
    saving = true
    savedMsg = ''
    try {
      await sync.save({
        sync_enabled: enabled,
        sync_url: url.trim(),
        sync_user: user.trim(),
        sync_password: password,
        sync_auto: autoSync,
      })
      savedMsg = 'Configuración guardada.'
      // Si está habilitado, reiniciar sync con la nueva config
      if (enabled) {
        await sync.restart()
      } else {
        sync.stop()
      }
    } catch (e) {
      savedMsg = `Error: ${e?.message || String(e)}`
    } finally {
      saving = false
    }
  }

  const test = async () => {
    testing = true
    testResult = null
    try {
      // Guardar antes de testear para que use la config nueva
      await sync.save({
        sync_enabled: enabled,
        sync_url: url.trim(),
        sync_user: user.trim(),
        sync_password: password,
        sync_auto: autoSync,
      })
      testResult = await sync.testConnection()
    } finally {
      testing = false
    }
  }

  const toggleEnabled = async (v) => {
    enabled = v
    if (!v) {
      sync.stop()
    }
  }

  const statusLabel = {
    idle: 'Inactivo',
    active: 'Sincronizando',
    paused: 'Al día',
    error: 'Error',
    denied: 'Acceso denegado',
  }

  const statusVariant = {
    idle: 'secondary',
    active: 'default',
    paused: 'secondary',
    error: 'destructive',
    denied: 'destructive',
  }
</script>

{#if !sync.isPouchMode}
  <Card.Root class="pt-2 border-0 shadow-none">
    <Card.Content class="pt-4">
      <div class="flex items-start gap-3 rounded-lg border border-border bg-muted/5 px-4 py-3">
        <CloudOffIcon class="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium">Sincronización no disponible</p>
          <p class="text-xs text-muted-foreground mt-1">
            La sincronización con CouchDB solo está disponible en modo standalone (PouchDB).
            Cuando la app corre dentro de Grist, los datos ya están en el documento de Grist.
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
{:else}
  <Card.Root class="pt-2 border-0 shadow-none">
    <Card.Content class="flex flex-col gap-4 pt-4">
      <!-- Estado actual -->
      <div class="rounded-lg border border-border px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if currentStatus === 'active'}
            <RefreshCwIcon class="size-4 text-primary animate-spin" />
          {:else if currentStatus === 'paused' || currentStatus === 'idle'}
            <CloudIcon class="size-4 text-muted-foreground" />
          {:else}
            <AlertCircleIcon class="size-4 text-destructive" />
          {/if}
          <div>
            <div class="text-sm font-medium">Estado de sincronización</div>
            <div class="text-xs text-muted-foreground">Replicación bidireccional con CouchDB</div>
          </div>
        </div>
        <Badge variant={statusVariant[currentStatus] || 'secondary'}>
          {statusLabel[currentStatus] || currentStatus}
        </Badge>
      </div>

      <!-- Habilitar/deshabilitar -->
      <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <PlugIcon class="size-4 text-primary" />
          <div>
            <div class="text-sm font-medium">Habilitar sincronización</div>
            <div class="text-xs text-muted-foreground">Activa la replicación con un servidor CouchDB remoto</div>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={toggleEnabled} />
      </div>

      {#if enabled}
        <Separator />

        <!-- Configuración de conexión -->
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <PlugZapIcon class="size-4 text-primary" />
            <span class="text-sm font-semibold">Configuración de conexión</span>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <Label for="sync-url">URL de CouchDB</Label>
              <Input
                id="sync-url"
                bind:value={url}
                placeholder="http://localhost:5984/lof"
                class="font-mono text-sm"
              />
              <p class="text-xs text-muted-foreground">
                URL completa incluyendo el nombre de la base de datos.
                Ej: <code>https://couchdb.midominio.com/lof</code>
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="sync-user">Usuario</Label>
              <Input
                id="sync-user"
                bind:value={user}
                placeholder="admin"
                class="text-sm"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="sync-password">Contraseña</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="sync-password"
                  type={showPassword ? 'text' : 'password'}
                  bind:value={password}
                  placeholder="••••••••"
                  class="text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={() => (showPassword = !showPassword)}
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {#if showPassword}
                    <EyeOffIcon class="size-4" />
                  {:else}
                    <EyeIcon class="size-4" />
                  {/if}
                </Button>
              </div>
            </div>
          </div>

          <!-- Auto-sync -->
          <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <div class="text-sm font-medium">Sincronización automática</div>
              <div class="text-xs text-muted-foreground">
                Iniciar sync automáticamente al abrir la app. Si está apagado,
                hay que iniciar manualmente cada vez.
              </div>
            </div>
            <Switch checked={autoSync} onCheckedChange={(v) => (autoSync = v)} />
          </div>

          <!-- Botones de acción -->
          <div class="flex flex-wrap gap-2">
            <Button onclick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Button>
            <Button variant="outline" onclick={test} disabled={testing || !url}>
              {testing ? 'Probando…' : 'Probar conexión'}
            </Button>
          </div>

          {#if savedMsg}
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircleIcon class="size-3.5 text-primary" />
              {savedMsg}
            </div>
          {/if}

          {#if testResult}
            {#if testResult.ok}
              <div class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <CheckCircleIcon class="size-4 text-primary shrink-0 mt-0.5" />
                <div class="text-xs">
                  <strong>Conexión exitosa.</strong>
                  {#if testResult.info}
                    <div class="text-muted-foreground mt-1">
                      CouchDB {testResult.info.version} · UUID: {testResult.info.uuid?.slice(0, 8)}…
                    </div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <AlertCircleIcon class="size-4 text-destructive shrink-0 mt-0.5" />
                <div class="text-xs">
                  <strong>No se pudo conectar.</strong>
                  <div class="text-destructive mt-1">{testResult.error}</div>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <Separator />

      <!-- Info -->
      <div class="flex items-start gap-2 rounded-lg border border-border bg-muted/5 px-4 py-3">
        <CloudIcon class="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div class="text-xs text-muted-foreground leading-relaxed">
          <strong class="text-foreground">¿Cómo funciona?</strong>
          LOF guarda los datos localmente en tu navegador (PouchDB) y los
          sincroniza bidireccionalmente con CouchDB cuando hay conexión.
          Si no hay conexión, los cambios se guardan localmente y se
          sincronizan automáticamente al reconectar. Cada cooperadora
          debería tener su propia base de datos en el servidor CouchDB.
        </div>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
