import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { IncomingMessage } from 'node:http'
import cors from 'cors'
import multer from 'multer'
import { detectFormat, detectFormatFromContent, extractTableFromBuffer } from './core/parse'
import { suggestMapping } from './core/mapping'
import { processRows, coerceCell } from './core/validate'
import { generateFiscalRecords } from './core/fiscal'
import { reconcile, generateAnomalies } from './core/reconcile'
import { saveUpload, getUpload } from './store'
import { FIELD_BY_KEY, type ApartmentKey } from '../src/types'
import type {
  AnomalyStatus,
  ApiError,
  BienEditResponse,
  ConfirmedMapping,
  ExtractResponse,
  FiscalAnomaly,
  ProcessResponse,
  ReconcileResponse,
  ResolutionAction,
  ValidationErrorBody,
} from '../src/api/contracts'

const PORT = Number(process.env.PORT ?? 3001)
const MAX_FILE_SIZE = 10 * 1024 * 1024
const PREVIEW_ROWS = 5

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (detectFormat(file.originalname)) cb(null, true)
    else cb(new Error('Format non supporté. Formats acceptés : .xlsx, .xls, .csv.'))
  },
})

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

function handler(
  fn: (req: Request, res: Response) => void | Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

function rawUploadType(req: IncomingMessage): boolean {
  const ct = String(req.headers['content-type'] ?? '')
  return !ct.includes('multipart/form-data') && !ct.includes('application/json')
}

app.post(
  ['/api/upload', '/api/extract', '/upload'],
  express.raw({ type: rawUploadType, limit: MAX_FILE_SIZE }),
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) return next(err)
      next()
    })
  },
  handler((req, res) => {
    let buffer: Buffer
    let filename: string
    let format

    if (req.file) {
      buffer = req.file.buffer
      filename = req.file.originalname
      format = detectFormat(filename) ?? detectFormatFromContent(buffer)
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body
      filename = '(flux binaire)'
      format = detectFormatFromContent(buffer)
    } else {
      sendError(res, 400, 'Aucun fichier reçu (champ « file » ou corps binaire attendu).')
      return
    }

    const { headers, rows } = extractTableFromBuffer(buffer, format)
    if (headers.length === 0) {
      sendError(res, 422, `Fichier vide ou sans ligne d'en-tête exploitable.`)
      return
    }

    const stored = saveUpload({ filename, format, headers, rows })

    const body: ExtractResponse = {
      uploadId: stored.id,
      filename,
      format,
      headers,
      preview: rows.slice(0, PREVIEW_ROWS),
      totalRows: rows.length,
      suggestions: suggestMapping(headers),
    }
    res.json(body)
  }),
)

app.post(
  '/api/process',
  handler((req, res) => {
    const { uploadId, mapping } = (req.body ?? {}) as {
      uploadId?: unknown
      mapping?: unknown
    }

    if (typeof uploadId !== 'string' || uploadId === '') {
      sendError(res, 400, 'Paramètre « uploadId » manquant ou invalide.')
      return
    }
    if (mapping === null || typeof mapping !== 'object') {
      sendError(res, 400, 'Paramètre « mapping » manquant ou invalide.')
      return
    }

    const stored = getUpload(uploadId)
    if (!stored) {
      sendError(res, 404, `Upload introuvable ou expiré. Relancez l'import.`)
      return
    }

    const outcome = processRows(
      stored.headers,
      stored.rows,
      mapping as ConfirmedMapping,
    )

    if (!outcome.ok) {
      const body: ValidationErrorBody = {
        error: `Validation échouée : ${outcome.anomalies.length} anomalie(s) bloquante(s).`,
        details: outcome.anomalies.map((a) => a.message),
        anomalies: outcome.anomalies,
      }
      res.status(422).json(body)
      return
    }

    stored.apartments = outcome.apartments
    stored.fiscal = undefined
    stored.reconcileState = undefined
    stored.anomalies = undefined

    const body: ProcessResponse = { apartments: outcome.apartments, report: outcome.report }
    res.json(body)
  }),
)

const REQUIRED_FIRST = `Traitez d'abord le fichier (POST /api/process).`

