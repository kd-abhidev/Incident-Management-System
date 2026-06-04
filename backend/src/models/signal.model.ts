import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ComponentType = z.enum([
  'RDBMS',
  'NOSQL',
  'CACHE',
  'API',
  'QUEUE',
  'MCP_HOST',
]);

export const SeverityLevel = z.enum(['P0', 'P1', 'P2', 'P3']);

export const SignalType = z.enum([
  'ERROR',
  'LATENCY_SPIKE',
  'TIMEOUT',
  'CONNECTION_REFUSED',
  'OOM',
  'DISK_FULL',
  'CPU_SPIKE',
  'HEALTH_CHECK_FAIL',
]);

// ── Zod Schema for incoming signal (validates API input) ──────────────────────

export const IncomingSignalSchema = z.object({
  component_id: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Z0-9_]+$/, 'component_id must be uppercase letters, numbers and underscores'),

  component_type: ComponentType,
  signal_type: SignalType,
  severity: SeverityLevel,

  message: z.string().min(1).max(2000),

  // Optional metadata bag — anything the caller wants to attach
  metadata: z.record(z.unknown()).optional().default({}),

  // Allow caller to set the time (for replaying historical events)
  occurred_at: z.string().datetime().optional(),
});

export type IncomingSignal = z.infer<typeof IncomingSignalSchema>;

// ── MongoDB document: raw signal as stored ────────────────────────────────────

export interface RawSignal {
  _id?: string;
  signal_id: string;           // uuid
  component_id: string;
  component_type: string;
  signal_type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  occurred_at: Date;
  received_at: Date;           // when IMS received it
  work_item_id: string | null; // null until debounce logic assigns one
}

// ── BullMQ job payload: what gets pushed onto the queue ───────────────────────

export interface SignalJobPayload {
  signal_id: string;
  raw_signal: RawSignal;
}

