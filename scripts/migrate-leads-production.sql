-- ============================================================
-- Migration: leads_production schema update
-- Safe: no columns dropped, no data deleted, all guarded
-- Run as: sudo -u postgres psql -d leads_production -f migrate-leads-production.sql
-- ============================================================

BEGIN;

-- 1. Create enums (no-op if already exist)
DO $$ BEGIN
  CREATE TYPE lead_variant AS ENUM ('script_1', 'script_2');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_outcome_type AS ENUM (
    'booked', 'voicemail', 'no_answer', 'not_interested',
    'wrong_number', 'callback_requested'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add canonical name columns alongside old ones
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS business_name    TEXT,
  ADD COLUMN IF NOT EXISTS trade            TEXT,
  ADD COLUMN IF NOT EXISTS drafted_message  TEXT;

UPDATE leads SET business_name   = company_name    WHERE business_name IS NULL;
UPDATE leads SET trade           = industry        WHERE trade IS NULL;
UPDATE leads SET drafted_message = message_drafted WHERE drafted_message IS NULL;

-- 3. Add all missing spec columns
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS owner_name        TEXT,
  ADD COLUMN IF NOT EXISTS gap_found         TEXT,
  ADD COLUMN IF NOT EXISTS research_notes    TEXT,
  ADD COLUMN IF NOT EXISTS variant           lead_variant,
  ADD COLUMN IF NOT EXISTS case_study_ref    TEXT,
  ADD COLUMN IF NOT EXISTS sequence_day      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact      TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS loom_url          TEXT,
  ADD COLUMN IF NOT EXISTS call_outcome      call_outcome_type,
  ADD COLUMN IF NOT EXISTS quarterly_recheck BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recheck_count     INTEGER NOT NULL DEFAULT 0;

-- 4. Fix the status CHECK constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

UPDATE leads SET status = CASE status
  WHEN 'new'         THEN 'pending_approval'
  WHEN 'researching' THEN 'pending_approval'
  WHEN 'drafted'     THEN 'pending_approval'
  WHEN 'failed'      THEN 'bad_data'
  WHEN 'dead'        THEN 'cold'
  ELSE status
END
WHERE status IN ('new', 'researching', 'drafted', 'failed', 'dead');

ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY[
  'pending_approval', 'approved', 'sent', 'waiting_on_loom',
  'replied', 'hot', 'warm', 'cold', 'opted_out', 'bad_data'
]));

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_variant      ON leads(variant);
CREATE INDEX IF NOT EXISTS idx_leads_sequence_day ON leads(sequence_day);
CREATE INDEX IF NOT EXISTS idx_leads_trade        ON leads(trade);
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON leads(last_contact);

-- 6. Create weekly_digests table
CREATE TABLE IF NOT EXISTS weekly_digests (
  id             SERIAL PRIMARY KEY,
  week_of        DATE NOT NULL,
  metrics        JSONB NOT NULL,
  recommendation TEXT,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_week_of ON weekly_digests(week_of DESC);

COMMIT;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'leads' ORDER BY ordinal_position;
