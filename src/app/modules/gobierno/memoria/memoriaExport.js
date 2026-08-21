/**
 * Exportadores de la Memoria anual a PDF y DOC.
 *
 * - PDF: usa pdf-lib (lazy load) para generar un PDF de texto plano
 *   formateado, 100% client-side.
 * - DOC: genera un HTML con estilos básicos y lo sirve como
 *   application/msword, que Word y Google Docs abren nativamente.
 *
 * Ambos funcionan sin backend, compatibles con el modo offline de Grist.
 */

/** @type {typeof import('pdf-lib').PDFDocument | null} */
let _PDFDocument = null

const getPdfLib = async () => {
  if (_PDFDocument) return _PDFDocument
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  _PDFDocument = { PDFDocument, StandardFonts, rgb }
  return _PDFDocument
}

/**
 * Parsea el texto de la Memoria en líneas estructuradas.
 * @param {string} text
 * @returns {{type: 'h1'|'h2'|'h3'|'li'|'hr'|'p'|'blank', text: string}[]}
 */
const parseMemoria = (text) => {
  if (!text) return []
  const lines = String(text).split('\n')
  const out = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^---+\s*$/.test(line)) {
      out.push({ type: 'hr', text: '' })
    } else if (line.startsWith('# ')) {
      out.push({ type: 'h1', text: line.slice(2).trim() })
    } else if (line.startsWith('## ')) {
      out.push({ type: 'h2', text: line.slice(3).trim() })
    } else if (line.startsWith('### ')) {
      out.push({ type: 'h3', text: line.slice(4).trim() })
    } else if (/^\s*[-•]\s+/.test(line)) {
      out.push({ type: 'li', text: line.replace(/^\s*[-•]\s+/, '').trim() })
    } else if (line === '') {
      out.push({ type: 'blank', text: '' })
    } else {
      out.push({ type: 'p', text: line })
    }
  }
  return out
}

/**
 * Quita el formato markdown inline (** y `).
 * @param {string} text
 * @returns {string}
 */
const stripInline = (text) => {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
}

/**
 * Genera un PDF de la Memoria con pdf-lib.
 * @param {string} memoriaText - Texto markdown de la Memoria
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<void>}
 */
export const exportMemoriaPdf = async (memoriaText, filename = 'memoria.pdf') => {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib()
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Márgenes y dimensiones A4
  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const MARGIN = 50
  const CONTENT_W = PAGE_W - MARGIN * 2
  const LINE_H = 14
  const PARA_SPACE = 8

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }

  const wrapText = (text, font, size, maxWidth) => {
    const words = String(text).split(/\s+/)
    const lines = []
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      const w = font.widthOfTextAtSize(test, size)
      if (w > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  }

  const drawText = (text, font, size, color, indent = 0) => {
    const lines = wrapText(stripInline(text), font, size, CONTENT_W - indent)
    for (const line of lines) {
      ensureSpace(LINE_H)
      page.drawText(line, { x: MARGIN + indent, y, size, font, color })
      y -= LINE_H
    }
  }

  const blocks = parseMemoria(memoriaText)
  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        y -= PARA_SPACE
        drawText(block.text, fontBold, 16, rgb(0.1, 0.1, 0.1))
        y -= PARA_SPACE / 2
        break
      case 'h2':
        y -= PARA_SPACE
        drawText(block.text, fontBold, 13, rgb(0.15, 0.15, 0.15))
        y -= PARA_SPACE / 3
        break
      case 'h3':
        y -= PARA_SPACE / 2
        drawText(block.text, fontBold, 11, rgb(0.2, 0.2, 0.2))
        break
      case 'hr':
        ensureSpace(LINE_H + 4)
        page.drawLine({
          start: { x: MARGIN, y: y - 2 },
          end: { x: PAGE_W - MARGIN, y: y - 2 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        })
        y -= LINE_H
        break
      case 'li':
        ensureSpace(LINE_H)
        page.drawText('•', { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
        drawText(block.text, fontRegular, 10, rgb(0.2, 0.2, 0.2), 12)
        break
      case 'blank':
        y -= LINE_H / 2
        break
      default:
        y -= PARA_SPACE / 3
        drawText(block.text, fontRegular, 10, rgb(0.2, 0.2, 0.2))
    }
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  downloadBlob(blob, filename)
}

/**
 * Genera un DOC (HTML con formato Word) de la Memoria.
 * Word y Google Docs abren este formato nativamente.
 * @param {string} memoriaText - Texto markdown de la Memoria
 * @param {string} filename - Nombre del archivo
 */
export const exportMemoriaDoc = (memoriaText, filename = 'memoria.doc') => {
  const blocks = parseMemoria(memoriaText)
  const htmlParts = [
    '<!DOCTYPE html>',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:w="urn:schemas-microsoft-com:office:word"',
    ' xmlns="http://www.w3.org/TR/REC-html40">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Memoria Anual</title>',
    '<style>',
    'body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }',
    'h1 { font-size: 16pt; font-weight: bold; margin-top: 20pt; }',
    'h2 { font-size: 13pt; font-weight: bold; margin-top: 14pt; }',
    'h3 { font-size: 11pt; font-weight: bold; margin-top: 10pt; }',
    'ul { margin-left: 18pt; margin-top: 4pt; }',
    'li { margin-bottom: 2pt; }',
    'hr { border: none; border-top: 1px solid #999; margin: 12pt 0; }',
    'p { margin: 4pt 0; }',
    '</style>',
    '</head>',
    '<body>',
  ]

  let inList = false
  const closeList = () => {
    if (inList) {
      htmlParts.push('</ul>')
      inList = false
    }
  }

  for (const block of blocks) {
    const text = stripInline(block.text)
    switch (block.type) {
      case 'h1':
        closeList()
        htmlParts.push(`<h1>${escHtml(text)}</h1>`)
        break
      case 'h2':
        closeList()
        htmlParts.push(`<h2>${escHtml(text)}</h2>`)
        break
      case 'h3':
        closeList()
        htmlParts.push(`<h3>${escHtml(text)}</h3>`)
        break
      case 'hr':
        closeList()
        htmlParts.push('<hr/>')
        break
      case 'li':
        if (!inList) {
          htmlParts.push('<ul>')
          inList = true
        }
        htmlParts.push(`<li>${escHtml(text)}</li>`)
        break
      case 'blank':
        closeList()
        break
      default:
        closeList()
        htmlParts.push(`<p>${escHtml(text)}</p>`)
    }
  }
  closeList()
  htmlParts.push('</body></html>')

  const html = htmlParts.join('\n')
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  downloadBlob(blob, filename)
}

/**
 * Descarga un blob como archivo.
 * @param {Blob} blob
 * @param {string} filename
 */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Escapa HTML.
 * @param {string} text
 * @returns {string}
 */
const escHtml = (text) => {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
