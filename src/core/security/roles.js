/**
 * Roles y permisos por dispositivo — Etapa 1 (sin hub).
 *
 * Puro JS, sin dependencias de Node ni browser. En Etapa 2 se mueve a
 * `packages/shared` para que SPA y hub usen la misma definición.
 *
 * Los roles de Etapa 1 son accesos generales del dispositivo, no vinculados
 * a una persona específica. El rol vive en la tabla `configuracion`
 * (como `modo_colaborador` hoy), en el campo `rol_dispositivo`.
 */

/**
 * @typedef {'super_admin' | 'admin' | 'tesorero'} Role
 * @typedef {'view' | 'edit' | 'manage' | 'export'} Action
 * @typedef {string} Resource
 */

/**
 * Definición de los 3 roles de Etapa 1.
 */
export const ROLES = {
  super_admin: {
    label: 'Super admin',
    description:
      'Directivo de la institución. Custodia la passphrase institucional, gestiona la seguridad (PIN/passkey, snapshots, recovery key) y recupera el acceso cuando se pierde.',
  },
  admin: {
    label: 'Administrador',
    description:
      'Comisión directiva. Ve y edita toda la información institucional, exporta/importa .lof cifrado. No gestiona seguridad.',
  },
  tesorero: {
    label: 'Tesorero',
    description:
      'Gestión diaria. Personas, movimientos, cierres. No ve información institucional ni gestiona seguridad. Usa intercambio ad-hoc para exports puntuales.',
  },
}

/**
 * Rol por defecto al configurar LOF por primera vez en un dispositivo.
 * El primer dispositivo de la escuela queda con super_admin.
 */
export const DEFAULT_ROLE = 'super_admin'

/**
 * Matriz de permisos: role → resource → Set<Action>.
 *
 * Recursos de ruta (view): inicio, cooperadora, comunidad, movimientos,
 * gobierno, resumen, cierre, configuracion.
 * Recursos especiales: seguridad (tab), pin, passkey, passphrase,
 * recovery-key, snapshot, rol-dispositivo, backup-institucional, intercambio.
 */
const PERMISSIONS = {
  super_admin: {
    // Rutas — todas
    inicio: ['view'],
    cooperadora: ['view', 'edit'],
    comunidad: ['view'],
    movimientos: ['view'],
    gobierno: ['view'],
    resumen: ['view'],
    cierre: ['view'],
    configuracion: ['view'],
    // Tab Seguridad y gestión de seguridad
    seguridad: ['view', 'manage'],
    pin: ['manage'],
    passkey: ['manage'],
    passphrase: ['manage'],
    'recovery-key': ['manage'],
    snapshot: ['manage'],
    'rol-dispositivo': ['manage'],
    // Exportación
    'backup-institucional': ['export'],
    intercambio: ['export'],
  },
  admin: {
    inicio: ['view'],
    cooperadora: ['view', 'edit'],
    comunidad: ['view'],
    movimientos: ['view'],
    gobierno: ['view'],
    resumen: ['view'],
    cierre: ['view'],
    configuracion: ['view'],
    // Sin tab Seguridad ni gestión de seguridad
    seguridad: [],
    pin: [],
    passkey: [],
    passphrase: [],
    'recovery-key': [],
    snapshot: [],
    'rol-dispositivo': [],
    // Exportación institucional sí, intercambio sí
    'backup-institucional': ['export'],
    intercambio: ['export'],
  },
  tesorero: {
    inicio: ['view'],
    // Sin Institucional
    cooperadora: [],
    comunidad: ['view'],
    movimientos: ['view'],
    gobierno: ['view'],
    resumen: ['view'],
    cierre: ['view'],
    configuracion: ['view'],
    // Sin tab Seguridad ni gestión de seguridad
    seguridad: [],
    pin: [],
    passkey: [],
    passphrase: [],
    'recovery-key': [],
    snapshot: [],
    'rol-dispositivo': [],
    // Sin backup institucional, intercambio ad-hoc sí
    'backup-institucional': [],
    intercambio: ['export'],
  },
}

/**
 * Verifica si un rol puede realizar una acción sobre un recurso.
 *
 * @param {Role | null | undefined} rol
 * @param {Action} action
 * @param {Resource} resource
 * @returns {boolean}
 */
export function can(rol, action, resource) {
  if (!rol) return false
  const rolePerms = PERMISSIONS[rol]
  if (!rolePerms) return false
  const actions = rolePerms[resource]
  if (!actions) return false
  return actions.includes(action)
}

/**
 * Rutas visibles en el menú para un rol dado.
 *
 * @param {Role | null | undefined} rol
 * @returns {string[]}
 */
export function routesForRole(rol) {
  if (!rol || !PERMISSIONS[rol]) return ['inicio']
  const rolePerms = PERMISSIONS[rol]
  const routes = []
  for (const [resource, actions] of Object.entries(rolePerms)) {
    if (actions.includes('view')) routes.push(resource)
  }
  // Orden canónico del menú
  const ORDER = [
    'inicio',
    'cooperadora',
    'comunidad',
    'movimientos',
    'gobierno',
    'resumen',
    'cierre',
    'configuracion',
  ]
  return ORDER.filter((r) => routes.includes(r))
}

/**
 * Migra la config legacy al modelo de roles.
 *
 * - Si ya hay `rol_dispositivo` seteado, se mantiene (no se pisa).
 * - Si hay `modo_colaborador=true` sin rol, migra a `tesorero`.
 * - Si no hay nada, devuelve `DEFAULT_ROLE` (super_admin).
 *
 * @param {Record<string, any> | null} config
 * @returns {Role}
 */
export function migrateRoleFromConfig(config) {
  if (!config) return DEFAULT_ROLE
  if (config.rol_dispositivo && ROLES[config.rol_dispositivo]) {
    return config.rol_dispositivo
  }
  if (config.modo_colaborador === true) return 'tesorero'
  return DEFAULT_ROLE
}

/**
 * Devuelve el label para mostrar en la UI, teniendo en cuenta el modo.
 * En modo colaborador, el rol tesorero se muestra como "Colaborador".
 * @param {Role} role
 * @param {Record<string, any> | null} [config]
 * @returns {string}
 */
export function getRoleLabel(role, config) {
  if (!ROLES[role]) return 'Desconocido'
  if (role === 'tesorero' && config?.modo_colaborador === true) return 'Colaborador'
  return ROLES[role].label
}
