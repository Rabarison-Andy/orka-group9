/**
 * Étape 1 du pipeline — lecture brute d'un fichier (Excel ou CSV).
 *
 * Rôle : transformer un buffer en `{ headers, rows }` sans interpréter le sens
 * métier des colonnes. Le mapping et la validation sont faits ensuite.
 */
import * as XLSX from 'xlsx'
import { parse as parseCsv } from 'csv-parse/sync'
import type { RawCell, RawRow, SourceFormat } from '../../src/api/contracts'

export interface ParsedTable {
  format: SourceFormat
  /** En-têtes nettoyés (trim). Les colonnes vides reçoivent un nom de repli. */
  headers: string[]
  /** Lignes de données, chaque ligne alignée sur la longueur de `headers`. */
  rows: RawRow[]
}

/** Extensions reconnues. */
const CSV_EXT = /\.csv$/i
const XLSX_EXT = /\.(xlsx|xls|xlsm|xlsb)$/i

export function detectFormat(filename: string): SourceFormat | null {
  if (CSV_EXT.test(filename)) return 'csv'
  if (XLSX_EXT.test(filename)) return 'xlsx'
  return null
}

/**
 * Déduit le format d'un buffer sans nom de fichier (upload en flux binaire) :
 * un .xlsx est un ZIP (`PK\x03\x04`), un .xls hérité est un conteneur OLE
 * (`D0 CF 11 E0`). Sinon, on suppose du CSV/texte.
 */
export function detectFormatFromContent(buffer: Buffer): SourceFormat {
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx'
  if (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf) return 'xlsx'
  return 'csv'
}

/**
 * Devine le séparateur d'un CSV à partir de sa première ligne.
 * Les exports Excel FR utilisent souvent `;`. On teste aussi `\t` et `,`.
 */
function sniffDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? ''
  const counts: Record<string, number> = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  }
  let best = ','
  let bestCount = -1
  for (const [delim, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = delim
      bestCount = count
    }
  }
  return best
}

/** Normalise une cellule lue (préserve nombres/booléens, trim les chaînes). */
function normalizeCell(value: unknown): RawCell {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  // Dates Excel (cellDates) → chaîne ISO, exploitable par le validateur.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  return s === '' ? null : s
}

/** Donne un nom de repli aux colonnes sans en-tête (« Colonne 3 »). */
function ensureHeaderNames(rawHeaders: unknown[]): string[] {
  return rawHeaders.map((h, i) => {
    const name = h === null || h === undefined ? '' : String(h).trim()
    return name === '' ? `Colonne ${i + 1}` : name
  })
}

/** Aligne chaque ligne sur la longueur des en-têtes (tronque / complète). */
function alignRows(rows: unknown[][], width: number): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = new Array(width).fill(null)
    for (let i = 0; i < width; i++) out[i] = normalizeCell(row[i])
    return out
  })
}

function parseXlsxBuffer(buffer: Buffer): ParsedTable {
  // `cellDates` convertit les dates Excel en objets Date plutôt qu'en série.
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
  if (!sheet) return { format: 'xlsx', headers: [], rows: [] }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  if (matrix.length === 0) return { format: 'xlsx', headers: [], rows: [] }

  const [headerRow, ...dataRows] = matrix
  const headers = ensureHeaderNames(headerRow)
  return { format: 'xlsx', headers, rows: alignRows(dataRows, headers.length) }
}

function parseCsvBuffer(buffer: Buffer): ParsedTable {
  // `bom: true` retire un éventuel BOM UTF-8 en tête de fichier.
  const text = buffer.toString('utf8')
  const delimiter = sniffDelimiter(text.replace(/^﻿/, ''))
  const records = parseCsv(text, {
    bom: true,
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true, // ne plante pas si une ligne a trop/pas assez de colonnes
    relax_quotes: true,
    trim: true,
  }) as unknown[][]

  if (records.length === 0) return { format: 'csv', headers: [], rows: [] }

  const [headerRow, ...dataRows] = records
  const headers = ensureHeaderNames(headerRow)
  return { format: 'csv', headers, rows: alignRows(dataRows, headers.length) }
}

/** Lit un buffer selon un format explicite (jamais de crash silencieux). */
export function extractTableFromBuffer(buffer: Buffer, format: SourceFormat): ParsedTable {
  try {
    return format === 'csv' ? parseCsvBuffer(buffer) : parseXlsxBuffer(buffer)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Fichier illisible (${format}) : ${reason}`)
  }
}

/**
 * Point d'entrée : lit un buffer selon le format déduit du nom de fichier.
 * Lève une erreur explicite si le format est inconnu — l'appelant la transforme
 * en réponse JSON.
 */
export function extractTable(buffer: Buffer, filename: string): ParsedTable {
  const format = detectFormat(filename)
  if (!format) {
    throw new Error(
      `Format non supporté pour « ${filename} ». Formats acceptés : .xlsx, .xls, .csv.`,
    )
  }
  return extractTableFromBuffer(buffer, format)
}
