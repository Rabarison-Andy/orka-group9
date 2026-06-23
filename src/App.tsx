import { useState } from 'react'
import { ImportZone } from './components/ImportZone'
import { ApartmentTable } from './components/ApartmentTable'
import { ConfigureForm } from './components/ConfigureForm'
import type { Apartment } from './types'

type View = 'import' | 'list' | 'form'

function App() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [view, setView] = useState<View>('import')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  function handleImported(imported: Apartment[]) {
    setApartments(imported)
    setView('list')
  }

  function handleConfigure(index: number) {
    setSelectedIndex(index)
    setView('form')
  }

  function handleSave(updated: Apartment) {
    if (selectedIndex === null) return
    setApartments((prev) => prev.map((apt, i) => (i === selectedIndex ? updated : apt)))
    setView('list')
    setSelectedIndex(null)
  }

  function handleReset() {
    setApartments([])
    setSelectedIndex(null)
    setView('import')
  }

  const selected =
    selectedIndex !== null ? apartments[selectedIndex] : undefined

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Conseil taxe foncière
          </h1>
          <p className="text-sm text-slate-500">
            Importez vos biens depuis Excel et configurez-les en quelques clics.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {view === 'import' && <ImportZone onImported={handleImported} />}

        {view === 'list' && (
          <ApartmentTable
            apartments={apartments}
            onConfigure={handleConfigure}
            onReset={handleReset}
          />
        )}

        {view === 'form' && selected && selectedIndex !== null && (
          <ConfigureForm
            apartment={selected}
            index={selectedIndex}
            onSave={handleSave}
            onBack={() => {
              setView('list')
              setSelectedIndex(null)
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
