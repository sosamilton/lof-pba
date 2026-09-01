<script>
  import { onMount, onDestroy } from 'svelte'
  import { pinStore } from '$core/security/pinStore.svelte'
  import { passkeyStore } from '$core/security/passkeyStore.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Field from '$lib/components/ui/field'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import LockIcon from '@lucide/svelte/icons/lock'
  import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
  import { identidad } from '$core/data/identidad'

  let pinInput = $state('')
  let error = $state('')
  let verifying = $state(false)
  let passkeyAuthenticating = $state(false)

  // Si hay passkey configurada, el PIN no funciona (regla del plan 1.B).
  // Si hay passkey pero no está desbloqueada, mostrar UI de passkey.
  let usePasskey = $derived(passkeyStore.configured && passkeyStore.supported)

  onMount(async () => {
    pinStore.init()
    passkeyStore.init()
    if (pinStore.isLocked) {
      pinStore.startCountdown()
    }
    // Si hay passkey configurada, intentar autenticar automáticamente.
    if (usePasskey && !passkeyStore.unlocked) {
      await tryPasskey()
    }
  })

  onDestroy(() => {
    pinStore.stopCountdown()
  })

  async function tryPasskey() {
    passkeyAuthenticating = true
    error = ''
    const result = await passkeyStore.authenticate()
    passkeyAuthenticating = false
    if (!result.ok) {
      error = result.error || 'Autenticación con passkey fallida.'
    }
  }

  async function handleSubmit() {
    if (!pinInput) return
    verifying = true
    error = ''
    const result = await pinStore.verify(pinInput)
    verifying = false
    pinInput = ''

    if (result.ok) {
      pinStore.stopCountdown()
      return
    }

    if (result.locked) {
      pinStore.startCountdown()
      error = `Demasiados intentos fallidos. Esperá ${result.remainingSeconds}s para reintentar.`
    } else {
      error = 'PIN incorrecto.'
    }
  }

  function handleInput(e) {
    // Solo dígitos, máximo 8
    pinInput = String(e.target.value).replace(/\D/g, '').slice(0, 8)
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <div class="w-full max-w-sm">
    <div class="mb-6 flex flex-col items-center gap-3">
      <div class="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
        {#if usePasskey}
          <FingerprintIcon class="size-7 text-primary" />
        {:else}
          <LockIcon class="size-7 text-primary" />
        {/if}
      </div>
      <div class="text-center">
        <h1 class="text-xl font-bold">{identidad.nombre}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {#if usePasskey}
            Usá la passkey para acceder
          {:else}
            Ingresá el PIN para acceder
          {/if}
        </p>
      </div>
    </div>

    {#if pinStore.isLocked}
      <Alert variant="destructive" class="mb-4">
        <AlertDescription>
          <div class="font-semibold text-sm">Dispositivo bloqueado</div>
          <div class="text-sm mt-1 text-muted-foreground">
            Esperá {pinStore.remainingLockout}s para reintentar.
          </div>
        </AlertDescription>
      </Alert>
    {/if}

    {#if usePasskey}
      <!-- UI Passkey -->
      {#if error}
        <Alert variant="destructive" class="mb-4">
          <AlertDescription class="text-sm">{error}</AlertDescription>
        </Alert>
      {/if}
      <div class="flex flex-col gap-4">
        <Button onclick={tryPasskey} disabled={passkeyAuthenticating} class="w-full">
          {#if passkeyAuthenticating}
            <FingerprintIcon class="animate-pulse" data-icon="inline-start" />
            Autenticando…
          {:else}
            <FingerprintIcon data-icon="inline-start" />
            Desbloquear con passkey
          {/if}
        </Button>
      </div>
    {:else}
      <!-- UI PIN -->
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }} class="flex flex-col gap-4">
        <Field.Field>
          <Field.FieldLabel for="pin-input" class="sr-only">PIN</Field.FieldLabel>
          <Input
            id="pin-input"
            type="password"
            inputmode="numeric"
            autocomplete="off"
            placeholder="PIN"
            value={pinInput}
            oninput={handleInput}
            disabled={pinStore.isLocked || verifying}
            class="text-center text-lg tracking-widest"
            maxlength="8"
            autofocus
          />
        </Field.Field>

        {#if error && !pinStore.isLocked}
          <Alert variant="destructive">
            <AlertDescription class="text-sm">{error}</AlertDescription>
          </Alert>
        {/if}

        <Button type="submit" disabled={!pinInput || pinStore.isLocked || verifying}>
          {verifying ? 'Verificando…' : 'Desbloquear'}
        </Button>
      </form>
    {/if}

    <p class="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
      El acceso protege este dispositivo. Los datos sensibles se protegen con cifrado en los backups y exports.
    </p>
  </div>
</div>
