import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type WorkItemDetail, type RawSignal } from '../lib/api'
import { SeverityBadge, StatusBadge, Button, Spinner, ErrorBox } from '../components/ui'
import { RcaForm } from '../components/RcaForm'
import { formatDistanceToNow, format } from 'date-fns'

const NEXT_STATUS: Record<string, string | null> = {
  OPEN:          'INVESTIGATING',
  INVESTIGATING: 'RESOLVED',
  RESOLVED:      'CLOSED',
  CLOSED:        null,
}

const STATUS_LABELS: Record<string, string> = {
  INVESTIGATING: '→ Start Investigating',
  RESOLVED:      '→ Mark Resolved',
  CLOSED:        '→ Close Incident',
}

function SignalRow({ signal }: { signal: RawSignal }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'grid', gridTemplateColumns: '90px 120px 1fr 140px',
          padding: '9px 16px', cursor: 'pointer', gap: 12, alignItems: 'center',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: 'var(--text2)' }}>{signal.signal_type}</span>
        <span style={{ color: 'var(--text3)' }}>{signal.component_type}</span>
        <span style={{ color: 'var(--text2)' }} className="truncate">{signal.message}</span>
        <span style={{ color: 'var(--text3)', textAlign: 'right' }}>
          {formatDistanceToNow(new Date(signal.received_at), { addSuffix: true })}
        </span>
      </div>
      {open && (
        <div style={{
          background: 'var(--bg)', padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          color: 'var(--text2)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {JSON.stringify({ ...signal, metadata: signal.metadata }, null, 2)}
        </div>
      )}
    </div>
  )
}

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<WorkItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionError, setTransitionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await api.getWorkItem(id)
      setData(res.data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load incident')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleTransition = async () => {
    if (!data) return
    const next = NEXT_STATUS[data.status]
    if (!next) return
    setTransitioning(true)
    setTransitionError(null)
    try {
      await api.transition(data.id, next)
      await load()
    } catch (e) {
      setTransitionError(e instanceof Error ? e.message : 'Transition failed')
    } finally {
      setTransitioning(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 60 }}>
      <Spinner size={28} />
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 40 }}><ErrorBox message={error ?? 'Incident not found'} /></div>
  )

  const nextStatus = NEXT_STATUS[data.status]
  const canClose = data.status === 'RESOLVED' && data.rca !== null
  const showRcaForm = data.status === 'RESOLVED' && !data.rca

  const mttrHuman = data.mttr_seconds != null
    ? data.mttr_seconds < 60
      ? `${data.mttr_seconds}s`
      : data.mttr_seconds < 3600
      ? `${Math.floor(data.mttr_seconds / 60)}m`
      : `${Math.floor(data.mttr_seconds / 3600)}h ${Math.floor((data.mttr_seconds % 3600) / 60)}m`
    : null

  return (
    <div style={{ padding: '32px 36px', maxWidth: 980, animation: 'slide-up 0.2s ease' }}>
      {/* Back */}
      <button onClick={() => navigate('/')} style={{
        background: 'none', border: 'none', color: 'var(--text3)',
        fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
        marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6,
        letterSpacing: '0.05em',
      }}>
        ← BACK TO FEED
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div style={{ flex: 1, marginRight: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <SeverityBadge severity={data.severity} />
            <StatusBadge status={data.status} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: 8 }}>
            {data.title}
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 20 }}>
            <span>ID: {data.id}</span>
            <span>Component: {data.component_id}</span>
            <span>Started: {format(new Date(data.start_time), 'MMM d, HH:mm:ss')}</span>
          </div>
        </div>

        {/* Transition button */}
        {nextStatus && (
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <Button
              onClick={handleTransition}
              disabled={transitioning || (nextStatus === 'CLOSED' && !canClose)}
              variant={nextStatus === 'CLOSED' ? (canClose ? 'primary' : 'ghost') : 'primary'}
            >
              {transitioning ? <Spinner size={12} /> : null}
              {STATUS_LABELS[nextStatus]}
            </Button>
            {nextStatus === 'CLOSED' && !canClose && (
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
                Submit RCA below first
              </div>
            )}
          </div>
        )}
      </div>

      {transitionError && (
        <div style={{ marginBottom: 20 }}><ErrorBox message={transitionError} /></div>
      )}

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Signals', value: data.signal_count.toLocaleString() },
          { label: 'MTTR', value: mttrHuman ?? '—' },
          { label: 'Resolved', value: data.resolved_time ? format(new Date(data.resolved_time), 'HH:mm:ss') : '—' },
          { label: 'RCA', value: data.rca ? '✓ Filed' : 'Pending' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* RCA — show form if pending, show filed RCA if submitted */}
      {showRcaForm && (
        <div style={{ marginBottom: 28 }}>
          <RcaForm workItem={data} onSuccess={load} />
        </div>
      )}

      {data.rca && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius2)', marginBottom: 28, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            background: 'rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: 'var(--resolved)' }}>◈</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Root Cause Analysis Filed</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
              by {data.rca.submitted_by}
            </span>
          </div>
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Category', value: data.rca.root_cause_category },
              { label: 'MTTR', value: mttrHuman ?? '—' },
              { label: 'Root Cause', value: data.rca.root_cause_detail, full: true },
              { label: 'Fix Applied', value: data.rca.fix_applied, full: true },
              { label: 'Prevention Steps', value: data.rca.prevention_steps, full: true },
            ].map(({ label, value, full }) => (
              <div key={label} style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw signals */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius2)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg3)', display: 'flex', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Raw Signals</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
            {data.signals.length} shown (latest first) · click to expand
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 120px 1fr 140px',
          padding: '8px 16px', borderBottom: '1px solid var(--border)',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)',
          letterSpacing: '0.1em', textTransform: 'uppercase', gap: 12,
        }}>
          <span>Type</span><span>Component</span><span>Message</span><span style={{ textAlign: 'right' }}>Received</span>
        </div>

        {data.signals.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            No signals yet
          </div>
        ) : (
          data.signals.map(s => <SignalRow key={s.signal_id} signal={s} />)
        )}
      </div>
    </div>
  )
}

