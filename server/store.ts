/**
 * Stockage en mémoire des uploads entre l'étape 1 (extraction) et l'étape 3
 * (traitement). On conserve les lignes brutes côté serveur pour ne pas avoir à
 * les renvoyer par le réseau à chaque modification du mapping.
 *
 * Limitation assumée : volatile (perdu au redémarrage) et mono-instance.
 * En production on remplacerait ce module par Redis / une base, sans toucher
 * au reste du code (l'interface resterait `save` / `get`).
 */
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
  /** Biens validés (renseignés après `POST /api/process`). */
  apartments?: Apartment[]
  /** Fiches fiscales simulées (générées au 1er rapprochement). */
  fiscal?: FiscalRecord[]
  /** Résolutions des cas non appariés (mutées par `/reconcile/resolve`). */
  reconcileState?: ReconcileState
  /** Anomalies Page 2 (générées par `/report/generate`). */
  anomalies?: FiscalAnomaly[]
}

/** Durée de vie d'un upload (30 min) et nombre max d'entrées conservées. */
const TTL_MS = 30 * 60 * 1000
const MAX_ENTRIES = 50

const uploads = new Map<string, StoredUpload>()

/** Supprime les entrées expirées puis, si besoin, les plus anciennes. */
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
