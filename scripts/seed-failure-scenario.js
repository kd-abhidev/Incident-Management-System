#!/usr/bin/env node
/**
 * Sample Data Script
 *
 * Simulates a realistic failure scenario as required by the assignment:
 *   1. RDBMS outage (P0) — 100 signals in burst
 *   2. MCP Host failure (P0) — 60 signals
 *   3. Cache degradation (P2) — 30 signals
 *
 * Then walks the RDBMS incident through its full lifecycle to CLOSED.
 *
 * Usage:
 *   node scripts/seed-failure-scenario.js
 */

const API = process.env.API_URL || 'http://localhost:3000/api/v1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Step 1: Send burst signals ────────────────────────────────────────────────

async function sendBurst(template, count) {
  console.log(`\n📡 Sending ${count} signals for ${template.component_id}...`);

  const promises = Array.from({ length: count }, (_, i) =>
    fetch(`${API}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...template,
        metadata: { sequence: i, simulated: true },
      }),
    }).then((r) => r.json())
  );

  const results = await Promise.all(promises);
  const workItemIds = [...new Set(results.map((r) => r.work_item_id))];
  const firstNew = results.find((r) => r.is_new_incident);

  console.log(`  ✅ Accepted: ${results.filter((r) => r.accepted).length}/${count}`);
  console.log(`  🔑 Work Item IDs: ${workItemIds.join(', ')}`);
  console.log(
    `  📊 Debounce working: ${workItemIds.length === 1 ? '✅ YES (1 work item)' : '❌ NO (multiple!)'}`
  );

  return workItemIds[0];
}

// ── Step 2: Walk through lifecycle ───────────────────────────────────────────

async function transition(workItemId, toStatus) {
  const res = await fetch(`${API}/workitems/${workItemId}/transition`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_status: toStatus }),
  });
  const data = await res.json();
  console.log(`  🔄 Transition: ${data.transition ?? data.error}`);
  return data;
}

async function submitRca(workItemId) {
  const now = new Date();
  const start = new Date(now.getTime() - 3600_000); // 1 hour ago

  const res = await fetch(`${API}/workitems/${workItemId}/rca`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      incident_start: start.toISOString(),
      incident_end: now.toISOString(),
      root_cause_category: 'DATABASE',
      root_cause_detail:
        'Primary RDBMS ran out of connections due to a connection pool misconfiguration ' +
        'deployed in the 14:30 release. Max connections was set to 10 instead of 100.',
      fix_applied:
        'Rolled back the misconfigured connection pool setting. ' +
        'Restarted the application servers to flush stale connections.',
      prevention_steps:
        'Add connection pool config to integration test suite. ' +
        'Add alerting on connection pool utilisation > 80%. ' +
        'Require config changes to go through peer review.',
      submitted_by: 'on-call-engineer',
    }),
  });
  const data = await res.json();
  console.log(
    `  📋 RCA submitted. MTTR: ${data.mttr_human ?? data.mttr_seconds + 's'}`
  );
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🚀 IMS Failure Scenario Simulation\n');
  console.log('='.repeat(50));

  // Phase 1: Simulate failures
  const rdbmsWorkItemId = await sendBurst(
    {
      component_id: 'RDBMS_PRIMARY_01',
      component_type: 'RDBMS',
      signal_type: 'CONNECTION_REFUSED',
      severity: 'P0',
      message: 'Postgres primary: max_connections exceeded, new connections refused',
    },
    100
  );

  await sleep(500);

  const mcpWorkItemId = await sendBurst(
    {
      component_id: 'MCP_HOST_PROD_01',
      component_type: 'MCP_HOST',
      signal_type: 'HEALTH_CHECK_FAIL',
      severity: 'P0',
      message: 'MCP Host health check failing — downstream RDBMS unreachable',
    },
    60
  );

  await sleep(500);

  await sendBurst(
    {
      component_id: 'CACHE_CLUSTER_01',
      component_type: 'CACHE',
      signal_type: 'LATENCY_SPIKE',
      severity: 'P2',
      message: 'Cache read latency spiked to 800ms (normal: 2ms)',
    },
    30
  );

  // Phase 2: Walk RDBMS incident through full lifecycle
  console.log('\n' + '='.repeat(50));
  console.log(`\n🔧 Walking RDBMS incident (${rdbmsWorkItemId}) through lifecycle...`);

  await sleep(200);
  await transition(rdbmsWorkItemId, 'INVESTIGATING');

  await sleep(200);
  await transition(rdbmsWorkItemId, 'RESOLVED');

  await sleep(200);
  await submitRca(rdbmsWorkItemId);

  await sleep(200);
  await transition(rdbmsWorkItemId, 'CLOSED');

  // Phase 3: Try an invalid transition on MCP incident (should fail)
  console.log('\n' + '='.repeat(50));
  console.log(`\n⛔ Testing invalid transition on MCP incident (OPEN → CLOSED)...`);
  const invalidResult = await transition(mcpWorkItemId, 'CLOSED');
  console.log(
    `  ${invalidResult.error ? '✅ Correctly blocked:' : '❌ Should have been blocked:'} ${invalidResult.error ?? 'allowed'}`
  );

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Seed complete! Check the dashboard at http://localhost:5173');
  console.log(`   Or hit: GET ${API}/workitems\n`);
}

run().catch(console.error);

