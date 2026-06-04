import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const WorkItemStatus = z.enum([
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED',
]);

export const RootCauseCategory = z.enum([
  'INFRASTRUCTURE',
  'APPLICATION',
  'DATABASE',
  'NETWORK',
  'CONFIGURATION',
  'THIRD_PARTY',
  'UNKNOWN',
]);

export type WorkItemStatusType = z.infer<typeof WorkItemStatus>;
export type RootCauseCategoryType = z.infer<typeof RootCauseCategory>;

// ── PostgreSQL row types ──────────────────────────────────────────────────────

export interface WorkItemRow {
  id: string;
  component_id: string;
  title: string;
  status: WorkItemStatusType;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  signal_count: number;
  start_time: Date;
  resolved_time: Date | null;
  closed_time: Date | null;
  mttr_seconds: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface RcaRow {
  id: string;
  work_item_id: string;
  incident_start: Date;
  incident_end: Date;
  root_cause_category: RootCauseCategoryType;
  root_cause_detail: string;
  fix_applied: string;
  prevention_steps: string;
  submitted_by: string;
  created_at: Date;
}

// ── Zod Schema for RCA submission ─────────────────────────────────────────────

export const RcaSubmissionSchema = z.object({
  incident_start: z.string().datetime(),
  incident_end: z.string().datetime(),
  root_cause_category: RootCauseCategory,
  root_cause_detail: z.string().min(10, 'Must be at least 10 characters'),
  fix_applied: z.string().min(10, 'Must be at least 10 characters'),
  prevention_steps: z.string().min(10, 'Must be at least 10 characters'),
  submitted_by: z.string().min(1).optional().default('engineer'),
});

export type RcaSubmission = z.infer<typeof RcaSubmissionSchema>;

// ── Zod Schema for state transition ──────────────────────────────────────────

export const TransitionSchema = z.object({
  to_status: WorkItemStatus,
});

export type TransitionRequest = z.infer<typeof TransitionSchema>;

// ── Valid state transitions map ───────────────────────────────────────────────
// Key = current state, Value = allowed next states

export const VALID_TRANSITIONS: Record<WorkItemStatusType, WorkItemStatusType[]> = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [], // terminal state
};

