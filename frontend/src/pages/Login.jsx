import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { Button } from '../components/ui'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('investigator1')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-app)] px-4">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle, #3aa0ff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-[var(--accent)] flex items-center justify-center mb-3">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text-bright)]">NEXUS</h1>
          <p className="text-xs text-[var(--text-dim)] mt-1 text-center">
            AI-Powered Criminal Network Analysis System<br />SIH26189 · Investigator Access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1.5">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-md px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <div className="text-[11px] text-[var(--text-dim)] text-center pt-1 border-t border-[var(--border)]">
            Demo accounts: <span className="mono">investigator1 / password123</span><br />
            or <span className="mono">admin / admin123</span>
          </div>
        </form>
        <p className="text-[11px] text-[var(--text-dim)] text-center mt-4">
          Prototype system · Synthetic data only · Results are investigative leads, not conclusions
        </p>
      </div>
    </div>
  )
}
