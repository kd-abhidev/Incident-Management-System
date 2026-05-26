import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  findAllWorkItems,
  findWorkItemById,
  findRcaByWorkItemId,
  findSignalsByWorkItemId,
  updateWorkItemStatus,
  createRca,
  calculateMttr,
  getDashboardFromCache,
  rebuildDashboardCache,
} from '../models/workitem.repository';
import {
  RcaSubmissionSchema,
  TransitionSchema,
  WorkItemStatusType,
} from '../models/workitem.model';
import { WorkItemContext, StateTransitionError } from '../workflow/workitem.state';
import { AlertContext } from '../workflow/alert.strategy';

export async function workItemRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /workitems ─────────────────────────────────────────────────────────
  // Returns all work items sorted by severity. Served from Redis cache.

  app.get('/workitems', async (_req: FastifyRequest, reply: FastifyReply) => {
    // Try cache first (avoids hitting Postgres on every dashboard refresh)
    let workItems = await getDashboardFromCache();
    let source = 'cache';

    if (!workItems) {
      workItems = await findAllWorkItems();
      source = 'db';
      // Rebuild cache for next request
      rebuildDashboardCache().catch((e) =>
        console.error('[Cache] Dashboard cache rebuild failed:', e.message)
      );
    }

    return reply.send({ data: workItems, source, count: workItems.length });
  });

  // ── GET /workitems/:id ─────────────────────────────────────────────────────
  // Returns work item detail + its raw signals from MongoDB + RCA if exists

  app.get(
    '/workitems/:id',
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = req.params;

      const [workItem, rca, signals] = await Promise.all([
        findWorkItemById(id),
        findRcaByWorkItemId(id),
        findSignalsByWorkItemId(id),
      ]);

      if (!workItem) {
        return reply.status(404).send({ error: 'Work item not found', id });
      }

      return reply.send({
        data: {
          ...workItem,
          rca: rca ?? null,
          signals,
          signal_count_live: signals.length,
        },
      });
    }
  );

  // ── PATCH /workitems/:id/transition ────────────────────────────────────────
  // Moves a work item through its lifecycle. Enforces valid transitions.

  app.patch(
    '/workitems/:id/transition',
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = req.params;

      // Validate request body
      const parseResult = TransitionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid transition request',
          details: parseResult.error.flatten(),
        });
      }

      const { to_status } = parseResult.data;

      // Load current work item
      const workItem = await findWorkItemById(id);
      if (!workItem) {
        return reply.status(404).send({ error: 'Work item not found', id });
      }

      // Check if RCA exists (needed for CLOSED gate)
      const rca = await findRcaByWorkItemId(id);

      // Run the State Pattern transition — throws if invalid
      const stateMachine = new WorkItemContext(workItem.status);
      try {
        stateMachine.transition(to_status, {
          workItemId: id,
          hasCompletedRca: rca !== null,
        });
      } catch (err) {
        if (err instanceof StateTransitionError) {
          return reply.status(422).send({
            error: err.message,
            code: err.code,
            current_status: workItem.status,
            requested_status: to_status,
          });
        }
        throw err;
      }

      // Build the DB update payload
      const now = new Date();
      const updatePayload: Parameters<typeof updateWorkItemStatus>[1] = {
        newStatus: to_status,
      };

      if (to_status === 'RESOLVED') {
        updatePayload.resolvedTime = now;
      }

      if (to_status === 'CLOSED') {
        updatePayload.closedTime = now;
        // Auto-calculate MTTR from first signal to RCA end time
        const endTime = rca?.incident_end ?? now;
        updatePayload.mttrSeconds = calculateMttr(workItem.start_time, endTime);
      }

      const updated = await updateWorkItemStatus(id, updatePayload);

      // Fire alert for new incidents (OPEN state only on new creation,
      // but also re-alert if escalated — future enhancement)
      if (to_status === 'INVESTIGATING') {
        const alertCtx = new AlertContext(updated.severity);
        alertCtx.dispatch(updated).catch((e) =>
          console.error('[Alert] Dispatch failed:', e.message)
        );
      }

      return reply.send({
        data: updated,
        transition: `${workItem.status} → ${to_status}`,
        mttr_seconds: updatePayload.mttrSeconds ?? null,
      });
    }
  );

  // ── POST /workitems/:id/rca ────────────────────────────────────────────────
  // Submit or update the RCA for a work item.
  // Work item must be in RESOLVED state (or already have an RCA).

  app.post(
    '/workitems/:id/rca',
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = req.params;

      // Validate RCA payload
      const parseResult = RcaSubmissionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid RCA submission',
          details: parseResult.error.flatten(),
        });
      }

      const rcaData = parseResult.data;

      // Work item must exist
      const workItem = await findWorkItemById(id);
      if (!workItem) {
        return reply.status(404).send({ error: 'Work item not found', id });
      }

      // Can only submit RCA when RESOLVED or already CLOSED
      if (workItem.status === 'OPEN' || workItem.status === 'INVESTIGATING') {
        return reply.status(422).send({
          error: `RCA can only be submitted when Work Item is RESOLVED or CLOSED. Current status: ${workItem.status}`,
          code: 'WRONG_STATUS_FOR_RCA',
        });
      }

      // Validate incident_end is after incident_start
      const start = new Date(rcaData.incident_start);
      const end = new Date(rcaData.incident_end);
      if (end <= start) {
        return reply.status(400).send({
          error: 'incident_end must be after incident_start',
          code: 'INVALID_TIME_RANGE',
        });
      }

      const rca = await createRca(id, rcaData);

      // Recalculate MTTR with the precise RCA timestamps
      const mttr = calculateMttr(workItem.start_time, end);
      await updateWorkItemStatus(id, {
        newStatus: workItem.status, // keep current status
        mttrSeconds: mttr,
      });

      return reply.status(201).send({
        data: rca,
        mttr_seconds: mttr,
        mttr_human: formatMttr(mttr),
        message: 'RCA submitted. Work item is now ready to be CLOSED.',
      });
    }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMttr(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

