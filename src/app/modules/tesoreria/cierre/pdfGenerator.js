/**
 * Generador de PDFs oficiales rellenando AcroForm fields con pdf-lib.
 *
 * Carga una plantilla PDF desde public/templates/, rellena los campos
 * AcroForm con los valores provistos, y devuelve un Uint8Array listo
 * para descargar o previsualizar.
 *
 * Funciona 100% client-side, sin backend. Compatible con el modo
 * offline del widget de Grist.
 *
 * pdf-lib se carga dinámicamente (import()) para no inflar el bundle
 * inicial — solo se carga cuando el usuario genera/previsualiza un PDF.
 */

/** @type {typeof import('pdf-lib').PDFDocument | null} */
let _PDFDocument = null

/**
 * Carga pdf-lib dinámicamente (lazy load).
 * @returns {Promise<typeof import('pdf-lib').PDFDocument>}
 */
const getPdfLib = async () => {
  if (_PDFDocument) return _PDFDocument
  const { PDFDocument } = await import('pdf-lib')
  _PDFDocument = PDFDocument
  return _PDFDocument
}

const TEMPLATES = {
  pia: '/templates/PIA_cooperadoras_editable_2025.pdf',
  nomina: '/templates/Nomina_comision_directiva_editable.pdf',
}

// Cache de plantillas cargadas para no re-fetchear en cada generación.
/** @type {Map<string, ArrayBuffer>} */
const _templateCache = new Map()

/**
 * Carga (y cachea) una plantilla PDF como ArrayBuffer.
 * @param {'pia'|'nomina'} tipo
 * @returns {Promise<ArrayBuffer>}
 */
const loadTemplate = async (tipo) => {
  const cached = _templateCache.get(tipo)
  if (cached) return cached
  const url = TEMPLATES[tipo]
  if (!url) throw new Error(`Plantilla desconocida: ${tipo}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar la plantilla ${tipo} (${res.status})`)
  const buf = await res.arrayBuffer()
  _templateCache.set(tipo, buf)
  return buf
}

/**
 * Rellena un campo de texto del AcroForm.
 * Maneja campos que existen y campos que no (los ignora con warn).
 * @param {import('pdf-lib').PDFForm} form
 * @param {string} name
 * @param {string} value
 */
const setText = (form, name, value) => {
  try {
    const field = form.getTextField(name)
    if (field) {
      field.setText(String(value ?? ''))
    }
  } catch {
    // Campo no existe o no es de texto — ignorar silenciosamente
  }
}

/**
 * Marca un checkbox del AcroForm.
 * @param {import('pdf-lib').PDFForm} form
 * @param {string} name
 * @param {boolean} checked
 */
const setCheckbox = (form, name, checked) => {
  if (!checked) return
  try {
    // pdf-lib usa el appearance state "Yes" por convención de Acrobat
    const field = form.getCheckBox(name)
    if (field) field.check()
  } catch {
    // Campo no existe — ignorar
  }
}

/**
 * Genera un PDF rellenando los campos AcroForm de la plantilla.
 * @param {'pia'|'nomina'} tipo - Tipo de plantilla
 * @param {Record<string, string>} fields - Mapa fieldName → value
 * @returns {Promise<Uint8Array>} - Bytes del PDF generado
 */
export const generatePdf = async (tipo, fields) => {
  const [templateBuf, PDFDocument] = await Promise.all([loadTemplate(tipo), getPdfLib()])
  const pdfDoc = await PDFDocument.load(templateBuf, { ignoreEncryption: true })
  const form = pdfDoc.getForm()

  // Rellenar campos
  for (const [name, value] of Object.entries(fields)) {
    // Detectar si es checkbox por el valor "Yes" o por el prefijo "Check Box"
    if (name.startsWith('Check Box') || value === 'Yes' || value === 'No') {
      setCheckbox(form, name, value === 'Yes')
    } else {
      setText(form, name, value)
    }
  }

  // NeedAppearances: fuerza a los viewers a regenerar appearances.
  // Algunos viewers (Acrobat) lo respetan; otros (Chrome) generan propios.
  try {
    form.updateFieldAppearances()
  } catch {
    // Si falla, los appearances se generan al abrir en la mayoría de viewers
  }

  return pdfDoc.save()
}

/**
 * Genera un PDF y devuelve una URL blob para previsualizar/descargar.
 * @param {'pia'|'nomina'} tipo
 * @param {Record<string, string>} fields
 * @returns {Promise<{url: string, bytes: Uint8Array, blob: Blob}>}
 */
export const generatePdfBlob = async (tipo, fields) => {
  const bytes = await generatePdf(tipo, fields)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  return { url, bytes, blob }
}

/**
 * Descarga un PDF generado.
 * @param {'pia'|'nomina'} tipo
 * @param {Record<string, string>} fields
 * @param {string} filename - Nombre del archivo a descargar
 */
export const downloadPdf = async (tipo, fields, filename) => {
  const { url } = await generatePdfBlob(tipo, fields)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revocar después de un delay para que el download se complete
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Limpia la cache de plantillas (útil si las plantillas cambian en dev).
 */
export const clearTemplateCache = () => {
  _templateCache.clear()
}
