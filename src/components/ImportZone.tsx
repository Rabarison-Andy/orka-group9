import { useRef, useState } from 'react'
import { extractFile, ApiClientError } from '../api/client'
import type { ExtractResponse } from '../api/contracts'

interface ImportZoneProps {
  onExtracted: (result: ExtractResponse) => void
}

export function ImportZone({ onExtracted }: ImportZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      const result = await extractFile(file)
      onExtracted(result)
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Import impossible. Vérifiez le fichier et réessayez.',
      )
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
        <p className="text-lg font-semibold text-slate-800">
          Importer un fichier Excel ou CSV
        </p>
        <p className="text-sm text-slate-500">
          Glissez-déposez votre fichier ici, ou cliquez pour le sélectionner.
          <br />
          Formats acceptés : .xlsx, .xls, .csv — une ligne = un bien.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
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
        {loading ? 'Analyse du fichier…' : 'Choisir un fichier'}
      </button>

      {error && <p className="max-w-md text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
