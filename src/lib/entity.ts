/**
 * Lien logique de regroupement des biens en ENTITÉS.
 *
 * Un bailleur possède des « entités » (immeubles / adresses) qui regroupent
 * plusieurs lots (appartement, parking, cave…). On dérive ce lien des données
 * — il n'est PAS codé en dur :
 *   1. `Nom de l'immeuble` s'il est renseigné ;
 *   2. sinon repli sur l'adresse (`Rue` + `Ville`).
 * Un bien sans aucun de ces repères reste autonome.
 *
 * Pour changer la règle de regroupement, il suffit de modifier ce seul fichier.
 */
import type { Apartment } from '../types'

/** Clé d'entité normalisée (vide = bien autonome, non regroupable). */
export function entityKey(apt: Apartment): string {
  const imm = String(apt.nomImmeuble ?? '').trim().toLowerCase()
  if (imm) return `imm:${imm}`
  const rue = String(apt.rue ?? '').trim().toLowerCase()
  const ville = String(apt.ville ?? '').trim().toLowerCase()
  if (rue || ville) return `addr:${rue}|${ville}`
  return ''
}

/** Libellé lisible de l'entité d'un bien. */
export function entityName(apt: Apartment): string {
  const imm = String(apt.nomImmeuble ?? '').trim()
  if (imm) return imm
  const rue = String(apt.rue ?? '').trim()
  const ville = String(apt.ville ?? '').trim()
  return [rue, ville].filter(Boolean).join(', ')
}

export interface BienRow {
  index: number
  apt: Apartment
}

export interface EntityNode {
  type: 'entity'
  key: string
  name: string
  rows: BienRow[]
  /** Somme des surfaces numériques des lots. */
  surface: number
}

export interface BienNode {
  type: 'bien'
  key: string
  row: BienRow
}

export type TreeNode = EntityNode | BienNode

/**
 * Regroupe des biens (avec leur index d'origine) en arbre :
 * une entité dès qu'au moins 2 biens partagent la même clé logique, sinon le
 * bien reste autonome. L'ordre d'apparition est préservé.
 */
export function buildEntityTree(rows: BienRow[]): TreeNode[] {
  const groups = new Map<string, BienRow[]>()
  const order: string[] = []

  for (const row of rows) {
    const key = entityKey(row.apt) || `solo:${row.index}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(row)
  }

  const nodes: TreeNode[] = []
  for (const key of order) {
    const members = groups.get(key)!
    const groupable = key.startsWith('imm:') || key.startsWith('addr:')
    if (groupable && members.length >= 2) {
      const surface = members.reduce(
        (sum, m) => sum + (typeof m.apt.surface === 'number' ? m.apt.surface : 0),
        0,
      )
      nodes.push({
        type: 'entity',
        key,
        name: entityName(members[0].apt),
        rows: members,
        surface,
      })
    } else {
      for (const m of members) nodes.push({ type: 'bien', key: `b:${m.index}`, row: m })
    }
  }
  return nodes
}
