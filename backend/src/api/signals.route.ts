import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { IncomingSignalSchema, IncomingSignal, RawSignal } from '../models/signal.model';
import { debounceSignal } from '../ingestion/debounce.service';
import { getSignalQueue, isQueueHealthy } from '../ingestion/queue';
import { incrementReceived, incrementRejected } from '../utils/metrics';

export async function signalRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /signals
   *
   * Accepts an incoming error signal.
   * Does NOT write to DB directly — pushes to BullMQ queue.
   * This is what keeps the system alive during DB slowdowns.
   */
  app.post(
    '/signals',
    async (req: FastifyRequest, reply: FastifyReply) => {
      incrementReceived();

      // 1. Validate the incoming payload
      const parseResult = IncomingSignalSchema.safeParse(req.body);
      if (!parseResult.success) {
        incrementRejected();
        return reply.status(400).send({
          error: 'Invalid signal payload',
          details: parseResult.error.flatten(),
        });
      }

      const signal: IncomingSignal = parseResult.data;

      // 2. Check backpressure — reject if queue is too full
      const queueOk = await isQueueHealthy();
      if (!queueOk) {
        incrementRejected();
        return reply.status(503).send({
          error: 'Service overloaded — signal queue at capacity. Retry later.',
          code: 'BACKPRESSURE',
        });
      }

      // 3. Debounce: find or create a Work Item for this component
      let debounceResult;
      try {
        debounceResult = await debounceSignal(signal);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        req.log.error({ err }, 'Debounce failed');
        return reply.status(500).send({ error: 'Debounce failed', message });
      }

      // 4. Build the raw signal document for MongoDB
      const rawSignal: RawSignal = {
        signal_id: uuidv4(),
        component_id: signal.component_id,
        component_type: signal.component_type,
        signal_type: signal.signal_type,
        severity: signal.severity,
        message: signal.message,
        metadata: signal.metadata,
        occurred_at: signal.occurred_at ? new Date(signal.occurred_at) : new Date(),
        received_at: new Date(),
        work_item_id: debounceResult.work_item_id,
      };

      // 5. Push to BullMQ queue (fast — just Redis LPUSH under the hood)
      await getSignalQueue().add('process-signal', {
        signal_id: rawSignal.signal_id,
        raw_signal: rawSignal,
      });

      // 6. Return immediately — do not wait for DB write
      return reply.status(202).send({
        accepted: true,
        signal_id: rawSignal.signal_id,
        work_item_id: debounceResult.work_item_id,
        is_new_incident: debounceResult.is_new,
        signal_count: debounceResult.signal_count,
      });
    }
  );
}

