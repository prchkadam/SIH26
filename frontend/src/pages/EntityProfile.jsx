import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Share2, PlusCircle, ArrowLeft, Phone, Landmark, MapPin, Building2, Car,
  AlertTriangle, GitMerge, ChevronRight, X, ExternalLink,
} from 'lucide-react'
import { api } from '../api/client'
import { useCase } from '../CaseContext'
import {
  Card,
  CardHeader,
  TypeBadge,
  Button,
  Badge,
  ScorePill,
  Spinner,
  EmptyState,
} from '../components/ui'
import { relLabel } from '../theme'

const CATEGORY_META = {
  communication: {
    label: 'Communication History',
    icon: Phone,
  },
  financial: {
    label: 'Financial Relationships',
    icon: Landmark,
  },
  asset: {
    label: 'Vehicles & Assets',
    icon: Car,
  },
  association: {
    label: 'Organizations',
    icon: Building2,
  },
  location: {
    label: 'Locations',
    icon: MapPin,
  },
  resolution: {
    label: 'Possible Same-Entity Matches',
    icon: GitMerge,
  },
  other: {
    label: 'Other Relationships',
    icon: Share2,
  },
}

function formatAttributeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatAttributeValue(value) {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

function formatRelationshipAttributes(attributes = {}) {
  return Object.entries(attributes || {}).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== ''
  )
}

