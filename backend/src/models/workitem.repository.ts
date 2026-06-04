/**
 * WorkItem Repository
 *
 * All SQL queries for work_items and rca_records live here.
 * Route handlers never write raw SQL — they call this.
 * Makes testing and swapping DB easy.
 */

import { PoolClient } from 'pg';
import { getPostgresPool } from '../config/postgres';
import { getSignalsCollection } from '../config/mongo';
import { getRedisClient, RedisKeys } from '../config/redis';
import {
  WorkItemRow,
  RcaRow,
  RcaSubmission,
  WorkItemStatusType,
} from '../models/workitem.model';

// ── Read ──────────────────────────────────────────────────────────────────────

export async function findAllWorkItems(): Promise<WorkItemRow[]> {
  const pool = getPostgresPool();
  const result = await pool.query<WorkItemRow>(
    `SELECT * FROM work_items
     ORDER BY
       CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
       created_at DESC`
  );
  return result.rows;
}

export async function findWorkItemById(id: string): Promise<WorkItemRow | null> {
  const pool = getPostgresPool();
  const result = await pool.query<WorkItemRow>(
    'SELECT * FROM work_items WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findRcaByWorkItemId(workItemId: string): Promise<RcaRow | null> {
  const pool = getPostgresPool();
  const result = await pool.query<RcaRow>(
    'SELECT * FROM rca_records WHERE work_item_id = $1',
    [workItemId]
  );
  return result.rows[0] ?? null;
}

/**
 * Fetch raw signals from MongoDB for a given work item.
 * This is the "data lake" query — can be large.
 */
export async function findSignalsByWorkItemId(
  workItemId: string,
  limit = 200
): Promise<unknown[]> {
  const collection = await getSignalsCollection();
  return collection
    .find({ work_item_id: workItemId })
    .sort({ received_at: -1 })
    .limit(limit)
    .toArray();
}

// ── Update: State Transition ──────────────────────────────────────────────────

export interface TransitionUpdate {
  newStatus: WorkItemStatusType;
  resolvedTime?: Date;
  closedTime?: Date;
  mttrSeconds?: number;
}

export async function updateWorkItemStatus(
  id: string,
  update: TransitionUpdate,
  client?: PoolClient
): Promise<WorkItemRow> {
  const pool = getPostgresPool();
  const conn = client ?? pool;

  const result = await conn.query<WorkItemRow>(
    `UPDATE work_items SET
       status        = $1,
       resolved_time = COALESCE($2, resolved_time),
       closed_time   = COALESCE($3, closed_time),
       mttr_seconds  = COALESCE($4, mttr_seconds),
       updated_at    = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      update.newStatus,
      update.resolvedTime ?? null,
      update.closedTime ?? null,
      update.mttrSeconds ?? null,
      id,
    ]
  );

  const updated = result.rows[0];
  if (!updated) throw new Error(`Work item ${id} not found`);

  // Invalidate dashboard cache so next UI refresh gets fresh data
  await invalidateDashboardCache();

  return updated;
}

// ── Write: RCA ────────────────────────────────────────────────────────────────

export async function createRca(
  workItemId: string,
  rca: RcaSubmission
): Promise<RcaRow> {
  const pool = getPostgresPool();

  // Use ON CONFLICT to allow re-submission (upsert)
  const result = await pool.query<RcaRow>(
    `INSERT INTO rca_records
       (work_item_id, incident_start, incident_end, root_cause_category,
        root_cause_detail, fix_applied, prevention_steps, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (work_item_id) DO UPDATE SET
       incident_start      = EXCLUDED.incident_start,
       incident_end        = EXCLUDED.incident_end,
       root_cause_category = EXCLUDED.root_cause_category,
       root_cause_detail   = EXCLUDED.root_cause_detail,
       fix_applied         = EXCLUDED.fix_applied,
       prevention_steps    = EXCLUDED.prevention_steps,
       submitted_by        = EXCLUDED.submitted_by
     RETURNING *`,
    [
      workItemId,
      rca.incident_start,
      rca.incident_end,
      rca.root_cause_category,
      rca.root_cause_detail,
      rca.fix_applied,
      rca.prevention_steps,
      rca.submitted_by,
    ]
  );

  return result.rows[0];
}

// ── MTTR Calculation ──────────────────────────────────────────────────────────

/**
 * MTTR = time from first signal (start_time) to RCA submission (incident_end)
 * Unit: seconds
 */
export function calculateMttr(startTime: Date, endTime: Date): number {
  return Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
}

// ── Dashboard Cache ───────────────────────────────────────────────────────────

/**
 * Rebuild and cache the dashboard state in Redis.
 * Called after every state transition so the UI always gets fresh data fast.
 */
export async function rebuildDashboardCache(): Promise<void> {
  const workItems = await findAllWorkItems();
  const redis = getRedisClient();
  await redis.set(
    RedisKeys.dashboardState(),
    JSON.stringify(workItems),
    'EX',
    30  // expire after 30s as a safety net
  );
}

export async function getDashboardFromCache(): Promise<WorkItemRow[] | null> {
  const redis = getRedisClient();
  const cached = await redis.get(RedisKeys.dashboardState());
  if (!cached) return null;
  return JSON.parse(cached) as WorkItemRow[];
}

async function invalidateDashboardCache(): Promise<void> {
  const redis = getRedisClient();
  await redis.del(RedisKeys.dashboardState());
}

