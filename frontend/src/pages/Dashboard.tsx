import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type WorkItem } from '../lib/api'
import { SeverityBadge, StatusBadge, Spinner, EmptyState, ErrorBox } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'

function StatCard({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius2)', padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  )
}

export function Dashboard() {
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const navigate = useNavigate()

  const fetch = useCallback(async () => {
    try {
      const res = await api.getWorkItems()
      setItems(res.data)
      setLastRefresh(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch incidents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const t = setInterval(fetch, 5000)
    return () => clearInterval(t)
  }, [fetch])

  const active = items.filter(i => i.status !== 'CLOSED')
  const p0Count = items.filter(i => i.severity === 'P0' && i.status !== 'CLOSED').length
  const closedCount = items.filter(i => i.status === 'CLOSED').length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Live Incident Feed
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            Auto-refreshes every 5s · Last: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <Spinner size={14} />}
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--resolved)',
            boxShadow: '0 0 8px var(--resolved)', display: 'inline-block',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>LIVE</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Active" value={active.length} sub="open incidents" color="var(--text)" />
        <StatCard label="Critical P0" value={p0Count} sub="needs immediate response" color={p0Count > 0 ? 'var(--p0)' : 'var(--text3)'} />
        <StatCard label="Total" value={items.length} sub="all time" />
        <StatCard label="Resolved" value={closedCount} sub="fully closed" color="var(--resolved)" />
      </div>

      {error && <div style={{ marginBottom: 20 }}><ErrorBox message={error} /></div>}

      {/* Table */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius2)', overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 140px 130px 90px 120px',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Severity</span>
          <span>Incident</span>
          <span>Component</span>
          <span>Status</span>
          <span>Signals</span>
          <span>Started</span>
        </div>

        {loading && items.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState message="No incidents found. System is nominal." />
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => navigate(`/incident/${item.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 140px 130px 90px 120px',
                padding: '14px 20px',
                borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.1s',
                alignItems: 'center',
                animation: `slide-up 0.2s ease ${idx * 0.03}s both`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div><SeverityBadge severity={item.severity} /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}
                  className="truncate">{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
                  className="truncate">{item.id.slice(0, 8)}…</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}
                className="truncate">{item.component_id}</div>
              <div><StatusBadge status={item.status} /></div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>
                {item.signal_count.toLocaleString()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                {formatDistanceToNow(new Date(item.start_time), { addSuffix: true })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