export default function EntityProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { linkEntityToActiveCase, activeCaseId } = useCase()

  const [profile, setProfile] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(false)

  // Selected connection for the details modal
  const [selectedConnection, setSelectedConnection] = useState(null)

  useEffect(() => {
    setLoading(true)
    setLinked(false)

    Promise.all([
      api.entityProfile(id),
      api.resolutionCandidates(id).catch(() => ({
        data: { candidates: [] },
      })),
      api.alerts({}),
    ])
      .then(([p, r, a]) => {
        setProfile(p.data)
        setCandidates(r.data.candidates)
        setAlerts(
          a.data.alerts.filter(
            (al) => al.entity_id === id
          )
        )
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [id])

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={28} />
      </div>
    )
  }

  const {
    entity,
    relationships,
    connection_count,
  } = profile

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ----------------------------------------------------- */}
      {/* BACK */}
      {/* ----------------------------------------------------- */}

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-bright)]"
      >
        <ArrowLeft size={13} />
        Back
      </button>

      {/* ----------------------------------------------------- */}
      {/* ENTITY HEADER */}
      {/* ----------------------------------------------------- */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TypeBadge type={entity.type} />

            <span className="text-[11px] text-[var(--text-dim)] mono">
              {entity.id}
            </span>

            {entity.confidence < 1 && (
              <Badge tone="warning">
                {Math.round(entity.confidence * 100)}% confidence
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold text-[var(--text-bright)]">
            {entity.name}
          </h1>

          <p className="text-xs text-[var(--text-dim)] mt-1">
            {connection_count} connected entities · sourced from{' '}
            {(entity.sources || []).join(', ') || 'manual entry'}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">

          <Button
            variant="secondary"
            onClick={() =>
              navigate(`/network?focus=${entity.id}`)
            }
          >
            <Share2 size={14} />
            Explore in graph
          </Button>

          {activeCaseId && (
            <Button
              variant={linked ? 'secondary' : 'primary'}
              disabled={linked}
              onClick={async () => {
                await linkEntityToActiveCase(
                  entity.id,
                  entity.type
                )
                setLinked(true)
              }}
            >
              <PlusCircle size={14} />
              {linked ? 'Added to case' : 'Add to case'}
            </Button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------- */}
      {/* ALERTS */}
      {/* ----------------------------------------------------- */}

      {alerts.length > 0 && (
        <Card className="border-[var(--danger)]/30">
          <CardHeader
            title="Risk / Anomaly Indicators"
            subtitle="Investigative leads flagged for this entity, not conclusions"
            right={
              <AlertTriangle
                size={16}
                className="text-[var(--danger)]"
              />
            }
          />

          <div className="divide-y divide-[var(--border)]">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm text-[var(--text-bright)] font-medium">
                    {a.alert_type}
                  </div>

                  <div className="text-xs text-[var(--text-dim)]">
                    {a.reasons?.[0]}
                  </div>
                </div>

                <Link
                  to="/alerts"
                  className="shrink-0"
                >
                  <ScorePill
                    score={a.score}
                    size="sm"
                  />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ----------------------------------------------------- */}
      {/* ENTITY INFORMATION */}
      {/* ----------------------------------------------------- */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card>
          <CardHeader title="Known Attributes" />

          <div className="p-4 space-y-2">

            {Object.entries(entity.attributes || {}).length === 0 && (
              <div className="text-xs text-[var(--text-dim)]">
                No additional attributes recorded.
              </div>
            )}

            {Object.entries(entity.attributes || {}).map(([k, v]) => (
              v !== null &&
              v !== undefined &&
              v !== '' ? (
                <div
                  key={k}
                  className="flex justify-between gap-4 text-sm border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-[var(--text-dim)] capitalize">
                    {formatAttributeKey(k)}
                  </span>

                  <span className="text-[var(--text-bright)] mono text-right break-all">
                    {formatAttributeValue(v)}
                  </span>
                </div>
              ) : null
            ))}

          </div>
        </Card>

        {/* ------------------------------------------------- */}
        {/* RESOLUTION CANDIDATES */}
        {/* ------------------------------------------------- */}

        <Card>
          <CardHeader
            title="Entity Resolution Candidates"
            subtitle="Records that may refer to this same real-world entity"
          />

          <div className="p-4">

            {candidates.length === 0 && (
              <div className="text-xs text-[var(--text-dim)]">
                No likely duplicate records found for this entity.
              </div>
            )}

            <div className="space-y-3">

              {candidates.slice(0, 5).map((c) => (
                <div
                  key={c.entity.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">

                    <Link
                      to={`/entities/${c.entity.id}`}
                      className="text-sm text-[var(--accent)] hover:underline truncate block"
                    >
                      {c.entity.name}
                    </Link>

                    <div className="text-[11px] text-[var(--text-dim)] truncate">
                      {c.reasons.join('; ')}
                    </div>

                  </div>

                  <Badge
                    tone={
                      c.auto_mergeable
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {Math.round(c.confidence * 100)}%
                  </Badge>
                </div>
              ))}

            </div>
          </div>
        </Card>
      </div>

      {/* ----------------------------------------------------- */}
      {/* RELATIONSHIPS */}
      {/* ----------------------------------------------------- */}

      {Object.entries(relationships).map(([cat, items]) => {

        if (!items.length) {
          return null
        }

        const meta =
          CATEGORY_META[cat] ||
          CATEGORY_META.other

        const Icon = meta.icon

        return (
          <Card key={cat}>

            <CardHeader
              title={meta.label}
              subtitle={`${items.length} record(s)`}
              right={
                <Icon
                  size={16}
                  className="text-[var(--text-dim)]"
                />
              }
            />

            <div className="divide-y divide-[var(--border)]">

              {items.map((r) => {

                const attributes =
                  formatRelationshipAttributes(
                    r.attributes
                  )

                return (
                  <button
                    key={r.id}
                    onClick={() =>
                      setSelectedConnection(r)
                    }
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--bg-hover)] text-left transition-colors"
                  >

                    <div className="flex items-center gap-3 min-w-0">

                      <TypeBadge
                        type={r.other_entity?.type}
                      />

                      <div className="min-w-0">

                        <div className="text-sm text-[var(--text-bright)] truncate">
                          {r.other_entity?.name ||
                            'Unknown entity'}
                        </div>

                        <div className="text-[11px] text-[var(--text-dim)] truncate">

                          {r.direction === 'outgoing'
                            ? relLabel(r.type)
                            : `${relLabel(r.type)} (incoming)`}

                          {attributes.length > 0 &&
                            ` · ${attributes.length} detail${
                              attributes.length === 1
                                ? ''
                                : 's'
                            }`}

                        </div>

                      </div>

                    </div>

                    <div className="flex items-center gap-2 shrink-0">

                      {r.confidence < 1 && (
                        <Badge tone="warning">
                          {Math.round(
                            r.confidence * 100
                          )}%
                        </Badge>
                      )}

                      <ChevronRight
                        size={14}
                        className="text-[var(--text-dim)]"
                      />

                    </div>

                  </button>
                )
              })}

            </div>
          </Card>
        )
      })}

      {/* ----------------------------------------------------- */}
      {/* EMPTY RELATIONSHIPS */}
      {/* ----------------------------------------------------- */}

      {Object.values(relationships).every(
        (v) => v.length === 0
      ) && (
        <EmptyState
          icon={Share2}
          title="No relationships recorded"
          subtitle="This entity has no linked records yet."
        />
      )}

      {/* ===================================================== */}
      {/* CONNECTION DETAILS MODAL */}
      {/* ===================================================== */}

      {selectedConnection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setSelectedConnection(null)}
        >

          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[var(--bg-panel)] border border-[var(--border-light)] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal header */}

            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border)]">

              <div>

                <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
                  Connection Details
                </div>

                <h2 className="text-lg font-semibold text-[var(--text-bright)] mt-1">
                  {selectedConnection.other_entity?.name ||
                    'Unknown entity'}
                </h2>

              </div>

              <button
                onClick={() =>
                  setSelectedConnection(null)
                }
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-dim)]"
              >
                <X size={17} />
              </button>

            </div>

            <div className="p-5 space-y-5">

              {/* Connected entity */}

              <div>

                <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                  Connected Entity
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]">

                  <TypeBadge
                    type={
                      selectedConnection
                        .other_entity?.type
                    }
                  />

                  <div className="min-w-0">

                    <div className="text-sm font-medium text-[var(--text-bright)]">
                      {selectedConnection.other_entity?.name ||
                        'Unknown entity'}
                    </div>

                    <div className="text-[11px] text-[var(--text-dim)] mono">
                      {selectedConnection.other_entity?.id ||
                        'Unknown ID'}
                    </div>

                  </div>

                </div>

              </div>

              {/* Relationship */}

              <div>

                <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                  Relationship
                </div>

                <div className="flex flex-wrap gap-2">

                  <Badge>
                    {selectedConnection.direction ===
                    'outgoing'
                      ? relLabel(
                          selectedConnection.type
                        )
                      : `${relLabel(
                          selectedConnection.type
                        )} (incoming)`}
                  </Badge>

                  {selectedConnection.confidence < 1 && (
                    <Badge tone="warning">
                      {Math.round(
                        selectedConnection.confidence * 100
                      )}% confidence
                    </Badge>
                  )}

                </div>

              </div>

              {/* Connection attributes */}

              <div>

                <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                  Connection Information
                </div>

                {formatRelationshipAttributes(
                  selectedConnection.attributes
                ).length === 0 ? (

                  <div className="p-3 rounded-lg border border-[var(--border)] text-xs text-[var(--text-dim)]">
                    No additional information is stored for this connection.
                  </div>

                ) : (

                  <div className="rounded-lg border border-[var(--border)] overflow-hidden">

                    {formatRelationshipAttributes(
                      selectedConnection.attributes
                    ).map(([key, value]) => (

                      <div
                        key={key}
                        className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.5fr)] gap-4 px-3 py-2.5 border-b border-[var(--border)] last:border-b-0"
                      >

                        <span className="text-xs text-[var(--text-dim)]">
                          {formatAttributeKey(key)}
                        </span>

                        <span className="text-xs text-[var(--text-bright)] mono break-all whitespace-pre-wrap">
                          {formatAttributeValue(value)}
                        </span>

                      </div>

                    ))}

                  </div>
                )}

              </div>

              {/* Relationship ID */}

              {selectedConnection.id && (
                <div>

                  <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Relationship ID
                  </div>

                  <div className="text-xs text-[var(--text-bright)] mono break-all">
                    {selectedConnection.id}
                  </div>

                </div>
              )}

              {/* Evidence attached to relationship */}

              {Array.isArray(
                selectedConnection.evidence
              ) &&
                selectedConnection.evidence.length > 0 && (
                  <div>

                    <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-2">
                      Relationship Evidence
                    </div>

                    <div className="space-y-2">

                      {selectedConnection.evidence.map(
                        (item, index) => (

                          <div
                            key={index}
                            className="p-3 rounded-lg border border-[var(--border)] text-xs text-[var(--text-bright)]"
                          >
                            {typeof item === 'object'
                              ? JSON.stringify(
                                  item,
                                  null,
                                  2
                                )
                              : String(item)}
                          </div>

                        )
                      )}

                    </div>

                  </div>
                )}

              {/* Actions */}

              <div className="flex flex-wrap justify-end gap-2 pt-2">

                <Button
                  variant="secondary"
                  onClick={() => {
                    const otherId =
                      selectedConnection
                        .other_entity?.id

                    setSelectedConnection(null)

                    if (otherId) {
                      navigate(
                        `/entities/${otherId}`
                      )
                    }
                  }}
                >
                  <ExternalLink size={14} />
                  View Entity Profile
                </Button>

                <Button
                  variant="ghost"
                  onClick={() =>
                    setSelectedConnection(null)
                  }
                >
                  Close
                </Button>

              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  )
}