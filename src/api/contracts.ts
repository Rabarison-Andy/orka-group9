import type { Apartment, ApartmentKey } from '../types'

export type SourceFormat = 'xlsx' | 'csv'

export type RawCell = string | number | boolean | null

export type RawRow = RawCell[]

export interface ExtractResponse {
  uploadId: string
  filename: string
  format: SourceFormat
  headers: string[]
  preview: RawRow[]
  totalRows: number
  suggestions: MappingSuggestion[]
}

export type MatchReason =
  | 'exact'
  | 'alias'
  | 'fuzzy'
  | 'none'

export interface MappingSuggestion {
  field: ApartmentKey
  columnIndex: number | null
  confidence: number
  reason: MatchReason
}

export type ConfirmedMapping = Partial<Record<ApartmentKey, number | null>>

export interface ProcessRequest {
  uploadId: string
  mapping: ConfirmedMapping
}

export type AnomalyKind =
  | 'missing_required_column'
  | 'type_mismatch'

export interface Anomaly {
  kind: AnomalyKind
  field: ApartmentKey
  sourceRow?: number
  rawValue?: string
  message: string
}

export type WarningKind =
  | 'malformed_optional'
  | 'empty_required'
  | 'skipped_row'
  | 'unmapped_column'

export interface Warning {
  kind: WarningKind
  field?: ApartmentKey
  sourceRow?: number
  message: string
}

export interface RowReport {
  index: number
  sourceRow: number
  status: 'complete' | 'incomplete'
  filledCount: number
  totalFields: number
  missingRequired: ApartmentKey[]
  missingOptional: ApartmentKey[]
}

export interface ValidationReport {
  totalRows: number
  importedRows: number
  skippedRows: number
  unmappedColumns: string[]
  warnings: Warning[]
  rows: RowReport[]
}

export interface ProcessResponse {
  apartments: Apartment[]
  report: ValidationReport
}

export interface ApiError {
  error: string
  details?: string[]
}

export interface ValidationErrorBody extends ApiError {
  anomalies: Anomaly[]
}

export interface FiscalRecord {
  invariant: string
  rue?: string
  ville?: string
  surface: number | ''
  categorie: number | ''
  natureBien?: string
  taxeEstimee: number
}

export type MatchStatus = 'matched' | 'erp_only' | 'fisc_only'

export type ResolutionAction = 'exclude' | 'attach' | 'import' | 'keep'

export type BulkResolutionAction = 'exclude' | 'import' | 'keep'

export interface ReconcileItem {
  invariant: string
  label: string
  status: MatchStatus
  bien?: Apartment
  fiscal?: FiscalRecord
  hasAnomalies: boolean
  impactEuros: number
  degrevementEuros: number
  resolved: boolean
  resolution?: ResolutionAction
}

export interface ReconcileCounts {
  matched: number
  erpOnly: number
  fiscOnly: number
  unresolved: number
  withAnomalies: number
}

export interface ReconcileResponse {
  matched: ReconcileItem[]
  erpOnly: ReconcileItem[]
  fiscOnly: ReconcileItem[]
  counts: ReconcileCounts
  canGenerateReport: boolean
}

export interface ResolveRequest {
  uploadId: string
  invariant: string
  side: 'erp_only' | 'fisc_only'
  action: ResolutionAction
  targetInvariant?: string
}

export interface ResolveBulkRequest {
  uploadId: string
  side: 'erp_only' | 'fisc_only'
  invariants: string[]
  action: BulkResolutionAction
}

export interface BienEditRequest {
  uploadId: string
  indices: number[]
  changes: Partial<Apartment>
}

export interface BienEditResponse {
  apartments: Apartment[]
  reconcile: ReconcileResponse
}

export type AnomalyStatus = 'open' | 'confirmed' | 'justified' | 'on_hold'

export interface FiscalAnomaly {
  id: string
  invariant: string
  label: string
  building: string
  field: ApartmentKey
  fieldLabel: string
  cadastralValue: string | number
  clientValue: string | number
  impactEuros: number
  direction: 'overtaxed' | 'undertaxed'
  status: AnomalyStatus
}

export interface AnomalyReport {
  anomalies: FiscalAnomaly[]
  totalImpactEuros: number
  byStatus: Record<AnomalyStatus, number>
  buildings: string[]
}

export interface AnomalyStatusRequest {
  uploadId: string
  anomalyIds: string[]
  status: AnomalyStatus
}
