import { useState } from 'react'
import { ApartmentTable } from './ApartmentTable'
import { formatEuros, display } from '../format'
import type { Apartment } from '../types'
import type {
  BulkResolutionAction,
  ExtractResponse,
  ReconcileItem,
  ReconcileResponse,
  ResolutionAction,
  ValidationReport,
} from '../api/contracts'

interface ParcDashboardProps {
  extract: ExtractResponse
  apartments: Apartment[]
  report: ValidationReport | null
  reconcile: ReconcileResponse
  busy: boolean
  reportError?: string | null
  onResolve: (
    invariant: string,
    side: 'erp_only' | 'fisc_only',
    action: ResolutionAction,
    targetInvariant?: string,
  ) => void
  onResolveBulk: (
    side: 'erp_only' | 'fisc_only',
    invariants: string[],
    action: BulkResolutionAction,
  ) => void
  onConfigure: (index: number) => void
  onReset: () => void
  onGenerateReport: () => void
}

/** L'action « accepter » diffère selon le côté : conserver (ERP) / importer (fisc). */
const ACCEPT: Record<
  'erp_only' | 'fisc_only',
  { action: BulkResolutionAction; label: string }
> = {
  erp_only: { action: 'keep', label: 'Conserver' },
  fisc_only: { action: 'import', label: 'Importer' },
}

type Tab = 'restitution' | 'matched' | 'erp_only' | 'fisc_only'

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`flex flex-col rounded-lg px-3 py-2 ${tone}`}>
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}

const RESOLUTION_LABEL: Record<ResolutionAction, string> = {
  exclude: 'Exclu',
  attach: 'Rattaché',
  import: 'Importé',
  keep: 'Conservé',
}

/** Boutons de résolution d'un cas non apparié, avec rattachement ciblé. */
function ResolveActions({
  item,
  side,
  targets,
  busy,
  onResolve,
}: {
  item: ReconcileItem
  side: 'erp_only' | 'fisc_only'
  targets: ReconcileItem[]
  busy: boolean
  onResolve: ParcDashboardProps['onResolve']
}) {
  const btn =
    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50'
  const active = 'border-indigo-600 bg-indigo-600 text-white'
  const idle = 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  const accept = ACCEPT[side]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.resolved && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          ✓ {item.resolution ? RESOLUTION_LABEL[item.resolution] : 'Résolu'}
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => onResolve(item.invariant, side, accept.action)}
        className={`${btn} ${item.resolution === accept.action ? active : idle}`}
      >
        {accept.label}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onResolve(item.invariant, side, 'exclude')}
        className={`${btn} ${item.resolution === 'exclude' ? active : idle}`}
      >
        Exclure
      </button>
      <select
        disabled={busy || targets.length === 0}
        value=""
        onChange={(e) =>
          e.target.value && onResolve(item.invariant, side, 'attach', e.target.value)
        }
        className={`${btn} ${item.resolution === 'attach' ? active : idle} cursor-pointer`}
        title={
          targets.length === 0
            ? 'Aucune contrepartie orpheline à rattacher'
            : 'Rattacher à une fiche orpheline'
        }
      >
        <option value="">
          {targets.length === 0 ? 'Rattacher (aucune)' : `Rattacher à… (${targets.length})`}
        </option>
        {targets.map((t) => (
          <option key={t.invariant} value={t.invariant}>
            {t.invariant} — {t.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ParcDashboard({
  extract,
  apartments,
  report,
  reconcile,
  busy,
  reportError = null,
  onResolve,
  onResolveBulk,
  onConfigure,
  onReset,
  onGenerateReport,
}: ParcDashboardProps) {
  const [tab, setTab] = useState<Tab>('restitution')
  const { counts, canGenerateReport } = reconcile

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'restitution', label: 'Restitution' },
    { id: 'matched', label: 'Appariés', count: counts.matched },
    { id: 'erp_only', label: 'ERP uniquement', count: counts.erpOnly },
    { id: 'fisc_only', label: 'Fisc uniquement', count: counts.fiscOnly },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-800">
            Parc immobilier — rapprochement Fisc / ERP
          </h2>
          <p className="text-sm text-slate-500">
            {extract.filename} · {apartments.length} biens · rapprochés aux fiches
            fiscales par invariant.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Importer un autre fichier
          </button>
          <button
            type="button"
            disabled={!canGenerateReport || busy}
            onClick={onGenerateReport}
            title={
              canGenerateReport
                ? 'Générer le rapport d’anomalies'
                : 'Résolvez d’abord tous les cas non appariés'
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? 'Traitement…' : 'Générer mon rapport →'}
          </button>
        </div>
      </div>

      {/* Verrou de transition. */}
      {canGenerateReport ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ Parc réconcilié — aucun cas en suspens. Le rapport d’anomalies est
          déverrouillé.
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          ⚠ {counts.unresolved} cas de rapprochement à résoudre (ERP uniquement /
          Fisc uniquement) avant de pouvoir générer le rapport.
        </div>
      )}

      {reportError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {reportError}
        </div>
      )}

      {/* Statistiques de rapprochement. */}
      <div className="flex flex-wrap gap-2">
        <Stat label="Appariés" value={counts.matched} tone="bg-emerald-50 text-emerald-700" />
        <Stat label="Avec écart €" value={counts.withAnomalies} tone="bg-amber-50 text-amber-700" />
        <Stat label="ERP uniquement" value={counts.erpOnly} tone="bg-sky-50 text-sky-700" />
        <Stat label="Fisc uniquement" value={counts.fiscOnly} tone="bg-violet-50 text-violet-700" />
      </div>

      {/* Onglets. */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'restitution' && (
        <ApartmentTable
          apartments={apartments}
          report={report}
          onConfigure={onConfigure}
          onReset={onReset}
          embedded
        />
      )}

      {tab === 'matched' && <MatchedTable items={reconcile.matched} />}

      {tab === 'erp_only' && (
        <UnmatchedTable
          items={reconcile.erpOnly}
          side="erp_only"
          targets={reconcile.fiscOnly}
          busy={busy}
          onResolve={onResolve}
          onResolveBulk={onResolveBulk}
          help="Ces biens de votre fichier sont inconnus du fisc. Conservez-les (les garder dans le parc), excluez-les, ou rattachez-les à une fiche fiscale orpheline."
          emptyLabel="Aucun bien « ERP uniquement »."
        />
      )}

      {tab === 'fisc_only' && (
        <UnmatchedTable
          items={reconcile.fiscOnly}
          side="fisc_only"
          targets={reconcile.erpOnly}
          busy={busy}
          onResolve={onResolve}
          onResolveBulk={onResolveBulk}
          help="Le fisc taxe ces biens absents de votre fichier. Importez-les (les ajouter au parc), excluez-les, ou rattachez-les à un de vos biens orphelins."
          emptyLabel="Aucune fiche « Fisc uniquement »."
        />
      )}
    </div>
  )
}

