import { config } from '../config';
import { getQueueDepth } from '../ingestion/queue';

// Simple in-memory counters — reset every interval
let signalsReceivedThisWindow = 0;
let signalsProcessedThisWindow = 0;
let signalsRejectedThisWindow = 0;

// Totals since process started
let totalReceived = 0;
let totalProcessed = 0;

let metricsTimer: NodeJS.Timeout | null = null;

export function incrementReceived(): void {
  signalsReceivedThisWindow++;
  totalReceived++;
}

export function incrementProcessed(): void {
  signalsProcessedThisWindow++;
  totalProcessed++;
}

export function incrementRejected(): void {
  signalsRejectedThisWindow++;
}

export function startMetricsLogger(): void {
  if (metricsTimer) return;

  metricsTimer = setInterval(async () => {
    const windowSecs = config.observability.metricsIntervalMs / 1000;
    const receivedPerSec = (signalsReceivedThisWindow / windowSecs).toFixed(1);
    const processedPerSec = (signalsProcessedThisWindow / windowSecs).toFixed(1);
    const queueDepth = await getQueueDepth();

    console.log(
      `[Metrics] ` +
      `Received: ${receivedPerSec}/s | ` +
      `Processed: ${processedPerSec}/s | ` +
      `Rejected: ${signalsRejectedThisWindow} | ` +
      `Queue depth: ${queueDepth} | ` +
      `Total received: ${totalReceived} | ` +
      `Total processed: ${totalProcessed}`
    );

    // Reset window counters
    signalsReceivedThisWindow = 0;
    signalsProcessedThisWindow = 0;
    signalsRejectedThisWindow = 0;
  }, config.observability.metricsIntervalMs);

  console.log(
    `[Metrics] Throughput logging every ${config.observability.metricsIntervalMs / 1000}s`
  );
}

export function stopMetricsLogger(): void {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

