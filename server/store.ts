import { randomUUID } from 'node:crypto'
import type { Apartment } from '../src/types'
import type {
  FiscalAnomaly,
  FiscalRecord,
  RawRow,
  SourceFormat,
} from '../src/api/contracts'
import type { ReconcileState } from './core/reconcile'

export interface StoredUpload {
  id: string
  filename: string
  format: SourceFormat
  headers: string[]
  rows: RawRow[]
  createdAt: number
  apartments?: Apartment[]
  fiscal?: FiscalRecord[]
  reconcileState?: ReconcileState
  anomalies?: FiscalAnomaly[]
}

const TTL_MS = 30 * 60 * 1000
const MAX_ENTRIES = 50

const uploads = new Map<string, StoredUpload>()

function evict(): void {
  const now = Date.now()
  for (const [id, entry] of uploads) {
    if (now - entry.createdAt > TTL_MS) uploads.delete(id)
  }
  while (uploads.size > MAX_ENTRIES) {
    const oldest = uploads.keys().next().value
    if (oldest === undefined) break
    uploads.delete(oldest)
  }
}

export function saveUpload(
  data: Omit<StoredUpload, 'id' | 'createdAt'>,
): StoredUpload {
  evict()
  const entry: StoredUpload = { ...data, id: randomUUID(), createdAt: Date.now() }
  uploads.set(entry.id, entry)
  return entry
}

export function getUpload(id: string): StoredUpload | undefined {
  evict()
  return uploads.get(id)
}