/** Tableau des biens appariés (avec ou sans écart financier). */
function MatchedTable({ items }: { items: ReconcileItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="px-4 py-3 font-medium">Invariant</th>
            <th className="px-4 py-3 font-medium">Adresse</th>
            <th className="px-4 py-3 font-medium">Surface (client / fisc)</th>
            <th className="px-4 py-3 font-medium">État</th>
            <th className="px-4 py-3 text-right font-medium">Enjeu</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.invariant} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-700">{it.invariant}</td>
              <td className="px-4 py-3 text-slate-600">{it.label}</td>
              <td className="px-4 py-3 text-slate-600">
                {display(it.bien?.surface)} / {display(it.fiscal?.surface)}
              </td>
              <td className="px-4 py-3">
                {it.hasAnomalies ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    ⚠ Écart détecté
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    ✓ Conforme
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-700">
                {it.impactEuros > 0 ? formatEuros(it.impactEuros) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Tableau des cas non appariés : sélection multiple + actions (unitaire & lot). */
function UnmatchedTable({
  items,
  side,
  targets,
  busy,
  onResolve,
  onResolveBulk,
  help,
  emptyLabel,
}: {
  items: ReconcileItem[]
  side: 'erp_only' | 'fisc_only'
  targets: ReconcileItem[]
  busy: boolean
  onResolve: ParcDashboardProps['onResolve']
  onResolveBulk: ParcDashboardProps['onResolveBulk']
  help: string
  emptyLabel: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {emptyLabel}
      </p>
    )
  }

  const openTargets = targets.filter((t) => !t.resolved)
  const accept = ACCEPT[side]

  function toggle(inv: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(inv)) next.delete(inv)
      else next.add(inv)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.invariant)),
    )
  }
  function applyBulk(action: BulkResolutionAction) {
    if (selected.size === 0) return
    onResolveBulk(side, [...selected], action)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">{help}</p>

      {/* Barre d'actions en lot. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white">
          <span className="font-medium">{selected.size} sélectionné(s)</span>
          <span className="text-slate-400">— en lot :</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyBulk(accept.action)}
            className="rounded-md bg-white/10 px-2.5 py-1 font-medium transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            {accept.label}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyBulk('exclude')}
            className="rounded-md bg-white/10 px-2.5 py-1 font-medium transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            Exclure
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-slate-300 hover:text-white"
          >
            Annuler la sélection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === items.length}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="px-4 py-3 font-medium">Invariant</th>
              <th className="px-4 py-3 font-medium">Adresse</th>
              <th className="px-4 py-3 font-medium">Surface · catégorie</th>
              <th className="px-4 py-3 font-medium">Résolution</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const data = side === 'erp_only' ? it.bien : it.fiscal
              return (
                <tr
                  key={it.invariant}
                  className={`border-b border-slate-100 last:border-0 ${
                    it.resolved ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(it.invariant)}
                      onChange={() => toggle(it.invariant)}
                      aria-label="Sélectionner"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{it.invariant}</td>
                  <td className="px-4 py-3 text-slate-600">{it.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {display(data?.surface)} m² · cat. {display(data?.categorie)}
                  </td>
                  <td className="px-4 py-3">
                    <ResolveActions
                      item={it}
                      side={side}
                      targets={openTargets}
                      busy={busy}
                      onResolve={onResolve}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
