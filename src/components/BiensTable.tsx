import { useMemo, useState, type ReactNode } from 'react'
import {
  FIELD_BY_KEY,
  isFilled,
  type Apartment,
  type ApartmentKey,
} from '../types'
import { formatEuros } from '../format'
import { buildEntityTree, type BienRow, type EntityNode } from '../lib/entity'

interface BiensTableProps {
  apartments: Apartment[]
  degrevement?: Map<string, number>
  actions?: ReactNode
  onConfigure: (index: number) => void
}

const PAGE_SIZE = 8
type ColKey = 'surface' | 'etage'
const COLUMNS: { key: ColKey; label: string; field: ApartmentKey; width: number }[] = [
  { key: 'surface', label: 'Surface', field: 'surface', width: 120 },
  { key: 'etage', label: 'Etage', field: 'etage', width: 110 },
]

function invKey(apt: Apartment): string {
  return String(apt.invariant ?? '').trim().toUpperCase()
}

function bienLabel(apt: Apartment): string {
  return (
    String(apt.natureBien ?? '').trim() ||
    String(apt.rue ?? '').trim() ||
    String(apt.invariant ?? '').trim() ||
    'Bien'
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

function DegrevementPill({ value }: { value: number }) {
  if (!value) return <span className="text-slate-400">—</span>
  const surcout = value > 0
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        surcout ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {surcout ? '+ ' : '− '}
      {formatEuros(Math.abs(value))}
    </span>
  )
}

function CellValueView({ apt, col }: { apt: Apartment; col: (typeof COLUMNS)[number] }) {
  const value = apt[col.field]
  if (isFilled(value)) {
    return <span className="text-slate-700">{col.key === 'surface' ? `${value} m²` : String(value)}</span>
  }
  const required = FIELD_BY_KEY[col.field].required
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        required ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {required ? 'Obligatoire' : 'À compléter'}
    </span>
  )
}

function TriCheckbox({ state, onChange }: { state: 'all' | 'some' | 'none'; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      className="size-4 accent-emerald-600"
      checked={state === 'all'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'some'
      }}
      onChange={onChange}
      aria-label="Sélectionner"
    />
  )
}


