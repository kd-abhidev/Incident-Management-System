import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { getSignalsCollection } from '../config/mongo';
import { config } from '../config';
import { SignalJobPayload } from '../models/signal.model';
import { incrementProcessed } from '../utils/metrics';

let worker: Worker<SignalJobPayload> | null = null;

/**
 * The signal processing worker.
 *
 * Runs in the background, reads from BullMQ, and persists signals to MongoDB.
 * This is intentionally separate from the HTTP layer — it runs at its own pace
 * without blocking the ingestion API.
 *
 * Retry logic is configured in the Queue (3 attempts, exponential backoff).
 */
export function startSignalWorker(): void {
  if (worker) return;

  worker = new Worker<SignalJobPayload>(
    config.bullmq.queueName,
    async (job: Job<SignalJobPayload>) => {
      const { raw_signal } = job.data;

      // Persist raw signal to MongoDB (the audit log / data lake)
      const collection = await getSignalsCollection();
      await collection.insertOne({
        ...raw_signal,
        // Ensure dates are proper Date objects (BullMQ serialises to JSON)
        occurred_at: new Date(raw_signal.occurred_at),
        received_at: new Date(raw_signal.received_at),
      });

      incrementProcessed();
    },
    {
      connection: getRedisClient(),
      // Process up to 50 jobs concurrently
      // Tune this based on MongoDB write capacity
      concurrency: 50,
    }
  );

  worker.on('completed', (job) => {
    // Only log occasionally to avoid log spam at high volume
    if (Math.random() < 0.01) {
      console.log(`[Worker] Processed job ${job.id}`);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      err.message
    );
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log('[Worker] Signal processing worker started');
}

export async function stopSignalWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

