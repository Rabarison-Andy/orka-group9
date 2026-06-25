/**
 * Étape 2 du pipeline — moteur de mapping automatique.
 *
 * Objectif : pour chaque champ interne Kadastra, proposer la colonne source la
 * plus probable du fichier client, avec un score de confiance et une raison.
 *
 * Stratégie en cascade (du plus sûr au plus permissif) :
 *   1. correspondance EXACTE avec le libellé officiel du champ        → 1.00
 *   2. correspondance EXACTE avec un alias/synonyme connu             → 0.95
 *   3. correspondance FLOUE (tokens + distance d'édition)             → < 0.90
 * Puis affectation gloutonne : on attribue les meilleures paires d'abord, en
 * garantissant qu'une colonne et un champ ne sont utilisés qu'une seule fois.
 */
import { FIELDS } from '../../src/types'
import type { ApartmentKey } from '../../src/types'
import type { MappingSuggestion, MatchReason } from '../../src/api/contracts'

/** Seuil minimal de confiance pour proposer une correspondance floue. */
const FUZZY_THRESHOLD = 0.62

/** Minuscule, sans accents, sans ponctuation, espaces compactés. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean)
}

/** Distance de Levenshtein classique (programmation dynamique). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Similarité caractères ∈ [0,1] dérivée de la distance d'édition. */
function charRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/** Similarité tokens : combine Jaccard et taux de recouvrement du plus court. */
function tokenSim(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const t of setA) if (setB.has(t)) inter++
  const union = new Set([...setA, ...setB]).size
  const jaccard = inter / union
  const containment = inter / Math.min(setA.size, setB.size)
  return Math.max(jaccard, 0.9 * containment)
}

/** Libellés candidats d'un champ (officiel + alias + libellé UI). */
function candidateLabels(field: (typeof FIELDS)[number]): string[] {
  return [field.excel, field.label, ...(field.aliases ?? [])]
}

interface Scored {
  field: ApartmentKey
  columnIndex: number
  confidence: number
  reason: MatchReason
}

/** Meilleur score d'un champ pour une colonne donnée. */
function scoreFieldColumn(
  field: (typeof FIELDS)[number],
  header: string,
): { confidence: number; reason: MatchReason } {
  const normHeader = normalize(header)
  if (normHeader === '') return { confidence: 0, reason: 'none' }

  // 1. Exact sur le libellé officiel.
  if (normHeader === normalize(field.excel)) return { confidence: 1, reason: 'exact' }

  // 2. Exact sur un alias / libellé UI.
  const aliasHit = [field.label, ...(field.aliases ?? [])].some(
    (label) => normalize(label) === normHeader,
  )
  if (aliasHit) return { confidence: 0.95, reason: 'alias' }

  // 3. Flou : meilleure similarité sur l'ensemble des libellés candidats.
  const headerTokens = tokenize(header)
  let best = 0
  for (const label of candidateLabels(field)) {
    const sim = Math.max(
      tokenSim(headerTokens, tokenize(label)),
      charRatio(normHeader, normalize(label)),
    )
    if (sim > best) best = sim
  }
  // Plafonné sous 0.9 pour rester sous les correspondances exactes/alias.
  return { confidence: Math.min(best, 0.89), reason: 'fuzzy' }
}

/**
 * Propose un mapping pour TOUS les champs internes à partir des en-têtes du
 * fichier. Affectation gloutonne : 1 colonne ↔ 1 champ au maximum.
 */
export function suggestMapping(headers: string[]): MappingSuggestion[] {
  // 1. Calcule toutes les paires (champ, colonne) au-dessus du seuil.
  const candidates: Scored[] = []
  for (const field of FIELDS) {
    headers.forEach((header, columnIndex) => {
      const { confidence, reason } = scoreFieldColumn(field, header)
      if (reason !== 'fuzzy' || confidence >= FUZZY_THRESHOLD) {
        if (confidence > 0) {
          candidates.push({ field: field.key, columnIndex, confidence, reason })
        }
      }
    })
  }

  // 2. Affectation gloutonne par confiance décroissante.
  candidates.sort((a, b) => b.confidence - a.confidence)
  const fieldTaken = new Set<ApartmentKey>()
  const columnTaken = new Set<number>()
  const chosen = new Map<ApartmentKey, Scored>()

  for (const cand of candidates) {
    if (fieldTaken.has(cand.field) || columnTaken.has(cand.columnIndex)) continue
    chosen.set(cand.field, cand)
    fieldTaken.add(cand.field)
    columnTaken.add(cand.columnIndex)
  }

  // 3. Une suggestion par champ (colonne nulle si rien trouvé).
  return FIELDS.map((field) => {
    const hit = chosen.get(field.key)
    return hit
      ? {
          field: field.key,
          columnIndex: hit.columnIndex,
          confidence: Number(hit.confidence.toFixed(2)),
          reason: hit.reason,
        }
      : { field: field.key, columnIndex: null, confidence: 0, reason: 'none' }
  })
}
