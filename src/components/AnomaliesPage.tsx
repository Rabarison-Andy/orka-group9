import { useMemo, useState } from 'react'
import { formatEuros } from '../format'
import type { AnomalyReport, AnomalyStatus, FiscalAnomaly } from '../api/contracts'

interface AnomaliesPageProps {
  report: AnomalyReport
  busy: boolean
  onUpdateStatus: (ids: string[], status: AnomalyStatus) => void
  onBack: () => void
}

const STATUS_META: Record<AnomalyStatus, { label: string; cls: string }> = {
  open: { label: 'À traiter', cls: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'Confirmée', cls: 'bg-indigo-100 text-indigo-700' },
  justified: { label: 'Justifiée', cls: 'bg-emerald-100 text-emerald-700' },
  on_hold: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
}

const QUICK_ACTIONS: { label: string; status: AnomalyStatus }[] = [
  { label: 'Confirmer', status: 'confirmed' },
  { label: 'Justifier', status: 'justified' },
  { label: 'En attente', status: 'on_hold' },
]

export function AnomaliesPage({ report, busy, onUpdateStatus, onBack }: AnomaliesPageProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | AnomalyStatus>('all')
  const [buildingFilter, setBuildingFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () =>
      report.anomalies.filter(
        (a) =>
          (statusFilter === 'all' || a.status === statusFilter) &&
          (buildingFilter === 'all' || a.building === buildingFilter),
      ),
    [report.anomalies, statusFilter, buildingFilter],
  )

  // Gain potentiel restant = anomalies non justifiées (récupérables).
  const recoverable = report.anomalies
    .filter((a) => a.status !== 'justified')
    .reduce((s, a) => s + a.impactEuros, 0)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id)),
    )
  }
  function applyBulk(status: AnomalyStatus) {
    if (selected.size === 0) return
    onUpdateStatus([...selected], status)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Retour au parc
        </button>
        <h2 className="text-xl font-semibold text-slate-800">Gestion des anomalies</h2>
      </div>

      {/* Bandeau « l'euro d'abord ». */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-indigo-700">
            Gain potentiel estimé (anomalies à récupérer)
          </span>
          <span className="text-3xl font-bold text-indigo-900">{formatEuros(recoverable)}</span>
          <span className="text-xs text-indigo-600">
            sur {formatEuros(report.totalImpactEuros)} d’écarts détectés ·{' '}
            {report.anomalies.length} anomalie{report.anomalies.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(STATUS_META) as AnomalyStatus[]).map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-1 font-medium ${STATUS_META[s].cls}`}>
              {STATUS_META[s].label} : {report.byStatus[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Filtres. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Statut</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | AnomalyStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 outline-none focus:border-indigo-500"
          >
            <option value="all">Tous</option>
            {(Object.keys(STATUS_META) as AnomalyStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Bâtiment</span>
          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 outline-none focus:border-indigo-500"
          >
            <option value="all">Tous</option>
            {report.buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <span className="text-slate-400">
          {filtered.length} / {report.anomalies.length} affichée
          {filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre d'actions en lot. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white">
          <span className="font-medium">{selected.size} sélectionnée(s)</span>
          <span className="text-slate-400">— appliquer en lot :</span>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.status}
              type="button"
              disabled={busy}
              onClick={() => applyBulk(a.status)}
              className="rounded-md bg-white/10 px-2.5 py-1 font-medium transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-slate-300 hover:text-white"
          >
            Annuler la sélection
          </button>
        </div>
      )}

      {/* Tableau des anomalies (l'enjeu € en premier). */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="px-4 py-3 text-right font-medium">Enjeu €</th>
              <th className="px-4 py-3 font-medium">Bien</th>
              <th className="px-4 py-3 font-medium">Bâtiment</th>
              <th className="px-4 py-3 font-medium">Champ</th>
              <th className="px-4 py-3 font-medium">Cadastre vs Client</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Qualifier</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <AnomalyRow
                key={a.id}
                anomaly={a}
                checked={selected.has(a.id)}
                busy={busy}
                onToggle={() => toggle(a.id)}
                onStatus={(status) => onUpdateStatus([a.id], status)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Aucune anomalie pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnomalyRow({
  anomaly,
  checked,
  busy,
  onToggle,
  onStatus,
}: {
  anomaly: FiscalAnomaly
  checked: boolean
  busy: boolean
  onToggle: () => void
  onStatus: (status: AnomalyStatus) => void
}) {
  const meta = STATUS_META[anomaly.status]
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td className="px-3 py-3">
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label="Sélectionner" />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-base font-bold text-slate-800">{formatEuros(anomaly.impactEuros)}</span>
        <span
          className={`ml-1 block text-[11px] font-medium ${
            anomaly.direction === 'overtaxed' ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {anomaly.direction === 'overtaxed' ? 'trop-perçu' : 'sous-évalué'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-700">{anomaly.label}</div>
        <div className="text-[11px] text-slate-400">{anomaly.invariant}</div>
      </td>
      <td className="px-4 py-3 text-slate-600">{anomaly.building}</td>
      <td className="px-4 py-3 text-slate-600">{anomaly.fieldLabel}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">
            cadastre <b>{anomaly.cadastralValue}</b>
          </span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
            client <b>{anomaly.clientValue}</b>
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {QUICK_ACTIONS.map((act) => (
            <button
              key={act.status}
              type="button"
              disabled={busy}
              onClick={() => onStatus(act.status)}
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                anomaly.status === act.status
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  )
}
