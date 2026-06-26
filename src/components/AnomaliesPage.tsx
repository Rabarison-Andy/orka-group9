import { useMemo, useState } from 'react'
import { formatEuros } from '../format'
import type { AnomalyReport, AnomalyStatus, FiscalAnomaly } from '../api/contracts'

interface AnomaliesPageProps {
  report: AnomalyReport
  /** Nombre total de biens du parc (pour « % des biens concernés »). */
  totalBiens: number
  busy: boolean
  onUpdateStatus: (ids: string[], status: AnomalyStatus) => void
  onBack: () => void
}

/** Carte de synthèse verte (bandeau « Résultat de votre vérification »). */
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
  { label: 'Confirmer', status: 'confirmed' },
  { label: 'Justifier', status: 'justified' },
  { label: 'En attente', status: 'on_hold' },
]

export function AnomaliesPage({
  report,
  totalBiens,
  busy,
  onUpdateStatus,
  onBack,
}: AnomaliesPageProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | AnomalyStatus>('all')
  const [buildingFilter, setBuildingFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const filtered = useMemo(
    () =>
      report.anomalies.filter(
        (a) =>
          (statusFilter === 'all' || a.status === statusFilter) &&
          (buildingFilter === 'all' || a.building === buildingFilter),
      ),
    [report.anomalies, statusFilter, buildingFilter],
  )

  // Synthèse des 3 cartes (calculée depuis le rapport, jamais codée en dur).
  const economie = report.anomalies
    .filter((a) => a.direction === 'overtaxed')
    .reduce((s, a) => s + a.impactEuros, 0)
  const biensConcernes = new Set(report.anomalies.map((a) => a.invariant)).size
  const pctConcernes = totalBiens ? Math.round((100 * biensConcernes) / totalBiens) : 0
  const heures = Math.max(1, Math.round(biensConcernes * 0.5))
  const confirmedCount = report.byStatus.confirmed
  const confirmedEuros = report.anomalies
    .filter((a) => a.status === 'confirmed')
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
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        ← Retour au parc
      </button>

      {/* En-tête « Résultat de votre vérification » (page résultat & réclamation). */}
      <div className="flex flex-col items-center gap-5">
        <h2 className="text-center text-2xl font-semibold text-slate-800">
          Résultat de votre vérification
        </h2>
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          <StatCard value={formatEuros(economie)} label="d’économie annuelle estimée" />
          <StatCard value={`${pctConcernes}%`} label="des biens concernés" />
          <StatCard prefix="environ" value={`${heures}h`} label="de démarche" />
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {(Object.keys(STATUS_META) as AnomalyStatus[]).map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-1 font-medium ${STATUS_META[s].cls}`}>
              {STATUS_META[s].label} : {report.byStatus[s]}
            </span>
          ))}
        </div>
        <p className="mx-auto max-w-3xl text-center text-slate-600">
          Votre parc immobilier a bien été analysé et les écarts ont été identifiés pour chacun de
          vos biens. Modifiez si nécessaire les informations détenues par l’administration, puis
          sélectionnez les anomalies que vous souhaitez contester — classées par enjeu décroissant,
          l’euro d’abord.
        </p>
      </div>

      {submitted && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ Réclamation prête : {confirmedCount} anomalie{confirmedCount > 1 ? 's' : ''} confirmée
          {confirmedCount > 1 ? 's' : ''} pour {formatEuros(confirmedEuros)}. Prochaine étape :
          Décision.
        </div>
      )}

      {/* Filtres. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Statut</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | AnomalyStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 outline-none focus:border-emerald-500"
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
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 outline-none focus:border-emerald-500"
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
                  className="accent-emerald-600"
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

      {/* Pied : retour / finaliser. */}
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
          title={
            confirmedCount === 0
              ? 'Confirmez au moins une anomalie à contester'
              : 'Finaliser la réclamation'
          }
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Finaliser ma réclamation
        </button>
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
        <input
          type="checkbox"
          className="accent-emerald-600"
          checked={checked}
          onChange={onToggle}
          aria-label="Sélectionner"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-base font-bold text-slate-800">{formatEuros(anomaly.impactEuros)}</span>
        <span
          className={`ml-1 block text-[11px] font-medium ${
            anomaly.direction === 'overtaxed' ? 'text-emerald-600' : 'text-orange-600'
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
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            cadastre <b>{anomaly.cadastralValue}</b>
          </span>
          <span className="text-slate-400">→</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
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
                  ? 'border-emerald-600 bg-emerald-600 text-white'
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
