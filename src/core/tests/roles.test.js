import { describe, it, expect } from 'vitest'
import {
  ROLES,
  DEFAULT_ROLE,
  can,
  routesForRole,
  migrateRoleFromConfig,
} from '$core/security/roles'

describe('ROLES', () => {
  it('define los 3 roles de Etapa 1', () => {
    expect(Object.keys(ROLES).sort()).toEqual(['admin', 'super_admin', 'tesorero'])
  })
  it('cada rol tiene label y description', () => {
    for (const [key, role] of Object.entries(ROLES)) {
      expect(role.label, `${key} label`).toBeTruthy()
      expect(role.description, `${key} description`).toBeTruthy()
    }
  })
})

describe('DEFAULT_ROLE', () => {
  it('es super_admin (primer dispositivo de la escuela)', () => {
    expect(DEFAULT_ROLE).toBe('super_admin')
  })
})

describe('can — visibilidad de rutas (view)', () => {
  it('todas las rutas operativas son visibles para los 3 roles', () => {
    const rutasComunes = ['inicio', 'comunidad', 'movimientos', 'gobierno', 'resumen', 'cierre']
    for (const rol of Object.keys(ROLES)) {
      for (const ruta of rutasComunes) {
        expect(can(rol, 'view', ruta), `${rol} view ${ruta}`).toBe(true)
      }
    }
  })
  it('cooperadora (Institucional) visible para super_admin y admin, no para tesorero', () => {
    expect(can('super_admin', 'view', 'cooperadora')).toBe(true)
    expect(can('admin', 'view', 'cooperadora')).toBe(true)
    expect(can('tesorero', 'view', 'cooperadora')).toBe(false)
  })
  it('configuracion visible para los 3 roles (tesorero sin tab Seguridad)', () => {
    for (const rol of Object.keys(ROLES)) {
      expect(can(rol, 'view', 'configuracion'), `${rol} view configuracion`).toBe(true)
    }
  })
  it('tab seguridad solo visible para super_admin', () => {
    expect(can('super_admin', 'view', 'seguridad')).toBe(true)
    expect(can('admin', 'view', 'seguridad')).toBe(false)
    expect(can('tesorero', 'view', 'seguridad')).toBe(false)
  })
})

describe('can — edición (edit)', () => {
  it('cooperadora editable por super_admin y admin, no por tesorero', () => {
    expect(can('super_admin', 'edit', 'cooperadora')).toBe(true)
    expect(can('admin', 'edit', 'cooperadora')).toBe(true)
    expect(can('tesorero', 'edit', 'cooperadora')).toBe(false)
  })
})

describe('can — gestión de seguridad (manage)', () => {
  const recursosSeguridad = [
    'seguridad',
    'pin',
    'passkey',
    'passphrase',
    'recovery-key',
    'snapshot',
    'rol-dispositivo',
  ]
  it('super_admin puede gestionar todos los recursos de seguridad', () => {
    for (const recurso of recursosSeguridad) {
      expect(can('super_admin', 'manage', recurso), `super_admin manage ${recurso}`).toBe(true)
    }
  })
  it('admin NO puede gestionar recursos de seguridad', () => {
    for (const recurso of recursosSeguridad) {
      expect(can('admin', 'manage', recurso), `admin manage ${recurso}`).toBe(false)
    }
  })
  it('tesorero NO puede gestionar recursos de seguridad', () => {
    for (const recurso of recursosSeguridad) {
      expect(can('tesorero', 'manage', recurso), `tesorero manage ${recurso}`).toBe(false)
    }
  })
})

describe('can — exportación', () => {
  it('backup institucional: super_admin y admin, no tesorero', () => {
    expect(can('super_admin', 'export', 'backup-institucional')).toBe(true)
    expect(can('admin', 'export', 'backup-institucional')).toBe(true)
    expect(can('tesorero', 'export', 'backup-institucional')).toBe(false)
  })
  it('intercambio ad-hoc: todos los roles', () => {
    for (const rol of Object.keys(ROLES)) {
      expect(can(rol, 'export', 'intercambio'), `${rol} export intercambio`).toBe(true)
    }
  })
})

describe('can — casos borde', () => {
  it('rol desconocido deniega todo', () => {
    expect(can('inventado', 'view', 'inicio')).toBe(false)
    expect(can('inventado', 'manage', 'seguridad')).toBe(false)
  })
  it('acción desconocida deniega', () => {
    expect(can('super_admin', 'delete', 'cooperadora')).toBe(false)
  })
  it('recurso desconocido deniega', () => {
    expect(can('super_admin', 'view', 'inventado')).toBe(false)
  })
  it('rol null/undefined deniega', () => {
    expect(can(null, 'view', 'inicio')).toBe(false)
    expect(can(undefined, 'view', 'inicio')).toBe(false)
  })
})

describe('routesForRole', () => {
  it('devuelve las rutas visibles para super_admin (todas)', () => {
    const rutas = routesForRole('super_admin')
    expect(rutas).toContain('inicio')
    expect(rutas).toContain('cooperadora')
    expect(rutas).toContain('configuracion')
    expect(rutas).toContain('movimientos')
  })
  it('tesorero no incluye cooperadora pero sí configuracion', () => {
    const rutas = routesForRole('tesorero')
    expect(rutas).not.toContain('cooperadora')
    expect(rutas).toContain('configuracion')
    expect(rutas).toContain('movimientos')
    expect(rutas).toContain('comunidad')
  })
  it('admin incluye cooperadora y configuracion', () => {
    const rutas = routesForRole('admin')
    expect(rutas).toContain('cooperadora')
    expect(rutas).toContain('configuracion')
  })
  it('rol desconocido devuelve solo inicio', () => {
    expect(routesForRole('inventado')).toEqual(['inicio'])
  })
})

describe('migrateRoleFromConfig', () => {
  it('migra modo_colaborador=true a tesorero', () => {
    const config = { modo_colaborador: true, instalado: true }
    expect(migrateRoleFromConfig(config)).toBe('tesorero')
  })
  it('mantiene rol existente si ya está seteado (no pisa)', () => {
    const config = { modo_colaborador: true, rol_dispositivo: 'admin', instalado: true }
    expect(migrateRoleFromConfig(config)).toBe('admin')
  })
  it('rol existente sin modo_colaborador se mantiene', () => {
    const config = { rol_dispositivo: 'tesorero', instalado: true }
    expect(migrateRoleFromConfig(config)).toBe('tesorero')
  })
  it('sin rol y sin modo_colaborador devuelve default (super_admin)', () => {
    const config = { instalado: true }
    expect(migrateRoleFromConfig(config)).toBe(DEFAULT_ROLE)
  })
  it('config null devuelve default', () => {
    expect(migrateRoleFromConfig(null)).toBe(DEFAULT_ROLE)
  })
  it('modo_colaborador=false sin rol devuelve default', () => {
    expect(migrateRoleFromConfig({ modo_colaborador: false })).toBe(DEFAULT_ROLE)
  })
})
