<script>
  import { onMount } from 'svelte'
  import { configStore } from '$core/grist/stores/configStore.svelte'
  import { ROLES, migrateRoleFromConfig, DEFAULT_ROLE } from '$core/security/roles'
  import { pinStore } from '$core/security/pinStore.svelte'
  import { passphraseStore } from '$core/security/passphraseStore.svelte'
  import { passkeyStore } from '$core/security/passkeyStore.svelte'
  import { snapshotScheduler, PERIODICITY } from '$core/security/snapshotScheduler.svelte'
  import { chooseSnapshotDirectory, getCurrentDirectory, getSaveStrategy } from '$core/security/fileOutput.js'
  import PassphrasePromptDialog from '$core/security/PassphrasePromptDialog.svelte'
  import { PIN_MIN_LENGTH, PIN_MAX_LENGTH, validatePin } from '$core/security/pinCrypto'
  import { loadConfig, saveConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
  import { notify } from '$core/ui/notify.svelte'
  import * as Card from '$lib/components/ui/card'
  import * as Field from '$lib/components/ui/field'
  import * as Select from '$lib/components/ui/select'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Separator } from '$lib/components/ui/separator'
  import ShieldIcon from '@lucide/svelte/icons/shield-check'
  import LockIcon from '@lucide/svelte/icons/lock'
  import KeyIcon from '@lucide/svelte/icons/key-round'
  import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
  import CameraIcon from '@lucide/svelte/icons/camera'
  import AlertCircleIcon from '@lucide/svelte/icons/circle-alert'
  import CopyCheckIcon from '@lucide/svelte/icons/copy-check'
  import { formatBytes } from '$core/format/format'
  import { trackEvent } from '$core/analytics/plausible.js'
  import { getActiveBackend } from '$core/data/dataRepository'

  // --- Rol del dispositivo ---
  let deviceRole = $derived(migrateRoleFromConfig(configStore.config))
  let savingRole = $state(false)
  let selectedRole = $state('')
  let roleChangeError = $state('')

  $effect(() => {
    if (deviceRole) selectedRole = deviceRole
  })

  const roleOptions = Object.entries(ROLES).map(([key, role]) => ({
    value: key,
    label: role.label,
    description: role.description,
  }))

  // Guard: no permitir salir de super_admin sin contraseña maestra + PIN de super_admin.
  // Sin esos dos, no hay forma de volver a super_admin (recovery key viene de la
  // contraseña maestra, y el PIN de super_admin es para reingresar con ese rol).
  let canChangeFromSuperAdmin = $derived(
    deviceRole !== 'super_admin' ||
    (passphraseStore.configured && pinStore.configuredRoles().includes('super_admin'))
  )

  async function saveRole() {
    if (!selectedRole || selectedRole === deviceRole) return
    roleChangeError = ''

    // Guard crítico: si estás en super_admin y querés bajar de rol,
    // necesitás contraseña maestra + PIN de super_admin configurados.
    // Esto garantiza que siempre podés volver a super_admin.
    if (deviceRole === 'super_admin' && selectedRole !== 'super_admin') {
      const missing = []
      if (!passphraseStore.configured) missing.push('contraseña maestra')
      if (!pinStore.configuredRoles().includes('super_admin')) missing.push('PIN de super_admin')
      if (missing.length > 0) {
        roleChangeError = `No podés cambiar de rol sin configurar primero ${missing.join(' y ')}. ` +
          'Sin esos, no podés volver a super_admin (la recovery key viene de la contraseña maestra, ' +
          'y el PIN de super_admin es para reingresar con ese rol).'
        notify.error(roleChangeError)
        return
      }
    }

    savingRole = true
    try {
      const config = await loadConfig()
      await saveConfig({ ...config, rol_dispositivo: selectedRole })
      await configStore.load()
      trackEvent('config_changed', { field: 'rol_dispositivo', value: selectedRole, backend: getActiveBackend() })

      // Cambiar el rol activo de la sesión en vivo (sin bloquear).
      // Así el usuario sigue en la app con el nuevo rol inmediatamente.
      pinStore.unlock(selectedRole)

      // Avisar si el rol destino no tiene PIN configurado.
      const targetHasPin = pinStore.configuredRoles().includes(selectedRole)
      if (targetHasPin) {
        notify.success(`Rol cambiado a: ${ROLES[selectedRole].label}.`)
      } else {
        notify.success(`Rol cambiado a: ${ROLES[selectedRole].label}.`)
        notify.warning(
          `No hay PIN configurado para ${ROLES[selectedRole].label}. ` +
          `Si bloqueás la app, vas a tener que entrar con el PIN de super_admin ` +
          `(que te dará rol super_admin, no ${ROLES[selectedRole].label}). ` +
          `Para usar este rol después de bloquear, volvé a super_admin y configurá un PIN para ${ROLES[selectedRole].label}.`
        )
      }
    } catch (e) {
      notify.error(e?.message || 'No se pudo cambiar el rol.')
    } finally {
      savingRole = false
    }
  }

  // --- PIN por rol ---
  let showPinForm = $state(/** @type {string | null} */ (null)) // rol para el que se está seteando PIN
  let newPin = $state('')
  let confirmPin = $state('')
  let savingPin = $state(false)
  let pinError = $state('')

  const ROLE_LIST = ['super_admin', 'admin', 'tesorero']

  function openSetPin(role) {
    showPinForm = role
    newPin = ''
    confirmPin = ''
    pinError = ''
  }

  async function savePin() {
    const role = showPinForm
    if (!role) return
    pinError = ''
    if (!validatePin(newPin)) {
      pinError = `El PIN debe tener entre ${PIN_MIN_LENGTH} y ${PIN_MAX_LENGTH} dígitos numéricos.`
      return
    }
    if (newPin !== confirmPin) {
      pinError = 'Los PINs no coinciden.'
      return
    }
    savingPin = true
    const ok = await pinStore.setPin(role, newPin)
    savingPin = false
    if (ok) {
      notify.success(`PIN para ${ROLES[role].label} configurado.`)
      showPinForm = null
      newPin = ''
      confirmPin = ''
      trackEvent('pin_set', { role, backend: getActiveBackend() })
    } else {
      pinError = 'No se pudo guardar el PIN.'
    }
  }

  async function removePinForRole(role) {
    pinStore.clearPinForRole(role)
    notify.success(`PIN para ${ROLES[role].label} eliminado.`)
    showPinForm = null
    newPin = ''
    confirmPin = ''
    trackEvent('pin_cleared', { role, backend: getActiveBackend() })
  }

  async function removeAllPins() {
    pinStore.clearPin()
    notify.success('Todos los PINs eliminados.')
    showPinForm = null
    newPin = ''
    confirmPin = ''
    trackEvent('pin_cleared_all', { backend: getActiveBackend() })
  }

  function onPinInput(e) {
    newPin = String(e.target.value).replace(/\D/g, '').slice(0, PIN_MAX_LENGTH)
  }

  function onConfirmPinInput(e) {
    confirmPin = String(e.target.value).replace(/\D/g, '').slice(0, PIN_MAX_LENGTH)
  }

  // --- Passkey ---
  let registeringPasskey = $state(false)
  let passkeyRecoveryKey = $state('')
  let showPasskeyRecovery = $state(false)

  async function registerPasskey() {
    registeringPasskey = true
    const result = await passkeyStore.register()
    registeringPasskey = false
    if (result.ok) {
      passkeyRecoveryKey = result.recoveryKey || ''
      showPasskeyRecovery = true
      notify.success('Passkey configurada. Guardá la recovery key en un sobre lacrado.')
      trackEvent('passkey_registered', { backend: getActiveBackend() })
    } else {
      notify.error(result.error || 'No se pudo configurar la passkey.')
    }
  }

  async function removePasskey() {
    passkeyStore.clearPasskey()
    notify.success('Passkey eliminada.')
    showPasskeyRecovery = false
    trackEvent('passkey_cleared', { backend: getActiveBackend() })
  }

  // --- Passphrase institucional ---
  let showPassphraseForm = $state(false)
  let newPassphrase = $state('')
  let confirmPassphrase = $state('')
  let currentPassphrase = $state('')
  let savingPassphrase = $state(false)
  let passphraseError = $state('')
  let generatedRecoveryKey = $state('')
  let recoveryKeyAcknowledged = $state(false)

  async function savePassphrase() {
    passphraseError = ''
    if (newPassphrase.length < 6) {
      passphraseError = 'La contraseña maestra debe tener al menos 6 caracteres.'
      return
    }
    if (newPassphrase !== confirmPassphrase) {
      passphraseError = 'Las contraseñas no coinciden.'
      return
    }
    // Si ya hay una contraseña configurada, pedir la actual para verificar.
    if (passphraseStore.configured) {
      const validCurrent = await passphraseStore.verifyPassphrase(currentPassphrase)
      if (!validCurrent) {
        passphraseError = 'La contraseña actual no es correcta.'
        return
      }
    }
    savingPassphrase = true
    const result = await passphraseStore.setPassphrase(newPassphrase)
    savingPassphrase = false
    if (result.ok) {
      newPassphrase = ''
      confirmPassphrase = ''
      currentPassphrase = ''
      showPassphraseForm = false
      trackEvent('passphrase_set', { backend: getActiveBackend() })
      if (result.recoveryKey) {
        // Es la primera vez — mostrar la recovery key hasta que confirmen
        // que la guardaron en un lugar seguro institucional.
        generatedRecoveryKey = result.recoveryKey
        recoveryKeyAcknowledged = false
        notify.success('Contraseña maestra configurada. Guardá la recovery key que aparece abajo.')
      } else {
        notify.success('Contraseña maestra actualizada.')
      }
    } else {
      passphraseError = 'No se pudo guardar la contraseña maestra.'
    }
  }

  // --- Snapshot sellado automático ---
  let snapshotEnabled = $state(false)
  let snapshotPeriodicity = $state(PERIODICITY.MONTHLY)
  let savingSnapshot = $state(false)
  let runningSnapshot = $state(false)
  let snapshotResult = $state('')
  let showPassphrasePrompt = $state(false)
  let snapshotDirInfo = $state('')
  let saveStrategy = $state('')

  $effect(() => {
    snapshotEnabled = snapshotScheduler.enabled
    snapshotPeriodicity = snapshotScheduler.periodicity
  })

  async function loadSnapshotDirInfo() {
    saveStrategy = getSaveStrategy()
    const dirInfo = await getCurrentDirectory()
    if (dirInfo.path) {
      snapshotDirInfo = dirInfo.path
    } else if (dirInfo.dirHandle) {
      snapshotDirInfo = dirInfo.dirHandle.name
    } else {
      snapshotDirInfo = ''
    }
  }

  onMount(() => {
    loadSnapshotDirInfo()
  })

  async function chooseDir() {
    const result = await chooseSnapshotDirectory()
    if (result.cancelled) return
    if (result.error) {
      notify.error(result.error)
      return
    }
    await loadSnapshotDirInfo()
    if (result.path || result.dirHandle) {
      notify.success('Carpeta de snapshots configurada.')
    }
  }

  async function saveSnapshotConfig() {
    savingSnapshot = true
    snapshotScheduler.configure({ enabled: snapshotEnabled, periodicity: snapshotPeriodicity })
    savingSnapshot = false
    notify.success('Configuración de snapshot guardada.')
    trackEvent('snapshot_configured', { enabled: snapshotEnabled, periodicity: snapshotPeriodicity, backend: getActiveBackend() })
  }

  async function runSnapshotNow() {
    runningSnapshot = true
    snapshotResult = ''
    showPassphrasePrompt = true
  }

  async function onPassphraseConfirm(passphrase) {
    // Cachear la passphrase en sessionStorage para el snapshot automático
    // en startup. Solo vive en esta pestaña.
    sessionStorage.setItem('lof-passphrase-session', passphrase)
    const result = await snapshotScheduler.maybeRunSnapshot(passphrase)
    runningSnapshot = false
    if (result.ran) {
      const strategy = result.result.saveStrategy || 'downloads'
      const path = result.result.savePath || 'Downloads'
      snapshotResult = `Snapshot generado: ${result.result.filename} (${formatBytes(result.result.size)}) → ${path}`
      notify.success(`Snapshot sellado guardado en ${path}.`)
      trackEvent('snapshot_run', { strategy, backend: getActiveBackend() })
    } else if (result.error) {
      snapshotResult = `Error: ${result.error}`
      notify.error(result.error)
    } else {
      snapshotResult = 'No corresponde correr snapshot todavía.'
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <ShieldIcon class="size-5" />
      Seguridad del dispositivo
    </Card.Title>
    <Card.Description>
      Configurá el acceso a este dispositivo y el rol que determina qué información puede ver y editar.
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-6">
    <!-- Rol del dispositivo -->
    <Field.Field>
      <Field.FieldLabel>Rol del dispositivo</Field.FieldLabel>
      <Select.Root type="single" bind:value={selectedRole}>
        <Select.Trigger class="w-full">{ROLES[selectedRole]?.label || 'Seleccionar…'}</Select.Trigger>
        <Select.Content>
          {#each roleOptions as opt (opt.value)}
            <Select.Item value={opt.value} label={opt.label}>
              <div class="flex flex-col gap-0.5">
                <span class="font-medium">{opt.label}</span>
                <span class="text-xs text-muted-foreground">{opt.description}</span>
              </div>
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Field.FieldDescription>
        El rol determina qué rutas y acciones están disponibles en este dispositivo. El primer dispositivo de la escuela queda con rol {ROLES[DEFAULT_ROLE].label} por defecto.
      </Field.FieldDescription>
    </Field.Field>

    {#if deviceRole === 'super_admin' && selectedRole !== 'super_admin' && !canChangeFromSuperAdmin}
      <Alert variant="destructive">
        <AlertCircleIcon data-icon="inline-start" />
        <AlertDescription class="text-sm">
          <strong>No podés bajar de rol todavía.</strong> Para volver a super_admin necesitás:
          <ul class="mt-1 ml-4 list-disc">
            {#if !passphraseStore.configured}
              <li>Configurar la <strong>contraseña maestra</strong> (genera la recovery key para recuperar acceso)</li>
            {/if}
            {#if !pinStore.configuredRoles().includes('super_admin')}
              <li>Configurar el <strong>PIN de super_admin</strong> (para reingresar con ese rol)</li>
            {/if}
          </ul>
          Configurá ambos más abajo en esta página, y después podés cambiar de rol.
        </AlertDescription>
      </Alert>
    {/if}

    {#if roleChangeError}
      <Alert variant="destructive">
        <AlertCircleIcon data-icon="inline-start" />
        <AlertDescription class="text-sm">{roleChangeError}</AlertDescription>
      </Alert>
    {/if}

    {#if deviceRole === 'super_admin' && selectedRole !== 'super_admin' && selectedRole !== deviceRole && canChangeFromSuperAdmin && !pinStore.configuredRoles().includes(selectedRole)}
      <Alert>
        <AlertCircleIcon data-icon="inline-start" />
        <AlertDescription class="text-sm">
          <strong>Advertencia:</strong> No hay PIN configurado para {ROLES[selectedRole]?.label}.
          Podés cambiar de rol ahora y seguir usando la app, pero si bloqueás la app
          vas a tener que entrar con el PIN de super_admin (que te dará rol super_admin).
          Para usar {ROLES[selectedRole]?.label} después de bloquear, volvé a super_admin
          y configurá un PIN para {ROLES[selectedRole]?.label} más abajo.
        </AlertDescription>
      </Alert>
    {/if}

    <div class="flex justify-end">
      <Button
        onclick={saveRole}
        disabled={savingRole || !selectedRole || selectedRole === deviceRole || (deviceRole === 'super_admin' && selectedRole !== 'super_admin' && !canChangeFromSuperAdmin)}
      >
        {savingRole ? 'Guardando…' : 'Guardar rol'}
      </Button>
    </div>

    <Separator />

    <!-- PIN de acceso por rol -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <LockIcon class="size-5" />
        <h3 class="font-semibold">Acceso con PIN (por rol)</h3>
      </div>

      <Alert>
        <AlertDescription class="text-sm">
          Cada rol tiene su propio PIN. Al ingresar el PIN, la app se desbloquea con ese rol.
          Esto permite compartir la PC entre roles distintos: el PIN de super_admin da acceso
          a todo, el de tesorero solo a lo operativo. La protección real de datos sensibles
          está en los backups cifrados.
        </AlertDescription>
      </Alert>

      <!-- Lista de roles con su estado de PIN -->
      <div class="flex flex-col gap-2">
        {#each ROLE_LIST as role (role)}
          {@const hasPin = pinStore.configuredRoles().includes(role)}
          <div class="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div class="flex items-center gap-2">
              {#if hasPin}
                <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <KeyIcon class="size-3" />
                  PIN activo
                </span>
              {:else}
                <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Sin PIN
                </span>
              {/if}
              <span class="text-sm font-medium">{ROLES[role].label}</span>
            </div>
            <div class="flex gap-1.5">
              {#if showPinForm === role}
                <Button variant="ghost" size="sm" onclick={() => { showPinForm = null; pinError = '' }}>Cancelar</Button>
              {:else}
                <Button variant="outline" size="sm" onclick={() => openSetPin(role)}>
                  {hasPin ? 'Cambiar' : 'Configurar'}
                </Button>
                {#if hasPin}
                  <Button variant="ghost" size="sm" onclick={() => removePinForRole(role)}>Eliminar</Button>
                {/if}
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Formulario de PIN (para el rol seleccionado) -->
      {#if showPinForm}
        <div class="rounded-lg border border-input p-4 bg-muted/30 flex flex-col gap-3">
          <div class="text-sm font-medium">
            PIN para {ROLES[showPinForm]?.label || showPinForm}
          </div>
          <Field.FieldGroup>
            <Field.Field>
              <Field.FieldLabel for="new-pin">PIN ({PIN_MIN_LENGTH}-{PIN_MAX_LENGTH} dígitos)</Field.FieldLabel>
              <Input id="new-pin" type="password" inputmode="numeric" autocomplete="off" value={newPin} oninput={onPinInput} maxlength={PIN_MAX_LENGTH} class="text-center tracking-widest" autofocus />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="confirm-pin">Confirmar PIN</Field.FieldLabel>
              <Input id="confirm-pin" type="password" inputmode="numeric" autocomplete="off" value={confirmPin} oninput={onConfirmPinInput} maxlength={PIN_MAX_LENGTH} class="text-center tracking-widest" />
            </Field.Field>
            {#if pinError}
              <Alert variant="destructive">
                <AlertDescription class="text-sm">{pinError}</AlertDescription>
              </Alert>
            {/if}
            <div class="flex justify-end gap-2">
              <Button variant="outline" onclick={() => { showPinForm = null; pinError = '' }}>Cancelar</Button>
              <Button onclick={savePin} disabled={savingPin || !newPin || !confirmPin}>
                {savingPin ? 'Guardando…' : 'Guardar PIN'}
              </Button>
            </div>
          </Field.FieldGroup>
        </div>
      {/if}

      <!-- Eliminar todos los PINs -->
      {#if pinStore.enabled && !showPinForm}
        <div class="flex justify-end">
          <Button variant="ghost" size="sm" onclick={removeAllPins}>Eliminar todos los PINs</Button>
        </div>
      {/if}
    </div>

    <!-- Passkey (WebAuthn) -->
    <Separator />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <FingerprintIcon class="size-5" />
        <h3 class="font-semibold">Passkey (biometría / llave de hardware)</h3>
      </div>

      {#if !passkeyStore.supported}
        <Alert>
          <AlertDescription class="text-sm">
            Este dispositivo no soporta passkey (WebAuthn). Usá el PIN para proteger el acceso.
          </AlertDescription>
        </Alert>
      {:else if passkeyStore.configured}
        <div class="flex items-center gap-2 text-sm">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <FingerprintIcon class="size-3" />
            Passkey activiva
          </span>
        </div>

        {#if showPasskeyRecovery && passkeyRecoveryKey}
          <Alert>
            <AlertDescription class="text-sm">
              <div class="font-semibold mb-1">Recovery key (mostrala una sola vez)</div>
              <code class="block bg-muted p-2 rounded text-xs break-all">{passkeyRecoveryKey}</code>
              <div class="mt-2">Imprimila y guardala en un sobre lacrado en el armario institucional. Si perdés la passkey, esta key es la única forma de recuperar el acceso.</div>
            </AlertDescription>
          </Alert>
        {/if}

        <div class="flex gap-2">
          <Button variant="outline" onclick={removePasskey}>Eliminar passkey</Button>
        </div>
      {:else}
        <Alert>
          <AlertDescription class="text-sm">
            La passkey usa biometría (huella, Face ID) o una llave de hardware para desbloquear la app. Si la configurás, reemplaza al PIN — es lo más seguro que el dispositivo permite.
          </AlertDescription>
        </Alert>
        <div>
          <Button onclick={registerPasskey} disabled={registeringPasskey}>
            {registeringPasskey ? 'Registrando…' : 'Configurar passkey'}
          </Button>
        </div>
      {/if}
    </div>

    <!-- Passphrase institucional -->
    <Separator />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <KeyIcon class="size-5" />
        <h3 class="font-semibold">Contraseña maestra <span class="text-muted-foreground font-normal text-sm">(passphrase institucional)</span></h3>
      </div>

      <Alert>
        <AlertDescription class="text-sm">
          La contraseña maestra (passphrase institucional) cifra los backups de la cooperadora. Es única (no una por persona) y la custodia el directivo de la institución. <strong class="font-semibold">Guardala en un sobre lacrado en el armario institucional.</strong> Se transmite con el traspaso de comisión, igual que la llave del armario.
        </AlertDescription>
      </Alert>

      {#if generatedRecoveryKey}
        <Alert variant="default" class="border-primary/40 bg-primary/5">
          <KeyIcon data-icon="inline-start" />
          <AlertDescription class="text-sm">
            <div class="font-semibold mb-1">Recovery key generada</div>
            <p class="text-muted-foreground mb-2">
              Esta key te permite recuperar acceso a super_admin si perdés el PIN o cambiaste
              de rol. <strong>No se vuelve a mostrar.</strong> Guardala en un sobre lacrado
              en el armario institucional, igual que la contraseña maestra.
            </p>
            <code class="block bg-muted p-3 rounded text-sm break-all font-mono select-all">{generatedRecoveryKey}</code>
            <div class="flex flex-col gap-3 mt-3">
              <label class="flex items-start gap-2 text-sm">
                <input type="checkbox" bind:checked={recoveryKeyAcknowledged} class="size-4 rounded border-input mt-0.5" />
                <span>
                  Confirmo que guardé la recovery key en un sobre lacrado en el armario
                  institucional (o lugar seguro y accesible por la institución).
                </span>
              </label>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" onclick={() => navigator.clipboard.writeText(generatedRecoveryKey)}>
                  <CopyCheckIcon data-icon="inline-start" />
                  Copiar
                </Button>
                <Button variant="default" size="sm" disabled={!recoveryKeyAcknowledged} onclick={() => { generatedRecoveryKey = ''; recoveryKeyAcknowledged = false }}>
                  Ya la guardé en un lugar seguro
                </Button>
              </div>
              {#if !recoveryKeyAcknowledged}
                <p class="text-xs text-muted-foreground">
                  Marcá el checkbox de arriba para confirmar que la guardaste.
                </p>
              {/if}
            </div>
          </AlertDescription>
        </Alert>
      {/if}

      {#if passphraseStore.configured}
        <div class="flex items-center gap-2 text-sm">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <KeyIcon class="size-3" />
            Passphrase configurada
          </span>
        </div>

        {#if showPassphraseForm}
          <Field.FieldGroup>
            <Field.Field>
              <Field.FieldLabel for="current-passphrase">Contraseña maestra actual</Field.FieldLabel>
              <Input id="current-passphrase" type="password" autocomplete="off" bind:value={currentPassphrase} autofocus />
              <Field.FieldDescription>Verificamos que sos quien tiene la contraseña actual antes de cambiarla.</Field.FieldDescription>
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="new-passphrase">Contraseña maestra nueva</Field.FieldLabel>
              <Input id="new-passphrase" type="password" autocomplete="off" bind:value={newPassphrase} />
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="confirm-passphrase">Confirmar contraseña nueva</Field.FieldLabel>
              <Input id="confirm-passphrase" type="password" autocomplete="off" bind:value={confirmPassphrase} />
            </Field.Field>
            {#if passphraseError}
              <Alert variant="destructive">
                <AlertDescription class="text-sm">{passphraseError}</AlertDescription>
              </Alert>
            {/if}
            <div class="flex justify-end gap-2">
              <Button variant="outline" onclick={() => { showPassphraseForm = false; passphraseError = ''; currentPassphrase = '' }}>Cancelar</Button>
              <Button onclick={savePassphrase} disabled={savingPassphrase || !newPassphrase || !confirmPassphrase || !currentPassphrase}>
                {savingPassphrase ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
            </div>
          </Field.FieldGroup>
        {:else}
          <div class="flex gap-2">
            <Button variant="outline" onclick={() => { showPassphraseForm = true; newPassphrase = ''; confirmPassphrase = ''; currentPassphrase = ''; passphraseError = '' }}>Cambiar contraseña</Button>
          </div>
        {/if}
      {:else}
        {#if showPassphraseForm}
          <Field.FieldGroup>
            <Field.Field>
              <Field.FieldLabel for="new-passphrase">Contraseña maestra</Field.FieldLabel>
              <Input id="new-passphrase" type="password" autocomplete="off" bind:value={newPassphrase} autofocus />
              <Field.FieldDescription>Mínimo 6 caracteres. Elegí una frase que puedas recordar y anotar en el sobre.</Field.FieldDescription>
            </Field.Field>
            <Field.Field>
              <Field.FieldLabel for="confirm-passphrase">Confirmar passphrase</Field.FieldLabel>
              <Input id="confirm-passphrase" type="password" autocomplete="off" bind:value={confirmPassphrase} />
            </Field.Field>
            {#if passphraseError}
              <Alert variant="destructive">
                <AlertDescription class="text-sm">{passphraseError}</AlertDescription>
              </Alert>
            {/if}
            <div class="flex justify-end gap-2">
              <Button variant="outline" onclick={() => { showPassphraseForm = false; passphraseError = '' }}>Cancelar</Button>
              <Button onclick={savePassphrase} disabled={savingPassphrase || !newPassphrase || !confirmPassphrase}>
                {savingPassphrase ? 'Guardando…' : 'Guardar passphrase'}
              </Button>
            </div>
          </Field.FieldGroup>
        {:else}
          <div class="flex flex-col gap-3">
            <p class="text-sm text-muted-foreground">
              No hay passphrase configurada. Los backups institucionales no se pueden cifrar hasta que la setees.
            </p>
            <div>
              <Button onclick={() => { showPassphraseForm = true; newPassphrase = ''; confirmPassphrase = ''; passphraseError = '' }}>Configurar passphrase</Button>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Snapshot sellado automático -->
    <Separator />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <CameraIcon class="size-5" />
        <h3 class="font-semibold">Snapshot sellado automático</h3>
      </div>

      <Alert>
        <AlertDescription class="text-sm">
          LOF puede generar automáticamente un snapshot sellado (.lof cifrado modo institucional) cada período y guardarlo en este dispositivo. Es la app haciendo lo que ya hace (exportar .lof), pero automático y sin intervención del tesorero. Los snapshots se acumulan como los libros hoy — no se sobrescriben.
        </AlertDescription>
      </Alert>

      {#if !passphraseStore.configured}
        <Alert variant="destructive">
          <AlertCircleIcon data-icon="inline-start" />
          <AlertDescription class="text-sm">
            <strong>No se pueden generar snapshots automáticos.</strong>
            Necesitás configurar primero la <strong>contraseña maestra institucional</strong>
            (más arriba, en la sección "Contraseña maestra"). Los snapshots se cifran
            con esa contraseña — sin ella, no hay protección de los backups automáticos.
          </AlertDescription>
        </Alert>
      {/if}

      <Field.Field>
        <div class="flex items-center gap-2">
          <input id="snapshot-enabled" type="checkbox" bind:checked={snapshotEnabled} disabled={!passphraseStore.configured} class="size-4 rounded border-input" />
          <label for="snapshot-enabled" class="text-sm font-medium">
            Habilitar snapshot automático
            {#if !passphraseStore.configured}
              <span class="text-muted-foreground">(requiere contraseña maestra)</span>
            {/if}
          </label>
        </div>
      </Field.Field>

      <Field.Field>
        <Field.FieldLabel>Periodicidad</Field.FieldLabel>
        <Select.Root type="single" bind:value={snapshotPeriodicity}>
          <Select.Trigger class="w-full">
            {snapshotPeriodicity === PERIODICITY.WEEKLY ? 'Semanal' : snapshotPeriodicity === PERIODICITY.YEARLY ? 'Anual' : 'Mensual'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={PERIODICITY.WEEKLY} label="Semanal">Semanal</Select.Item>
            <Select.Item value={PERIODICITY.MONTHLY} label="Mensual">Mensual</Select.Item>
            <Select.Item value={PERIODICITY.YEARLY} label="Anual">Anual</Select.Item>
          </Select.Content>
        </Select.Root>
        <Field.FieldDescription>
          {#if snapshotScheduler.lastRun}
            Último snapshot: {new Date(snapshotScheduler.lastRun).toLocaleDateString('es-AR')}.
            {#if snapshotScheduler.nextRun}
              Próximo: {new Date(snapshotScheduler.nextRun).toLocaleDateString('es-AR')}.
            {/if}
          {:else}
            Aún no se generó ningún snapshot.
          {/if}
        </Field.FieldDescription>
      </Field.Field>

      <!-- Carpeta de destino -->
      <Field.Field>
        <Field.FieldLabel>Carpeta de destino</Field.FieldLabel>
        <div class="flex items-center gap-2">
          <code class="flex-1 truncate rounded-md border border-input bg-muted px-3 py-2 text-sm">
            {#if snapshotDirInfo}
              {snapshotDirInfo}
            {:else}
              {saveStrategy === 'downloads' ? 'Downloads (default del browser)' : 'No configurada'}
            {/if}
          </code>
          {#if saveStrategy !== 'downloads'}
            <Button variant="outline" onclick={chooseDir}>Elegir…</Button>
          {/if}
        </div>
        <Field.FieldDescription>
          {#if saveStrategy === 'tauri'}
            Desktop: el snapshot se guarda en la carpeta que elijas del filesystem.
          {:else if saveStrategy === 'fs-access'}
            Chrome/Edge: el snapshot se guarda en la carpeta que elijas. El permiso persiste entre sesiones.
          {:else}
            Firefox/Safari: el snapshot se descarga a la carpeta de descargas del browser.
          {/if}
        </Field.FieldDescription>
      </Field.Field>

      <div class="flex gap-2">
        <Button variant="outline" onclick={saveSnapshotConfig} disabled={savingSnapshot}>
          {savingSnapshot ? 'Guardando…' : 'Guardar configuración'}
        </Button>
        <Button variant="outline" onclick={runSnapshotNow} disabled={runningSnapshot || !snapshotEnabled || !passphraseStore.configured}>
          {runningSnapshot ? 'Generando…' : 'Generar snapshot ahora'}
        </Button>
      </div>

      {#if snapshotResult}
        <Alert>
          <AlertDescription class="text-sm">{snapshotResult}</AlertDescription>
        </Alert>
      {/if}
    </div>
  </Card.Content>
</Card.Root>

<PassphrasePromptDialog
  bind:open={showPassphrasePrompt}
  title="Contraseña maestra"
  description="Ingresá la contraseña maestra para sellar el snapshot."
  onConfirm={onPassphraseConfirm}
/>
