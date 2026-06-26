import { useState } from 'react'
import type { Apartment } from '../types'

type ApplyMode = 'all' | 'selection' | null

interface ConfigureFormProps {
  apartment: Apartment
  index: number
  apartments: Apartment[]
  onSave: (apartment: Apartment, indices: number[]) => void
  onBack: () => void
}

function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  )
}

function NavigationFooter({
  onPrev,
  onNext,
  nextLabel = 'Etape suivante',
}: {
  onPrev?: () => void
  onNext: () => void
  nextLabel?: string
}) {
  return (
    <div className="mt-12 flex justify-end gap-3 border-t border-slate-100 pt-6">
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Etape précédente
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        className="rounded-lg bg-[#b4d62c] px-6 py-2.5 text-sm font-bold text-[#14361f] transition-transform hover:scale-105"
      >
        {nextLabel}
      </button>
    </div>
  )
}

function CounterRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description: string
  value: number
  onChange: (val: number) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-100 pb-5 last:border-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">{title}</span>
        <span className="text-xs leading-relaxed text-slate-500">{description}</span>
      </div>
      <div className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-white">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="flex h-full w-8 items-center justify-center text-slate-500 hover:text-slate-800">-</button>
        <span className="flex h-full w-8 items-center justify-center border-x border-slate-200 text-sm font-medium text-slate-700">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="flex h-full w-8 items-center justify-center text-slate-500 hover:text-slate-800">+</button>
      </div>
    </div>
  )
}

