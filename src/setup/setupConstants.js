import { MODULES, MESES } from '$core/utils/utils'
import { ORGANISMOS, ORGANISMO_LABELS } from '$app/modules/gobierno/constants.js'

export const CUENTAS_OPCIONES = ['Banco', 'Efectivo', 'Caja Chica']
export const currentYear = new Date().getFullYear()
export const steps = ['Módulos', 'Escuela y cooperadora', 'Banco y kiosco', 'Ejercicio y cargos', 'Instalar']

// Re-exportaciones para compatibilidad con imports existentes
export const CUENTAS_OPCIONES_EXPORT = CUENTAS_OPCIONES
export { MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS }
