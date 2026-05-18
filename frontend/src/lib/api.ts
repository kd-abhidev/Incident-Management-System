const BASE = 'http://localhost:3000/api/v1'

export interface WorkItem {
  id: string
  component_id: string
  title: string
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED'
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  signal_count: number
  start_time: string
  resolved_time: string | null
  closed_time: string | null
  mttr_seconds: number | null
  created_at: string
  updated_at: string
}

export interface RawSignal {
  signal_id: string
  component_id: string
  component_type: string
  signal_type: string
  severity: string
  message: string
  metadata: Record<string, unknown>
  occurred_at: string
  received_at: string
  work_item_id: string
}

export interface RcaRecord {
  id: string
  work_item_id: string
  incident_start: string
  incident_end: string
  root_cause_category: string
  root_cause_detail: string
  fix_applied: string
  prevention_steps: string
  submitted_by: string
  created_at: string
}

export interface WorkItemDetail extends WorkItem {
  rca: RcaRecord | null
  signals: RawSignal[]
  signal_count_live: number
}

export interface RcaSubmission {
  incident_start: string
  incident_end: string
  root_cause_category: string
  root_cause_detail: string
  fix_applied: string
  prevention_steps: string
  submitted_by?: string
}

export interface HealthStatus {
  status: 'healthy' | 'degraded'
  timestamp: string
  services: { postgres: string; mongodb: string; redis: string }
  queue: { depth: number }
}

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  getWorkItems: () =>
    request<{ data: WorkItem[]; count: number; source: string }>(`${BASE}/workitems`),

  getWorkItem: (id: string) =>
    request<{ data: WorkItemDetail }>(`${BASE}/workitems/${id}`),

  transition: (id: string, to_status: string) =>
    request<{ data: WorkItem; transition: string; mttr_seconds: number | null }>(
      `${BASE}/workitems/${id}/transition`,
      { method: 'PATCH', body: JSON.stringify({ to_status }) }
    ),

  submitRca: (id: string, rca: RcaSubmission) =>
    request<{ data: RcaRecord; mttr_seconds: number; mttr_human: string; message: string }>(
      `${BASE}/workitems/${id}/rca`,
      { method: 'POST', body: JSON.stringify(rca) }
    ),

  health: () => request<HealthStatus>('http://localhost:3000/health'),
}

