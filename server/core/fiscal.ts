/**
 * Source de données fiscales (cadastre) — SIMULÉE.
 *
 * Le produit final interrogerait une API DGFiP. Faute de source réelle, on
 * génère un jeu fiscal **déterministe** dérivé du parc importé, en injectant des
 * écarts contrôlés (surface, catégorie), des biens « ERP uniquement » et des
 * fiches « Fisc uniquement ». Déterministe ⇒ démo et tests reproductibles.
 *
 * Modèle de taxe foncière **simplifié** (assumé, cf. note technique) :
 *   valeur locative ≈ surface × tarif(catégorie)        [€/an]
 *   taxe foncière   ≈ valeur locative × TAUX_TF          [€/an]
 * L'impact d'un écart = différence de taxe induite par cet écart.
 */
import type { Apartment } from '../../src/types'
import type { FiscalRecord } from '../../src/api/contracts'

/** Tarif annuel €/m² par catégorie cadastrale (1 = haut standing … 8 = vétuste). */
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
/** Taux global de taxe foncière (commune + interco + ordures), approché. */
export const TAUX_TF = 0.35

export function tarif(categorie: number | ''): number {
  return typeof categorie === 'number' ? (TARIF_BY_CAT[categorie] ?? DEFAULT_TARIF) : DEFAULT_TARIF
}

/** Taxe foncière annuelle estimée pour une surface et une catégorie. */
export function annualTax(surface: number | '', categorie: number | ''): number {
  if (typeof surface !== 'number') return 0
  return Math.round(surface * tarif(categorie) * TAUX_TF)
}

/** Hash déterministe (FNV-1a) d'une chaîne → entier non signé. */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Génère les fiches fiscales correspondant (ou non) au parc importé.
 * Règle déterministe par invariant (h = hash) :
 *   h%10 < 6  → fiche identique (apparié, sans écart)
 *   h%10 6-7  → écart de surface (le fisc surévalue → trop-perçu)
 *   h%10 == 8 → écart de catégorie
 *   h%10 == 9 → AUCUNE fiche (bien « ERP uniquement »)
 * Puis quelques fiches « Fisc uniquement » synthétiques.
 */
export function generateFiscalRecords(apartments: Apartment[]): FiscalRecord[] {
  const records: FiscalRecord[] = []

  for (const a of apartments) {
    const invariant = String(a.invariant ?? '').trim()
    if (!invariant) continue // sans identifiant → restera « ERP uniquement »

    const h = hashStr(invariant)
    const r = h % 10
    if (r === 9) continue // ERP uniquement

    const surfaceClient = typeof a.surface === 'number' ? a.surface : ''
    const catClient = typeof a.categorie === 'number' ? a.categorie : ''
    let surface: number | '' = surfaceClient
    let categorie: number | '' = catClient

    if ((r === 6 || r === 7) && typeof surfaceClient === 'number') {
      surface = surfaceClient + ((h % 6) + 3) // le fisc compte plus de m²
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

  // Fiches « Fisc uniquement » (taxées mais absentes de l'ERP).
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