function RadioCard({
  label,
  subLabel,
  selected,
  onClick,
}: {
  label: string
  subLabel: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
        selected ? 'border-[#14361f] bg-slate-50 ring-1 ring-[#14361f]' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span className={`text-sm font-bold ${selected ? 'text-[#14361f]' : 'text-slate-700'}`}>
        {label} <span className="font-medium text-slate-500">{subLabel}</span>
      </span>
      <div className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[#14361f]' : 'border-slate-300'}`}>
        {selected && <div className="size-2 rounded-full bg-[#14361f]" />}
      </div>
    </button>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-100 py-5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">{title}</span>
        <span className="text-sm text-slate-500">{description}</span>
      </div>
      <div className="flex shrink-0 items-center rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all ${checked ? 'bg-white text-[#14361f] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Oui
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all ${!checked ? 'bg-white text-[#14361f] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Non
        </button>
      </div>
    </div>
  )
}

export function ConfigureForm({ apartment, index, apartments, onSave, onBack }: ConfigureFormProps) {
  const [draft, setDraft] = useState<Apartment>({ ...apartment })
  const [step, setStep] = useState(1)
  const [applyMode, setApplyMode] = useState<ApplyMode>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set([index]))

  const [annexes, setAnnexes] = useState({ parking: 0, box: 0, cave: 0, piece: 0, terrasse: 0, toiture: 0 })

  function update(key: keyof Apartment, value: string | number) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }
  function updateAnnexe(key: keyof typeof annexes, value: number) {
    setAnnexes((prev) => ({ ...prev, [key]: value }))
  }
  function toggleIndex(i: number) {
    if (i === index) return
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }
  function computeIndices(): number[] {
    if (applyMode === 'all') return apartments.map((_, i) => i)
    if (applyMode === 'selection') return [...selectedIndices]
    return [index]
  }

  const getNum = (val: string | number | undefined | null) => (typeof val === 'number' ? val : 0)

  return (
    <div className="relative mx-auto w-full max-w-5xl py-2">
      <button
        type="button"
        onClick={onBack}
        className="mb-10 flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-[#14361f] shadow-sm transition-colors hover:bg-slate-50"
      >
        <span className="mr-2 text-lg leading-none">‹</span> Retour à la collecte
      </button>

      <div className="flex items-start justify-center gap-6 xl:gap-10">
        <div className="w-full max-w-3xl rounded-[20px] bg-white p-8 shadow-sm sm:p-12">
          
          <div className="mb-10 flex items-center gap-4">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[#b4d62c] transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold text-slate-800">{step}/5</span>
          </div>

          {step === 1 && (
            <div className="animate-in fade-in duration-300">
              <StepHeader title="Informations générales" />
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-800">Nommez votre bien</label>
                  <input type="text" value={String(draft.nomImmeuble ?? '')} onChange={(e) => update('nomImmeuble', e.target.value)} placeholder="Exemple : Résidence principale" className="rounded-md border border-slate-400 px-4 py-2.5 text-sm outline-none focus:border-[#14361f] focus:ring-1" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-800">Adresse du bien</label>
                  <input type="text" value={String(draft.rue ?? '')} onChange={(e) => update('rue', e.target.value)} placeholder="Saisissez votre adresse" className="rounded-md border border-slate-400 px-4 py-2.5 text-sm outline-none focus:border-[#14361f] focus:ring-1" />
                </div>
              </div>
              <NavigationFooter onNext={() => setStep(2)} />
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in duration-300">
              <StepHeader title="Surface habitable" />
              <div className="mb-8 flex items-start gap-3 rounded-lg bg-[#eef2f3] p-4 text-sm text-slate-600">
                <svg className="mt-0.5 size-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>Texte explicatif sur la surface à remplacer par le vrai contenu de votre maquette.</p>
              </div>

              <div className="mb-12 grid grid-cols-3 gap-6 border-b border-slate-100 pb-10">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-800">Surface habitable - m2</label>
                  <input type="number" value={draft.surface === '' ? '' : Number(draft.surface)} onChange={(e) => update('surface', e.target.value === '' ? '' : Number(e.target.value))} className="w-32 rounded-md border border-slate-400 px-4 py-2 text-sm outline-none focus:border-[#14361f] focus:ring-1" />
                </div>
              </div>

              <h2 className="mb-1 text-xl font-bold text-slate-900">Espaces et annexes</h2>
              <p className="mb-6 text-sm text-slate-500">Saisissez le nombre d'éléments composant votre bien</p>

              <div className="flex flex-col gap-6">
                <CounterRow title="Parking" description="Un emplacement privatif..." value={annexes.parking} onChange={(val) => updateAnnexe('parking', val)} />
                <CounterRow title="Cave" description="Local souterrain..." value={annexes.cave} onChange={(val) => updateAnnexe('cave', val)} />
              </div>
              <NavigationFooter onPrev={() => setStep(1)} onNext={() => setStep(3)} />
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in duration-300">
              <StepHeader title="Coefficients d'évaluation" description="Ajustez les coefficients qui impactent la valeur locative de votre bien." />
              <div className="mb-10">
                <h3 className="mb-2 text-lg font-bold text-slate-800">Coefficient d'entretien</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <RadioCard label="Bon" subLabel="(1,2)" selected={draft.coefEntretien === 1.2} onClick={() => update('coefEntretien', 1.2)} />
                  <RadioCard label="Assez bon" subLabel="(1)" selected={draft.coefEntretien === 1} onClick={() => update('coefEntretien', 1)} />
                  <RadioCard label="Passable" subLabel="(0,9)" selected={draft.coefEntretien === 0.9} onClick={() => update('coefEntretien', 0.9)} />
                </div>
              </div>
              <NavigationFooter onPrev={() => setStep(2)} onNext={() => setStep(4)} />
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in duration-300">
              <StepHeader title="Confort" description="Renseignez si votre bien est raccordé aux équipements suivants." />
              <div className="mt-8 flex flex-col">
                <ToggleRow title="Ascenseur" description="Votre bien bénéficie-t-il d'un ascenseur ?" checked={draft.ascenseur === 'Oui' || draft.ascenseur === 1} onChange={(val) => update('ascenseur', val ? 'Oui' : 'Non')} />
                <ToggleRow title="Eau courante" description="Raccordement au réseau d'eau potable." checked={draft.eauCourante === 1 || draft.eauCourante === 'Oui'} onChange={(val) => update('eauCourante', val ? 1 : 0)} />
                <ToggleRow title="Gaz" description="Raccordement au réseau de gaz de ville." checked={draft.gaz === 1 || draft.gaz === 'Oui'} onChange={(val) => update('gaz', val ? 1 : 0)} />
              </div>
              <NavigationFooter onPrev={() => setStep(3)} onNext={() => setStep(5)} />
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in duration-300">
              <StepHeader
                title="Sanitaires"
                description="Saisissez le nombre d'éléments composant votre bien."
              />

              <div className="mt-8 flex flex-col gap-6">
                <CounterRow
                  title="Baignoire(s)"
                  description="Élément encastré ou posé servant à se baigner."
                  value={getNum(draft.nbBaignoires)}
                  onChange={(val) => update('nbBaignoires', val)}
                />
                <CounterRow
                  title="Receveur(s) de douche"
                  description="Bac posé au sol ou encastré recueillant l'eau de la douche."
                  value={getNum(draft.nbDouches)}
                  onChange={(val) => update('nbDouches', val)}
                />
                <CounterRow
                  title="Lavabo(s)"
                  description="Vasque ou cuvette munie d'un écoulement d'eau, servant à faire sa toilette."
                  value={getNum(draft.nbEviers)}
                  onChange={(val) => update('nbEviers', val)}
                />
                <CounterRow
                  title="W-C"
                  description="Cuvette raccordée à une chasse d'eau."
                  value={getNum(draft.nbWc)}
                  onChange={(val) => update('nbWc', val)}
                />
              </div>

              {/* Appliquer à */}
              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-800">Appliquer ces paramètres à</h3>
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="applyMode"
                      checked={applyMode === 'all'}
                      onChange={() => setApplyMode('all')}
                      className="accent-[#14361f]"
                    />
                    <span className="text-sm text-slate-700">Tous les biens ({apartments.length})</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="applyMode"
                      checked={applyMode === 'selection'}
                      onChange={() => setApplyMode('selection')}
                      className="accent-[#14361f]"
                    />
                    <span className="text-sm text-slate-700">Une sélection de biens</span>
                  </label>
                </div>

                {applyMode === 'selection' && (
                  <div className="mt-4 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {apartments.map((apt, i) => (
                      <label
                        key={i}
                        className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${
                          i === index ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#14361f]"
                          checked={selectedIndices.has(i)}
                          onChange={() => toggleIndex(i)}
                          disabled={i === index}
                        />
                        <div className="flex flex-1 items-center gap-4 text-sm">
                          <span className="font-medium text-slate-700">
                            {String(apt.natureBien ?? '—')}
                          </span>
                          <span className="text-slate-400">
                            {apt.surface != null ? `${apt.surface} m²` : '—'}
                          </span>
                          <span className="text-slate-400">
                            {apt.etage != null && apt.etage !== '' ? `Ét. ${apt.etage}` : 'RDC'}
                          </span>
                        </div>
                        {i === index && (
                          <span className="shrink-0 text-xs font-medium text-emerald-600">En cours</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <NavigationFooter
                onPrev={() => setStep(4)}
                onNext={() => onSave(draft, computeIndices())}
                nextLabel="Visualiser mon estimation"
              />
            </div>
          )}

        </div>

        {/* WIDGET VIDÉO */}
        <div className="hidden w-56 shrink-0 flex-col gap-3 rounded-xl bg-[#eef2f3] p-5 text-center lg:flex">
          <p className="text-sm font-medium leading-snug text-slate-700">Laissez vous guider par notre tutoriel vidéo</p>
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg bg-[#14361f] px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90">
            ▶ Accéder à la vidéo
          </button>
        </div>
      </div>
    </div>
  )
}