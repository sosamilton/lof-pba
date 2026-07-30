import schemaJson from './schema.json'
import { TABLE_PREFERRED_IDS } from './utils'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export const REQUIRED_TABLES = (schemaJson.tables || []).map((t) => {
  const id = String(t.id || '')
  return {
    key: id,
    label: t.title || capitalize(id),
    tableId: id,
    preferredIds: TABLE_PREFERRED_IDS[id] || [capitalize(id), id],
    columns: (t.columns || []).map((c) => ({
      id: c.id,
      type: c.fields?.type || 'Text'
    }))
  }
})

