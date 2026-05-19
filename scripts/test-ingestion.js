#!/usr/bin/env node
/**
 * Test script: simulate a burst of signals to verify ingestion + debouncing
 *
 * Usage:
 *   node scripts/test-ingestion.js
 *
 * What it does:
 *   - Sends 100 signals for CACHE_CLUSTER_01 within 10 seconds
 *   - Sends 50 signals for RDBMS_PRIMARY_01 (P0)
 *   - Verifies only 2 Work Items are created (not 150)
 */

const API = process.env.API_URL || 'http://localhost:3000';

const SIGNAL_TEMPLATES = [
  {
    component_id: 'CACHE_CLUSTER_01',
    component_type: 'CACHE',
    signal_type: 'CONNECTION_REFUSED',
    severity: 'P2',
    message: 'Redis connection refused at cache cluster 01',
    count: 100,
  },
  {
    component_id: 'RDBMS_PRIMARY_01',
    component_type: 'RDBMS',
    signal_type: 'TIMEOUT',
    severity: 'P0',
    message: 'Postgres primary replica timeout - query exceeded 30s',
    count: 50,
  },
];

async function sendSignal(template) {
  const res = await fetch(`${API}/api/v1/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      component_id: template.component_id,
      component_type: template.component_type,
      signal_type: template.signal_type,
      severity: template.severity,
      message: template.message,
      metadata: { test: true, timestamp: Date.now() },
    }),
  });
  return res.json();
}

async function run() {
  console.log('🚀 Starting ingestion test...\n');

  for (const template of SIGNAL_TEMPLATES) {
    console.log(
      `Sending ${template.count} signals for ${template.component_id}...`
    );
    const results = await Promise.all(
      Array.from({ length: template.count }, () => sendSignal(template))
    );

    const newIncidents = results.filter((r) => r.is_new_incident).length;
    const workItemIds = [...new Set(results.map((r) => r.work_item_id))];

    console.log(`  ✅ Signals accepted: ${results.length}`);
    console.log(`  📦 Unique work items created: ${workItemIds.length} (expected: 1)`);
    console.log(`  🆕 New incident flags: ${newIncidents} (expected: 1)`);
    console.log(`  🔑 Work Item ID: ${workItemIds[0]}\n`);

    if (workItemIds.length !== 1) {
      console.error('  ❌ DEBOUNCE FAILED — more than 1 work item created!');
    }
  }

  console.log('✅ Test complete. Check /health for system status.');
}

run().catch(console.error);

