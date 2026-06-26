import { useState } from 'react'
import { AppShell } from './components/AppShell'
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
  editBiens,
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
} from './api/contracts'

type View = 'import' | 'mapping' | 'parc' | 'form' | 'anomalies'

function App() {
  const [view, setView] = useState<View>('import')
  const [extract, setExtract] = useState<ExtractResponse | null>(null)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [reconcileData, setReconcileData] = useState<ReconcileResponse | null>(null)
  const [anomalyReport, setAnomalyReport] = useState<AnomalyReport | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [returnView, setReturnView] = useState<'parc' | 'anomalies'>('parc')
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
    setReturnView(view === 'anomalies' ? 'anomalies' : 'parc')
    setView('form')
  }

  async function handleSave(updated: Apartment) {
    if (selectedIndex === null || !extract) return
    setBusy(true)
    try {
      const res = await editBiens(extract.uploadId, [selectedIndex], updated)
      setApartments(res.apartments)
      setReconcileData(res.reconcile)
    } catch {
      // repli local si l'API échoue : on garde la saisie
      setApartments((prev) => prev.map((apt, i) => (i === selectedIndex ? updated : apt)))
    } finally {
      setBusy(false)
      setView(returnView)
      setSelectedIndex(null)
    }
  }

  function handleReset() {
    setExtract(null)
    setApartments([])
    setReconcileData(null)
    setAnomalyReport(null)
    setSelectedIndex(null)
    setMappingError(null)
    setMappingErrorDetails(null)
    setReportError(null)
    setView('import')
  }

  const selected = selectedIndex !== null ? apartments[selectedIndex] : undefined
  // import/mapping = collecte (0), parc/form = résultat (1), anomalies = décision (2).
  const step = view === 'import' || view === 'mapping' ? 0 : view === 'anomalies' ? 2 : 1

  return (
    <AppShell step={step} onHome={handleReset}>
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
          apartments={apartments}
          totalBiens={apartments.length}
          busy={busy}
          onUpdateStatus={handleUpdateAnomalyStatus}
          onConfigure={handleConfigure}
          onBack={() => setView('parc')}
        />
      )}

      {view === 'form' && selected && selectedIndex !== null && (
        <ConfigureForm
          apartment={selected}
          index={selectedIndex}
          onSave={handleSave}
          onBack={() => {
            setView(returnView)
            setSelectedIndex(null)
          }}
        />
      )}
    </AppShell>
  )
}

export default App
