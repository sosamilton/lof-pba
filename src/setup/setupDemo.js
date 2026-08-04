import { DEMO_MODULES, DEMO_ESC_COOP, DEMO_BANCO, DEMO_KIOSCO, DEMO_EJERCICIO } from './demoData'
import { emailInstitucionalAlias } from '$core/emailInstitucional'
import { currentYear } from './setupConstants'
import { onCueInput, onCuitInput, onTelefonoEscuelaInput, onTelefonoInput, onEmailInput, onCbuInput } from './setupSchoolData'
import { syncFederacionCargos, loadDefaultCargos } from './setupEjercicioCargos'

/**
 * Funciones DEV-only para precargar datos de ejemplo en el wizard.
 * Tree-shakeable: el cuerpo se ejecuta solo si import.meta.env.DEV es true.
 * @param {any} s - Instancia del store
 */

// Rellena los campos del paso actual con datos de ejemplo (solo desarrollo).
export function fillDemoData(s) {
  switch (s.step) {
    case 0: // Módulos
      s.selectedModules = { ...DEMO_MODULES }
      break
    case 1: // Escuela y cooperadora
      s.schoolData = { ...DEMO_ESC_COOP }
      s.emailEscuelaAlias = emailInstitucionalAlias(DEMO_ESC_COOP.email_escuela)
      s.telefonoMismoQueEscuela = false
      onCueInput(s)
      onCuitInput(s)
      onTelefonoEscuelaInput(s)
      onTelefonoInput(s)
      onEmailInput(s)
      break
    case 2: // Banco y kiosco
      s.banco = { ...DEMO_BANCO }
      onCbuInput(s)
      s.cuentaDefault = 'Efectivo'
      s.kiosco = { ...DEMO_KIOSCO(currentYear) }
      break
    case 3: // Ejercicio y cargos
      s.ejercicio = { ...DEMO_EJERCICIO(currentYear) }
      // Los cargos ya se cargan por defecto en init(); si están vacíos, forzamos la carga.
      if (s.cargos.length === 0) {
        loadDefaultCargos(s)
      }
      // Marcamos adhesión a la Federación para que se vean sus cargos en el demo.
      s.federacionAdherida = true
      syncFederacionCargos(s)
      break
    case 4: // Instalar (pantalla de revisión, nada que precargar)
      break
  }
}

// Rellena TODOS los pasos (0-3) con datos de ejemplo de una sola vez.
// Se usa cuando el usuario activa "precargar datos demo por defecto" en el
// primer paso (dev), reemplazando al botón "Precargar datos demo" por paso.
// El salto al paso 4 (Instalar) lo maneja el onchange del checkbox en StepModulos.
export function fillAllDemoData(s) {
  const stepActual = s.step
  for (let step = 0; step <= 3; step++) {
    s.step = step
    fillDemoData(s)
  }
  s.step = stepActual
}
