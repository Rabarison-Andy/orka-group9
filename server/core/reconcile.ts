import { FIELD_BY_KEY, type Apartment, type ApartmentKey } from '../../src/types'
import type {
  AnomalyStatus,
  FiscalAnomaly,
  FiscalRecord,
  ReconcileItem,
  ReconcileResponse,
  ResolutionAction,
} from '../../src/api/contracts'
import { tarif, TAUX_TF } from './fiscal'

export interface ReconcileState {
  resolvedErp: Map<string, ResolutionAction>
  resolvedFisc: Map<string, ResolutionAction>
}

function key(invariant: string): string {
  return invariant.trim().toUpperCase()
}

interface Delta {
  field: ApartmentKey
  cadastralValue: number
  clientValue: number
  impactEuros: number
  direction: 'overtaxed' | 'undertaxed'
}

export function computeDeltas(bien: Apartment, fiscal: FiscalRecord): Delta[] {
  const deltas: Delta[] = []

  if (
    typeof bien.surface === 'number' &&
    typeof fiscal.surface === 'number' &&
    bien.surface !== fiscal.surface
  ) {
    const cat: number | '' =
      typeof fiscal.categorie === 'number'
        ? fiscal.categorie
        : typeof bien.categorie === 'number'
          ? bien.categorie
          : ''
    const impact = Math.round(Math.abs(bien.surface - fiscal.surface) * tarif(cat) * TAUX_TF)
    deltas.push({
      field: 'surface',
      cadastralValue: fiscal.surface,
      clientValue: bien.surface,
      impactEuros: impact,
      direction: fiscal.surface > bien.surface ? 'overtaxed' : 'undertaxed',
    })
  }

  if (
    typeof bien.categorie === 'number' &&
    typeof fiscal.categorie === 'number' &&
    bien.categorie !== fiscal.categorie
  ) {
    const surf =
      typeof bien.surface === 'number'
        ? bien.surface
        : typeof fiscal.surface === 'number'
          ? fiscal.surface
          : 0
    const impact = Math.round(
      surf * Math.abs(tarif(bien.categorie) - tarif(fiscal.categorie)) * TAUX_TF,
    )
    deltas.push({
      field: 'categorie',
      cadastralValue: fiscal.categorie,
      clientValue: bien.categorie,
      impactEuros: impact,
      direction: tarif(fiscal.categorie) > tarif(bien.categorie) ? 'overtaxed' : 'undertaxed',
    })
  }

  return deltas
}

function label(bien?: Apartment, fiscal?: FiscalRecord, invariant = ''): string {
  const rue = String(bien?.rue ?? fiscal?.rue ?? '')
  const ville = String(bien?.ville ?? fiscal?.ville ?? '')
  return [rue, ville].filter(Boolean).join(', ') || invariant || '(sans invariant)'
}

export function reconcile(
  apartments: Apartment[],
  fiscal: FiscalRecord[],
  state: ReconcileState,
): ReconcileResponse {
  const fiscalByKey = new Map(fiscal.map((f) => [key(f.invariant), f]))
  const matchedKeys = new Set<string>()

  const matched: ReconcileItem[] = []
  const erpOnly: ReconcileItem[] = []

  for (const bien of apartments) {
    const invariant = String(bien.invariant ?? '').trim()
    const k = key(invariant)
    const fiche = k ? fiscalByKey.get(k) : undefined

    if (fiche) {
      matchedKeys.add(k)
      const deltas = computeDeltas(bien, fiche)
      const impactEuros = deltas.reduce((sum, d) => sum + d.impactEuros, 0)
      const degrevementEuros = deltas.reduce(
        (sum, d) => sum + (d.direction === 'overtaxed' ? -d.impactEuros : d.impactEuros),
        0,
      )
      matched.push({
        invariant,
        label: label(bien, fiche, invariant),
        status: 'matched',
        bien,
        fiscal: fiche,
        hasAnomalies: deltas.length > 0,
        impactEuros,
        degrevementEuros,
        resolved: true,
      })
    } else {
      if (k) matchedKeys.add(k)
      erpOnly.push({
        invariant,
        label: label(bien, undefined, invariant),
        status: 'erp_only',
        bien,
        hasAnomalies: false,
        impactEuros: 0,
        degrevementEuros: 0,
        resolved: state.resolvedErp.has(k),
        resolution: state.resolvedErp.get(k),
      })
    }
  }

  const fiscOnly: ReconcileItem[] = []
  for (const fiche of fiscal) {
    const k = key(fiche.invariant)
    if (matchedKeys.has(k)) continue
    fiscOnly.push({
      invariant: fiche.invariant,
      label: label(undefined, fiche, fiche.invariant),
      status: 'fisc_only',
      fiscal: fiche,
      hasAnomalies: false,
      impactEuros: 0,
      degrevementEuros: 0,
      resolved: state.resolvedFisc.has(k),
      resolution: state.resolvedFisc.get(k),
    })
  }

  const unresolved =
    erpOnly.filter((i) => !i.resolved).length + fiscOnly.filter((i) => !i.resolved).length
  const withAnomalies = matched.filter((i) => i.hasAnomalies).length

  return {
    matched,
    erpOnly,
    fiscOnly,
    counts: {
      matched: matched.length,
      erpOnly: erpOnly.length,
      fiscOnly: fiscOnly.length,
      unresolved,
      withAnomalies,
    },
    canGenerateReport: unresolved === 0,
  }
}

export function generateAnomalies(
  apartments: Apartment[],
  fiscal: FiscalRecord[],
  previous: Map<string, AnomalyStatus> = new Map(),
): FiscalAnomaly[] {
  const fiscalByKey = new Map(fiscal.map((f) => [key(f.invariant), f]))
  const anomalies: FiscalAnomaly[] = []

  for (const bien of apartments) {
    const invariant = String(bien.invariant ?? '').trim()
    const fiche = invariant ? fiscalByKey.get(key(invariant)) : undefined
    if (!fiche) continue

    for (const delta of computeDeltas(bien, fiche)) {
      const id = `${key(invariant)}:${delta.field}`
      anomalies.push({
        id,
        invariant,
        label: label(bien, fiche, invariant),
        building: String(bien.nomImmeuble ?? '') || '—',
        field: delta.field,
        fieldLabel: FIELD_BY_KEY[delta.field].label,
        cadastralValue: delta.cadastralValue,
        clientValue: delta.clientValue,
        impactEuros: delta.impactEuros,
        direction: delta.direction,
        status: previous.get(id) ?? 'open',
      })
    }
  }

  anomalies.sort((a, b) => b.impactEuros - a.impactEuros)
  return anomalies
}
