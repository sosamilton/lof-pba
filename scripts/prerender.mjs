/**
 * Pre-render de páginas públicas a HTML estático.
 *
 * Flujo:
 * 1. `vite build` ya generó dist/ con el SPA (JS + CSS + index.html).
 * 2. Este script hace `vite build --ssr` del entry-server.js.
 * 3. Importa el bundle SSR compilado.
 * 4. Para cada ruta pública, renderiza el componente a HTML.
 * 5. Lee dist/index.html como plantilla, extrae los tags <link> de CSS/JS.
 * 6. Escribe un HTML por página con meta tags correctos + contenido pre-renderizado.
 *
 * Uso: node scripts/prerender.mjs (después de `vite build`)
 */
import { build } from 'vite'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')
const ssrOutDir = resolve(distDir, '.ssr')

// Meta tags por ruta pública.
const PAGE_META = {
  '/': {
    title: 'LOF — Software libre para cooperadoras escolares PBA',
    description: 'Software libre y offline para gestionar cooperadoras escolares de la Provincia de Buenos Aires: socios, tesorería, asambleas, PIA y nómina. Tus datos son tuyos.',
    canonical: 'https://lof.mdsoluciones.ar/',
  },
  '/sobre-lof': {
    title: 'Sobre LOF — Historia, significado y principios',
    description: 'LOF (Lazos que Organizan el Futuro) es un proyecto independiente de software libre para cooperadoras escolares de PBA. Conocé su historia, qué significa el nombre y qué principios lo guían.',
    canonical: 'https://lof.mdsoluciones.ar/sobre-lof',
  },
  '/instalacion': {
    title: 'Cómo empezar a usar LOF — Guía de instalación',
    description: 'Tres formas de usar LOF: en el navegador, con respaldo local o dentro de Grist. Elegí la que mejor se adapte a tu escuela. Sin costos, sin cuentas.',
    canonical: 'https://lof.mdsoluciones.ar/instalacion',
  },
  '/seguridad': {
    title: 'Seguridad — LOF',
    description: 'Si encontraste una vulnerabilidad en LOF, reportala de manera privada a seguridad@lof.mdsoluciones.ar. No la publiques en foros públicos.',
    canonical: 'https://lof.mdsoluciones.ar/seguridad',
  },
  '/ayuda-comunidad': {
    title: 'Ayuda y comunidad — LOF',
    description: 'Sugerí mejoras, reportá problemas, pedí ayuda y conversá con el proyecto LOF. Un espacio abierto para la comunidad de cooperadoras escolares.',
    canonical: 'https://lof.mdsoluciones.ar/ayuda-comunidad',
  },
}

