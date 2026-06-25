import { useMemo, useState } from 'react'
import { FIELDS, FIELD_GROUPS, type ApartmentKey } from '../types'
import type {
  ConfirmedMapping,
  ExtractResponse,
  MappingSuggestion,
  RawCell,
} from '../api/contracts'

interface MappingStepProps {
  extract: ExtractResponse
  onConfirm: (mapping: ConfirmedMapping) => void
  onBack: () => void
  processing?: boolean
  error?: string | null
  /** Détail des anomalies bloquantes renvoyées par le serveur (422). */
  errorDetails?: string[] | null
}

/** Affiche une cellule d'aperçu brute. */
function previewCell(value: RawCell): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

/** Badge décrivant l'origine d'une suggestion. */
function SuggestionBadge({ suggestion }: { suggestion?: MappingSuggestion }) {
  if (!suggestion || suggestion.columnIndex === null) return null
  const pct = Math.round(suggestion.confidence * 100)
  const tone =
    suggestion.reason === 'fuzzy'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700'
  const label =
    suggestion.reason === 'exact'
      ? 'exact'
      : suggestion.reason === 'alias'
        ? 'synonyme'
        : 'approché'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      auto · {label} · {pct}%
    </span>
  )
}

export function MappingStep({
  extract,
  onConfirm,
  onBack,
  processing = false,
  error = null,
  errorDetails = null,
}: MappingStepProps) {
  const suggestionByField = useMemo(() => {
    const map = new Map<ApartmentKey, MappingSuggestion>()
    for (const s of extract.suggestions) map.set(s.field, s)
    return map
  }, [extract.suggestions])

  const [mapping, setMapping] = useState<Record<ApartmentKey, number | null>>(() => {
    const initial = {} as Record<ApartmentKey, number | null>
    for (const field of FIELDS) {
      initial[field.key] = suggestionByField.get(field.key)?.columnIndex ?? null
    }
    return initial
  })

  function setField(key: ApartmentKey, columnIndex: number | null) {
    setMapping((prev) => ({ ...prev, [key]: columnIndex }))
  }

  const mappedCount = Object.values(mapping).filter((v) => v !== null).length
  const missingRequired = FIELDS.filter(
    (f) => f.required && mapping[f.key] === null,
  )
  const usedColumns = new Set(
    Object.values(mapping).filter((v): v is number => v !== null),
  )
  const ignoredColumns = extract.headers.filter((_, i) => !usedColumns.has(i))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Choisir un autre fichier
        </button>
        <h2 className="text-xl font-semibold text-slate-800">
          Vérifier la correspondance des colonnes
        </h2>
        <p className="text-sm text-slate-500">
          Fichier <span className="font-medium">{extract.filename}</span> ·{' '}
          {extract.format.toUpperCase()} · {extract.headers.length} colonnes ·{' '}
          {extract.totalRows} lignes. Le mapping ci-dessous a été proposé
          automatiquement — corrigez-le si nécessaire avant de traiter.
        </p>
      </div>

      {/* Aperçu des données brutes (Étape 1). */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Aperçu du fichier ({extract.preview.length} premières lignes)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {extract.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {extract.preview.map((row, r) => (
                <tr key={r} className="border-b border-slate-100 last:border-0">
                  {extract.headers.map((_, c) => (
                    <td key={c} className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {previewCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Récapitulatif + alertes. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
          {mappedCount} / {FIELDS.length} champs mappés
        </span>
        {missingRequired.length > 0 ? (
          <span className="rounded-lg bg-red-50 px-3 py-1.5 font-medium text-red-700">
            ⚠ Champs obligatoires non mappés :{' '}
            {missingRequired.map((f) => f.label).join(', ')}
          </span>
        ) : (
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
            ✓ Tous les champs obligatoires sont mappés
          </span>
        )}
      </div>

      {/* Éditeur de mapping, groupé par section. */}
      <div className="flex flex-col gap-5">
        {FIELD_GROUPS.map((group) => (
          <fieldset
            key={group}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <legend className="px-2 text-sm font-semibold tracking-wide text-indigo-600 uppercase">
              {group}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.filter((f) => f.group === group).map((field) => {
                const suggestion = suggestionByField.get(field.key)
                const current = mapping[field.key]
                const isSuggested =
                  suggestion?.columnIndex != null && current === suggestion.columnIndex
                const requiredUnmapped = field.required && current === null
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`map-${field.key}`}
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-600"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                      {isSuggested && <SuggestionBadge suggestion={suggestion} />}
                    </label>
                    <select
                      id={`map-${field.key}`}
                      value={current === null ? '' : String(current)}
                      onChange={(e) =>
                        setField(
                          field.key,
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      className={`rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${
                        requiredUnmapped ? 'border-red-300' : 'border-slate-300'
                      }`}
                    >
                      <option value="">— Non mappé —</option>
                      {extract.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {ignoredColumns.length > 0 && (
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-600">
            Colonnes du fichier ignorées :
          </span>{' '}
          {ignoredColumns.join(', ')}
        </p>
      )}

      {error && (
        <div className="flex flex-col gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{error}</p>
          {errorDetails && errorDetails.length > 0 && (
            <ul className="flex flex-col gap-1 pl-4">
              {errorDetails.slice(0, 20).map((d, i) => (
                <li key={i} className="list-disc text-xs">
                  {d}
                </li>
              ))}
              {errorDetails.length > 20 && (
                <li className="text-xs text-red-500">
                  … et {errorDetails.length - 20} autre(s).
                </li>
              )}
            </ul>
          )}
          <p className="text-xs text-red-500">
            Corrigez le mapping ci-dessus ou le fichier source, puis relancez le
            traitement.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => {
            const confirmed: ConfirmedMapping = {}
            for (const key of Object.keys(mapping) as ApartmentKey[]) {
              confirmed[key] = mapping[key]
            }
            onConfirm(confirmed)
          }}
          disabled={processing}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {processing ? 'Traitement…' : 'Confirmer et traiter'}
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Les champs marqués d'un <span className="text-red-500">*</span> sont
        obligatoires. Vous pourrez compléter les valeurs manquantes après le
        traitement.
      </p>
    </div>
  )
}