function ensureReconcileReady(uploadId: unknown, res: Response) {
  if (typeof uploadId !== 'string' || uploadId === '') {
    sendError(res, 400, 'Paramètre « uploadId » manquant ou invalide.')
    return null
  }
  const stored = getUpload(uploadId)
  if (!stored) {
    sendError(res, 404, `Upload introuvable ou expiré. Relancez l'import.`)
    return null
  }
  if (!stored.apartments) {
    sendError(res, 422, REQUIRED_FIRST)
    return null
  }
  if (!stored.fiscal) stored.fiscal = generateFiscalRecords(stored.apartments)
  if (!stored.reconcileState) {
    stored.reconcileState = { resolvedErp: new Map(), resolvedFisc: new Map() }
  }
  return stored
}

app.post(
  '/api/reconcile',
  handler((req, res) => {
    const stored = ensureReconcileReady((req.body ?? {}).uploadId, res)
    if (!stored) return
    const body: ReconcileResponse = reconcile(
      stored.apartments!,
      stored.fiscal!,
      stored.reconcileState!,
    )
    res.json(body)
  }),
)

const RESOLUTIONS: readonly ResolutionAction[] = ['exclude', 'attach', 'import', 'keep']
const BULK_RESOLUTIONS: readonly ResolutionAction[] = ['exclude', 'import', 'keep']

app.post(
  '/api/reconcile/resolve',
  handler((req, res) => {
    const { uploadId, invariant, side, action, targetInvariant } = (req.body ?? {}) as {
      uploadId?: unknown
      invariant?: unknown
      side?: unknown
      action?: unknown
      targetInvariant?: unknown
    }
    const stored = ensureReconcileReady(uploadId, res)
    if (!stored) return
    if (typeof invariant !== 'string' || (side !== 'erp_only' && side !== 'fisc_only')) {
      sendError(res, 400, 'Paramètres « invariant » / « side » invalides.')
      return
    }
    if (!RESOLUTIONS.includes(action as ResolutionAction)) {
      sendError(res, 400, 'Action de résolution invalide (exclude | attach | import | keep).')
      return
    }

    const state = stored.reconcileState!
    const k = invariant.trim().toUpperCase()
    const map = side === 'erp_only' ? state.resolvedErp : state.resolvedFisc
    map.set(k, action as ResolutionAction)
    if (action === 'attach' && typeof targetInvariant === 'string' && targetInvariant) {
      const other = side === 'erp_only' ? state.resolvedFisc : state.resolvedErp
      other.set(targetInvariant.trim().toUpperCase(), 'attach')
    }

    const body: ReconcileResponse = reconcile(stored.apartments!, stored.fiscal!, state)
    res.json(body)
  }),
)

app.post(
  '/api/reconcile/resolve-bulk',
  handler((req, res) => {
    const { uploadId, side, invariants, action } = (req.body ?? {}) as {
      uploadId?: unknown
      side?: unknown
      invariants?: unknown
      action?: unknown
    }
    const stored = ensureReconcileReady(uploadId, res)
    if (!stored) return
    if (side !== 'erp_only' && side !== 'fisc_only') {
      sendError(res, 400, 'Paramètre « side » invalide.')
      return
    }
    if (!Array.isArray(invariants) || invariants.length === 0) {
      sendError(res, 400, 'Paramètre « invariants » (liste non vide) requis.')
      return
    }
    if (!BULK_RESOLUTIONS.includes(action as ResolutionAction)) {
      sendError(res, 400, 'Action en lot invalide (exclude | import | keep).')
      return
    }

    const state = stored.reconcileState!
    const map = side === 'erp_only' ? state.resolvedErp : state.resolvedFisc
    for (const inv of invariants) {
      map.set(String(inv).trim().toUpperCase(), action as ResolutionAction)
    }

    const body: ReconcileResponse = reconcile(stored.apartments!, stored.fiscal!, state)
    res.json(body)
  }),
)

