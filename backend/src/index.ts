import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { getRedisClient } from './config/redis';
import { signalRoutes } from './api/signals.route';
import { healthRoutes } from './api/health.route';
import { workItemRoutes } from './api/workitems.route';
import { startSignalWorker, stopSignalWorker } from './worker/signal.worker';
import { startMetricsLogger, stopMetricsLogger } from './utils/metrics';
import { closePostgresPool } from './config/postgres';
import { closeMongo } from './config/mongo';
import { closeRedis } from './config/redis';
import { closeQueue } from './ingestion/queue';

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'info' : 'warn',
    },
  });

  // ── Plugins ────────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: true, // Allow all origins (restrict in production)
  });

  // Rate limiting on all routes (tighter limits can be set per-route)
  await app.register(rateLimit, {
    global: true,
    max: config.ingestion.rateLimitPerMin,
    timeWindow: '1 minute',
    redis: getRedisClient() as any, // Use Redis to share limits across instances
    errorResponseBuilder: (_req, context) => ({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      limit: context.max,
      remaining: context.ttl,
    }),
  });

  // ── Routes ─────────────────────────────────────────────────────────────────

  await app.register(healthRoutes);
  await app.register(signalRoutes, { prefix: '/api/v1' });
  await app.register(workItemRoutes, { prefix: '/api/v1' });

  // ── Background services ────────────────────────────────────────────────────

  startSignalWorker();
  startMetricsLogger();

  // ── Graceful shutdown — register BEFORE listen ────────────────────────────

  const shutdown = async (signal: string) => {
    console.log(`\n[IMS] Received ${signal}, shutting down gracefully...`);
    stopMetricsLogger();
    await app.close();
    await stopSignalWorker();
    await closeQueue();
    await closePostgresPool();
    await closeMongo();
    await closeRedis();
    console.log('[IMS] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ── Start listening ────────────────────────────────────────────────────────

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[IMS] Backend running on port ${config.port}`);
}

bootstrap().catch((err) => {
  console.error('[IMS] Fatal startup error:', err);
  process.exit(1);
});
