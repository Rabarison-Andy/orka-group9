import {
  FIELDS,
  FIELD_BY_KEY,
  REQUIRED_FIELDS,
  emptyApartment,
  type Apartment,
  type ApartmentKey,
  type CellValue,
  type FieldDef,
} from '../../src/types'
import type { RawRow } from '../../src/api/contracts'
import type {
  Anomaly,
  ConfirmedMapping,
  ProcessResponse,
  RowReport,
  ValidationReport,
  Warning,
} from '../../src/api/contracts'

export type ProcessOutcome =
  | ({ ok: true } & ProcessResponse)
  | { ok: false; anomalies: Anomaly[] }

interface Coerced {
  value: CellValue
  status: 'ok' | 'empty' | 'invalid'
}

const EMPTY: Coerced = { value: '', status: 'empty' }

function coerceDate(raw: unknown): Coerced {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { value: raw.toISOString().slice(0, 10), status: 'ok' }
  }
  const s = String(raw).trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return { value: s.slice(0, 10), status: 'ok' }
  }
  const fr = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s)
  if (fr) {
    const day = Number(fr[1])
    const month = Number(fr[2])
    const year = Number(fr[3].length === 2 ? `20${fr[3]}` : fr[3])
    const d = new Date(Date.UTC(year, month - 1, day))
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return { value: d.toISOString().slice(0, 10), status: 'ok' }
    }
  }
  return { value: '', status: 'invalid' }
}

function coerce(field: FieldDef, raw: unknown): Coerced {
  if (raw === null || raw === undefined || raw === '') return EMPTY

  switch (field.type) {
    case 'number': {
      const n =
        typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'))
      return Number.isFinite(n) ? { value: n, status: 'ok' } : { value: '', status: 'invalid' }
    }
    case 'date':
      return coerceDate(raw)
    case 'binaire': {
      if (typeof raw === 'number') return { value: raw ? 1 : 0, status: 'ok' }
      const s = String(raw).trim().toLowerCase()
      if (['oui', '1', 'true', 'o', 'x'].includes(s)) return { value: 1, status: 'ok' }
      if (['non', '0', 'false', 'n', ''].includes(s)) return { value: 0, status: 'ok' }
      const n = Number(s)
      return Number.isFinite(n) ? { value: n ? 1 : 0, status: 'ok' } : { value: '', status: 'invalid' }
    }
    case 'ouinon': {
      const s = String(raw).trim().toLowerCase()
      if (['oui', '1', 'true', 'o'].includes(s)) return { value: 'Oui', status: 'ok' }
      if (['non', '0', 'false', 'n'].includes(s)) return { value: 'Non', status: 'ok' }
      return { value: String(raw).trim(), status: 'ok' }
    }
    default:
      return { value: String(raw).trim(), status: 'ok' }
  }
}

export function coerceCell(field: FieldDef, raw: unknown): CellValue {
  return coerce(field, raw).value
}

function resolveMapping(
  mapping: ConfirmedMapping,
  width: number,
): Map<ApartmentKey, number> {
  const resolved = new Map<ApartmentKey, number>()
  for (const field of FIELDS) {
    const col = mapping[field.key]
    if (typeof col === 'number' && col >= 0 && col < width) {
      resolved.set(field.key, col)
    }
  }
  return resolved
}

function typeLabel(type: FieldDef['type']): string {
  switch (type) {
    case 'number':
      return 'nombre'
    case 'date':
      return 'date'
    case 'binaire':
      return 'booléen (1/0)'
    default:
      return 'texte'
  }
}

export function processRows(
  headers: string[],
  rows: RawRow[],
  mapping: ConfirmedMapping,
): ProcessOutcome {
  const width = headers.length
  const resolved = resolveMapping(mapping, width)

  const anomalies: Anomaly[] = []
  const warnings: Warning[] = []

  for (const key of REQUIRED_FIELDS) {
    if (!resolved.has(key)) {
      anomalies.push({
        kind: 'missing_required_column',
        field: key,
        message: `Colonne obligatoire manquante : « ${FIELD_BY_KEY[key].label} » n'est mappée à aucune colonne.`,
      })
    }
  }

  const usedColumns = new Set(resolved.values())
  const unmappedColumns = headers.filter((_, i) => !usedColumns.has(i))
  for (const h of unmappedColumns) {
    warnings.push({ kind: 'unmapped_column', message: `Colonne « ${h} » du fichier non mappée (ignorée).` })
  }

  const apartments: Apartment[] = []
  const rowReports: RowReport[] = []
  let skippedRows = 0

  rows.forEach((row, idx) => {
    const sourceRow = idx + 2
    const apt = emptyApartment()
    let hasAnyValue = false
    const rowAnomalies: Anomaly[] = []
    const rowWarnings: Warning[] = []

    for (const [key, col] of resolved) {
      const field = FIELD_BY_KEY[key]
      const { value, status } = coerce(field, row[col])
      apt[key] = value
      if (status !== 'empty') hasAnyValue = true
      if (status === 'invalid') {
        if (field.required) {
          rowAnomalies.push({
            kind: 'type_mismatch',
            field: key,
            sourceRow,
            rawValue: String(row[col]),
            message: `Ligne ${sourceRow} : « ${field.label} » attend un ${typeLabel(field.type)}, mais a reçu « ${String(row[col])} ».`,
          })
        } else {
          rowWarnings.push({
            kind: 'malformed_optional',
            field: key,
            sourceRow,
            message: `Ligne ${sourceRow} : « ${field.label} » mal formé (« ${String(row[col])} »), valeur ignorée.`,
          })
        }
      }
    }

    if (!hasAnyValue) {
      skippedRows++
      warnings.push({ kind: 'skipped_row', sourceRow, message: `Ligne ${sourceRow} vide, écartée.` })
      return
    }

    anomalies.push(...rowAnomalies)
    warnings.push(...rowWarnings)

    const missingRequired = REQUIRED_FIELDS.filter((k) => apt[k] === '')
    const missingOptional = FIELDS.filter((f) => !f.required && apt[f.key] === '').map(
      (f) => f.key,
    )
    for (const k of missingRequired) {
      warnings.push({
        kind: 'empty_required',
        field: k,
        sourceRow,
        message: `Ligne ${sourceRow} : « ${FIELD_BY_KEY[k].label} » obligatoire non renseigné.`,
      })
    }

    const filledCount = FIELDS.filter((f) => apt[f.key] !== '').length
    rowReports.push({
      index: apartments.length,
      sourceRow,
      status: missingRequired.length === 0 ? 'complete' : 'incomplete',
      filledCount,
      totalFields: FIELDS.length,
      missingRequired,
      missingOptional,
    })
    apartments.push(apt)
  })

  if (anomalies.length > 0) {
    return { ok: false, anomalies }
  }

  const report: ValidationReport = {
    totalRows: rows.length,
    importedRows: apartments.length,
    skippedRows,
    unmappedColumns,
    warnings,
    rows: rowReports,
  }
  return { ok: true, apartments, report }
}
