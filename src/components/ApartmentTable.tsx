import { FIELD_BY_KEY, TABLE_COLUMNS, type Apartment } from '../types'

interface ApartmentTableProps {
  apartments: Apartment[]
  onConfigure: (index: number) => void
  onReset: () => void
}

function displayValue(apt: Apartment, key: (typeof TABLE_COLUMNS)[number]): string {
  const value = apt[key]
  if (value === '' || value === null || value === undefined) return '—'
  return String(value)
}

export function ApartmentTable({ apartments, onConfigure, onReset }: ApartmentTableProps) {
  return (
    <div className="flex flex-col gap-4">
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              {TABLE_COLUMNS.map((key) => (
                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">
                  {FIELD_BY_KEY[key].label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {apartments.map((apt, index) => (
              <tr
                key={index}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                {TABLE_COLUMNS.map((key) => (
                  <td key={key} className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {displayValue(apt, key)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onConfigure(index)}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    Configurer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
