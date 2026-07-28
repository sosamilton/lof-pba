# AppCoop SPA (Svelte)

SPA para operar una cooperadora escolar consumiendo un documento de Grist como backend.

## Modo de uso

Esta app está pensada para ejecutarse como `Custom Widget` dentro de Grist (iframe) y usar `grist-plugin-api` para:
- leer tablas (`docApi.fetchTable`)
- escribir registros (`docApi.applyUserActions`)

Cuando se abre fuera de Grist (navegador normal), no tiene acceso a datos.

## Requisitos

- Node.js 20+ (recomendado)

## Desarrollo local

```bash
cd spa-app
npm install
npm run dev
```

## Publicación (GitHub Pages)

El proyecto está configurado con `base: './'` en Vite para que funcione en GitHub Pages.

```bash
cd spa-app
npm install
npm run build
```

El build deja los archivos estáticos en `spa-app/dist/`.

### Deploy automático (recomendado)

El repo incluye un workflow de GitHub Actions: [.github/workflows/deploy-pages.yml](file:///home/miltonsosa/appcoop/spa-app/.github/workflows/deploy-pages.yml)

En GitHub:

1. `Settings` → `Pages`
2. En `Build and deployment`:
   - `Source`: `GitHub Actions`
3. Hacé push a `main` o `master`
4. Mirá el estado en `Actions` y copiá la URL publicada (termina en `github.io/<repo>/`)

Si querés publicar un path ya con ruta, podés usar hash routes:
- `https://<owner>.github.io/<repo>/#/setup`
- `https://<owner>.github.io/<repo>/#/socios`

## Usarlo en Grist

1. En tu documento: `Add New` -> `Add Widget to Page` -> `Custom`.
2. Pegá la URL de GitHub Pages (la home de la SPA).
3. Configurá `Access level` como **Full document access**.

Sugerencia: dejá la URL sin ruta y navegá desde el menú. La SPA usa hash routing, así que no depende de rutas del servidor.

## Automatizar la instalación en Grist (nota)

- No hay una API pública “simple” para que un script cree automáticamente páginas y widgets en el documento usando el “Custom Widget Builder”.
- La opción más estable para “instalar” esta SPA en nuevos documentos es armar un documento plantilla con el widget ya creado y luego copiar ese documento.
- Alternativa avanzada (frágil): manipular tablas internas `_grist_Views_*` con `applyUserActions` para crear secciones/fields. Se puede hacer, pero depende de metadata interna y conviene usarlo solo si de verdad lo necesitás.

## Troubleshooting

- “No muestra datos”: verificar que el widget esté con **Full document access**.
- “Funciona en Grist pero no en el navegador”: es normal; fuera de Grist no hay `grist-plugin-api` activo.
- “Pantalla en blanco/404 al refrescar”: la SPA usa hash routes (`/#/...`) para evitar problemas de routing en Pages.
- Warning en Actions “Node.js 20 is deprecated”: es un aviso de GitHub Actions sobre acciones internas; no debería romper el build. Si el deploy falla con 404, revisar `Settings → Pages → Source: GitHub Actions`.

## Pantallas incluidas (demo)

- `Inicio`: estado y modo (Grist vs navegador)
- `Setup`: datos de cooperadora + ejercicios + cargos
- `Socios`: buscador por múltiples campos + alta/edición
- `Movimientos`: listado y filtro básico (siguiente: wizard + totales)
