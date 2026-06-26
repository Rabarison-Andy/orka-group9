import * as XLSX from 'xlsx'
import { parse as parseCsv } from 'csv-parse/sync'
import type { RawCell, RawRow, SourceFormat } from '../../src/api/contracts'

export interface ParsedTable {
  format: SourceFormat
  headers: string[]
  rows: RawRow[]
}

const CSV_EXT = /\.csv$/i
const XLSX_EXT = /\.(xlsx|xls|xlsm|xlsb)$/i

export function detectFormat(filename: string): SourceFormat | null {
  if (CSV_EXT.test(filename)) return 'csv'
  if (XLSX_EXT.test(filename)) return 'xlsx'
  return null
}

export function detectFormatFromContent(buffer: Buffer): SourceFormat {
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx'
  if (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf) return 'xlsx'
  return 'csv'
}

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

function normalizeCell(value: unknown): RawCell {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  return s === '' ? null : s
}

function ensureHeaderNames(rawHeaders: unknown[]): string[] {
  return rawHeaders.map((h, i) => {
    const name = h === null || h === undefined ? '' : String(h).trim()
    return name === '' ? `Colonne ${i + 1}` : name
  })
}

function alignRows(rows: unknown[][], width: number): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = new Array(width).fill(null)
    for (let i = 0; i < width; i++) out[i] = normalizeCell(row[i])
    return out
  })
}

function parseXlsxBuffer(buffer: Buffer): ParsedTable {
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
  const text = buffer.toString('utf8')
  const delimiter = sniffDelimiter(text.replace(/^﻿/, ''))
  const records = parseCsv(text, {
    bom: true,
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  }) as unknown[][]

  if (records.length === 0) return { format: 'csv', headers: [], rows: [] }

  const [headerRow, ...dataRows] = records
  const headers = ensureHeaderNames(headerRow)
  return { format: 'csv', headers, rows: alignRows(dataRows, headers.length) }
}

export function extractTableFromBuffer(buffer: Buffer, format: SourceFormat): ParsedTable {
  try {
    return format === 'csv' ? parseCsvBuffer(buffer) : parseXlsxBuffer(buffer)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Fichier illisible (${format}) : ${reason}`)
  }
}

export function extractTable(buffer: Buffer, filename: string): ParsedTable {
  const format = detectFormat(filename)
  if (!format) {
    throw new Error(
      `Format non supporté pour « ${filename} ». Formats acceptés : .xlsx, .xls, .csv.`,
    )
  }
  return extractTableFromBuffer(buffer, format)
}
