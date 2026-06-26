import type { ReactNode } from 'react'

interface AppShellProps {
  step: 0 | 1 | 2
  onHome: () => void
  children: ReactNode
}

const STEPS = ['Collecte des documents', 'Résultat et réclamation', 'Décision']

function Stepper({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="flex items-start justify-center py-5">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-start">
          <div className="flex w-40 flex-col items-center">
            <div
              className={`size-6 rounded-full border-2 ${
                i <= step ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
              }`}
            />
            <span
              className={`mt-2 text-center text-xs ${
                i <= step ? 'font-medium text-slate-700' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className="mt-3 h-px w-16 bg-slate-300" />}
        </div>
      ))}
    </div>
  )
}

function SideIcon({
  title,
  onClick,
  children,
}: {
  title: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-lg text-emerald-200/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  )
}

export function AppShell({ step, onHome, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-16 flex-col items-center gap-6 bg-[#14361f] py-5">
        <button
          type="button"
          onClick={onHome}
          title="Accueil"
          className="text-sm font-bold tracking-tight text-emerald-300"
        >
          ORK
        </button>
        <nav className="flex flex-col items-center gap-2">
          <SideIcon title="Tableau de bord" onClick={onHome}>
            <svg viewBox="0 0 20 20" className="size-5 fill-current">
              <rect x="2" y="2" width="7" height="7" rx="1" />
              <rect x="11" y="2" width="7" height="7" rx="1" />
              <rect x="2" y="11" width="7" height="7" rx="1" />
              <rect x="11" y="11" width="7" height="7" rx="1" />
            </svg>
          </SideIcon>
          <SideIcon title="Nouvel import" onClick={onHome}>
            <svg viewBox="0 0 20 20" className="size-5 fill-current">
              <path d="M2 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Z" />
            </svg>
          </SideIcon>
          <SideIcon title="Analyses">
            <svg viewBox="0 0 20 20" className="size-5 fill-current">
              <path d="M10 1.5 12 4l3-.4-.4 3L17 9l-2.4 2 .4 3-3-.4L10 16l-2-2.4-3 .4.4-3L3 9l2.4-2L5 4l3 .4L10 1.5Z" />
            </svg>
          </SideIcon>
        </nav>
        <SideIcon title="Aide">
          <svg viewBox="0 0 20 20" className="mt-auto size-5 fill-current">
            <path d="M10 2a8 8 0 1 0 4 14.9L17 18l-1-3a8 8 0 0 0-6-13Z" />
          </svg>
        </SideIcon>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="grid grid-cols-3 items-center border-b border-slate-200 bg-white px-6 py-4">
          <div />
          <h1 className="text-center text-lg font-semibold text-slate-800">
            Mon avis sur les taxe foncière
          </h1>
          <div className="flex items-center justify-end gap-5 text-sm text-slate-500">
            <span className="hidden lg:inline">Vérification gratuite jusqu'au 1er octobre 2026</span>
            <button type="button" className="font-medium text-emerald-700 hover:text-emerald-800">
              Obtenir des crédits
            </button>
            <span className="font-medium text-slate-700">Perso</span>
          </div>
        </header>

        <Stepper step={step} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
