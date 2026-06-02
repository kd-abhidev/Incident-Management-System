import { Pool } from 'pg';
import { config } from '../config';

// Single shared connection pool for entire app
// Pool handles reconnection automatically
let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.postgres.url,
      max: 20,              // max connections in pool
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on('error', (err) => {
      console.error('[Postgres] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    const client = await getPostgresPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

export async function closePostgresPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

