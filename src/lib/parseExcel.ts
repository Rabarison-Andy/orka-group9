import * as XLSX from 'xlsx'
import {
  FIELDS,
  emptyApartment,
  type Apartment,
  type ApartmentKey,
  type CellValue,
  type FieldDef,
} from '../types'

/** Normalise un libellé de colonne pour le matching (trim, minuscules, espaces compactés). */
function normalizeHeader(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Index : libellé Excel normalisé → champ. */
const HEADER_TO_FIELD: ReadonlyMap<string, FieldDef> = new Map(
  FIELDS.map((f) => [normalizeHeader(f.excel), f]),
)

/** Convertit une valeur brute de cellule selon le type du champ. */
function coerce(field: FieldDef, raw: unknown): CellValue {
  if (raw === null || raw === undefined || raw === '') return ''

  switch (field.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
      return Number.isFinite(n) ? n : ''
    }
    case 'binaire': {
      if (typeof raw === 'number') return raw ? 1 : 0
      const s = String(raw).trim().toLowerCase()
      if (['oui', '1', 'true', 'o', 'x'].includes(s)) return 1
      if (['non', '0', 'false', 'n'].includes(s)) return 0
      return Number(s) ? 1 : 0
    }
    case 'ouinon': {
      const s = String(raw).trim().toLowerCase()
      if (['oui', '1', 'true', 'o'].includes(s)) return 'Oui'
      if (['non', '0', 'false', 'n'].includes(s)) return 'Non'
      return String(raw).trim()
    }
    default:
      return String(raw).trim()
  }
}

/** Une ligne est considérée vide si elle n'a ni invariant ni rue. */
function isEmptyRow(apt: Apartment): boolean {
  return apt.invariant === '' && apt.rue === ''
}

/**
 * Parse un fichier Excel et retourne un bien par ligne non vide.
 * Lit la première feuille ; l'en-tête est attendu sur la première ligne.
 */
export async function parseWorkbook(file: File): Promise<Apartment[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  })
  if (rows.length === 0) return []

  const [headerRow, ...dataRows] = rows

  // index colonne -> champ
  const columnFields = new Map<number, FieldDef>()
  headerRow.forEach((cell, index) => {
    const field = HEADER_TO_FIELD.get(normalizeHeader(String(cell ?? '')))
    if (field) columnFields.set(index, field)
  })

  const apartments: Apartment[] = []
  for (const row of dataRows) {
    const apt = emptyApartment()
    for (const [index, field] of columnFields) {
      apt[field.key] = coerce(field, row[index])
    }
    if (!isEmptyRow(apt)) apartments.push(apt)
  }

  return apartments
}

export type { Apartment, ApartmentKey }