app.post(
  '/api/biens/edit',
  handler((req, res) => {
    const { uploadId, indices, changes } = (req.body ?? {}) as {
      uploadId?: unknown
      indices?: unknown
      changes?: unknown
    }
    const stored = ensureReconcileReady(uploadId, res)
    if (!stored) return
    if (!Array.isArray(indices) || indices.length === 0) {
      sendError(res, 400, 'Paramètre « indices » (liste non vide) requis.')
      return
    }
    if (changes === null || typeof changes !== 'object') {
      sendError(res, 400, 'Paramètre « changes » invalide.')
      return
    }

    const apartments = stored.apartments!
    const entries = Object.entries(changes).filter(([k]) => k in FIELD_BY_KEY)
    let edited = 0
    for (const idx of indices) {
      if (typeof idx !== 'number' || idx < 0 || idx >= apartments.length) continue
      for (const [key, raw] of entries) {
        const field = FIELD_BY_KEY[key as ApartmentKey]
        apartments[idx][key as ApartmentKey] = coerceCell(field, raw)
      }
      edited++
    }
    if (edited === 0) {
      sendError(res, 400, 'Aucun index de bien valide à modifier.')
      return
    }

    stored.anomalies = undefined

    const body: BienEditResponse = {
      apartments,
      reconcile: reconcile(apartments, stored.fiscal!, stored.reconcileState!),
    }
    res.json(body)
  }),
)

app.post(
  '/api/report/generate',
  handler((req, res) => {
    const stored = ensureReconcileReady((req.body ?? {}).uploadId, res)
    if (!stored) return

    const recon = reconcile(stored.apartments!, stored.fiscal!, stored.reconcileState!)
    if (!recon.canGenerateReport) {
      sendError(
        res,
        409,
        `Rapport verrouillé : ${recon.counts.unresolved} cas de rapprochement non résolu(s).`,
        [
          ...recon.erpOnly.filter((i) => !i.resolved).map((i) => `ERP uniquement : ${i.label}`),
          ...recon.fiscOnly.filter((i) => !i.resolved).map((i) => `Fisc uniquement : ${i.label}`),
        ],
      )
      return
    }

    const previous = new Map<string, AnomalyStatus>(
      (stored.anomalies ?? []).map((a) => [a.id, a.status]),
    )
    const anomalies = generateAnomalies(stored.apartments!, stored.fiscal!, previous)
    stored.anomalies = anomalies
    res.json(buildAnomalyReport(anomalies))
  }),
)

app.post(
  '/api/anomalies/status',
  handler((req, res) => {
    const { uploadId, anomalyIds, status } = (req.body ?? {}) as {
      uploadId?: unknown
      anomalyIds?: unknown
      status?: unknown
    }
    if (typeof uploadId !== 'string' || uploadId === '') {
      sendError(res, 400, 'Paramètre « uploadId » manquant ou invalide.')
      return
    }
    const stored = getUpload(uploadId)
    if (!stored) {
      sendError(res, 404, 'Upload introuvable ou expiré.')
      return
    }
    if (!stored.anomalies) {
      sendError(res, 422, 'Aucun rapport généré (POST /api/report/generate).')
      return
    }
    const validStatuses: readonly AnomalyStatus[] = ['open', 'confirmed', 'justified', 'on_hold']
    if (!Array.isArray(anomalyIds) || !validStatuses.includes(status as AnomalyStatus)) {
      sendError(res, 400, 'Paramètres « anomalyIds » / « status » invalides.')
      return
    }

    const ids = new Set(anomalyIds.map(String))
    let updated = 0
    for (const a of stored.anomalies) {
      if (ids.has(a.id)) {
        a.status = status as AnomalyStatus
        updated++
      }
    }
    res.json({ updated, ...buildAnomalyReport(stored.anomalies) })
  }),
)

function buildAnomalyReport(anomalies: FiscalAnomaly[]) {
  const byStatus: Record<AnomalyStatus, number> = {
    open: 0,
    confirmed: 0,
    justified: 0,
    on_hold: 0,
  }
  let totalImpactEuros = 0
  const buildings = new Set<string>()
  for (const a of anomalies) {
    byStatus[a.status]++
    totalImpactEuros += a.impactEuros
    buildings.add(a.building)
  }
  return {
    anomalies,
    totalImpactEuros,
    byStatus,
    buildings: [...buildings].sort(),
  }
}

app.use('/api', (_req, res) => {
  sendError(res, 404, 'Route inconnue.')
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux (10 Mo maximum).'
        : `Erreur d'upload : ${err.message}`
    sendError(res, 400, message)
    return
  }
  const message = err instanceof Error ? err.message : 'Erreur interne inattendue.'
  sendError(res, 422, message)
})

function sendError(res: Response, status: number, error: string, details?: string[]): void {
  const body: ApiError = details ? { error, details } : { error }
  res.status(status).json(body)
}

app.listen(PORT, () => {
  console.log(`[orka-api] serveur prêt sur http://localhost:${PORT}`)
})
