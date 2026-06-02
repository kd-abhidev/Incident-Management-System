// Central config - reads from environment variables
// All defaults are for local dev (outside Docker)

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  postgres: {
    url:
      process.env.POSTGRES_URL ??
      'postgresql://ims_user:ims_pass@localhost:5432/ims_db',
  },

  mongo: {
    url:
      process.env.MONGO_URL ??
      'mongodb://ims_user:ims_pass@localhost:27017/ims_db?authSource=admin',
    dbName: 'ims_db',
    signalsCollection: 'raw_signals',
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  ingestion: {
    // How many signals from same component within window = 1 work item
    debounceWindowSeconds: parseInt(
      process.env.DEBOUNCE_WINDOW_SECONDS ?? '10',
      10
    ),
    debounceThreshold: parseInt(process.env.DEBOUNCE_THRESHOLD ?? '100', 10),

    // Rate limit: requests per minute on POST /signals
    rateLimitPerMin: parseInt(
      process.env.SIGNAL_RATE_LIMIT_PER_MIN ?? '60000',
      10
    ),
  },

  bullmq: {
    queueName: 'signal-processing',
    // Max jobs waiting in queue before we reject new ones (backpressure)
    maxQueueSize: 100_000,
  },

  observability: {
    // Print throughput metrics to console every N ms
    metricsIntervalMs: 5000,
  },
} as const;

