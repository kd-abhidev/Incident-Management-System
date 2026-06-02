import Redis from 'ioredis';
import { config } from '../config';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
      enableOfflineQueue: true, // queue commands if disconnected, replay on reconnect
    });

    redisClient.on('connect', () => console.log('[Redis] Connected'));
    redisClient.on('error', (err) =>
      console.error('[Redis] Error:', err.message)
    );
    redisClient.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
  }
  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await getRedisClient().ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// Redis key helpers — centralise key naming to avoid typos
export const RedisKeys = {
  // Debounce key: tracks if a work item exists for a component in the last N seconds
  debounce: (componentId: string) => `debounce:${componentId}`,

  // Dashboard cache: stores list of active incidents as JSON
  dashboardState: () => 'dashboard:state',

  // Per-component signal count (for dashboard badge)
  signalCount: (componentId: string) => `signals:count:${componentId}`,
} as const;

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

