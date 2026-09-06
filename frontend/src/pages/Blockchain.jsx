import { useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'

function HashValue({ label, value }) {
    const [revealed, setRevealed] = useState(false)
    const visible = value || '—'
    const masked = visible.length > 14 ? `${visible.slice(0, 8)}...${visible.slice(-6)}` : visible
    return (
        <div>
            <p className="text-xs text-[var(--text-dim)]">{label}</p>
            <button
                type="button"
                onClick={() => setRevealed((current) => !current)}
                className="mt-1 flex max-w-full items-center gap-2 text-left font-mono text-xs text-[var(--text)]"
                title={revealed ? 'Hide hash' : 'Reveal hash'}
            >
                {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                <span className="break-all">{revealed ? visible : masked}</span>
            </button>
        </div>
    )
}

function recordData(block) {
    return block?.data || {}
}

function isEvidence(block) {
    const data = recordData(block)
    return data.record_type === 'evidence' || Boolean(data.evidence_id) || Boolean(data.record_id && data.record_type === 'evidence')
}

export default function Blockchain() {
    const [blocks, setBlocks] = useState([])
    const [isValid, setIsValid] = useState(null)
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState(null)
    const [verifyMessage, setVerifyMessage] = useState('')

    async function loadBlockchain() {
        try {
            setLoading(true)
            setError(null)
            const res = await api.blockchain()
            const data = res.data
            setBlocks(Array.isArray(data) ? data : data.chain || [])
        } catch (err) {
            setError(err?.response?.data?.detail || 'Unable to load audit ledger.')
        } finally {
            setLoading(false)
        }
    }

    async function handleVerify() {
        try {
            setVerifying(true)
            setError(null)
            const res = await api.verifyBlockchain()
            const result = res.data
            const valid = result.valid ?? result.is_valid ?? false
            setIsValid(valid)
            setVerifyMessage(result.message || (valid ? 'Audit chain integrity verified.' : 'Audit chain integrity check failed.'))
        } catch (err) {
            setIsValid(false)
            setError(err?.response?.data?.detail || 'Audit chain verification failed.')
            setVerifyMessage('')
        } finally {
            setVerifying(false)
        }
    }

    useEffect(() => {
        async function initialize() {
            await loadBlockchain()
            await handleVerify()
        }
        initialize()
    }, [])

    if (loading) {
        return <div className="p-6"><h1 className="text-2xl font-bold text-[var(--text-bright)]">Audit Ledger</h1><p className="mt-4 text-sm text-[var(--text-dim)]">Loading audit events...</p></div>
    }

    const evidenceCount = new Set(blocks.filter(isEvidence).map((block) => recordData(block).record_id || recordData(block).evidence_id)).size

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-bright)]">Audit Ledger</h1>
                    <p className="mt-1 text-sm text-[var(--text-dim)]">Tamper-evident investigative activity recorded in the SQLite trust chain.</p>
                </div>
                <button onClick={handleVerify} disabled={verifying} className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    <ShieldCheck size={16} />
                    {verifying ? 'Verifying...' : 'Verify Chain'}
                </button>
            </div>

            {error && <div className="rounded-lg bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">{error}</div>}
            {verifyMessage && <div className={isValid ? 'rounded-lg bg-[var(--success)]/10 p-4 text-sm text-[var(--success)]' : 'rounded-lg bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]'}>{isValid ? '✓ ' : '✕ '}{verifyMessage}</div>}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5"><p className="text-sm text-[var(--text-dim)]">Audit Events</p><p className="mt-2 text-3xl font-bold text-[var(--text-bright)]">{blocks.length}</p></div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5"><p className="text-sm text-[var(--text-dim)]">Chain Status</p><p className="mt-2 text-xl font-bold">{isValid === true ? <span className="text-[var(--success)]">✓ Verified</span> : isValid === false ? <span className="text-[var(--danger)]">✕ Invalid</span> : <span className="text-[var(--text-dim)]">Checking...</span>}</p></div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5"><p className="text-sm text-[var(--text-dim)]">Evidence Records</p><p className="mt-2 text-3xl font-bold text-[var(--text-bright)]">{evidenceCount}</p></div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]">
                <div className="border-b border-[var(--border)] p-5"><h2 className="text-lg font-semibold text-[var(--text-bright)]">Recent Activity</h2></div>
                <div className="divide-y divide-[var(--border)]">
                    {blocks.map((block) => {
                        const data = recordData(block)
                        return (
                            <div key={block.index} className="p-5 hover:bg-[var(--bg-hover)]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="font-semibold text-[var(--text-bright)]">Event #{block.index}</span>
                                            <span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)]">{data.event_type || (block.index === 0 ? 'GENESIS' : 'AUDIT')}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-[var(--text)]">{data.description || 'Recorded investigative activity'}</p>
                                        <p className="mt-2 text-xs text-[var(--text-dim)]">{block.timestamp ? new Date(block.timestamp).toLocaleString() : 'Unknown time'}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                                    <div><p className="text-xs text-[var(--text-dim)]">Actor</p><p className="mt-1 text-[var(--text)]">{data.actor || 'System'}</p></div>
                                    <div><p className="text-xs text-[var(--text-dim)]">Source</p><p className="mt-1 text-[var(--text)]">{data.source || 'System'}</p></div>
                                    <div><p className="text-xs text-[var(--text-dim)]">Record</p><p className="mt-1 text-[var(--text)]">{data.record_type || 'ledger'}{data.record_id ? ` · ${data.record_id}` : ''}</p></div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><HashValue label="Block Hash" value={block.hash} /><HashValue label="Previous Hash" value={block.previous_hash} /></div>
                                <details className="mt-4"><summary className="cursor-pointer text-xs text-[var(--text-dim)]">Show raw technical data</summary><pre className="mt-2 overflow-auto rounded-lg bg-[var(--bg-app)] p-3 text-xs text-[var(--text)]">{JSON.stringify(data, null, 2)}</pre></details>
                            </div>
                        )
                    })}
                    {blocks.length === 0 && <div className="p-10 text-center text-[var(--text-dim)]">No audit records found.</div>}
                </div>
            </div>
        </div>
    )
}
