import { useMemo, useState } from 'react'
import { formatEuros } from '../format'
import type { AnomalyReport, AnomalyStatus } from '../api/contracts'
import type { Apartment } from '../types'
import { buildEntityTree, type BienRow, type EntityNode } from '../lib/entity'

interface AnomaliesPageProps {
  report: AnomalyReport
  apartments: Apartment[]
  totalBiens: number
  busy: boolean
  onUpdateStatus: (ids: string[], status: AnomalyStatus) => void
  onConfigure: (index: number) => void
  onBack: () => void
}

function StatCard({ value, label, prefix }: { value: string; label: string; prefix?: string }) {
  return (
    <div className="flex min-w-[170px] flex-col items-center rounded-2xl bg-emerald-50 px-8 py-5 text-center">
      <span className="text-3xl font-bold text-slate-800">
        {prefix && <span className="mr-1 align-middle text-sm font-normal text-slate-500">{prefix}</span>}
        {value}
      </span>
      <span className="mt-1 text-sm text-slate-600">{label}</span>
    </div>
  )
}

const STATUS_META: Record<AnomalyStatus, { label: string; cls: string }> = {
  open: { label: 'À traiter', cls: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'Confirmée', cls: 'bg-emerald-100 text-emerald-700' },
  justified: { label: 'Justifiée', cls: 'bg-slate-200 text-slate-500' },
  on_hold: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
}

const QUICK_ACTIONS: { label: string; status: AnomalyStatus }[] = [
  { label: 'Confirmée', status: 'confirmed' },
  { label: 'Justifiée', status: 'justified' },
  { label: 'En attente', status: 'on_hold' },
]

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

