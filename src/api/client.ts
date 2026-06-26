/**
 * Client HTTP du front vers l'API d'import.
 * Centralise les appels `fetch`, le parsing JSON et la remontée d'erreurs
 * sous une forme unique (`ApiClientError`) exploitable par les composants.
 */
import type { Apartment } from '../types'
import type {
  AnomalyReport,
  AnomalyStatus,
  ApiError,
  BienEditResponse,
  BulkResolutionAction,
  ConfirmedMapping,
  ExtractResponse,
  ProcessResponse,
  ReconcileResponse,
  ResolutionAction,
} from './contracts'

export class ApiClientError extends Error {
  details?: string[]
  constructor(message: string, details?: string[]) {
    super(message)
    this.name = 'ApiClientError'
    this.details = details
  }
}

/** Lit la réponse : JSON si possible, sinon message d'erreur générique. */
async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  if (!res.ok) {
    const err = (body ?? {}) as ApiError
    throw new ApiClientError(
      err.error ?? `Erreur serveur (${res.status}).`,
      err.details,
    )
  }
  return body as T
}

/** Étape 1 & 2 : envoie le fichier, récupère en-têtes + aperçu + suggestions. */
export async function extractFile(file: File): Promise<ExtractResponse> {
  const form = new FormData()
  form.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/upload', { method: 'POST', body: form })
  } catch {
    throw new ApiClientError(
      'Serveur injoignable. Vérifiez que l’API est démarrée (npm run dev).',
    )
  }
  return readJson<ExtractResponse>(res)
}

/** Étape 3 : envoie le mapping confirmé, récupère biens + rapport de validation. */
export async function processMapping(
  uploadId: string,
  mapping: ConfirmedMapping,
): Promise<ProcessResponse> {
  return postJson<ProcessResponse>('/api/process', { uploadId, mapping })
}

/** Helper POST JSON commun aux endpoints de rapprochement / anomalies. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiClientError('Serveur injoignable. Réessayez.')
  }
  return readJson<T>(res)
}

/** Page 1 — rapproche le parc validé aux fiches fiscales. */
export function reconcile(uploadId: string): Promise<ReconcileResponse> {
  return postJson<ReconcileResponse>('/api/reconcile', { uploadId })
}

/** Transition — résout un cas « ERP uniquement » ou « Fisc uniquement ». */
export function resolveCase(
  uploadId: string,
  invariant: string,
  side: 'erp_only' | 'fisc_only',
  action: ResolutionAction,
  targetInvariant?: string,
): Promise<ReconcileResponse> {
  return postJson<ReconcileResponse>('/api/reconcile/resolve', {
    uploadId,
    invariant,
    side,
    action,
    targetInvariant,
  })
}

/** Transition — résout en LOT plusieurs cas non appariés. */
export function resolveBulk(
  uploadId: string,
  side: 'erp_only' | 'fisc_only',
  invariants: string[],
  action: BulkResolutionAction,
): Promise<ReconcileResponse> {
  return postJson<ReconcileResponse>('/api/reconcile/resolve-bulk', {
    uploadId,
    side,
    invariants,
    action,
  })
}

/** Édite un ou plusieurs biens (même modification appliquée à `indices`). */
export function editBiens(
  uploadId: string,
  indices: number[],
  changes: Partial<Apartment>,
): Promise<BienEditResponse> {
  return postJson<BienEditResponse>('/api/biens/edit', { uploadId, indices, changes })
}

/** Verrou + génération du rapport d'anomalies (Page 2). */
export function generateReport(uploadId: string): Promise<AnomalyReport> {
  return postJson<AnomalyReport>('/api/report/generate', { uploadId })
}

/** Qualification d'anomalies (single si 1 id, bulk si plusieurs). */
export function updateAnomalyStatus(
  uploadId: string,
  anomalyIds: string[],
  status: AnomalyStatus,
): Promise<AnomalyReport & { updated: number }> {
  return postJson('/api/anomalies/status', { uploadId, anomalyIds, status })
}
