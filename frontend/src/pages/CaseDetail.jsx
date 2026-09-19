import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Star,
  StarOff,
  Send,
  AlertTriangle,
  Share2,
  ShieldCheck,
  FileText,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  Eye,
  Pencil,
  History,
  X,
} from 'lucide-react'

import { api } from '../api/client'
import { useCase } from '../CaseContext'
import {
  Card,
  CardHeader,
  Button,
  TypeBadge,
  Badge,
  ScorePill,
  Spinner,
  EmptyState,
} from '../components/ui'


export default function CaseDetail() {

  const { id } = useParams()
  const navigate = useNavigate()

  const {
    activeCaseId,
    setActiveCaseId,
  } = useCase()


  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  const [note, setNote] = useState('')
  const [alertsById, setAlertsById] = useState({})

  // -------------------------------------------------------
  // Case linking state
  // -------------------------------------------------------

  const [showEntityLinker, setShowEntityLinker] = useState(false)
  const [showAlertLinker, setShowAlertLinker] = useState(false)
  const [availableEntities, setAvailableEntities] = useState([])
  const [availableAlerts, setAvailableAlerts] = useState([])
  const [entitySearch, setEntitySearch] = useState('')
  const [alertSearch, setAlertSearch] = useState('')
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [selectedAlertId, setSelectedAlertId] = useState('')
  const [linkingEntity, setLinkingEntity] = useState(false)
  const [linkingAlert, setLinkingAlert] = useState(false)
  const [linkError, setLinkError] = useState('')


  // -------------------------------------------------------
  // Evidence state
  // -------------------------------------------------------

  const [evidence, setEvidence] = useState([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)

  const [evidenceType, setEvidenceType] = useState('Document')
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [evidenceContent, setEvidenceContent] = useState('')
  const [evidenceSource, setEvidenceSource] = useState('')

  const [addingEvidence, setAddingEvidence] = useState(false)

  const [verification, setVerification] = useState({})

  // Currently selected evidence for viewing
  const [selectedEvidence, setSelectedEvidence] = useState(null)

  const [editingEvidence, setEditingEvidence] = useState(null)
  const [editEvidenceType, setEditEvidenceType] = useState('Document')
  const [editEvidenceDescription, setEditEvidenceDescription] = useState('')
  const [editEvidenceContent, setEditEvidenceContent] = useState('')
  const [editEvidenceSource, setEditEvidenceSource] = useState('')
  const [savingCorrection, setSavingCorrection] = useState(false)
  const [historyEvidence, setHistoryEvidence] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [verifyingVersion, setVerifyingVersion] = useState({})


  // -------------------------------------------------------
  // Load case
  // -------------------------------------------------------

  async function load() {

    setLoading(true)

    try {

      const res = await api.case(id)

      setCaseData(res.data)


      const alertLinks =
        res.data.linked_entities.filter(
          (l) => l.linked_kind === 'alert'
        )


      if (alertLinks.length) {

        const allAlerts = await api.alerts({})

        const map = {}

        for (const a of allAlerts.data.alerts) {
          map[a.id] = a
        }

        setAlertsById(map)

      }


      // Load blockchain evidence
      await loadEvidence()

    } catch (err) {

      console.error(err)

    } finally {

      setLoading(false)

    }

  }


  // -------------------------------------------------------
  // Load evidence
  // -------------------------------------------------------

  async function loadEvidence() {

    setEvidenceLoading(true)

    try {

      const res = await api.caseEvidence(id)

      setEvidence(
        Array.isArray(res.data)
          ? res.data
          : res.data.evidence || []
      )

    } catch (err) {

      console.error('Failed to load evidence:', err)

      setEvidence([])

    } finally {

      setEvidenceLoading(false)

    }

  }


  useEffect(() => {
    load()
  }, [id])


  // -------------------------------------------------------
  // Link entities / alerts to this case
  // -------------------------------------------------------

  function closeLinkModals() {
    setShowEntityLinker(false)
    setShowAlertLinker(false)
    setSelectedEntityId('')
    setSelectedAlertId('')
    setEntitySearch('')
    setAlertSearch('')
    setLinkError('')
  }

  async function openEntityLinker() {
    setLinkError('')
    setEntitySearch('')
    setSelectedEntityId('')

    try {
      const res = await api.entities()
      setAvailableEntities(res.data?.entities || [])
      setShowEntityLinker(true)
    } catch (err) {
      console.error('Failed to load entities:', err)
      setLinkError(err?.response?.data?.detail || 'Failed to load entities.')
      setShowEntityLinker(true)
    }
  }

  async function openAlertLinker() {
    setLinkError('')
    setAlertSearch('')
    setSelectedAlertId('')

    try {
      const res = await api.alerts({})
      setAvailableAlerts(res.data?.alerts || [])
      setShowAlertLinker(true)
    } catch (err) {
      console.error('Failed to load alerts:', err)
      setLinkError(err?.response?.data?.detail || 'Failed to load alerts.')
      setShowAlertLinker(true)
    }
  }

  async function handleLinkEntity() {
    if (!selectedEntityId) return

    const entity = availableEntities.find((item) => item.id === selectedEntityId)
    if (!entity) return

    setLinkingEntity(true)
    setLinkError('')

    try {
      const res = await api.linkToCase(id, {
        entity_id: entity.id,
        entity_type: entity.type || null,
        linked_kind: 'entity',
        ref_id: null,
      })

      setCaseData(res.data)
      setShowEntityLinker(false)
      setSelectedEntityId('')
      setEntitySearch('')
    } catch (err) {
      console.error('Failed to link entity:', err)
      setLinkError(err?.response?.data?.detail || 'Failed to link entity.')
    } finally {
      setLinkingEntity(false)
    }
  }

  async function handleLinkAlert() {
    if (!selectedAlertId) return

    const alertItem = availableAlerts.find((item) => item.id === selectedAlertId)
    if (!alertItem) return

    setLinkingAlert(true)
    setLinkError('')

    try {
      const res = await api.linkToCase(id, {
        entity_id: alertItem.entity_id || null,
        entity_type: 'Alert',
        linked_kind: 'alert',
        ref_id: alertItem.id,
      })

      setCaseData(res.data)
      setAlertsById((prev) => ({ ...prev, [alertItem.id]: alertItem }))
      setShowAlertLinker(false)
      setSelectedAlertId('')
      setAlertSearch('')
    } catch (err) {
      console.error('Failed to link alert:', err)
      setLinkError(err?.response?.data?.detail || 'Failed to link alert.')
    } finally {
      setLinkingAlert(false)
    }
  }


  // -------------------------------------------------------
  // Add note
  // -------------------------------------------------------

  async function handleAddNote(e) {

    e.preventDefault()

    if (!note.trim()) return

    await api.addCaseNote(id, note)

    setNote('')

    await load()

  }


  // -------------------------------------------------------
  // Add evidence
  // -------------------------------------------------------

  async function handleAddEvidence(e) {

    e.preventDefault()

    if (!evidenceDescription.trim()) return
    if (!evidenceContent.trim()) return

    setAddingEvidence(true)

    try {

      await api.addEvidence(id, {

        evidence_type: evidenceType,

        description: evidenceDescription,

        content: evidenceContent,

        source: evidenceSource || null,

      })


      // Clear form

      setEvidenceDescription('')
      setEvidenceContent('')
      setEvidenceSource('')


      // Reload evidence

      await loadEvidence()

    } catch (err) {

      console.error('Failed to add evidence:', err)

      alert(
        err?.response?.data?.detail ||
        'Failed to add evidence'
      )

    } finally {

      setAddingEvidence(false)

    }

  }


  // -------------------------------------------------------
  // View evidence
  // -------------------------------------------------------

  async function handleViewEvidence(item) {

    try {

      /*
       * Fetch the complete evidence record from the
       * blockchain/evidence endpoint.
       *
       * This gives us the actual off-chain evidence content.
       */

      const res = await api.blockchainEvidence(item.id)

      setSelectedEvidence(res.data)

    } catch (err) {

      console.error('Failed to load evidence:', err)

      /*
       * Fallback to the evidence already returned by
       * the case evidence endpoint.
       */

      setSelectedEvidence(item)

    }

  }


  // -------------------------------------------------------
  // Close evidence viewer
  // -------------------------------------------------------

  function closeEvidenceViewer() {

    setSelectedEvidence(null)

  }


  // -------------------------------------------------------
  // Verify evidence
  // -------------------------------------------------------

  async function handleVerifyEvidence(evidenceId) {

    setVerification((prev) => ({
      ...prev,

      [evidenceId]: {
        loading: true,
      },

    }))


    try {

      const res =
        await api.verifyEvidence(evidenceId)


      setVerification((prev) => ({
        ...prev,

        [evidenceId]: {

          loading: false,

          valid:
            res.data.valid ??
            res.data.is_valid ??
            false,

        },

      }))

    } catch (err) {

      console.error(
        'Evidence verification failed:',
        err
      )


      setVerification((prev) => ({
        ...prev,

        [evidenceId]: {

          loading: false,

          valid: false,

          error: true,

        },

      }))

    }

  }


  // -------------------------------------------------------
  // Evidence correction

  function openEditEvidence(item) {
    setEditingEvidence(item)
    setEditEvidenceType(item.evidence_type || 'Document')
    setEditEvidenceDescription(item.description || '')
    setEditEvidenceContent(item.content || '')
    setEditEvidenceSource(item.source || '')
  }

  async function handleSaveCorrection(e) {
    e.preventDefault()
    if (!editingEvidence || !editEvidenceDescription.trim() || !editEvidenceContent.trim()) return
    setSavingCorrection(true)
    try {
      const res = await api.editEvidence(id, editingEvidence.id, {
        evidence_type: editEvidenceType,
        description: editEvidenceDescription,
        content: editEvidenceContent,
        source: editEvidenceSource || null,
      })
      setEditingEvidence(null)
      await loadEvidence()
      if (res.data) setSelectedEvidence(res.data)
      alert(`Correction recorded. Version ${res.data?.version ?? 'new'} was created.`)
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to save evidence correction')
    } finally {
      setSavingCorrection(false)
    }
  }

  async function handleViewHistory(item) {
    setHistoryLoading(true)
    setHistoryEvidence({ ...item, history: [] })
    try {
      const res = await api.evidenceHistory(id, item.id)
      setHistoryEvidence({ ...item, ...res.data })
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to load evidence history')
      setHistoryEvidence(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSetVerified(item) {
    if (!item || item.status === 'superseded') return
    setVerifyingVersion((prev) => ({ ...prev, [item.id]: true }))
    try {
      const res = await api.verifyEvidenceVersion(id, item.id)
      await loadEvidence()
      if (selectedEvidence?.id === item.id) {
        setSelectedEvidence((prev) => ({ ...prev, ...(res.data || {}), status: 'verified' }))
      }
      alert(res?.data?.message || 'Evidence has been marked as verified.')
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to mark evidence as verified')
    } finally {
      setVerifyingVersion((prev) => ({ ...prev, [item.id]: false }))
    }
  }


  // Loading
  // -------------------------------------------------------

  if (loading || !caseData) {

    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={28} />
      </div>
    )

  }


  const entityLinks =
    caseData.linked_entities.filter(
      (l) => l.linked_kind === 'entity'
    )


  const alertLinks =
    caseData.linked_entities.filter(
      (l) => l.linked_kind === 'alert'
    )


  const isActive =
    activeCaseId === caseData.id


  // -------------------------------------------------------
  // Page
  // -------------------------------------------------------

  return (

    <div className="p-6 max-w-5xl mx-auto space-y-5">


      {/* ------------------------------------------------ */}
      {/* Back */}
      {/* ------------------------------------------------ */}

      <button
        onClick={() => navigate('/cases')}
        className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-bright)]"
      >

        <ArrowLeft size={13} />

        Back to cases

      </button>


      {/* ------------------------------------------------ */}
      {/* Case Header */}
      {/* ------------------------------------------------ */}

      <div className="flex items-start justify-between gap-4">

        <div>

          <div className="flex items-center gap-2 mb-1">

            <span className="text-[11px] text-[var(--text-dim)] mono">
              {caseData.id}
            </span>


            <Badge
              tone={
                caseData.priority === 'high'
                  ? 'danger'
                  : caseData.priority === 'medium'
                    ? 'warning'
                    : 'neutral'
              }
            >

              {caseData.priority}

            </Badge>


            <Badge>

              {caseData.status}

            </Badge>

          </div>


          <h1 className="text-xl font-bold text-[var(--text-bright)]">

            {caseData.title}

          </h1>


          <p className="text-sm text-[var(--text-dim)] mt-1 max-w-2xl">

            {caseData.description}

          </p>

        </div>


        <Button
          variant={
            isActive
              ? 'secondary'
              : 'primary'
          }

          onClick={() =>
            setActiveCaseId(
              isActive
                ? null
                : caseData.id
            )
          }
        >

          {isActive ? (

            <>
              <StarOff size={14} />
              Unset active
            </>

          ) : (

            <>
              <Star size={14} />
              Set active
            </>

          )}

        </Button>

      </div>


      {/* ------------------------------------------------ */}
      {/* Entities + Alerts */}
      {/* ------------------------------------------------ */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">


        <Card>

          <CardHeader
            title="Linked Entities"
            subtitle={`${entityLinks.length} entities associated with this investigation`}
            right={
              <Button variant="secondary" onClick={openEntityLinker}>
                <Plus size={14} />
                Link Entity
              </Button>
            }
          />


          <div className="divide-y divide-[var(--border)]">

            {entityLinks.length === 0 && (

              <div className="p-4">

                <EmptyState
                  title="No entities linked yet"
                />

              </div>

            )}


            {entityLinks.map((l) => (

              <Link
                key={l.link_id}
                to={`/entities/${l.entity_id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-hover)]"
              >

                <TypeBadge
                  type={
                    l.entity?.type ||
                    l.entity_type
                  }
                />


                <span className="text-sm text-[var(--text-bright)] truncate">

                  {l.entity?.name ||
                    l.entity_id}

                </span>

              </Link>

            ))}

          </div>

        </Card>



        <Card>

          <CardHeader
            title="Linked Alerts"
            subtitle={`${alertLinks.length} investigative signal(s) attached`}
            right={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={openAlertLinker}>
                  <Plus size={14} />
                  Link Alert
                </Button>
                <AlertTriangle
                  size={16}
                  className="text-[var(--text-dim)]"
                />
              </div>
            }
          />


          <div className="divide-y divide-[var(--border)]">

            {alertLinks.length === 0 && (

              <div className="p-4">

                <EmptyState
                  title="No alerts linked yet"
                />

              </div>

            )}


            {alertLinks.map((l) => {

              const a =
                alertsById[l.ref_id]

              return (

                <div
                  key={l.link_id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >

                  <div className="min-w-0">

                    <div className="text-sm text-[var(--text-bright)] truncate">

                      {a?.alert_type ||
                        l.ref_id}

                    </div>


                    <div className="text-xs text-[var(--text-dim)] truncate">

                      {a?.entity_name}

                    </div>

                  </div>


                  {a && (

                    <ScorePill
                      score={a.score}
                      size="sm"
                    />

                  )}

                </div>

              )

            })}

          </div>

        </Card>

      </div>


      {/* ------------------------------------------------ */}
      {/* Link Entity Modal */}
      {/* ------------------------------------------------ */}

      {showEntityLinker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLinkModals()
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-bright)]">Link Entity</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">Choose an existing entity to associate with this case.</p>
              </div>
              <button
                type="button"
                onClick={closeLinkModals}
                className="text-[var(--text-dim)] hover:text-[var(--text-bright)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {linkError && (
                <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--bg-hover)] px-3 py-2 text-xs text-[var(--danger)]">
                  {linkError}
                </div>
              )}

              <input
                value={entitySearch}
                onChange={(event) => setEntitySearch(event.target.value)}
                placeholder="Search by entity name, ID, or type..."
                className="w-full bg-[var(--bg)] border border-[var(--border-light)] rounded-md px-3 py-2 text-xs text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
              />

              <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-md">
                {availableEntities
                  .filter((entity) => {
                    const query = entitySearch.trim().toLowerCase()
                    if (!query) return true
                    return `${entity.name || ''} ${entity.id || ''} ${entity.type || ''}`
                      .toLowerCase()
                      .includes(query)
                  })
                  .map((entity) => {
                    const alreadyLinked = entityLinks.some((link) => link.entity_id === entity.id)
                    const selected = selectedEntityId === entity.id

                    return (
                      <button
                        key={entity.id}
                        type="button"
                        disabled={alreadyLinked}
                        onClick={() => setSelectedEntityId(entity.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-b-0 border-[var(--border)] ${
                          alreadyLinked
                            ? 'opacity-40 cursor-not-allowed'
                            : selected
                              ? 'bg-[var(--bg-hover)]'
                              : 'hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <TypeBadge type={entity.type} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-[var(--text-bright)] truncate">
                            {entity.name || entity.id}
                          </span>
                          <span className="block text-[10px] text-[var(--text-dim)] mono truncate">
                            {entity.id}
                          </span>
                        </span>
                        {alreadyLinked && <Badge>Linked</Badge>}
                        {selected && !alreadyLinked && <CheckCircle2 size={15} />}
                      </button>
                    )
                  })}

                {availableEntities.filter((entity) => {
                  const query = entitySearch.trim().toLowerCase()
                  if (!query) return true
                  return `${entity.name || ''} ${entity.id || ''} ${entity.type || ''}`
                    .toLowerCase()
                    .includes(query)
                }).length === 0 && (
                  <div className="p-5 text-center text-xs text-[var(--text-dim)]">
                    No matching entities found.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeLinkModals} disabled={linkingEntity}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleLinkEntity}
                  disabled={!selectedEntityId || linkingEntity}
                >
                  {linkingEntity ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {linkingEntity ? 'Linking...' : 'Link Entity'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* Link Alert Modal */}
      {/* ------------------------------------------------ */}

      {showAlertLinker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLinkModals()
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-bright)]">Link Alert</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">Attach an existing investigative signal to this case.</p>
              </div>
              <button
                type="button"
                onClick={closeLinkModals}
                className="text-[var(--text-dim)] hover:text-[var(--text-bright)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {linkError && (
                <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--bg-hover)] px-3 py-2 text-xs text-[var(--danger)]">
                  {linkError}
                </div>
              )}

              <input
                value={alertSearch}
                onChange={(event) => setAlertSearch(event.target.value)}
                placeholder="Search by alert type, entity, or ID..."
                className="w-full bg-[var(--bg)] border border-[var(--border-light)] rounded-md px-3 py-2 text-xs text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
              />

              <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-md">
                {availableAlerts
                  .filter((alertItem) => {
                    const query = alertSearch.trim().toLowerCase()
                    if (!query) return true
                    return `${alertItem.alert_type || ''} ${alertItem.entity_name || ''} ${alertItem.entity_id || ''} ${alertItem.id || ''}`
                      .toLowerCase()
                      .includes(query)
                  })
                  .map((alertItem) => {
                    const alreadyLinked = alertLinks.some((link) => link.ref_id === alertItem.id)
                    const selected = selectedAlertId === alertItem.id

                    return (
                      <button
                        key={alertItem.id}
                        type="button"
                        disabled={alreadyLinked}
                        onClick={() => setSelectedAlertId(alertItem.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-b-0 border-[var(--border)] ${
                          alreadyLinked
                            ? 'opacity-40 cursor-not-allowed'
                            : selected
                              ? 'bg-[var(--bg-hover)]'
                              : 'hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <AlertTriangle size={16} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-[var(--text-bright)] truncate">
                            {alertItem.alert_type || 'Alert'}
                          </span>
                          <span className="block text-[10px] text-[var(--text-dim)] truncate">
                            {alertItem.entity_name || alertItem.entity_id || alertItem.id}
                          </span>
                        </span>
                        <ScorePill score={alertItem.score} />
                        {alreadyLinked && <Badge>Linked</Badge>}
                        {selected && !alreadyLinked && <CheckCircle2 size={15} />}
                      </button>
                    )
                  })}

                {availableAlerts.filter((alertItem) => {
                  const query = alertSearch.trim().toLowerCase()
                  if (!query) return true
                  return `${alertItem.alert_type || ''} ${alertItem.entity_name || ''} ${alertItem.entity_id || ''} ${alertItem.id || ''}`
                    .toLowerCase()
                    .includes(query)
                }).length === 0 && (
                  <div className="p-5 text-center text-xs text-[var(--text-dim)]">
                    No matching alerts found.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeLinkModals} disabled={linkingAlert}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleLinkAlert}
                  disabled={!selectedAlertId || linkingAlert}
                >
                  {linkingAlert ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {linkingAlert ? 'Linking...' : 'Link Alert'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* Blockchain Evidence */}
      {/* ------------------------------------------------ */}
      {/* ------------------------------------------------ */}

      <Card>

        <CardHeader
          title="Evidence & Blockchain"
          subtitle={`${evidence.length} evidence record(s) protected by the tamper-evident ledger`}
          right={
            <ShieldCheck
              size={16}
              className="text-[var(--success)]"
            />
          }
        />


        {/* Add Evidence */}

        <form
          onSubmit={handleAddEvidence}
          className="p-4 space-y-3 border-b border-[var(--border)]"
        >

          <div className="text-xs font-semibold text-[var(--text-bright)]">

            Add Evidence

          </div>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">


            {/* Type */}

            <div>

              <label className="block text-[11px] text-[var(--text-dim)] mb-1">

                Evidence type

              </label>


              <select
                value={evidenceType}
                onChange={(e) =>
                  setEvidenceType(e.target.value)
                }

                className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none"
              >

                <option>Document</option>
                <option>Image</option>
                <option>Report</option>
                <option>Transaction</option>
                <option>Call Record</option>
                <option>Surveillance</option>
                <option>Other</option>

              </select>

            </div>


            {/* Source */}

            <div>

              <label className="block text-[11px] text-[var(--text-dim)] mb-1">

                Source

              </label>


              <input
                value={evidenceSource}
                onChange={(e) =>
                  setEvidenceSource(e.target.value)
                }

                placeholder="Evidence source"

                className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
              />

            </div>


            {/* Description */}

            <div>

              <label className="block text-[11px] text-[var(--text-dim)] mb-1">

                Description

              </label>


              <input
                value={evidenceDescription}
                onChange={(e) =>
                  setEvidenceDescription(
                    e.target.value
                  )
                }

                placeholder="Describe the evidence"

                className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
              />

            </div>

          </div>


          {/* Evidence content */}

          <div>

            <label className="block text-[11px] text-[var(--text-dim)] mb-1">

              Evidence content

            </label>


            <textarea
              value={evidenceContent}

              onChange={(e) =>
                setEvidenceContent(
                  e.target.value
                )
              }

              rows={4}

              placeholder="Enter the evidence content to be cryptographically fingerprinted..."

              className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
            />

          </div>


          <Button
            type="submit"

            disabled={
              addingEvidence ||
              !evidenceDescription.trim() ||
              !evidenceContent.trim()
            }
          >

            {addingEvidence ? (

              <Loader2
                size={14}
                className="animate-spin"
              />

            ) : (

              <Plus size={14} />

            )}


            {addingEvidence
              ? 'Recording...'
              : 'Add & Record Evidence'}

          </Button>

        </form>


        {/* Evidence list */}

        {evidenceLoading ? (

          <div className="p-6 flex justify-center">

            <Spinner size={22} />

          </div>

        ) : evidence.length === 0 ? (

          <div className="p-4">

            <EmptyState
              title="No evidence recorded yet"
            />

          </div>

        ) : (

          <div className="divide-y divide-[var(--border)]">

            {evidence.map((item) => {

              const status =
                verification[item.id]


              return (

                <div
                  key={item.id}
                  className="p-4 space-y-3"
                >


                  {/* Evidence header */}

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <div className="flex items-center gap-2">

                        <FileText
                          size={15}
                          className="text-[var(--text-dim)]"
                        />

                        <span className="text-sm font-semibold text-[var(--text-bright)]">

                          {item.evidence_type}

                        </span>


                        <Badge>

                          {item.id}

                        </Badge>

                        <Badge tone={item.status === 'verified' ? 'success' : item.status === 'superseded' ? 'danger' : 'neutral'}>

                          {(item.status || 'active').toUpperCase()}

                        </Badge>

                        <span className="text-[10px] text-[var(--text-dim)] mono">
                          V{item.version ?? 1}
                        </span>

                      </div>


                      <div className="text-xs text-[var(--text-dim)] mt-1">

                        {item.description}

                      </div>

                    </div>


                    <div className="flex items-center gap-2">


                      {/* View Evidence */}

                      <Button
                        variant="secondary"
                        onClick={() =>
                          handleViewEvidence(item)
                        }
                      >

                        <Eye size={13} />

                        View Evidence

                      </Button>


                      {item.status !== 'superseded' && (

                        <Button
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const res = await api.blockchainEvidence(item.id)
                              openEditEvidence(res.data)
                            } catch {
                              openEditEvidence(item)
                            }
                          }}
                        >

                          <Pencil size={13} />

                          Edit Evidence

                        </Button>

                      )}


                      {/* Verify */}

                      <Button
                        variant="secondary"

                        onClick={() =>
                          handleVerifyEvidence(
                            item.id
                          )
                        }

                        disabled={status?.loading}
                      >

                        {status?.loading ? (

                          <Loader2
                            size={13}
                            className="animate-spin"
                          />

                        ) : status?.valid ? (

                          <CheckCircle2
                            size={13}
                          />

                        ) : (

                          <ShieldCheck
                            size={13}
                          />

                        )}


                        {status?.loading
                          ? 'Verifying...'
                          : status?.valid
                            ? 'Verified'
                            : 'Verify'}

                      </Button>

                      {item.status === 'active' && (

                        <Button
                          variant="primary"
                          onClick={() => handleSetVerified(item)}
                          disabled={verifyingVersion[item.id]}
                        >
                          {verifyingVersion[item.id] ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          {verifyingVersion[item.id] ? 'Saving...' : 'Set as Verified'}
                        </Button>

                      )}

                      <Button
                        variant="secondary"
                        onClick={() => handleViewHistory(item)}
                      >
                        <History size={13} />
                        History
                      </Button>

                    </div>

                  </div>


                  {/* Blockchain metadata */}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">


                    {/* Block */}

                    <div className="bg-[var(--bg-app)] rounded-md p-3">

                      <div className="text-[10px] text-[var(--text-dim)]">

                        Blockchain Block

                      </div>


                      <div className="text-sm font-semibold text-[var(--text-bright)] mt-1 mono">

                        #

                        {item.block_index ?? '—'}

                      </div>

                    </div>


                    {/* Content hash */}

                    <div className="bg-[var(--bg-app)] rounded-md p-3">

                      <div className="text-[10px] text-[var(--text-dim)]">

                        SHA-256 Content Hash

                      </div>


                      <div className="text-[10px] text-[var(--text-bright)] mt-1 mono break-all">

                        {item.content_hash || '—'}

                      </div>

                    </div>


                    {/* Block hash */}

                    <div className="bg-[var(--bg-app)] rounded-md p-3">

                      <div className="text-[10px] text-[var(--text-dim)]">

                        Block Hash

                      </div>


                      <div className="text-[10px] text-[var(--text-bright)] mt-1 mono break-all">

                        {item.block_hash || '—'}

                      </div>

                    </div>

                  </div>


                  {/* Verification result */}

                  {status && !status.loading && (

                    <div
                      className={
                        status.valid
                          ? "text-xs text-[var(--success)] bg-[var(--success)]/10 rounded-md px-3 py-2 flex items-center gap-2"
                          : "text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-md px-3 py-2 flex items-center gap-2"
                      }
                    >

                      {status.valid ? (

                        <>

                          <CheckCircle2 size={14} />

                          Evidence integrity verified.
                          The recorded content hash
                          matches the blockchain record.

                        </>

                      ) : (

                        <>

                          <XCircle size={14} />

                          Evidence verification failed.
                          The blockchain record or evidence
                          may have been modified.

                        </>

                      )}

                    </div>

                  )}

                </div>

              )

            })}

          </div>

        )}

      </Card>


      {/* ------------------------------------------------ */}
      {/* Evidence Viewer Modal */}
      {/* ------------------------------------------------ */}

      {selectedEvidence && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={closeEvidenceViewer}
        >

          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >


            {/* Modal Header */}

            <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--border)]">

              <div>

                <div className="flex items-center gap-2">

                  <FileText
                    size={18}
                    className="text-[var(--accent)]"
                  />

                  <h2 className="text-base font-semibold text-[var(--text-bright)]">

                    Evidence Details

                  </h2>

                </div>


                <div className="text-xs text-[var(--text-dim)] mt-1">

                  {selectedEvidence.evidence_type}

                  {' • '}

                  {selectedEvidence.id}

                  {' • '}

                  V{selectedEvidence.version ?? 1}

                  {' • '}

                  {(selectedEvidence.status || 'active').toUpperCase()}

                </div>

              </div>


              <button
                onClick={closeEvidenceViewer}
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-bright)] hover:bg-[var(--bg-hover)]"
              >

                <X size={18} />

              </button>

            </div>


            {/* Modal Content */}

            <div className="p-5 space-y-4">


              {/* Description */}

              <div>

                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">

                  Description

                </div>


                <div className="text-sm text-[var(--text-bright)]">

                  {selectedEvidence.description || '—'}

                </div>

              </div>


              {/* Source */}

              <div>

                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">

                  Source

                </div>


                <div className="text-sm text-[var(--text-bright)]">

                  {selectedEvidence.source || '—'}

                </div>

              </div>


              {/* Actual Evidence Content */}

              <div>

                <div className="flex items-center justify-between mb-1">

                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">

                    Evidence Content

                  </div>

                  <Badge>

                    Off-chain storage

                  </Badge>

                </div>


                <div className="bg-[var(--bg-app)] border border-[var(--border)] rounded-md p-4">

                  <pre className="text-sm text-[var(--text-bright)] whitespace-pre-wrap break-words font-mono leading-relaxed">

                    {selectedEvidence.content || 'No evidence content available.'}

                  </pre>

                </div>

              </div>


              {/* Integrity Information */}

              <div className="border-t border-[var(--border)] pt-4">

                <div className="text-xs font-semibold text-[var(--text-bright)] mb-3">

                  Integrity & Blockchain Record

                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">


                  {/* Block */}

                  <div className="bg-[var(--bg-app)] rounded-md p-3">

                    <div className="text-[10px] text-[var(--text-dim)]">

                      Blockchain Block

                    </div>


                    <div className="text-sm font-semibold text-[var(--text-bright)] mt-1 mono">

                      #

                      {selectedEvidence.block_index ?? '—'}

                    </div>

                  </div>


                  {/* Created By */}

                  <div className="bg-[var(--bg-app)] rounded-md p-3">

                    <div className="text-[10px] text-[var(--text-dim)]">

                      Recorded By

                    </div>


                    <div className="text-sm text-[var(--text-bright)] mt-1">

                      {selectedEvidence.created_by || '—'}

                    </div>

                  </div>


                  {/* Content Hash */}

                  <div className="md:col-span-2 bg-[var(--bg-app)] rounded-md p-3">

                    <div className="text-[10px] text-[var(--text-dim)]">

                      SHA-256 Content Hash

                    </div>


                    <div className="text-[10px] text-[var(--text-bright)] mt-1 mono break-all">

                      {selectedEvidence.content_hash || '—'}

                    </div>

                  </div>


                  {/* Block Hash */}

                  <div className="md:col-span-2 bg-[var(--bg-app)] rounded-md p-3">

                    <div className="text-[10px] text-[var(--text-dim)]">

                      Block Hash

                    </div>


                    <div className="text-[10px] text-[var(--text-bright)] mt-1 mono break-all">

                      {selectedEvidence.block_hash || '—'}

                    </div>

                  </div>

                </div>

              </div>


              {selectedEvidence.status === 'active' && (

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    onClick={() => handleSetVerified(selectedEvidence)}
                    disabled={verifyingVersion[selectedEvidence.id]}
                  >
                    {verifyingVersion[selectedEvidence.id] ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {verifyingVersion[selectedEvidence.id] ? 'Saving...' : 'Set as Verified'}
                  </Button>
                </div>

              )}


              {/* Verify Button */}

              <div className="flex justify-end pt-2">

                <Button
                  variant="primary"
                  onClick={() => {

                    handleVerifyEvidence(
                      selectedEvidence.id
                    )

                  }}
                  disabled={
                    verification[selectedEvidence.id]?.loading
                  }
                >

                  {verification[selectedEvidence.id]?.loading ? (

                    <>

                      <Loader2
                        size={14}
                        className="animate-spin"
                      />

                      Verifying...

                    </>

                  ) : verification[selectedEvidence.id]?.valid ? (

                    <>

                      <CheckCircle2 size={14} />

                      Integrity Verified

                    </>

                  ) : (

                    <>

                      <ShieldCheck size={14} />

                      Verify Integrity

                    </>

                  )}

                </Button>

              </div>


              {/* Modal Verification Result */}

              {verification[selectedEvidence.id] &&
                !verification[selectedEvidence.id].loading && (

                  <div
                    className={
                      verification[selectedEvidence.id].valid
                        ? "text-xs text-[var(--success)] bg-[var(--success)]/10 rounded-md px-3 py-3 flex items-center gap-2"
                        : "text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-md px-3 py-3 flex items-center gap-2"
                    }
                  >

                    {verification[selectedEvidence.id].valid ? (

                      <>

                        <CheckCircle2 size={15} />

                        <span>

                          <strong>Integrity verified.</strong>{' '}

                          The evidence content matches its
                          stored SHA-256 fingerprint and
                          blockchain record.

                        </span>

                      </>

                    ) : (

                      <>

                        <XCircle size={15} />

                        <span>

                          <strong>Verification failed.</strong>{' '}

                          The evidence or its blockchain
                          record may have been modified.

                        </span>

                      </>

                    )}

                  </div>

                )}

            </div>

          </div>

        </div>

      )}


      {/* ------------------------------------------------ */}
      {/* Edit Evidence Modal */}

      {editingEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !savingCorrection && setEditingEvidence(null)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveCorrection}>
              <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--border)]">
                <div>
                  <div className="flex items-center gap-2">
                    <Pencil size={18} className="text-[var(--accent)]" />
                    <h2 className="text-base font-semibold text-[var(--text-bright)]">Correct Evidence</h2>
                  </div>
                  <div className="text-xs text-[var(--text-dim)] mt-1">Editing V{editingEvidence.version ?? 1} creates a new immutable version.</div>
                </div>
                <button type="button" onClick={() => !savingCorrection && setEditingEvidence(null)} className="p-1.5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-bright)] hover:bg-[var(--bg-hover)]"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3 text-[11px] text-[var(--text-dim)]">The original evidence is retained as superseded. The correction receives a new SHA-256 hash and blockchain record.</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-dim)] mb-1">Evidence type</label>
                    <select value={editEvidenceType} onChange={(e) => setEditEvidenceType(e.target.value)} className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)]">
                      <option>Document</option><option>Image</option><option>Report</option><option>Transaction</option><option>Call Record</option><option>Surveillance</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-dim)] mb-1">Source</label>
                    <input value={editEvidenceSource} onChange={(e) => setEditEvidenceSource(e.target.value)} placeholder="Evidence source" className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-1">Description</label>
                  <input value={editEvidenceDescription} onChange={(e) => setEditEvidenceDescription(e.target.value)} className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-1">Corrected evidence content</label>
                  <textarea value={editEvidenceContent} onChange={(e) => setEditEvidenceContent(e.target.value)} rows={8} className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)]" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditingEvidence(null)} disabled={savingCorrection}>Cancel</Button>
                  <Button type="submit" disabled={savingCorrection || !editEvidenceDescription.trim() || !editEvidenceContent.trim()}>
                    {savingCorrection ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    {savingCorrection ? 'Recording Correction...' : 'Save Correction'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence History Modal */}

      {historyEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !historyLoading && setHistoryEvidence(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-2"><History size={18} className="text-[var(--accent)]" /><h2 className="text-base font-semibold text-[var(--text-bright)]">Evidence Audit History</h2></div>
                <div className="text-xs text-[var(--text-dim)] mt-1">Previous versions remain traceable and are never silently overwritten.</div>
              </div>
              <button onClick={() => !historyLoading && setHistoryEvidence(null)} className="p-1.5 rounded-md text-[var(--text-dim)]"><X size={18} /></button>
            </div>
            <div className="p-5">
              {historyLoading ? <div className="flex justify-center py-10"><Spinner size={24} /></div> : (
                <div className="space-y-3">
                  {(historyEvidence.history || []).map((version, index) => (
                    <div key={version.id || index} className="border border-[var(--border)] rounded-md p-4 bg-[var(--bg-app)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[var(--text-bright)]">Version {version.version ?? index + 1}</span>
                          <Badge tone={version.status === 'verified' ? 'success' : version.status === 'superseded' ? 'danger' : 'neutral'}>{(version.status || 'active').toUpperCase()}</Badge>
                        </div>
                        <span className="text-[10px] text-[var(--text-dim)]">{version.created_at ? new Date(version.created_at).toLocaleString() : '—'}</span>
                      </div>
                      <div className="text-xs text-[var(--text-dim)] mt-1">{version.evidence_type} • {version.id}</div>
                      <div className="mt-3 text-sm text-[var(--text-bright)]">{version.description || '—'}</div>
                      <pre className="mt-2 text-xs text-[var(--text-bright)] whitespace-pre-wrap break-words font-mono bg-[var(--bg-card)] border border-[var(--border)] rounded-md p-3">{version.content || 'No content available.'}</pre>
                      <div className="mt-2 text-[10px] text-[var(--text-dim)] mono break-all">SHA-256: {version.content_hash || '—'}</div>
                      <div className="mt-1 text-[10px] text-[var(--text-dim)] mono">Blockchain block: #{version.block_index ?? '—'}</div>
                    </div>
                  ))}
                  {(!historyEvidence.history || historyEvidence.history.length === 0) && <EmptyState title="No revision history available" />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Network Snapshot */}
      {/* ------------------------------------------------ */}

      <Card>

        <CardHeader
          title="Network Snapshot"
          subtitle="Open the full interactive graph filtered to this case's entities"

          right={
            <Share2
              size={16}
              className="text-[var(--text-dim)]"
            />
          }
        />


        <div className="p-4">

          <Button
            variant="secondary"

            onClick={() =>
              entityLinks[0] &&
              navigate(
                `/network?focus=${entityLinks[0].entity_id}`
              )
            }

            disabled={!entityLinks.length}
          >

            Open Network Explorer

          </Button>

        </div>

      </Card>


      {/* ------------------------------------------------ */}
      {/* Investigator Notes */}
      {/* ------------------------------------------------ */}

      <Card>

        <CardHeader
          title="Investigator Notes"
          subtitle={`${caseData.notes.length} note(s)`}
        />


        <div className="divide-y divide-[var(--border)]">

          {caseData.notes.length === 0 && (

            <div className="p-4">

              <EmptyState
                title="No notes yet"
              />

            </div>

          )}


          {caseData.notes.map((n) => (

            <div
              key={n.id}
              className="px-4 py-3"
            >

              <div className="flex items-center justify-between mb-1">

                <span className="text-xs font-medium text-[var(--text-bright)]">

                  {n.author}

                </span>


                <span className="text-[11px] text-[var(--text-dim)]">

                  {new Date(
                    n.created_at
                  ).toLocaleString()}

                </span>

              </div>


              <p className="text-sm text-[var(--text)] whitespace-pre-wrap">

                {n.text}

              </p>

            </div>

          ))}

        </div>


        <form
          onSubmit={handleAddNote}
          className="p-4 border-t border-[var(--border)] flex gap-2"
        >

          <input
            value={note}

            onChange={(e) =>
              setNote(e.target.value)
            }

            placeholder="Add a finding or note to this case..."

            className="flex-1 bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
          />


          <Button type="submit">

            <Send size={14} />

            Save

          </Button>

        </form>

      </Card>

    </div>

  )

}