async function main() {
  console.log('▸ Build SSR entry...')
  await build({
    root,
    configFile: resolve(root, 'vite.config.js'),
    build: {
      ssr: resolve(root, 'src/prerender/entry-server.js'),
      outDir: ssrOutDir,
      rollupOptions: {
        output: { format: 'es' },
      },
    },
    ssr: {
      noExternal: ['@lucide/svelte', 'tailwind-variants', 'clsx', 'tailwind-merge'],
    },
    resolve: {
      // Array syntax: el primer alias que matchea gana. El mock de
      // dataRepository DEBE ir antes que $core para que se aplique.
      // Con object syntax, Vite mergea con los alias del vite.config.js
      // y $core del config puede tener prioridad, haciendo que el mock
      // nunca se aplique → _detectBackend() devuelve 'grist' (SSR fallback)
      // → isPouchMode === false → card "Ver una demo" oculta en pre-render.
      alias: [
        { find: '$core/data/dataRepository', replacement: resolve(root, 'src/prerender/mock-dataRepository.js') },
        { find: '$lib', replacement: resolve(root, 'src/lib') },
        { find: '$core', replacement: resolve(root, 'src/core') },
        { find: '$app', replacement: resolve(root, 'src/app') },
        { find: '$landing', replacement: resolve(root, 'src/landing') },
        { find: '$setup', replacement: resolve(root, 'src/setup') },
      ],
    },
    logLevel: 'warn',
  })

  console.log('▸ Importando SSR bundle...')
  const ssrEntry = await import(join(ssrOutDir, 'entry-server.js'))

  // Leer el index.html generado por el build del SPA
  const indexHtmlPath = resolve(distDir, 'index.html')
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`No se encontró ${indexHtmlPath}. ¿Se ejecutó vite build antes?`)
  }
  const indexHtml = readFileSync(indexHtmlPath, 'utf-8')

  // Extraer los tags <link rel="stylesheet"> y <script type="module"> del index.html
  const cssLinks = [...indexHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0])
  const jsScripts = [...indexHtml.matchAll(/<script[^>]*type="module"[^>]*src="[^"]*"[^>]*>\s*<\/script>/g)].map((m) => m[0])
  const modulePreloads = [...indexHtml.matchAll(/<link[^>]*rel="modulepreload"[^>]*>/g)].map((m) => m[0])

  // Extraer el JSON-LD del index.html (para reusarlo en cada página)
  const jsonldMatch = indexHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/)
  const jsonldBlock = jsonldMatch ? jsonldMatch[0] : ''

  // Extraer el <noscript> fallback
  const noscriptMatch = indexHtml.match(/<noscript>[\s\S]*?<\/noscript>/)
  const noscriptBlock = noscriptMatch ? noscriptMatch[0] : ''

  // Generar HTML por página
  const routes = ssrEntry.ROUTES
  for (const route of routes) {
    const meta = PAGE_META[route]
    if (!meta) {
      console.warn(`  ⚠ Sin meta para ${route}, saltando...`)
      continue
    }

    console.log(`▸ Renderizando ${route}...`)
    const result = ssrEntry.renderPage(route)
    if (!result) {
      console.warn(`  ⚠ No se pudo renderizar ${route}`)
      continue
    }

    // Construir el HTML completo
    // El noscript del index.html solo aplica al landing; para otras
    // páginas, un noscript genérico que linkee al home.
    const pageNoscript = route === '/'
      ? noscriptBlock
      : '<noscript><p>LOF — Software libre para cooperadoras escolares de PBA. Visitá <a href="/">lof.mdsoluciones.ar</a> para más información.</p></noscript>'

    const html = buildPageHtml({
      meta,
      content: result.html,
      cssLinks,
      jsScripts,
      modulePreloads,
      jsonldBlock,
      noscriptBlock: pageNoscript,
      originalHtml: indexHtml,
    })

    // Determinar el path de salida
    const outPath = route === '/'
      ? resolve(distDir, 'index.html')
      : resolve(distDir, route.slice(1) + '.html')

    writeFileSync(outPath, html, 'utf-8')
    console.log(`  ✓ ${outPath}`)
  }

  console.log('▸ Pre-render completo.')
}

/**
 * Construye el HTML completo de una página pre-renderizada.
 */
function buildPageHtml({ meta, content, cssLinks, jsScripts, modulePreloads, jsonldBlock, noscriptBlock, originalHtml }) {
  // Extraer el <head> del index.html original y reemplazar title/description/canonical
  let head = extractHead(originalHtml)

  // Reemplazar title
  head = head.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)

  // Reemplazar meta description
  if (head.includes('name="description"')) {
    head = head.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${meta.description}" />`
    )
  }

  // Reemplazar canonical
  if (head.includes('rel="canonical"')) {
    head = head.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${meta.canonical}" />`
    )
  }

  // Reemplazar OG tags
  if (head.includes('property="og:title"')) {
    head = head.replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${meta.title}" />`
    )
  }
  if (head.includes('property="og:description"')) {
    head = head.replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${meta.description}" />`
    )
  }
  if (head.includes('property="og:url"')) {
    head = head.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${meta.canonical}" />`
    )
  }
  // Twitter
  if (head.includes('name="twitter:title"')) {
    head = head.replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:title" content="${meta.title}" />`
    )
  }
  if (head.includes('name="twitter:description"')) {
    head = head.replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${meta.description}" />`
    )
  }

  // Construir el HTML final: head + body con contenido pre-renderizado + scripts
  return `<!doctype html>
<html lang="es">
${head}
<body>
  <div id="app">${content}</div>
  ${noscriptBlock}
  ${cssLinks.join('\n  ')}
  ${modulePreloads.join('\n  ')}
  ${jsScripts.join('\n  ')}
</body>
</html>`
}

/**
 * Extrae el <head> del HTML original, sin los scripts de módulo
 * (esos los reinyectamos nosotros en el body).
 */
function extractHead(html) {
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/)
  if (!headMatch) return '<head></head>'

  let head = headMatch[0]
  // Remover los <script type="module" src="..."> del head (los reinyectamos en el body)
  head = head.replace(/<script[^>]*type="module"[^>]*src="[^"]*"[^>]*><\/script>/g, '')
  // Remover los <link rel="stylesheet"> del head (los reinyectamos en el body)
  head = head.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
  // Remover los <link rel="modulepreload"> del head
  head = head.replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '')

  return head
}

main().catch((err) => {
  console.error('✗ Error en pre-render:', err)
  process.exit(1)
})
