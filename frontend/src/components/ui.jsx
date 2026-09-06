import { scoreColor, scoreLabel, ENTITY_COLORS } from '../theme'

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
      <div>
        <div className="text-sm font-semibold text-[var(--text-bright)]">{title}</div>
        {subtitle && <div className="text-xs text-[var(--text-dim)] mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, accent = 'var(--accent)', hint }) {
  return (
    <Card className="p-4 flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide text-[var(--text-dim)]">{label}</div>
        <div className="text-2xl font-semibold text-[var(--text-bright)] mt-1">{value}</div>
        {hint && <div className="text-xs text-[var(--text-dim)] mt-1">{hint}</div>}
      </div>
      {Icon && (
        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
             style={{ background: `${accent}22`, color: accent }}>
          <Icon size={18} />
        </div>
      )}
    </Card>
  )
}

export function ScorePill({ score, size = 'md' }) {
  const color = scoreColor(score)
  const label = scoreLabel(score)
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad}`}
      style={{ background: `${color}1f`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {Math.round(score)} · {label}
    </span>
  )
}

export function TypeBadge({ type }) {
  const color = ENTITY_COLORS[type] || '#7c8798'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ background: `${color}22`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {type}
    </span>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-[var(--bg-hover)] text-[var(--text-dim)]',
    accent: 'bg-[var(--accent)]/15 text-[var(--accent)]',
    success: 'bg-[var(--success)]/15 text-[var(--success)]',
    warning: 'bg-[var(--warning)]/15 text-[var(--warning)]',
    danger: 'bg-[var(--danger)]/15 text-[var(--danger)]',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${tones[tone]}`}>{children}</span>
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:brightness-110',
    secondary: 'bg-[var(--bg-hover)] text-[var(--text-bright)] border border-[var(--border-light)] hover:border-[var(--accent)]',
    ghost: 'text-[var(--text-dim)] hover:text-[var(--text-bright)] hover:bg-[var(--bg-hover)]',
    danger: 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-dim)]">
      {Icon && <Icon size={32} className="mb-3 opacity-50" />}
      <div className="text-sm font-medium text-[var(--text)]">{title}</div>
      {subtitle && <div className="text-xs mt-1 max-w-xs">{subtitle}</div>}
    </div>
  )
}

export function Spinner({ size = 20 }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-[var(--border-light)]"
      style={{ width: size, height: size, borderTopColor: 'var(--accent)' }}
    />
  )
}

export function ExplainList({ reasons = [] }) {
  return (
    <ul className="space-y-1.5">
      {reasons.map((r, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-[var(--text)]">
          <span className="text-[var(--success)] mt-0.5">✓</span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  )
}
