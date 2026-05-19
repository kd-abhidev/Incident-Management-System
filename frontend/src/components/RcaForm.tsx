import { useState } from 'react'
import { api, type RcaSubmission, type WorkItem } from '../lib/api'
import { Button, ErrorBox } from './ui'

const ROOT_CAUSE_CATEGORIES = [
  'INFRASTRUCTURE', 'APPLICATION', 'DATABASE',
  'NETWORK', 'CONFIGURATION', 'THIRD_PARTY', 'UNKNOWN',
]

interface Props {
  workItem: WorkItem
  onSuccess: () => void
}

export function RcaForm({ workItem, onSuccess }: Props) {
  const [form, setForm] = useState<Partial<RcaSubmission>>({
    submitted_by: 'engineer',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof RcaSubmission, value: string) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    if (!form.incident_start || !form.incident_end || !form.root_cause_category ||
      !form.root_cause_detail || !form.fix_applied || !form.prevention_steps) {
      setError('All fields are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.submitRca(workItem.id, form as RcaSubmission)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RCA submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--text)',
    fontSize: 13, outline: 'none', transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, display: 'block',
  }

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius2)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg3)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>◈</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Root Cause Analysis</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            Required before closing this incident
          </div>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Time range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Incident Start</label>
            <input type="datetime-local" style={inputStyle}
              value={form.incident_start?.slice(0, 16) ?? ''}
              onChange={e => set('incident_start', new Date(e.target.value).toISOString())}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label style={labelStyle}>Incident End</label>
            <input type="datetime-local" style={inputStyle}
              value={form.incident_end?.slice(0, 16) ?? ''}
              onChange={e => set('incident_end', new Date(e.target.value).toISOString())}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {/* Category + submitter */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Root Cause Category</label>
            <select style={{ ...inputStyle, appearance: 'none' }}
              value={form.root_cause_category ?? ''}
              onChange={e => set('root_cause_category', e.target.value)}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            >
              <option value="">Select category…</option>
              {ROOT_CAUSE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Submitted By</label>
            <input type="text" style={inputStyle}
              value={form.submitted_by ?? ''}
              onChange={e => set('submitted_by', e.target.value)}
              placeholder="engineer name"
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {/* Root cause detail */}
        <div>
          <label style={labelStyle}>Root Cause Detail</label>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }}
            value={form.root_cause_detail ?? ''}
            onChange={e => set('root_cause_detail', e.target.value)}
            placeholder="Describe what caused this incident in detail…"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Fix applied */}
        <div>
          <label style={labelStyle}>Fix Applied</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            value={form.fix_applied ?? ''}
            onChange={e => set('fix_applied', e.target.value)}
            placeholder="What was done to resolve the incident?"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Prevention steps */}
        <div>
          <label style={labelStyle}>Prevention Steps</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
            value={form.prevention_steps ?? ''}
            onChange={e => set('prevention_steps', e.target.value)}
            placeholder="How will this be prevented from recurring?"
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {error && <ErrorBox message={error} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : '◈ Submit RCA'}
          </Button>
        </div>
      </div>
    </div>
  )
}

