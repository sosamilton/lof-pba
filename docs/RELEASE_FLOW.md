# Flujo de release (LOF)

> Versión normalizada del flujo de release. El ejecutable guiado vive en `.devin/skills/release-flow/SKILL.md`. Esta doc es la referencia humana.

## Ramas

| Rama | Uso |
|------|-----|
| `develop` | Rama de trabajo. Todo commit nuevo va acá. |
| `main` | Solo recibe merges vía PR desde `develop` al release. Tags y releases se crean sobre main. |
| `feat/*`, `fix/*` | Opcionales para trabajo grande. Si se usan, se mergean a `develop` primero. |

**Regla**: nunca commitear directo en `main` como flujo normal. Solo hotfixes excepcionales (ver abajo).

## Versionado (semver)

| Bump | Cuándo |
|------|--------|
| `X+1.0.0` (major) | Cambio breaking. Confirmar explícitamente. |
| `x.Y+1.0` (minor) | Nuevas features compatibles. Gana sobre patch si hay mezcla. |
| `x.y.Z+1` (patch) | Bugfixes, docs, chore, hotfixes. |

El bump se propone al usuario y se confirma antes de taggear.

## Pasos del release

1. **Verificar**: estar en `develop`, working tree limpio, `develop` y `main` actualizados vs origin. Confirmar que hay commits en `main..develop`.
2. **Bump de versión** (tras confirmar número): propagar a `package.json`, `src-tauri/tauri.conf.json` y cualquier otro archivo de versión. Commitear `chore: bump version to vX.Y.Z` en develop.
3. **Push develop** y crear **PR técnico** `develop → main` con plantilla (arquitectura, problemas resueltos, mejoras — sin código).
4. **Merge** del PR con merge-commit (preserva historial). No borrar develop.
5. **Sincronizar y taggear**: `checkout main`, `pull`, `tag -a vX.Y.Z`, push main + tag.
6. **Release PWA** con texto para usuarias finales (plantilla, tono cercano, sin jerga).
7. **Release Desktop** solo si hubo cambios en `src-tauri/` o build desktop. Si no, omitir.
8. **Volver a develop** y sincronizar con main (`merge main`).

## Plantilla PR técnico (develop → main)

```markdown
## Resumen
<1-2 párrafos: arquitectura/funcional>

### Arquitectura y cambios internos
- <módulo tocado y por qué>

### Problemas resueltos
- **<problema>**: <causa raíz> → <solución>

### Mejoras
- <perf, UX, DX, seguridad>

### Notas de migración / compatibilidad
- <si aplica; si no, omitir>
```

Sin código, sin diffs. Foco en "por qué" y "qué resuelve".

## Plantilla release PWA (usuarias finales)

```markdown
## Qué hay de nuevo en esta versión

### <Feature en lenguaje natural>
<Qué cambia para la usuaria, qué le resuelve, cómo se usa.>

### Para quienes ya usan LOF
<Impacto en instalación existente, acción manual si hace falta.>

---

### Detalles técnicos (opcional)
<Al final, para quienes les interese.>
```

Tono: español rioplatense, segunda persona, sin nombres de archivos ni términos de dev.

## Hotfix en main (excepción)

Tender a que no pase, pero mientras nadie use desktop puede ocurrir:

1. Commitear fix en main.
2. **Bump patch nuevo** `vX.Y.(Z+1)`. NUNCA reusar ni sobreescribir un tag.
3. Propagar versión a todos los archivos.
4. Commitear bump, taggear, pushear.
5. Release PWA (y desktop si aplica).
6. **Sincronizar develop**: `checkout develop && merge main && push`.

Nunca: `git tag -f`, `git push --force` sobre main/tags, borrar tags publicados.

## Anti-patrones

- Commits directos en main como flujo normal.
- PR develop→main sin diff real (significa que se commiteó en main y develop es espejo).
- Reusar número de tag para "regenerarlo".
- Bump en un solo archivo (siempre `package.json` + `tauri.conf.json`).
- Release Desktop sin cambios en `src-tauri` (genera drafts huérfanos).
- Branches de feature muertas tras merge.

## Limpieza periódica

- Branches feature merged: borrar tras confirmar contenido en main (ojo con squash merges).
- Releases Draft huérfanos: borrar.
- Tags desactualizados: no borrar, documentar si apuntan a commit intermedio.

## Verificación final

- [ ] Tag `vX.Y.Z` en origin apuntando al commit correcto de main.
- [ ] Release PWA publicada (no draft) con texto usuaria.
- [ ] `package.json` y `tauri.conf.json` coinciden en versión.
- [ ] `develop` sincronizada con `main`.
- [ ] Sin branches feature muertas ni drafts huérfanos.

## Estado conocido (2026-08-28)

- `tauri.conf.json` está en `2.0.1` mientras `package.json` está en `2.2.1`. **Desincronizado.** Próximo release debe alinear (probablemente `2.3.0` o el que corresponda, subiendo tauri.conf.json a la par).
- Tags `v1.2.1` y `v1.3.0` creados el mismo día con orden semver invertido (v1.2.1 posterior en tiempo pero menor en número). Es el caso de hotfix en main que se taggeó con número menor en vez de patch sobre v1.3.0. De acá en adelante, aplicar el flujo de hotfix (patch nuevo).
