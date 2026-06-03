import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { SignalJobPayload } from '../models/signal.model';

let signalQueue: Queue<SignalJobPayload> | null = null;

export function getSignalQueue(): Queue<SignalJobPayload> {
  if (!signalQueue) {
    signalQueue = new Queue<SignalJobPayload>(config.bullmq.queueName, {
      connection: getRedisClient(),
      defaultJobOptions: {
        // Retry failed jobs up to 3 times with exponential backoff
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s → 2s → 4s
        },
        // Remove completed jobs after 1 hour (keeps Redis lean)
        removeOnComplete: { age: 3600 },
        // Keep failed jobs for 24h for debugging
        removeOnFail: { age: 86_400 },
      },
    });

    console.log(`[Queue] Signal queue "${config.bullmq.queueName}" ready`);
  }
  return signalQueue;
}

/**
 * Checks if queue is within safe capacity limits.
 * This is our backpressure mechanism.
 */
export async function isQueueHealthy(): Promise<boolean> {
  try {
    const queue = getSignalQueue();
    const counts = await queue.getJobCounts('waiting', 'active');
    const total = (counts.waiting ?? 0) + (counts.active ?? 0);
    return total < config.bullmq.maxQueueSize;
  } catch {
    return false;
  }
}

export async function getQueueDepth(): Promise<number> {
  try {
    const counts = await getSignalQueue().getJobCounts('waiting', 'active', 'delayed');
    return Object.values(counts).reduce((a, b) => a + b, 0);
  } catch {
    return -1;
  }
}

export async function closeQueue(): Promise<void> {
  if (signalQueue) {
    await signalQueue.close();
    signalQueue = null;
  }
}

