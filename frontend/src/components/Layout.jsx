import { useState, useRef, useEffect, useCallback } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
LayoutDashboard, Share2, Bell, Briefcase, UploadCloud, Search, LogOut,
ShieldCheck, ChevronDown, X, User, Building2, Landmark, Car, MapPin, Phone,
Blocks
} from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useCase } from '../CaseContext'
import { api } from '../api/client'
import { TypeBadge } from './ui'


const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/network', label: 'Network Explorer', icon: Share2 },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/cases', label: 'Cases', icon: Briefcase },
  { to: '/import', label: 'Data Import', icon: UploadCloud },
  { to: '/blockchain', label: 'Blockchain Ledger', icon: Blocks },
]



const TYPE_ICON = { Person: User, Organization: Building2, Account: Landmark, Vehicle: Car, Location: MapPin, Phone: Phone }

export default function Layout() {
  const { user, logout } = useAuth()
  const { activeCaseId, activeCase, cases, setActiveCaseId, refreshCases } = useCase()
  const navigate = useNavigate()
  const [caseMenuOpen, setCaseMenuOpen] = useState(false)

  useEffect(() => { refreshCases() }, [refreshCases])

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-app)] text-[var(--text)] overflow-hidden">
      <aside className="w-60 shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-panel)]">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-[var(--border)]">
          <div className="w-7 h-7 rounded bg-[var(--accent)] flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-bright)] leading-tight">NEXUS</div>
            <div className="text-[10px] text-[var(--text-dim)] leading-tight">SIH26189 · Demo</div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-bright)] hover:bg-[var(--bg-hover)]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-[var(--border)] relative">
          <button
            onClick={() => setCaseMenuOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-panel-2)] border border-[var(--border-light)]"
          >
            <div className="text-left overflow-hidden">
              <div className="text-[var(--text-dim)]">Active Case</div>
              <div className="text-[var(--text-bright)] font-medium truncate">
                {activeCase ? activeCase.title : 'None selected'}
              </div>
            </div>
            <ChevronDown size={14} className="shrink-0 text-[var(--text-dim)]" />
          </button>
          {caseMenuOpen && (
            <div className="absolute bottom-full mb-1 left-2 right-2 bg-[var(--bg-panel-2)] border border-[var(--border-light)] rounded-md shadow-xl max-h-56 overflow-y-auto z-30">
              {activeCaseId && (
                <button
                  className="w-full text-left px-3 py-2 text-xs text-[var(--text-dim)] hover:bg-[var(--bg-hover)]"
                  onClick={() => { setActiveCaseId(null); setCaseMenuOpen(false) }}
                >
                  Clear active case
                </button>
              )}
              {cases.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] flex flex-col"
                  onClick={() => { setActiveCaseId(c.id); setCaseMenuOpen(false); navigate(`/cases/${c.id}`) }}
                >
                  <span className="text-[var(--text-bright)] font-medium truncate">{c.title}</span>
                  <span className="text-[var(--text-dim)]">{c.id} · {c.status}</span>
                </button>
              ))}
              <button
                className="w-full text-left px-3 py-2 text-xs text-[var(--accent)] hover:bg-[var(--bg-hover)] border-t border-[var(--border)]"
                onClick={() => { setCaseMenuOpen(false); navigate('/cases') }}
              >
                + Manage cases
              </button>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[var(--border)] flex items-center justify-between">
          <div className="overflow-hidden">
            <div className="text-xs font-medium text-[var(--text-bright)] truncate">{user?.full_name}</div>
            <div className="text-[10px] text-[var(--text-dim)] truncate">{user?.role} · {user?.badge_id}</div>
          </div>
          <button onClick={logout} className="text-[var(--text-dim)] hover:text-[var(--danger)] shrink-0" title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function TopBar() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const navigate = useNavigate()
  const timerRef = useRef(null)

  const runSearch = useCallback((query) => {
    if (!query.trim()) { setResults(null); return }
    api.search(query).then((res) => setResults(res.data))
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runSearch(q), 200)
    return () => clearTimeout(timerRef.current)
  }, [q, runSearch])

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-4 gap-4 bg-[var(--bg-panel)]">
      <div className="relative flex-1 max-w-xl" ref={boxRef}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search people, phone numbers, accounts, vehicles, locations, case IDs..."
          className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md pl-9 pr-8 py-1.5 text-sm text-[var(--text-bright)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
        />
        {q && (
          <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" onClick={() => { setQ(''); setResults(null) }}>
            <X size={14} />
          </button>
        )}
        {open && results && (results.entities.length > 0 || results.cases.length > 0) && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-panel-2)] border border-[var(--border-light)] rounded-md shadow-xl max-h-96 overflow-y-auto z-40">
            {results.entities.map((e) => {
              const Icon = TYPE_ICON[e.type] || User
              return (
                <button
                  key={e.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] text-left"
                  onClick={() => { navigate(`/entities/${e.id}`); setOpen(false); setQ('') }}
                >
                  <Icon size={14} className="text-[var(--text-dim)] shrink-0" />
                  <span className="text-sm text-[var(--text-bright)] flex-1 truncate">{e.name}</span>
                  <TypeBadge type={e.type} />
                </button>
              )
            })}
            {results.cases.map((c) => (
              <button
                key={c.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] text-left border-t border-[var(--border)]"
                onClick={() => { navigate(`/cases/${c.id}`); setOpen(false); setQ('') }}
              >
                <Briefcase size={14} className="text-[var(--text-dim)] shrink-0" />
                <span className="text-sm text-[var(--text-bright)] flex-1 truncate">{c.title}</span>
                <span className="text-[10px] text-[var(--text-dim)] mono">{c.id}</span>
              </button>
            ))}
          </div>
        )}
        {open && results && results.entities.length === 0 && results.cases.length === 0 && q && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-panel-2)] border border-[var(--border-light)] rounded-md shadow-xl px-3 py-3 text-xs text-[var(--text-dim)] z-40">
            No matches for "{q}"
          </div>
        )}
      </div>
      <div className="text-[11px] text-[var(--text-dim)]">Synthetic / demo data only, for authorized training use</div>
    </header>
  )
}
