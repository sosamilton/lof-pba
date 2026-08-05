import localidadesData from '$core/data/localidades-buenos-aires.json'
import { MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS } from '$core/utils'

export const CUENTAS_OPCIONES = ['Banco', 'Efectivo', 'Caja Chica']
export const currentYear = new Date().getFullYear()
export const localidades = localidadesData.map((l) => ({ value: l, label: l }))
export const steps = ['Módulos', 'Escuela y cooperadora', 'Banco y kiosco', 'Ejercicio y cargos', 'Instalar']

// Re-exportaciones para compatibilidad con imports existentes
export const CUENTAS_OPCIONES_EXPORT = CUENTAS_OPCIONES
export { MODULES, MESES, ORGANISMOS, ORGANISMO_LABELS }
