/**
 * Contrats d'API partagés entre le client (React) et le serveur (Express).
 * Ce fichier ne contient QUE des types — aucune dépendance runtime — afin de
 * pouvoir être importé des deux côtés sans embarquer de code Node dans le bundle.
 */
import type { Apartment, ApartmentKey } from '../types'

/** Formats de fichiers acceptés par l'endpoint d'extraction. */
export type SourceFormat = 'xlsx' | 'csv'

/** Une cellule brute telle que lue dans le fichier (avant coercition de type). */
export type RawCell = string | number | boolean | null

/** Une ligne brute = un tableau de cellules aligné sur `headers`. */
export type RawRow = RawCell[]

/**
 * Étape 1 du pipeline — réponse de `POST /api/extract`.
 * Le serveur a lu le fichier, extrait les en-têtes et un aperçu des données,
 * et proposé un mapping automatique.
 */
export interface ExtractResponse {
  /** Identifiant de l'upload, à renvoyer à `POST /api/process`. */
  uploadId: string
  filename: string
  format: SourceFormat
  /** En-têtes (colonnes) détectés dans le fichier. */
  headers: string[]
  /** Aperçu des premières lignes de données brutes (valeurs non transformées). */
  preview: RawRow[]
  /** Nombre total de lignes de données (hors en-tête). */
  totalRows: number
  /** Mapping proposé automatiquement (Étape 2). */
  suggestions: MappingSuggestion[]
}

/** Origine d'une proposition de mapping (sert à expliquer la confiance). */
export type MatchReason =
  | 'exact' // libellé identique au champ interne
  | 'alias' // correspond à un synonyme connu
  | 'fuzzy' // proximité textuelle (tokens / distance d'édition)
  | 'none' // aucune colonne trouvée

/** Proposition de correspondance pour UN champ interne Kadastra. */
export interface MappingSuggestion {
  field: ApartmentKey
  /** Index de la colonne source proposée, ou `null` si aucune. */
  columnIndex: number | null
  /** Confiance de 0 à 1. */
  confidence: number
  reason: MatchReason
}

/**
 * Mapping confirmé par l'utilisateur : champ interne → index de colonne source.
 * `null` = champ explicitement laissé non mappé.
 */
export type ConfirmedMapping = Partial<Record<ApartmentKey, number | null>>

/** Corps de `POST /api/process`. */
export interface ProcessRequest {
  uploadId: string
  mapping: ConfirmedMapping
}

/* ------------------------------------------------------------------ *
 * Validation à deux niveaux de sévérité (cf. spéc. Kadastra Étape 3) :
 *   - ANOMALIES bloquantes  → 422, AUCUN traitement partiel.
 *   - WARNINGS non bloquants → 200, données acceptées + signalées.
 * ------------------------------------------------------------------ */

/** Type d'anomalie BLOQUANTE (interdit l'import). */
export type AnomalyKind =
  | 'missing_required_column' // un champ obligatoire n'est mappé à aucune colonne
  | 'type_mismatch' // valeur de type incompatible dans un champ obligatoire

/** Anomalie bloquante renvoyée dans le corps d'erreur 422. */
export interface Anomaly {
  kind: AnomalyKind
  field: ApartmentKey
  /** Ligne 1-based dans le fichier d'origine (pour `type_mismatch`). */
  sourceRow?: number
  /** Valeur brute fautive (pour `type_mismatch`). */
  rawValue?: string
  message: string
}

/** Type de warning NON bloquant. */
export type WarningKind =
  | 'malformed_optional' // valeur de mauvais type dans un champ optionnel (vidée)
  | 'empty_required' // champ obligatoire mappé mais vide (à compléter)
  | 'skipped_row' // ligne vide écartée
  | 'unmapped_column' // colonne source non mappée

/** Warning non bloquant. */
export interface Warning {
  kind: WarningKind
  field?: ApartmentKey
  sourceRow?: number
  message: string
}

/**
 * Rapport de restitution d'une ligne importée — permet au front de
 * distinguer champs complétés / manquants.
 */
export interface RowReport {
  /** Index de la ligne dans le tableau `apartments` renvoyé. */
  index: number
  /** Numéro de ligne 1-based dans le fichier d'origine (en-tête = ligne 1). */
  sourceRow: number
  status: 'complete' | 'incomplete'
  filledCount: number
  totalFields: number
  /** Champs obligatoires encore vides (à compléter, surlignés en rouge). */
  missingRequired: ApartmentKey[]
  /** Champs optionnels vides (à compléter, surlignés en ambre). */
  missingOptional: ApartmentKey[]
}

/** Rapport global renvoyé par `POST /api/process` en cas de succès. */
export interface ValidationReport {
  totalRows: number
  importedRows: number
  /** Lignes vides écartées. */
  skippedRows: number
  /** En-têtes source ignorés (non mappés à un champ interne). */
  unmappedColumns: string[]
  /** Avertissements non bloquants, exploitables par l'UI. */
  warnings: Warning[]
  rows: RowReport[]
}

