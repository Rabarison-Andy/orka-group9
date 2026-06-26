import type { Apartment } from '../../src/types'
import type { FiscalRecord } from '../../src/api/contracts'

const TARIF_BY_CAT: Readonly<Record<number, number>> = {
  1: 14,
  2: 12,
  3: 10,
  4: 8,
  5: 6.5,
  6: 5,
  7: 4,
  8: 3,
}
const DEFAULT_TARIF = 6
export const TAUX_TF = 0.35

export function tarif(categorie: number | ''): number {
  return typeof categorie === 'number' ? (TARIF_BY_CAT[categorie] ?? DEFAULT_TARIF) : DEFAULT_TARIF
}

export function annualTax(surface: number | '', categorie: number | ''): number {
  if (typeof surface !== 'number') return 0
  return Math.round(surface * tarif(categorie) * TAUX_TF)
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function generateFiscalRecords(apartments: Apartment[]): FiscalRecord[] {
  const records: FiscalRecord[] = []

  for (const a of apartments) {
    const invariant = String(a.invariant ?? '').trim()
    if (!invariant) continue

    const h = hashStr(invariant)
    const r = h % 10
    if (r === 9) continue

    const surfaceClient = typeof a.surface === 'number' ? a.surface : ''
    const catClient = typeof a.categorie === 'number' ? a.categorie : ''
    let surface: number | '' = surfaceClient
    let categorie: number | '' = catClient

    if ((r === 6 || r === 7) && typeof surfaceClient === 'number') {
      surface = surfaceClient + ((h % 6) + 3)
    }
    if (r === 8 && typeof catClient === 'number') {
      categorie = Math.min(8, Math.max(1, catClient + (h % 2 === 0 ? 1 : -1)))
    }

    records.push({
      invariant,
      rue: String(a.rue ?? ''),
      ville: String(a.ville ?? ''),
      surface,
      categorie,
      natureBien: String(a.natureBien ?? ''),
      taxeEstimee: annualTax(surface, categorie),
    })
  }

  const fiscOnlyCount = Math.max(2, Math.floor(apartments.length / 20))
  for (let i = 0; i < fiscOnlyCount; i++) {
    const invariant = `FISC-${String(i + 1).padStart(4, '0')}`
    const h = hashStr(invariant)
    const surface = 30 + (h % 80)
    const categorie = 1 + (h % 8)
    records.push({
      invariant,
      rue: `Parcelle cadastrale ${i + 1}`,
      ville: '—',
      surface,
      categorie,
      natureBien: 'Appartement',
      taxeEstimee: annualTax(surface, categorie),
    })
  }

  return records
}
