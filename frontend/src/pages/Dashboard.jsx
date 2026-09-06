import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Share2, Briefcase, Bell, Network, TrendingUp, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { Card, CardHeader, StatCard, ScorePill, TypeBadge, Button, EmptyState, Spinner } from '../components/ui'
import { relLabel } from '../theme'

export default function Dashboard() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [hubs, setHubs] = useState([])
  const [communities, setCommunities] = useState([])
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [ov, al, hb, cm, cs] = await Promise.all([
      api.overview(), api.alerts({ status: 'open' }), api.hubs(6), api.communities(4, 4), api.cases(),
    ])
    setOverview(ov.data)
    setAlerts(al.data.alerts)
    setHubs(hb.data.hubs)
    setCommunities(cm.data.communities)
    setCases(cs.data.cases)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleRunDetection() {
    setRunning(true)
    await api.runDetection()
    await loadAll()
    setRunning(false)
  }

  if (loading || !overview) {
    return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  }

  const highPriority = alerts.filter((a) => a.score >= 70).slice(0, 6)
  const activeCases = cases.filter((c) => c.status === 'open')

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-bright)]">Investigator Overview</h1>
          <p className="text-xs text-[var(--text-dim)] mt-1">Network-wide summary across all loaded entities and active investigations</p>
        </div>
        <Button variant="secondary" onClick={handleRunDetection} disabled={running}>
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
          {running ? 'Running detection...' : 'Run anomaly detection'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Entities" value={overview.total_entities.toLocaleString()} icon={Users} accent="#3aa0ff" />
        <StatCard label="Total Relationships" value={overview.total_relationships.toLocaleString()} icon={Share2} accent="#22c55e" />
        <StatCard label="Active Cases" value={activeCases.length} icon={Briefcase} accent="#f5a524"
                  hint={`${cases.length} total`} />
        <StatCard label="Open Alerts" value={alerts.length} icon={Bell} accent="#ef4757"
                  hint={`${highPriority.length} high priority`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="High-Priority Connections & Alerts" subtitle="Top investigative leads by anomaly score" />
          <div className="divide-y divide-[var(--border)]">
            {highPriority.length === 0 && (
              <EmptyState icon={Bell} title="No high-priority alerts" subtitle="Run anomaly detection to scan the current network for investigative leads." />
            )}
            {highPriority.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/alerts`)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-bright)] font-medium truncate">{a.entity_name}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate">{a.alert_type}</div>
                </div>
                <ScorePill score={a.score} size="sm" />
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Entity Type Breakdown" />
          <div className="p-4 space-y-2.5">
            {Object.entries(overview.entity_type_counts).map(([type, count]) => {
              const total = overview.total_entities || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <TypeBadge type={type} />
                    <span className="text-[var(--text-dim)]">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Most Connected Entities" subtitle="Highest-degree nodes, potential hubs / intermediaries"
            right={<Network size={16} className="text-[var(--text-dim)]" />} />
          <div className="divide-y divide-[var(--border)]">
            {hubs.map((h) => (
              <button
                key={h.id}
                onClick={() => navigate(`/entities/${h.id}`)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-hover)] text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TypeBadge type={h.type} />
                  <span className="text-sm text-[var(--text-bright)] truncate">{h.name}</span>
                </div>
                <span className="text-xs text-[var(--text-dim)] shrink-0">{h.degree} connections</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Detected Communities" subtitle="Densely interconnected groups, possible operational cells"
            right={<TrendingUp size={16} className="text-[var(--text-dim)]" />} />
          <div className="divide-y divide-[var(--border)]">
            {communities.map((c) => (
              <div key={c.community_id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--text-bright)] font-medium">{c.size} entities</span>
                  <span className="text-xs text-[var(--text-dim)]">density {c.density}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)] truncate">
                  {c.members.slice(0, 4).map((m) => m.name).join(', ')}{c.members.length > 4 ? '…' : ''}
                </div>
              </div>
            ))}
            {communities.length === 0 && (
              <EmptyState title="No dense communities detected" subtitle="Load more relationship data to enable community detection." />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
