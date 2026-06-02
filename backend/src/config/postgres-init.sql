-- ============================================================
-- IMS Database Schema
-- Source of Truth: Work Items + RCA records
-- ============================================================

CREATE TYPE work_item_status AS ENUM (
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE severity_level AS ENUM ('P0', 'P1', 'P2', 'P3');

CREATE TYPE root_cause_category AS ENUM (
  'INFRASTRUCTURE',
  'APPLICATION',
  'DATABASE',
  'NETWORK',
  'CONFIGURATION',
  'THIRD_PARTY',
  'UNKNOWN'
);

-- Work Items: one per unique incident (debounced)
CREATE TABLE IF NOT EXISTS work_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id    VARCHAR(255) NOT NULL,
  title           TEXT NOT NULL,
  status          work_item_status NOT NULL DEFAULT 'OPEN',
  severity        severity_level NOT NULL DEFAULT 'P2',
  signal_count    INTEGER NOT NULL DEFAULT 1,
  start_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_time   TIMESTAMPTZ,
  closed_time     TIMESTAMPTZ,
  mttr_seconds    INTEGER,          -- auto-calculated on CLOSED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RCA Records: one per work item, required to CLOSE
CREATE TABLE IF NOT EXISTS rca_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id        UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  incident_start      TIMESTAMPTZ NOT NULL,
  incident_end        TIMESTAMPTZ NOT NULL,
  root_cause_category root_cause_category NOT NULL,
  root_cause_detail   TEXT NOT NULL,
  fix_applied         TEXT NOT NULL,
  prevention_steps    TEXT NOT NULL,
  submitted_by        VARCHAR(255) NOT NULL DEFAULT 'engineer',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_rca_per_workitem UNIQUE (work_item_id)
);

-- Indexes for common queries
CREATE INDEX idx_work_items_component_id ON work_items(component_id);
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_severity ON work_items(severity);
CREATE INDEX idx_work_items_created_at ON work_items(created_at DESC);
CREATE INDEX idx_rca_work_item_id ON rca_records(work_item_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_items_updated_at
  BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

