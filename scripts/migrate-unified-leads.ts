import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.VENDING_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('Running unified leads migration...');

  const client = await pool.connect();

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Add missing fields to vending_leads
    // -----------------------------------------------------------------------

    // Create lead_variant enum if it doesn't exist
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE lead_variant AS ENUM ('script_1', 'script_2');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ Ensured lead_variant enum exists');

    // Create call_outcome_type enum if it doesn't exist
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE call_outcome_type AS ENUM (
          'booked', 'voicemail', 'no_answer', 'not_interested',
          'wrong_number', 'callback_requested'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ Ensured call_outcome_type enum exists');

    // Add gap_found column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS gap_found TEXT;
    `);
    console.log('✓ Added gap_found');

    // Add variant column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS variant lead_variant;
    `);
    console.log('✓ Added variant');

    // Add case_study_ref column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS case_study_ref TEXT;
    `);
    console.log('✓ Added case_study_ref');

    // Add loom_url column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS loom_url TEXT;
    `);
    console.log('✓ Added loom_url');

    // Add sequence_day column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS sequence_day INTEGER DEFAULT 0;
    `);
    console.log('✓ Added sequence_day');

    // Add last_contact column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS last_contact TIMESTAMP WITH TIME ZONE;
    `);
    console.log('✓ Added last_contact');

    // Add call_outcome column
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS call_outcome call_outcome_type;
    `);
    console.log('✓ Added call_outcome');

    // -----------------------------------------------------------------------
    // STEP 1: Rename fields
    // -----------------------------------------------------------------------

    // Rename contact_name -> owner_name (skip if already renamed)
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vending_leads' AND column_name = 'contact_name'
        ) THEN
          ALTER TABLE vending_leads RENAME COLUMN contact_name TO owner_name;
        END IF;
      END $$;
    `);
    console.log('✓ Renamed contact_name -> owner_name (if it existed)');

    // Rename vertical -> trade (skip if already renamed)
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vending_leads' AND column_name = 'vertical'
        ) THEN
          ALTER TABLE vending_leads RENAME COLUMN vertical TO trade;
        END IF;
      END $$;
    `);
    console.log('✓ Renamed vertical -> trade (if it existed)');

    // -----------------------------------------------------------------------
    // STEP 1: Add drafted_message
    // -----------------------------------------------------------------------
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS drafted_message TEXT;
    `);
    console.log('✓ Added drafted_message');

    // -----------------------------------------------------------------------
    // STEP 1: Create weekly_digests table
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_digests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        week_of DATE NOT NULL,
        metrics JSONB NOT NULL,
        recommendation TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ Created weekly_digests table');

    // -----------------------------------------------------------------------
    // STEP 2: Fix the vending_outreach status enum
    // -----------------------------------------------------------------------

    // Create new enum type with the desired values
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE lead_status_new AS ENUM (
          'pending_approval', 'approved', 'sent', 'replied',
          'hot', 'cold', 'opted_out', 'bad_data'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ Created lead_status_new enum');

    // Add a temporary column for the new status
    await client.query(`
      ALTER TABLE vending_outreach
        ADD COLUMN IF NOT EXISTS status_new lead_status_new;
    `);
    console.log('✓ Added status_new column to vending_outreach');

    // Migrate existing status values to new enum values
    await client.query(`
      UPDATE vending_outreach
      SET status_new = CASE status::TEXT
        WHEN 'draft'            THEN 'pending_approval'::lead_status_new
        WHEN 'active'           THEN 'sent'::lead_status_new
        WHEN 'closed_won'       THEN 'hot'::lead_status_new
        WHEN 'closed_lost'      THEN 'cold'::lead_status_new
        WHEN 'unresponsive'     THEN 'cold'::lead_status_new
        WHEN 'pending_approval' THEN 'pending_approval'::lead_status_new
        WHEN 'approved'         THEN 'approved'::lead_status_new
        WHEN 'replied'          THEN 'replied'::lead_status_new
        ELSE 'pending_approval'::lead_status_new
      END
      WHERE status_new IS NULL;
    `);
    console.log('✓ Migrated status values in vending_outreach');

    // Drop the old status column
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vending_outreach' AND column_name = 'status'
        ) THEN
          ALTER TABLE vending_outreach DROP COLUMN status;
        END IF;
      END $$;
    `);
    console.log('✓ Dropped old status column from vending_outreach');

    // Rename status_new to status
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vending_outreach' AND column_name = 'status_new'
        ) THEN
          ALTER TABLE vending_outreach RENAME COLUMN status_new TO status;
        END IF;
      END $$;
    `);
    console.log('✓ Renamed status_new -> status in vending_outreach');

    // -----------------------------------------------------------------------
    // STEP 2: Add opted_out / bad_data tracking to vending_leads
    // -----------------------------------------------------------------------

    // Create a lead_contact_status enum for vending_leads outreach tracking
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE lead_contact_status AS ENUM (
          'pending_approval', 'approved', 'sent', 'replied',
          'hot', 'cold', 'opted_out', 'bad_data'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ Created lead_contact_status enum');

    // Add outreach_status column to vending_leads (separate from the lead qualification status)
    await client.query(`
      ALTER TABLE vending_leads
        ADD COLUMN IF NOT EXISTS outreach_status lead_contact_status DEFAULT 'pending_approval';
    `);
    console.log('✓ Added outreach_status column to vending_leads');

    // -----------------------------------------------------------------------
    // Add indexes for new columns
    // -----------------------------------------------------------------------
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_leads_sequence_day ON vending_leads(sequence_day);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_leads_variant ON vending_leads(variant);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_leads_outreach_status ON vending_leads(outreach_status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_outreach_new_status ON vending_outreach(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_digests_week_of ON weekly_digests(week_of DESC);`);
    console.log('✓ Created new indexes');

    console.log('\n✅ Unified migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
