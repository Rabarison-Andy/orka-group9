import type { Apartment } from '../types'

export function entityKey(apt: Apartment): string {
  const imm = String(apt.nomImmeuble ?? '').trim().toLowerCase()
  if (imm) return `imm:${imm}`
  const rue = String(apt.rue ?? '').trim().toLowerCase()
  const ville = String(apt.ville ?? '').trim().toLowerCase()
  if (rue || ville) return `addr:${rue}|${ville}`
  return ''
}

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
  surface: number
}

export interface BienNode {
  type: 'bien'
  key: string
  row: BienRow
}

export type TreeNode = EntityNode | BienNode

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
