import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase, X, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useCase } from '../CaseContext'
import { Card, Button, Badge, EmptyState, Spinner } from '../components/ui'

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' }

export default function Cases() {
  const navigate = useNavigate()
  const { setActiveCaseId, activeCaseId, refreshCases } = useCase()

  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')

  const [deletingId, setDeletingId] = useState(null)

  async function load() {
    try {
      setLoading(true)

      const res = await api.cases()
      setCases(res.data.cases)
    } catch (err) {
      console.error('Failed to load cases:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()

    if (!title.trim()) return

    try {
      const res = await api.createCase({
        title,
        description,
        priority,
      })

      await load()
      await refreshCases()

      setShowForm(false)
      setTitle('')
      setDescription('')
      setPriority('medium')

      navigate(`/cases/${res.data.id}`)
    } catch (err) {
      console.error('Failed to create case:', err)
      alert(
        err?.response?.data?.detail ||
        'Failed to create case.'
      )
    }
  }

  async function handleDelete(e, caseId, caseTitle) {
  e.stopPropagation()

  const confirmed = window.confirm(
    `Are you sure you want to delete "${caseTitle}"?\n\n` +
    `This will remove the case, its notes, linked entities, and ` +
    `database evidence records.\n\n` +
    `Blockchain audit records will NOT be deleted.`
  )

  if (!confirmed) return

  try {
    setDeletingId(caseId)

    await api.deleteCase(caseId)

    // If this was the active case, clear it
    if (activeCaseId === caseId) {
      setActiveCaseId(null)
    }

    await load()
    await refreshCases()

    // If we were viewing this case, return to case list
    if (window.location.pathname === `/cases/${caseId}`) {
      navigate('/cases')
    }

  } catch (err) {
    console.error('Failed to delete case:', err)

    const detail = err?.response?.data?.detail

    let message = 'Failed to delete case.'

    if (typeof detail === 'string') {
      message = detail
    } else if (detail) {
      message = JSON.stringify(detail, null, 2)
    } else if (err?.message) {
      message = err.message
    }

    alert(message)

  } finally {
    setDeletingId(null)
  }
}

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-bright)]">
            Case Investigation
          </h1>

          <p className="text-xs text-[var(--text-dim)] mt-1">
            Open or create a case to associate entities,
            relationships, alerts, and notes.
          </p>
        </div>

        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            <X size={14} />
          ) : (
            <Plus size={14} />
          )}

          {showForm ? 'Cancel' : 'New case'}
        </Button>
      </div>


      {/* =====================================================
          CREATE CASE FORM
      ===================================================== */}

      {showForm && (
        <Card className="p-4">

          <form
            onSubmit={handleCreate}
            className="space-y-3"
          >

            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Case title
              </label>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
              />
            </div>


            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
              />
            </div>


            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Priority
              </label>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none"
              >
                <option value="low">
                  Low
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="high">
                  High
                </option>
              </select>
            </div>


            <Button type="submit">
              Create case
            </Button>

          </form>

        </Card>
      )}


      {/* =====================================================
          CASE LIST
      ===================================================== */}

      {loading ? (

        <div className="flex items-center justify-center py-20">
          <Spinner size={26} />
        </div>

      ) : cases.length === 0 ? (

        <EmptyState
          icon={Briefcase}
          title="No cases yet"
          subtitle="Create a case to begin an investigation."
        />

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {cases.map((c) => (

            <Card
              key={c.id}
              className={`
                p-4 cursor-pointer
                hover:border-[var(--accent)]
                transition-colors
                ${activeCaseId === c.id
                  ? 'border-[var(--accent)]'
                  : ''}
              `}
              onClick={() =>
                navigate(`/cases/${c.id}`)
              }
            >

              {/* =================================================
                  CASE HEADER
              ================================================= */}

              <div className="flex items-start justify-between mb-2">

                <div className="text-sm font-semibold text-[var(--text-bright)]">
                  {c.title}
                </div>

                <Badge tone={PRIORITY_TONE[c.priority]}>
                  {c.priority}
                </Badge>

              </div>


              {/* =================================================
                  DESCRIPTION
              ================================================= */}

              <p className="text-xs text-[var(--text-dim)] line-clamp-2 mb-3">
                {c.description ||
                  'No description provided.'}
              </p>


              {/* =================================================
                  CASE INFO
              ================================================= */}

              <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">

                <span className="mono">
                  {c.id}
                </span>

                <span>
                  {c.linked_entities.length} linked ·{' '}
                  {c.notes.length} notes
                </span>

              </div>


              {/* =================================================
                  ACTIVE CASE BUTTON
              ================================================= */}

              <Button
                variant={
                  activeCaseId === c.id
                    ? 'secondary'
                    : 'ghost'
                }
                className="w-full mt-3"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveCaseId(c.id)
                }}
              >
                {activeCaseId === c.id
                  ? 'Active case'
                  : 'Set as active case'}
              </Button>


              {/* =================================================
                  DELETE BUTTON
              ================================================= */}

              <Button
                variant="ghost"
                className="w-full mt-2 text-[var(--danger)] hover:text-[var(--danger)] hover:border-[var(--danger)]"
                disabled={deletingId === c.id}
                onClick={(e) =>
                  handleDelete(
                    e,
                    c.id,
                    c.title
                  )
                }
              >

                <Trash2 size={14} />

                {deletingId === c.id
                  ? 'Deleting...'
                  : 'Delete case'}

              </Button>

            </Card>

          ))}

        </div>

      )}

    </div>
  )
}