export function BiensTable({
  apartments,
  degrevement,
  actions,
  onConfigure,
}: BiensTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [search, setSearch] = useState('')
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({ surface: true, etage: true })
  const [colsOpen, setColsOpen] = useState(false)
  const [page, setPage] = useState(0)

  const degrevOf = (apt: Apartment) => degrevement?.get(invKey(apt)) ?? 0

  const natures = useMemo(
    () => [...new Set(apartments.map((a) => String(a.natureBien ?? '').trim()).filter(Boolean))].sort(),
    [apartments],
  )
  const villes = useMemo(
    () => [...new Set(apartments.map((a) => String(a.ville ?? '').trim()).filter(Boolean))].sort(),
    [apartments],
  )

  const tree = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows: BienRow[] = apartments
      .map((apt, index) => ({ index, apt }))
      .filter(({ apt }) => {
        if (typeFilter && String(apt.natureBien ?? '').trim() !== typeFilter) return false
        if (zoneFilter && String(apt.ville ?? '').trim() !== zoneFilter) return false
        if (q) {
          const hay = [apt.natureBien, apt.rue, apt.ville, apt.nomImmeuble, apt.invariant]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ')
          if (!hay.includes(q)) return false
        }
        return true
      })
    return buildEntityTree(rows)
  }, [apartments, typeFilter, zoneFilter, search])

  const pageCount = Math.max(1, Math.ceil(tree.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageNodes = tree.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const activeCols = COLUMNS.filter((c) => visibleCols[c.key])

  function toggleBien(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }
  function entityState(node: EntityNode): 'all' | 'some' | 'none' {
    const sel = node.rows.filter((r) => selected.has(r.index)).length
    if (sel === 0) return 'none'
    return sel === node.rows.length ? 'all' : 'some'
  }
  function toggleEntity(node: EntityNode) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSel = node.rows.every((r) => next.has(r.index))
      for (const r of node.rows) {
        if (allSel) next.delete(r.index)
        else next.add(r.index)
      }
      return next
    })
  }
  const allBienIndices = useMemo(
    () => tree.flatMap((n) => (n.type === 'entity' ? n.rows.map((r) => r.index) : [n.row.index])),
    [tree],
  )
  function toggleAll() {
    setSelected((prev) =>
      allBienIndices.every((i) => prev.has(i)) ? new Set() : new Set(allBienIndices),
    )
  }
  const headerState: 'all' | 'some' | 'none' =
    allBienIndices.length > 0 && allBienIndices.every((i) => selected.has(i))
      ? 'all'
      : allBienIndices.some((i) => selected.has(i))
        ? 'some'
        : 'none'

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const showDegrevement = degrevement !== undefined
  const colSpan = 2 + activeCols.length + (showDegrevement ? 1 : 0) + 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">type de bien</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(0)
            }}
            className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">Tous</option>
            {natures.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">zone géographique</span>
          <select
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value)
              setPage(0)
            }}
            className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">Toutes</option>
            {villes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="relative flex-1 self-end">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input
            type="text"
            value={search}
            placeholder="Rechercher"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div className="relative self-end">
          <button
            type="button"
            onClick={() => setColsOpen((o) => !o)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Columns ⌄
          </button>
          {colsOpen && (
            <div className="absolute right-0 z-10 mt-1 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg">
              {COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-2 py-1">
                  <input
                    type="checkbox"
                    className="accent-emerald-600"
                    checked={visibleCols[c.key]}
                    onChange={() => setVisibleCols((v) => ({ ...v, [c.key]: !v[c.key] }))}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: 64 }} />
            <col />
            {activeCols.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            {showDegrevement && <col style={{ width: 168 }} />}
            <col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="py-3 pl-4 pr-2">
                <TriCheckbox state={headerState} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 font-semibold">Vos biens</th>
              {activeCols.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">
                  {c.label}
                </th>
              ))}
              {showDegrevement && <th className="px-4 py-3 font-semibold">Dégrèvement estimé</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pageNodes.map((node) =>
              node.type === 'entity' ? (
                <EntityRows
                  key={node.key}
                  node={node}
                  expanded={expanded.has(node.key)}
                  state={entityState(node)}
                  activeCols={activeCols}
                  selected={selected}
                  showDegrevement={showDegrevement}
                  degrevOf={degrevOf}
                  onToggleExpand={() => toggleExpand(node.key)}
                  onToggleEntity={() => toggleEntity(node)}
                  onToggleBien={toggleBien}
                  onConfigure={onConfigure}
                />
              ) : (
                <BienTr
                  key={node.key}
                  row={node.row}
                  depth={0}
                  activeCols={activeCols}
                  checked={selected.has(node.row.index)}
                  showDegrevement={showDegrevement}
                  degrev={degrevOf(node.row.apt)}
                  onToggle={() => toggleBien(node.row.index)}
                  onConfigure={onConfigure}
                />
              ),
            )}
            {pageNodes.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
                  Aucun bien pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {actions && <div className="flex justify-end">{actions}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {selected.size} of {apartments.length} row(s) selected.
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <PageBtn label="«" disabled={safePage === 0} onClick={() => setPage(0)} />
            <PageBtn label="‹" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} />
            <span className="px-2">
              Page {safePage + 1} / {pageCount}
            </span>
            <PageBtn
              label="›"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            />
            <PageBtn
              label="»"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(pageCount - 1)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function EntityRows({
  node,
  expanded,
  state,
  activeCols,
  selected,
  showDegrevement,
  degrevOf,
  onToggleExpand,
  onToggleEntity,
  onToggleBien,
  onConfigure,
}: {
  node: EntityNode
  expanded: boolean
  state: 'all' | 'some' | 'none'
  activeCols: typeof COLUMNS
  selected: Set<number>
  showDegrevement: boolean
  degrevOf: (apt: Apartment) => number
  onToggleExpand: () => void
  onToggleEntity: () => void
  onToggleBien: (index: number) => void
  onConfigure: (index: number) => void
}) {
  const total = node.rows.reduce((s, r) => s + degrevOf(r.apt), 0)
  return (
    <>
      <tr className="border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50">
        <td className="py-3 pl-4 pr-2">
          <TriCheckbox state={state} onChange={onToggleEntity} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={expanded ? 'Replier les lots' : 'Déplier les lots'}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <Chevron open={expanded} />
            </button>
            <span className="truncate font-semibold text-slate-800">{node.name}</span>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {node.rows.length}
            </span>
          </div>
        </td>
        {activeCols.map((c) => (
          <td key={c.key} className="px-4 py-3 text-slate-500">
            {c.key === 'surface' ? `${node.surface} m²` : ''}
          </td>
        ))}
        {showDegrevement && (
          <td className="px-4 py-3">
            <DegrevementPill value={total} />
          </td>
        )}
        <td className="px-4 py-3 text-right">
          <DetailsBtn onClick={() => onConfigure(node.rows[0].index)} />
        </td>
      </tr>
      {expanded &&
        node.rows.map((r) => (
          <BienTr
            key={r.index}
            row={r}
            depth={1}
            activeCols={activeCols}
            checked={selected.has(r.index)}
            showDegrevement={showDegrevement}
            degrev={degrevOf(r.apt)}
            onToggle={() => onToggleBien(r.index)}
            onConfigure={onConfigure}
          />
        ))}
    </>
  )
}

function BienTr({
  row,
  depth,
  activeCols,
  checked,
  showDegrevement,
  degrev,
  onToggle,
  onConfigure,
}: {
  row: BienRow
  depth: number
  activeCols: typeof COLUMNS
  checked: boolean
  showDegrevement: boolean
  degrev: number
  onToggle: () => void
  onConfigure: (index: number) => void
}) {
  return (
    <tr
      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
        checked ? 'bg-emerald-50/40' : ''
      }`}
    >
      <td className="py-3 pr-2" style={{ paddingLeft: depth ? 30 : 16 }}>
        <input
          type="checkbox"
          className="size-4 accent-emerald-600"
          checked={checked}
          onChange={onToggle}
          aria-label="Sélectionner"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2" style={{ paddingLeft: depth ? 28 : 0 }}>
          <span className="size-6 shrink-0" aria-hidden />
          <span className="truncate text-slate-700">{bienLabel(row.apt)}</span>
        </div>
      </td>
      {activeCols.map((c) => (
        <td key={c.key} className="px-4 py-3">
          <CellValueView apt={row.apt} col={c} />
        </td>
      ))}
      {showDegrevement && (
        <td className="px-4 py-3">
          <DegrevementPill value={degrev} />
        </td>
      )}
      <td className="px-4 py-3 text-right">
        <DetailsBtn onClick={() => onConfigure(row.index)} />
      </td>
    </tr>
  )
}

function DetailsBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      En savoir plus
    </button>
  )
}
