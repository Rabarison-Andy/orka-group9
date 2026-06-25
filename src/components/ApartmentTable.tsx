import {
  FIELDS,
  FIELD_BY_KEY,
  REQUIRED_FIELDS,
  TABLE_COLUMNS,
  isFilled,
  type Apartment,
  type ApartmentKey,
} from '../types'
import type { ValidationReport } from '../api/contracts'

interface ApartmentTableProps {
  apartments: Apartment[]
  report: ValidationReport | null
  onConfigure: (index: number) => void
  onReset: () => void
  /** Masque l'en-tête + bouton « importer un autre fichier » (intégré ailleurs). */
  embedded?: boolean
}

/** Complétude d'un bien, recalculée en direct depuis ses valeurs courantes. */
function completeness(apt: Apartment) {
  const filled = FIELDS.filter((f) => isFilled(apt[f.key])).length
  const missingRequired = REQUIRED_FIELDS.filter((k) => !isFilled(apt[k]))
  return { filled, total: FIELDS.length, missingRequired }
}

/** Cellule de tableau : valeur si remplie, pastille « manquant » sinon. */
function Cell({ apt, fieldKey }: { apt: Apartment; fieldKey: ApartmentKey }) {
  const value = apt[fieldKey]
  if (isFilled(value)) {
    return <span className="text-slate-700">{String(value)}</span>
  }
  const required = FIELD_BY_KEY[fieldKey].required
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

/** Bandeau récapitulatif du traitement serveur (rapport d'import). */
function ImportReport({ report }: { report: ValidationReport }) {
  const malformed = report.warnings.filter((w) => w.kind === 'malformed_optional')
  const incompleteCount = report.rows.filter((r) => r.status === 'incomplete').length

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
          {report.importedRows} bien{report.importedRows > 1 ? 's' : ''} importé
          {report.importedRows > 1 ? 's' : ''}
        </span>
        {incompleteCount > 0 && (
          <span className="rounded-lg bg-red-50 px-3 py-1.5 font-medium text-red-700">
            {incompleteCount} bien{incompleteCount > 1 ? 's' : ''} à compléter
          </span>
        )}
        {report.skippedRows > 0 && (
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
            {report.skippedRows} ligne{report.skippedRows > 1 ? 's' : ''} vide
            {report.skippedRows > 1 ? 's' : ''} écartée
            {report.skippedRows > 1 ? 's' : ''}
          </span>
        )}
        {malformed.length > 0 && (
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
            {malformed.length} valeur{malformed.length > 1 ? 's' : ''} optionnelle
            {malformed.length > 1 ? 's' : ''} ignorée{malformed.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {malformed.length > 0 && (
        <details className="text-slate-600">
          <summary className="cursor-pointer font-medium text-amber-700">
            Détail des valeurs optionnelles ignorées (type incorrect)
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4">
            {malformed.slice(0, 12).map((w, i) => (
              <li key={i} className="list-disc text-xs">
                {w.message}
              </li>
            ))}
            {malformed.length > 12 && (
              <li className="text-xs text-slate-400">
                … et {malformed.length - 12} autre(s).
              </li>
            )}
          </ul>
        </details>
      )}

      {report.unmappedColumns.length > 0 && (
        <p className="text-xs text-slate-400">
          Colonnes du fichier ignorées : {report.unmappedColumns.join(', ')}.
        </p>
      )}
    </div>
  )
}

export function ApartmentTable({
  apartments,
  report,
  onConfigure,
  onReset,
  embedded = false,
}: ApartmentTableProps) {
  return (
    <div className="flex flex-col gap-4">
      {!embedded && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {apartments.length} bien{apartments.length > 1 ? 's' : ''} importé
            {apartments.length > 1 ? 's' : ''}
          </h2>
          <button
            type="button"
            onClick={onReset}
            className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:self-auto"
          >
            Importer un autre fichier
          </button>
        </div>
      )}

      {report && <ImportReport report={report} />}

      {/* Légende des états de remplissage. */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-red-100 ring-1 ring-red-300" />
          Champ obligatoire manquant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-amber-100 ring-1 ring-amber-300" />
          Champ optionnel à compléter
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-emerald-100 ring-1 ring-emerald-300" />
          Bien complet
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-medium whitespace-nowrap">Statut</th>
              {TABLE_COLUMNS.map((key) => (
                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">
                  {FIELD_BY_KEY[key].label}
                  {FIELD_BY_KEY[key].required && (
                    <span className="ml-0.5 text-red-500">*</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {apartments.map((apt, index) => {
              const { filled, total, missingRequired } = completeness(apt)
              const complete = missingRequired.length === 0
              return (
                <tr
                  key={index}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          complete
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {complete ? '✓ Complet' : '⚠ À compléter'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {filled}/{total} champs
                      </span>
                    </div>
                  </td>
                  {TABLE_COLUMNS.map((key) => (
                    <td key={key} className="px-4 py-3 whitespace-nowrap">
                      <Cell apt={apt} fieldKey={key} />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onConfigure(index)}
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      {complete ? 'Modifier' : 'Compléter'}
                    </button>
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
