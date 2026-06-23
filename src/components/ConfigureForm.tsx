import { useState } from 'react'
import {
  FIELDS,
  FIELD_GROUPS,
  type Apartment,
  type CellValue,
  type FieldDef,
} from '../types'

interface ConfigureFormProps {
  apartment: Apartment
  index: number
  onSave: (apartment: Apartment) => void
  onBack: () => void
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: CellValue
  onChange: (value: CellValue) => void
}) {
  const id = `field-${field.key}`
  const baseClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

  function renderControl() {
    switch (field.type) {
      case 'select':
        return (
          <select
            id={id}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          >
            <option value="">—</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )
      case 'ouinon':
        return (
          <select
            id={id}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          >
            <option value="">—</option>
            <option value="Oui">Oui</option>
            <option value="Non">Non</option>
          </select>
        )
      case 'binaire':
        return (
          <select
            id={id}
            value={value === '' ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className={baseClass}
          >
            <option value="">—</option>
            <option value="1">Oui</option>
            <option value="0">Non</option>
          </select>
        )
      case 'number':
        return (
          <input
            id={id}
            type="number"
            step="any"
            value={value === '' ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className={baseClass}
          />
        )
      default:
        return (
          <input
            id={id}
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          />
        )
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-600">
        {field.label}
      </label>
      {renderControl()}
    </div>
  )
}

export function ConfigureForm({ apartment, index, onSave, onBack }: ConfigureFormProps) {
  const [draft, setDraft] = useState<Apartment>(apartment)

  function update(key: FieldDef['key'], value: CellValue) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const title = [draft.rue, draft.ville].filter(Boolean).join(', ') || `Bien #${index + 1}`

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onBack}
            className="self-start text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Retour à la liste
          </button>
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        </div>
      </div>

      {FIELD_GROUPS.map((group) => (
        <fieldset
          key={group}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <legend className="px-2 text-sm font-semibold tracking-wide text-indigo-600 uppercase">
            {group}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.filter((f) => f.group === group).map((field) => (
              <Field
                key={field.key}
                field={field}
                value={draft[field.key]}
                onChange={(value) => update(field.key, value)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Enregistrer
        </button>
      </div>
    </form>
  )
}
