import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, X, Maximize2, Route, Trash2, ExternalLink, PlusCircle, Loader2, Filter,
} from 'lucide-react'
import { api } from '../api/client'
import { useCase } from '../CaseContext'
import GraphView from '../components/GraphView'
import { Button, Card, TypeBadge, Spinner, Badge } from '../components/ui'
import { ENTITY_COLORS, relLabel } from '../theme'

const ALL_TYPES = ['Person', 'Organization', 'Phone', 'Account', 'Vehicle', 'Location']

function mergeGraph(prev, incoming) {
  const nodeMap = new Map(prev.nodes.map((n) => [n.id, n]))
  for (const n of incoming.nodes || []) nodeMap.set(n.id, n)
  const edgeMap = new Map(prev.edges.map((e) => [e.id, e]))
  for (const e of incoming.edges || []) edgeMap.set(e.id, e)
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] }
}

export default function NetworkExplorer() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { linkEntityToActiveCase, activeCaseId } = useCase()

  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [selectedId, setSelectedId] = useState(null)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [typeFilter, setTypeFilter] = useState(new Set(ALL_TYPES))
  const [loading, setLoading] = useState(true)
  const [expanding, setExpanding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [pathMode, setPathMode] = useState(false)
  const [pathSource, setPathSource] = useState(null)
  const [pathTarget, setPathTarget] = useState(null)
  const [pathIds, setPathIds] = useState([])
  const [pathNotFound, setPathNotFound] = useState(false)

  const loadInitial = useCallback(async (focusId) => {
    setLoading(true)
    if (focusId) {
      const res = await api.expand(focusId, 1)
      setGraph({ nodes: res.data.nodes, edges: res.data.edges })
      setSelectedId(focusId)
    } else {
      const hubsRes = await api.hubs(6)
      let merged = { nodes: [], edges: [] }
      for (const h of hubsRes.data.hubs) {
        const res = await api.expand(h.id, 1)
        merged = mergeGraph(merged, res.data)
      }
      setGraph(merged)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const focus = params.get('focus')
    loadInitial(focus || undefined)
  }, [])

  useEffect(() => {
    if (!selectedId) { setSelectedEntity(null); return }
    api.entityProfile(selectedId).then((res) => setSelectedEntity(res.data)).catch(() => setSelectedEntity(null))
  }, [selectedId])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      api.search(query).then((res) => setResults(res.data.entities))
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const handleExpand = useCallback(async (id) => {
    setExpanding(true)
    const res = await api.expand(id, 1)
    setGraph((prev) => mergeGraph(prev, res.data))
    setExpanding(false)
  }, [])

  async function addEntityToGraph(entity) {
    setExpanding(true)
    const res = await api.expand(entity.id, 1)
    setGraph((prev) => mergeGraph(prev, res.data))
    setSelectedId(entity.id)
    setQuery('')
    setResults([])
    setExpanding(false)
  }

  async function runPathFind() {
    if (!pathSource || !pathTarget) return
    setExpanding(true)
    setPathNotFound(false)
    const res = await api.path(pathSource.id, pathTarget.id)
    if (res.data.found) {
      setGraph((prev) => mergeGraph(prev, res.data))
      setPathIds(res.data.path_order)
    } else {
      setPathIds([])
      setPathNotFound(true)
    }
    setExpanding(false)
  }

  function clearPath() {
    setPathMode(false)
    setPathSource(null)
    setPathTarget(null)
    setPathIds([])
    setPathNotFound(false)
  }

  function resetGraph() {
    setGraph({ nodes: [], edges: [] })
    setSelectedId(null)
    clearPath()
    loadInitial()
  }

  function toggleType(t) {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const visibleNodes = useMemo(() => graph.nodes.filter((n) => typeFilter.has(n.type)), [graph.nodes, typeFilter])
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () => graph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [graph.edges, visibleIds]
  )

  return (
    <div className="h-full flex">
      <div className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-5 overflow-y-auto">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-bright)] mb-2">
            <Filter size={13} /> Entity Filters
          </div>
          <div className="space-y-1.5">
            {ALL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={typeFilter.has(t)} onChange={() => toggleType(t)}
                       className="accent-[var(--accent)]" />
                <span className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[t] }} />
                <span className="text-[var(--text)]">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[var(--text-bright)] mb-2">Path Finder</div>
          {!pathMode ? (
            <Button variant="secondary" className="w-full" onClick={() => setPathMode(true)}>
              <Route size={14} /> Find path between entities
            </Button>
          ) : (
            <div className="space-y-2">
              <EntityPicker label="Source" value={pathSource} onChange={setPathSource} />
              <EntityPicker label="Target" value={pathTarget} onChange={setPathTarget} />
              <div className="flex gap-1.5">
                <Button className="flex-1" onClick={runPathFind} disabled={!pathSource || !pathTarget}>
                  Trace
                </Button>
                <Button variant="ghost" onClick={clearPath}><X size={14} /></Button>
              </div>
              {pathNotFound && <div className="text-[11px] text-[var(--warning)]">No connecting path found within the loaded network.</div>}
              {pathIds.length > 0 && <div className="text-[11px] text-[var(--success)]">Path found: {pathIds.length} hops highlighted</div>}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-dim)] space-y-1">
          <div>{visibleNodes.length} entities shown</div>
          <div>{visibleEdges.length} relationships shown</div>
          <Button variant="ghost" className="!px-0 mt-1" onClick={resetGraph}>
            <Trash2 size={13} /> Reset view
          </Button>
        </div>
      </div>

      <div className="flex-1 relative min-w-0">
        <div className="absolute top-3 left-3 right-3 z-10 flex items-start gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search to add an entity and expand its network..."
              className="w-full bg-[var(--bg-panel)]/95 backdrop-blur border border-[var(--border-light)] rounded-md pl-8 pr-3 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)] shadow-lg"
            />
            {results.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-panel-2)] border border-[var(--border-light)] rounded-md shadow-xl max-h-72 overflow-y-auto">
                {results.map((r) => (
                  <button key={r.id} onClick={() => addEntityToGraph(r)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] text-left">
                    <TypeBadge type={r.type} />
                    <span className="text-sm text-[var(--text-bright)] truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {expanding && (
            <div className="bg-[var(--bg-panel)]/95 border border-[var(--border-light)] rounded-md px-3 py-2 flex items-center gap-2 text-xs text-[var(--text-dim)] shadow-lg">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
        ) : visibleNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-dim)]">
            Search above to start exploring from an entity.
          </div>
        ) : (
          <GraphView
            nodes={visibleNodes}
            edges={visibleEdges}
            selectedId={selectedId}
            highlightPathIds={pathIds}
            onSelectNode={setSelectedId}
            onExpandNode={handleExpand}
          />
        )}

        <div className="absolute bottom-3 left-3 bg-[var(--bg-panel)]/90 border border-[var(--border)] rounded-md px-3 py-1.5 text-[11px] text-[var(--text-dim)]">
          Double-click a node to expand its connections · Scroll to zoom · Drag to pan
        </div>
      </div>

      {selectedEntity && (
        <div className="w-80 shrink-0 border-l border-[var(--border)] bg-[var(--bg-panel)] overflow-y-auto">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-1">
              <TypeBadge type={selectedEntity.entity.type} />
              <button onClick={() => setSelectedId(null)} className="text-[var(--text-dim)] hover:text-[var(--text-bright)]">
                <X size={14} />
              </button>
            </div>
            <div className="text-base font-semibold text-[var(--text-bright)]">{selectedEntity.entity.name}</div>
            <div className="text-[11px] text-[var(--text-dim)] mono mt-0.5">{selectedEntity.entity.id}</div>
          </div>

          <div className="p-4 space-y-3 border-b border-[var(--border)]">
            {Object.entries(selectedEntity.entity.attributes || {}).map(([k, v]) => (
              v ? (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[var(--text-dim)] capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--text)] mono">{String(v)}</span>
                </div>
              ) : null
            ))}
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-dim)]">Connections</span>
              <span className="text-[var(--text)]">{selectedEntity.connection_count}</span>
            </div>
          </div>

          <div className="p-4 space-y-2">
            <Button variant="primary" className="w-full" onClick={() => navigate(`/entities/${selectedEntity.entity.id}`)}>
              <ExternalLink size={14} /> View full profile
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => handleExpand(selectedEntity.entity.id)}>
              <Maximize2 size={14} /> Expand connections
            </Button>
            {activeCaseId && (
              <Button variant="secondary" className="w-full"
                      onClick={() => linkEntityToActiveCase(selectedEntity.entity.id, selectedEntity.entity.type)}>
                <PlusCircle size={14} /> Add to active case
              </Button>
            )}
          </div>

          <div className="p-4 border-t border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--text-bright)] mb-2">Connection breakdown</div>
            <div className="space-y-1.5">
              {Object.entries(selectedEntity.connections_summary).filter(([, v]) => v > 0).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-dim)] capitalize">{cat}</span>
                  <Badge>{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntityPicker({ label, value, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(() => api.search(query).then((res) => setResults(res.data.entities)), 200)
    return () => clearTimeout(t)
  }, [query])

  if (value) {
    return (
      <div className="flex items-center justify-between bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-2.5 py-1.5">
        <span className="text-xs text-[var(--text-bright)] truncate">{value.name}</span>
        <button onClick={() => onChange(null)}><X size={12} className="text-[var(--text-dim)]" /></button>
      </div>
    )
  }
  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={label}
        className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
      />
      {results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-panel-2)] border border-[var(--border-light)] rounded-md shadow-xl max-h-48 overflow-y-auto z-20">
          {results.map((r) => (
            <button key={r.id} onClick={() => { onChange(r); setQuery('') }}
                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--bg-hover)] text-[var(--text-bright)] truncate">
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
