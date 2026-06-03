import { getRedisClient, RedisKeys } from '../config/redis';
import { getPostgresPool } from '../config/postgres';
import { config } from '../config';
import { IncomingSignal } from '../models/signal.model';
import { WorkItemRow } from '../models/workitem.model';
import { v4 as uuidv4 } from 'uuid';

// Maps component_type → severity (Strategy pattern will handle alerts later)
// Defined here so debounce can set the right severity on the work item
const COMPONENT_SEVERITY_MAP: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
  RDBMS: 'P0',
  MCP_HOST: 'P0',
  API: 'P1',
  QUEUE: 'P1',
  NOSQL: 'P2',
  CACHE: 'P2',
};

export interface DebounceResult {
  work_item_id: string;
  is_new: boolean;         // true = new work item was created
  signal_count: number;    // total signals for this work item now
}

/**
 * Core debounce logic:
 *
 * 1. Check Redis for an existing debounce key for this component_id
 * 2. If found → increment signal_count, return existing work_item_id
 * 3. If not found → create new Work Item in Postgres, set Redis key with TTL
 *
 * The Redis key TTL is the "debounce window". All signals within the window
 * that share the same component_id are grouped into the same Work Item.
 */
export async function debounceSignal(
  signal: IncomingSignal
): Promise<DebounceResult> {
  const redis = getRedisClient();
  const pool = getPostgresPool();
  const debounceKey = RedisKeys.debounce(signal.component_id);

  // Atomic check-and-set using Redis SET NX (only set if Not eXists)
  // Returns null if key already exists (debounce window active)
  const existingWorkItemId = await redis.get(debounceKey);

  if (existingWorkItemId) {
    // --- Debounce HIT: signal belongs to existing work item ---
    // Just increment the counter atomically
    const countKey = RedisKeys.signalCount(signal.component_id);
    const newCount = await redis.incr(countKey);

    // Also increment in Postgres (fire and forget — not critical path)
    pool
      .query(
        'UPDATE work_items SET signal_count = signal_count + 1 WHERE id = $1',
        [existingWorkItemId]
      )
      .catch((err) =>
        console.error('[Debounce] Failed to increment signal_count:', err.message)
      );

    return {
      work_item_id: existingWorkItemId,
      is_new: false,
      signal_count: newCount,
    };
  }

  // --- Debounce MISS: create a new Work Item ---
  const workItemId = uuidv4();
  const severity =
    COMPONENT_SEVERITY_MAP[signal.component_type] ?? 'P2';

  const title = `[${severity}] ${signal.component_type} failure on ${signal.component_id}`;

  // Write new Work Item to Postgres (transactional)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query<WorkItemRow>(
      `INSERT INTO work_items
        (id, component_id, title, status, severity, signal_count, start_time)
       VALUES ($1, $2, $3, 'OPEN', $4, 1, NOW())`,
      [workItemId, signal.component_id, title, severity]
    );

    await client.query('COMMIT');
    console.log(
      `[Debounce] New work item created: ${workItemId} for ${signal.component_id}`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Set debounce key in Redis with TTL
  // SETEX = SET + EXPIRE in one atomic command
  await redis.setex(
    debounceKey,
    config.ingestion.debounceWindowSeconds,
    workItemId
  );

  // Also set/reset the signal count key
  const countKey = RedisKeys.signalCount(signal.component_id);
  await redis.setex(
    countKey,
    config.ingestion.debounceWindowSeconds,
    '1'
  );

  return { work_item_id: workItemId, is_new: true, signal_count: 1 };
}