export function AnomaliesPage({
  report,
  apartments,
  totalBiens,
  busy,
  onUpdateStatus,
  onConfigure,
  onBack,
}: AnomaliesPageProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')

  const degrevByInv = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of report.anomalies) {
      const key = a.invariant.trim().toUpperCase()
      const delta = a.direction === 'overtaxed' ? -a.impactEuros : a.impactEuros
      m.set(key, (m.get(key) ?? 0) + delta)
    }
    return m
  }, [report.anomalies])

  const anomalyIdsByInv = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of report.anomalies) {
      const key = a.invariant.trim().toUpperCase()
      m.set(key, [...(m.get(key) ?? []), a.id])
    }
    return m
  }, [report.anomalies])

  const statusByInv = useMemo(() => {
    const m = new Map<string, AnomalyStatus>()
    for (const a of report.anomalies) {
      const key = a.invariant.trim().toUpperCase()
      const cur = m.get(key)
      if (!cur) m.set(key, a.status)
      else if (a.status === 'open') m.set(key, 'open')
    }
    return m
  }, [report.anomalies])

  const anomalyInvs = useMemo(
    () => new Set(report.anomalies.map((a) => a.invariant.trim().toUpperCase())),
    [report.anomalies],
  )
  const filteredApts = useMemo(
    () => apartments.filter((a) => anomalyInvs.has(String(a.invariant ?? '').trim().toUpperCase())),
    [apartments, anomalyInvs],
  )

  const typeOptions = useMemo(
    () => [...new Set(filteredApts.map((a) => String(a.natureBien ?? '').trim()).filter(Boolean))].sort(),
    [filteredApts],
  )
  const zoneOptions = useMemo(
    () => [...new Set(filteredApts.map((a) => String(a.ville ?? '').trim()).filter(Boolean))].sort(),
    [filteredApts],
  )

  const displayedApts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return filteredApts.filter((a) => {
      if (typeFilter && String(a.natureBien ?? '').trim() !== typeFilter) return false
      if (zoneFilter && String(a.ville ?? '').trim() !== zoneFilter) return false
      if (q) {
        const text = [a.natureBien, a.rue, a.ville, a.invariant, a.nomImmeuble].join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [filteredApts, searchQuery, typeFilter, zoneFilter])

  const rows: BienRow[] = displayedApts.map((apt) => ({
    index: apartments.indexOf(apt),
    apt,
  }))
  const tree = useMemo(() => buildEntityTree(rows), [displayedApts])

  const statusCounts = useMemo(() => {
    const counts: Record<AnomalyStatus, number> = { open: 0, confirmed: 0, justified: 0, on_hold: 0 }
    for (const apt of filteredApts) {
      const s = statusByInv.get(String(apt.invariant ?? '').trim().toUpperCase())
      if (s) counts[s]++
    }
    return counts
  }, [filteredApts, statusByInv])

  const economie = report.anomalies
    .filter((a) => a.direction === 'overtaxed')
    .reduce((s, a) => s + a.impactEuros, 0)
  const biensConcernes = anomalyInvs.size
  const pctConcernes = totalBiens ? Math.round((100 * biensConcernes) / totalBiens) : 0
  const heures = Math.max(1, Math.round(biensConcernes * 0.5))
  const confirmedCount = report.byStatus.confirmed
  const confirmedEuros = report.anomalies
    .filter((a) => a.status === 'confirmed')
    .reduce((s, a) => s + a.impactEuros, 0)

  function degrevOf(apt: Apartment) {
    return degrevByInv.get(String(apt.invariant ?? '').trim().toUpperCase()) ?? 0
  }
  function entityDegrev(node: EntityNode) {
    return node.rows.reduce((s, r) => s + degrevOf(r.apt), 0)
  }
  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function qualify(apt: Apartment, status: AnomalyStatus) {
    const ids = anomalyIdsByInv.get(String(apt.invariant ?? '').trim().toUpperCase()) ?? []
    if (ids.length) onUpdateStatus(ids, status)
  }
  function qualifyEntity(node: EntityNode, status: AnomalyStatus) {
    const ids = node.rows.flatMap(
      (r) => anomalyIdsByInv.get(String(r.apt.invariant ?? '').trim().toUpperCase()) ?? [],
    )
    if (ids.length) onUpdateStatus(ids, status)
  }
  function bienStatus(apt: Apartment): AnomalyStatus | undefined {
    return statusByInv.get(String(apt.invariant ?? '').trim().toUpperCase())
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        ← Retour au parc
      </button>

      <div className="flex flex-col items-center gap-5">
        <h2 className="text-center text-2xl font-semibold text-slate-800">
          Résultat de votre vérification
        </h2>
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          <StatCard value={formatEuros(economie)} label="d'économie annuelle estimée" />
          <StatCard value={`${pctConcernes}%`} label="des biens concernés" />
          <StatCard prefix="environ" value={`${heures}h`} label="de démarche" />
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {(Object.keys(STATUS_META) as AnomalyStatus[]).map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-1 font-medium ${STATUS_META[s].cls}`}>
              {STATUS_META[s].label} : {statusCounts[s]}
            </span>
          ))}
        </div>
        <p className="mx-auto max-w-3xl text-center text-slate-600">
          Votre parc immobilier a bien été analysé et les écarts ont été identifiés pour chacun de vos biens. Modifiez si nécessaire les informations détenues par l'administration, puis sélectionnez les anomalies que vous souhaitez contester.
        </p>
      </div>

      {submitted && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ Réclamation prête : {confirmedCount} anomalie{confirmedCount > 1 ? 's' : ''} confirmée
          {confirmedCount > 1 ? 's' : ''} pour {formatEuros(confirmedEuros)}.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Rechercher un bien…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Type de bien</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Zone géographique</option>
          {zoneOptions.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        {(searchQuery || typeFilter || zoneFilter) && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setTypeFilter(''); setZoneFilter('') }}
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 168 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 140 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Vos biens</th>
              <th className="px-4 py-3 font-semibold">Surface</th>
              <th className="px-4 py-3 font-semibold">Étage</th>
              <th className="px-4 py-3 font-semibold">Dégrèvement estimé</th>
              <th className="px-4 py-3 font-semibold">Qualifier</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tree.map((node) =>
              node.type === 'entity' ? (
                <AnomalyEntityRows
                  key={node.key}
                  node={node}
                  expanded={expanded.has(node.key)}
                  entityDegrev={entityDegrev(node)}
                  degrevOf={degrevOf}
                  bienStatus={bienStatus}
                  busy={busy}
                  onToggleExpand={() => toggleExpand(node.key)}
                  onQualify={qualifyEntity}
                  onQualifyBien={qualify}
                  onConfigure={onConfigure}
                />
              ) : (
                <AnomalyBienTr
                  key={node.key}
                  row={node.row}
                  depth={0}
                  degrev={degrevOf(node.row.apt)}
                  status={bienStatus(node.row.apt)}
                  busy={busy}
                  onQualify={(s) => qualify(node.row.apt, s)}
                  onConfigure={onConfigure}
                />
              ),
            )}
            {tree.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Aucune anomalie détectée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Modifier ma vérification
        </button>
        <button
          type="button"
          disabled={busy || confirmedCount === 0}
          onClick={() => setSubmitted(true)}
          title={confirmedCount === 0 ? 'Confirmez au moins une anomalie' : 'Finaliser la réclamation'}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Finaliser ma réclamation
        </button>
      </div>
    </div>
  )
}

function AnomalyEntityRows({
  node,
  expanded,
  entityDegrev,
  degrevOf,
  bienStatus,
  busy,
  onToggleExpand,
  onQualify,
  onQualifyBien,
  onConfigure,
}: {
  node: EntityNode
  expanded: boolean
  entityDegrev: number
  degrevOf: (apt: Apartment) => number
  bienStatus: (apt: Apartment) => AnomalyStatus | undefined
  busy: boolean
  onToggleExpand: () => void
  onQualify: (node: EntityNode, status: AnomalyStatus) => void
  onQualifyBien: (apt: Apartment, status: AnomalyStatus) => void
  onConfigure: (index: number) => void
}) {
  return (
    <>
      <tr className="border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={expanded ? 'Replier' : 'Déplier'}
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
        <td className="px-4 py-3 text-slate-500">{node.surface ? `${node.surface} m²` : ''}</td>
        <td className="px-4 py-3" />
        <td className="px-4 py-3">
          <DegrevementPill value={entityDegrev} />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {QUICK_ACTIONS.map((act) => (
              <button
                key={act.status}
                type="button"
                disabled={busy}
                onClick={() => onQualify(node, act.status)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {act.label}
              </button>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <DetailsBtn onClick={() => onConfigure(node.rows[0].index)} />
        </td>
      </tr>
      {expanded &&
        node.rows.map((r) => (
          <AnomalyBienTr
            key={r.index}
            row={r}
            depth={1}
            degrev={degrevOf(r.apt)}
            status={bienStatus(r.apt)}
            busy={busy}
            onQualify={(s) => onQualifyBien(r.apt, s)}
            onConfigure={onConfigure}
          />
        ))}
    </>
  )
}

function AnomalyBienTr({
  row,
  depth,
  degrev,
  status,
  busy,
  onQualify,
  onConfigure,
}: {
  row: BienRow
  depth: number
  degrev: number
  status: AnomalyStatus | undefined
  busy: boolean
  onQualify: (status: AnomalyStatus) => void
  onConfigure: (index: number) => void
}) {
  const apt = row.apt
  const label =
    String(apt.natureBien ?? '').trim() ||
    String(apt.rue ?? '').trim() ||
    String(apt.invariant ?? '').trim() ||
    'Bien'
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td className="px-4 py-3">
        <div style={{ paddingLeft: depth ? 28 : 0 }} className="flex items-center gap-2">
          {depth > 0 && <span className="size-6 shrink-0" aria-hidden />}
          <div>
            <div className="truncate text-slate-700">{label}</div>
            <div className="text-[11px] text-slate-400">{String(apt.invariant ?? '')}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">
        {apt.surface ? `${apt.surface} m²` : <span className="text-amber-600 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-slate-600">{String(apt.etage ?? '') || '—'}</td>
      <td className="px-4 py-3">
        <DegrevementPill value={degrev} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((act) => (
            <button
              key={act.status}
              type="button"
              disabled={busy}
              onClick={() => onQualify(act.status)}
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                status === act.status
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <DetailsBtn onClick={() => onConfigure(row.index)} />
      </td>
    </tr>
  )
}
