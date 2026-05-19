import { type ReactNode } from 'react'

// ── Severity Badge ────────────────────────────────────────────────────────────

const SEV_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  P0: { color: 'var(--p0)', bg: 'var(--p0-bg)', border: 'var(--p0-border)' },
  P1: { color: 'var(--p1)', bg: 'var(--p1-bg)', border: 'var(--p1-border)' },
  P2: { color: 'var(--p2)', bg: 'var(--p2-bg)', border: 'var(--p2-border)' },
  P3: { color: 'var(--p3)', bg: 'var(--p3-bg)', border: 'var(--p3-border)' },
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = SEV_STYLES[severity] ?? SEV_STYLES.P3
  return (
    <span style={{
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 11,
      fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {severity === 'P0' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color,
          animation: 'pulse-dot 1.2s ease-in-out infinite', display: 'inline-block' }} />
      )}
      {severity}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN:          'var(--open)',
  INVESTIGATING: 'var(--investigating)',
  RESOLVED:      'var(--resolved)',
  CLOSED:        'var(--closed)',
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'var(--text2)'
  return (
    <span style={{
      color, background: `${color}15`, border: `1px solid ${color}40`,
      padding: '2px 10px', borderRadius: 20, fontSize: 11,
      fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  style?: React.CSSProperties
}

export function Button({
  children, onClick, variant = 'primary', disabled, size = 'md', type = 'button', style
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid', borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-sans)', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s ease',
    padding: size === 'sm' ? '5px 12px' : '8px 18px',
    fontSize: size === 'sm' ? 12 : 13,
  }
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
    ghost:   { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text2)' },
    danger:  { background: 'transparent', borderColor: 'var(--p0-border)', color: 'var(--p0)' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...styles[variant], ...style }}>
      {children}
    </button>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--border2)`,
      borderTopColor: 'var(--accent)',
      display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{message}</div>
    </div>
  )
}

// ── Error Box ─────────────────────────────────────────────────────────────────

export function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      background: 'var(--p0-bg)', border: '1px solid var(--p0-border)',
      borderRadius: 'var(--radius2)', padding: '12px 16px',
      color: 'var(--p0)', fontFamily: 'var(--font-mono)', fontSize: 12,
    }}>
      ✕ {message}
    </div>
  )
}

