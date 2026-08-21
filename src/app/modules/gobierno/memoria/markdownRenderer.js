/**
 * Renderizador de markdown ligero (sin dependencias externas).
 *
 * Convierte un texto markdown simple a HTML para visualización.
 * Soporta: encabezados (H1-H3), negrita, listas con `-` o `•`,
 * líneas horizontales (`---`), párrafos y saltos de línea.
 *
 * No es un parser completo de markdown — es suficiente para la
 * Memoria anual que genera el sistema, que usa un subconjunto simple.
 */

/**
 * Escapa caracteres HTML peligrosos.
 * @param {string} text
 * @returns {string}
 */
const escapeHtml = (text) => {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Convierte un texto markdown a HTML.
 * @param {string} md
 * @returns {string}
 */
export const markdownToHtml = (md) => {
  if (!md) return ''
  const lines = String(md).split('\n')
  const html = []
  let inList = false
  let inParagraph = []

  const flushParagraph = () => {
    if (inParagraph.length > 0) {
      const text = inParagraph.join(' ')
      html.push(`<p>${inlineFormat(text)}</p>`)
      inParagraph = []
    }
  }

  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    // Línea horizontal
    if (/^---+\s*$/.test(line)) {
      closeList()
      flushParagraph()
      html.push('<hr />')
      continue
    }

    // Encabezados
    const h1 = line.match(/^#\s+(.+)$/)
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    if (h1) {
      closeList()
      flushParagraph()
      html.push(`<h1>${inlineFormat(h1[1])}</h1>`)
      continue
    }
    if (h2) {
      closeList()
      flushParagraph()
      html.push(`<h2>${inlineFormat(h2[1])}</h2>`)
      continue
    }
    if (h3) {
      closeList()
      flushParagraph()
      html.push(`<h3>${inlineFormat(h3[1])}</h3>`)
      continue
    }

    // Items de lista (- o •)
    const li = line.match(/^\s*[-•]\s+(.+)$/)
    if (li) {
      flushParagraph()
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inlineFormat(li[1])}</li>`)
      continue
    }

    // Línea vacía = separador
    if (line === '') {
      closeList()
      flushParagraph()
      continue
    }

    // Línea normal → acumular en párrafo
    closeList()
    inParagraph.push(line)
  }

  closeList()
  flushParagraph()

  return html.join('\n')
}

/**
 * Formateo inline: negrita **texto** y código `texto`.
 * @param {string} text
 * @returns {string}
 */
const inlineFormat = (text) => {
  let result = escapeHtml(text)
  // Negrita
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Código inline
  result = result.replace(/`(.+?)`/g, '<code>$1</code>')
  return result
}