/** Réponse de `POST /api/process` (HTTP 200, validation passée). */
export interface ProcessResponse {
  apartments: Apartment[]
  report: ValidationReport
}

/** Forme standard d'une erreur d'API (jamais un crash, toujours du JSON). */
export interface ApiError {
  error: string
  details?: string[]
}

/** Corps d'erreur 422 quand des anomalies bloquantes sont détectées. */
export interface ValidationErrorBody extends ApiError {
  anomalies: Anomaly[]
}

/* ================================================================== *
 * PAGE 1 (suite) — Rapprochement Fisc / ERP
 * ================================================================== */

/** Fiche fiscale cadastrale (côté fisc) rapprochée d'un bien ERP. */
export interface FiscalRecord {
  invariant: string
  rue?: string
  ville?: string
  surface: number | ''
  categorie: number | ''
  natureBien?: string
  /** Taxe foncière annuelle estimée par le fisc (€). */
  taxeEstimee: number
}

/** Statut de rapprochement d'un bien. */
export type MatchStatus = 'matched' | 'erp_only' | 'fisc_only'

/**
 * Action de résolution d'un cas non apparié :
 * - `keep`    : conserver le bien ERP tel quel (sans équivalent fisc) ;
 * - `import`  : importer la fiche fisc comme nouveau bien ;
 * - `exclude` : écarter le cas du lot ;
 * - `attach`  : rattacher manuellement à une contrepartie orpheline.
 */
export type ResolutionAction = 'exclude' | 'attach' | 'import' | 'keep'

/** Actions applicables en lot (le rattachement reste unitaire). */
export type BulkResolutionAction = 'exclude' | 'import' | 'keep'

/** Un élément du rapprochement (bien ERP et/ou fiche fiscale). */
export interface ReconcileItem {
  invariant: string
  label: string
  status: MatchStatus
  bien?: Apartment
  fiscal?: FiscalRecord
  /** Vrai si un écart financier existe entre ERP et fisc (cas `matched`). */
  hasAnomalies: boolean
  /** Impact financier total estimé des écarts de cette ligne (€). */
  impactEuros: number
  resolved: boolean
  resolution?: ResolutionAction
}

export interface ReconcileCounts {
  matched: number
  erpOnly: number
  fiscOnly: number
  /** Cas ERP-seul / Fisc-seul encore en suspens. */
  unresolved: number
  /** Nb de biens appariés présentant au moins un écart. */
  withAnomalies: number
}

/** Réponse de `POST /api/reconcile`. */
export interface ReconcileResponse {
  matched: ReconcileItem[]
  erpOnly: ReconcileItem[]
  fiscOnly: ReconcileItem[]
  counts: ReconcileCounts
  /** Verrou de transition : faux tant qu'il reste des cas non résolus. */
  canGenerateReport: boolean
}

/** Corps de `POST /api/reconcile/resolve` (résolution unitaire). */
export interface ResolveRequest {
  uploadId: string
  invariant: string
  side: 'erp_only' | 'fisc_only'
  action: ResolutionAction
  /** Invariant cible pour un rattachement (`attach`). */
  targetInvariant?: string
}

/** Corps de `POST /api/reconcile/resolve-bulk` (résolution en lot). */
export interface ResolveBulkRequest {
  uploadId: string
  side: 'erp_only' | 'fisc_only'
  invariants: string[]
  action: BulkResolutionAction
}

/* ================================================================== *
 * PAGE 2 — Gestion des anomalies (écarts Fisc/ERP, « l'euro d'abord »)
 * ================================================================== */

export type AnomalyStatus = 'open' | 'confirmed' | 'justified' | 'on_hold'

/** Un écart financier entre la donnée cadastrale et la donnée client. */
export interface FiscalAnomaly {
  id: string
  invariant: string
  label: string
  /** Immeuble/bâtiment (sert au regroupement et aux actions en lot). */
  building: string
  field: ApartmentKey
  fieldLabel: string
  /** Comparaison côte-à-côte. */
  cadastralValue: string | number
  clientValue: string | number
  /** Enjeu financier estimé (€), valeur absolue — clé de tri. */
  impactEuros: number
  /** `overtaxed` = le fisc surévalue (montant récupérable). */
  direction: 'overtaxed' | 'undertaxed'
  status: AnomalyStatus
}

/** Réponse de `POST /api/report/generate` (anomalies triées par € décroissant). */
export interface AnomalyReport {
  anomalies: FiscalAnomaly[]
  /** Somme des impacts (€) — gain potentiel total. */
  totalImpactEuros: number
  byStatus: Record<AnomalyStatus, number>
  /** Bâtiments présents (pour les filtres front). */
  buildings: string[]
}

/** Corps de `POST /api/anomalies/status` (single si 1 id, bulk si plusieurs). */
export interface AnomalyStatusRequest {
  uploadId: string
  anomalyIds: string[]
  status: AnomalyStatus
}
