import { useRef, useState } from 'react'
import { parseWorkbook } from '../lib/parseExcel'
import type { Apartment } from '../types'

interface ImportZoneProps {
  onImported: (apartments: Apartment[]) => void
}

export function ImportZone({ onImported }: ImportZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      const apartments = await parseWorkbook(file)
      if (apartments.length === 0) {
        setError('Aucun bien trouvé dans ce fichier. Vérifiez l’en-tête des colonnes.')
        return
      }
      onImported(apartments)
    } catch {
      setError('Fichier illisible. Formats acceptés : .xlsx, .xls.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) void handleFile(file)
      }}
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-16 ${
        dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'
      }`}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-indigo-100 text-2xl">
        📥
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-slate-800">Importer un fichier Excel</p>
        <p className="text-sm text-slate-500">
          Glissez-déposez votre fichier ici, ou cliquez pour le sélectionner.
          <br />
          Une ligne = un bien (appartement, maison, parking…).
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? 'Traitement…' : 'Choisir un fichier'}
      </button>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
