import { FastifyInstance } from 'fastify';
import { checkPostgresHealth } from '../config/postgres';
import { checkMongoHealth } from '../config/mongo';
import { checkRedisHealth } from '../config/redis';
import { getQueueDepth } from '../ingestion/queue';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    const [postgres, mongo, redis, queueDepth] = await Promise.all([
      checkPostgresHealth(),
      checkMongoHealth(),
      checkRedisHealth(),
      getQueueDepth(),
    ]);

    const allHealthy = postgres && mongo && redis;

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        postgres: postgres ? 'up' : 'down',
        mongodb: mongo ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
      queue: {
        depth: queueDepth,
      },
    });
  });
}

