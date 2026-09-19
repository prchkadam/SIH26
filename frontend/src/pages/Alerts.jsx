import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronUp, CheckCircle2, XCircle, PlusCircle, ExternalLink, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { api } from '../api/client'
import { useCase } from '../CaseContext'
import { Card, ScorePill, Button, Badge, ExplainList, Spinner, EmptyState } from '../components/ui'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
]

export default function Alerts() {
  const navigate = useNavigate()
  const { linkAlertToActiveCase, activeCaseId } = useCase()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('open')
  const [minScore, setMinScore] = useState(0)
  const [expanded, setExpanded] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')

  async function load() {
    setLoading(true)
    const params = { min_score: minScore }
    if (status) params.status = status
    const res = await api.alerts(params)
    setAlerts(res.data.alerts)
    setLoading(false)
  }

  useEffect(() => { load() }, [status, minScore])

  async function handleRunDetection() {
    setRunning(true)
    await api.runDetection()
    await load()
    setRunning(false)
  }

  async function handleAction(id, action) {
    if (action === 'resolve') await api.resolveAlert(id)
    if (action === 'dismiss') await api.dismissAlert(id)
    await load()
  }

  const types = [...new Set(alerts.map((a) => a.alert_type))]
  const filtered = typeFilter ? alerts.filter((a) => a.alert_type === typeFilter) : alerts

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-bright)]">Alerts</h1>
          <p className="text-xs text-[var(--text-dim)] mt-1">
            AI/rule-based investigative signals. These describe potential leads and anomalies, not confirmed findings.
          </p>
        </div>
        <Button variant="secondary" onClick={handleRunDetection} disabled={running}>
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
          {running ? 'Scanning...' : 'Run detection'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="bg-[var(--bg-panel)] border border-[var(--border-light)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-bright)] outline-none">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[var(--bg-panel)] border border-[var(--border-light)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-bright)] outline-none">
          <option value="">All alert types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
          Min score
          <input type="range" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}
                 className="accent-[var(--accent)]" />
          <span className="mono text-[var(--text-bright)] w-6">{minScore}</span>
        </div>
        <span className="text-xs text-[var(--text-dim)] ml-auto">{filtered.length} alert(s)</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size={26} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No alerts match these filters" subtitle="Try lowering the score threshold or running detection again." />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--bg-hover)] text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ScorePill score={a.score} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-bright)] truncate">{a.alert_type}</div>
                    <div className="text-xs text-[var(--text-dim)] truncate">Entity: {a.entity_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.status !== 'open' && <Badge tone={a.status === 'reviewed' ? 'success' : 'neutral'}>{a.status}</Badge>}
                  {expanded === a.id ? <ChevronUp size={16} className="text-[var(--text-dim)]" /> : <ChevronDown size={16} className="text-[var(--text-dim)]" />}
                </div>
              </button>

              {expanded === a.id && (
                <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-bright)] mb-2">Why was this flagged?</div>
                    <ExplainList reasons={a.reasons} />
                    <div className="mt-2 text-xs text-[var(--text-dim)]">Confidence / risk score: <span className="text-[var(--text-bright)] font-medium">{a.score}/100</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/entities/${a.entity_id}`)}>
                      <ExternalLink size={14} /> View entity profile
                    </Button>
                    {activeCaseId && (
                      <Button variant="secondary" onClick={() => linkAlertToActiveCase(a.id)}>
                        <PlusCircle size={14} /> Add to active case
                      </Button>
                    )}
                    {a.status === 'open' && (
                      <>
                        <Button variant="secondary" onClick={() => handleAction(a.id, 'resolve')}>
                          <CheckCircle2 size={14} /> Mark reviewed
                        </Button>
                        <Button variant="ghost" onClick={() => handleAction(a.id, 'dismiss')}>
                          <XCircle size={14} /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
