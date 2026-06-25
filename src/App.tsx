import { useState } from 'react'
import { ImportZone } from './components/ImportZone'
import { MappingStep } from './components/MappingStep'
import { ParcDashboard } from './components/ParcDashboard'
import { AnomaliesPage } from './components/AnomaliesPage'
import { ConfigureForm } from './components/ConfigureForm'
import {
  processMapping,
  reconcile as reconcileApi,
  resolveCase,
  resolveBulk,
  generateReport,
  updateAnomalyStatus,
  ApiClientError,
} from './api/client'
import type { Apartment } from './types'
import type {
  AnomalyReport,
  AnomalyStatus,
  BulkResolutionAction,
  ConfirmedMapping,
  ExtractResponse,
  ReconcileResponse,
  ResolutionAction,
  ValidationReport,
} from './api/contracts'

type View = 'import' | 'mapping' | 'parc' | 'form' | 'anomalies'

function App() {
  const [view, setView] = useState<View>('import')
  const [extract, setExtract] = useState<ExtractResponse | null>(null)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [reconcileData, setReconcileData] = useState<ReconcileResponse | null>(null)
  const [anomalyReport, setAnomalyReport] = useState<AnomalyReport | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [mappingErrorDetails, setMappingErrorDetails] = useState<string[] | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  function handleExtracted(result: ExtractResponse) {
    setExtract(result)
    setMappingError(null)
    setMappingErrorDetails(null)
    setView('mapping')
  }

  async function handleConfirmMapping(mapping: ConfirmedMapping) {
    if (!extract) return
    setProcessing(true)
    setMappingError(null)
    setMappingErrorDetails(null)
    try {
      const result = await processMapping(extract.uploadId, mapping)
      setApartments(result.apartments)
      setReport(result.report)
      const rec = await reconcileApi(extract.uploadId)
      setReconcileData(rec)
      setReportError(null)
      setView('parc')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setMappingError(err.message)
        setMappingErrorDetails(err.details ?? null)
      } else {
        setMappingError('Le traitement a échoué. Réessayez.')
      }
    } finally {
      setProcessing(false)
    }
  }

  async function handleResolve(
    invariant: string,
    side: 'erp_only' | 'fisc_only',
    action: ResolutionAction,
    targetInvariant?: string,
  ) {
    if (!extract) return
    setBusy(true)
    setReportError(null)
    try {
      const rec = await resolveCase(extract.uploadId, invariant, side, action, targetInvariant)
      setReconcileData(rec)
    } catch (err) {
      setReportError(err instanceof ApiClientError ? err.message : 'Échec de la résolution.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResolveBulk(
    side: 'erp_only' | 'fisc_only',
    invariants: string[],
    action: BulkResolutionAction,
  ) {
    if (!extract) return
    setBusy(true)
    setReportError(null)
    try {
      const rec = await resolveBulk(extract.uploadId, side, invariants, action)
      setReconcileData(rec)
    } catch (err) {
      setReportError(err instanceof ApiClientError ? err.message : 'Échec de la résolution en lot.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateReport() {
    if (!extract) return
    setBusy(true)
    setReportError(null)
    try {
      const rep = await generateReport(extract.uploadId)
      setAnomalyReport(rep)
      setView('anomalies')
    } catch (err) {
      setReportError(err instanceof ApiClientError ? err.message : 'Génération du rapport impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateAnomalyStatus(ids: string[], status: AnomalyStatus) {
    if (!extract) return
    setBusy(true)
    try {
      const rep = await updateAnomalyStatus(extract.uploadId, ids, status)
      setAnomalyReport(rep)
    } catch {
      /* non bloquant : on conserve l'état courant */
    } finally {
      setBusy(false)
    }
  }

  function handleConfigure(index: number) {
    setSelectedIndex(index)
    setView('form')
  }

  function handleSave(updated: Apartment) {
    if (selectedIndex === null) return
    setApartments((prev) => prev.map((apt, i) => (i === selectedIndex ? updated : apt)))
    setView('parc')
    setSelectedIndex(null)
  }

  function handleReset() {
    setExtract(null)
    setApartments([])
    setReport(null)
    setReconcileData(null)
    setAnomalyReport(null)
    setSelectedIndex(null)
    setMappingError(null)
    setMappingErrorDetails(null)
    setReportError(null)
    setView('import')
  }

  const selected = selectedIndex !== null ? apartments[selectedIndex] : undefined

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Kadastra — Conseil taxe foncière
          </h1>
          <p className="text-sm text-slate-500">
            Importez votre parc (Excel/CSV), validez le mapping, rapprochez les
            fiches fiscales, puis traitez les anomalies par enjeu financier.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {view === 'import' && <ImportZone onExtracted={handleExtracted} />}

        {view === 'mapping' && extract && (
          <MappingStep
            extract={extract}
            onConfirm={handleConfirmMapping}
            onBack={handleReset}
            processing={processing}
            error={mappingError}
            errorDetails={mappingErrorDetails}
          />
        )}

        {view === 'parc' && extract && reconcileData && (
          <ParcDashboard
            extract={extract}
            apartments={apartments}
            report={report}
            reconcile={reconcileData}
            busy={busy}
            reportError={reportError}
            onResolve={handleResolve}
            onResolveBulk={handleResolveBulk}
            onConfigure={handleConfigure}
            onReset={handleReset}
            onGenerateReport={handleGenerateReport}
          />
        )}

        {view === 'anomalies' && anomalyReport && (
          <AnomaliesPage
            report={anomalyReport}
            busy={busy}
            onUpdateStatus={handleUpdateAnomalyStatus}
            onBack={() => setView('parc')}
          />
        )}

        {view === 'form' && selected && selectedIndex !== null && (
          <ConfigureForm
            apartment={selected}
            index={selectedIndex}
            onSave={handleSave}
            onBack={() => {
              setView('parc')
              setSelectedIndex(null)
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
