import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.VENDING_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('Running vending database migration...');
  
  const client = await pool.connect();
  
  try {
    // Create leads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vending_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        batch_date DATE NOT NULL,
        business_name TEXT NOT NULL,
        vertical TEXT NOT NULL,
        address TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        contact_name TEXT,
        website TEXT,
        size_indicator TEXT CHECK (size_indicator IN ('Small', 'Medium', 'Large')),
        scout_notes TEXT,
        status TEXT NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'qualified', 'discarded')),
        score NUMERIC(4,1),
        tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),
        score_breakdown JSONB,
        qualifier_notes TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created vending_leads table');
    
    // Create outreach table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vending_outreach (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES vending_leads(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
          'draft', 'pending_approval', 'approved', 'active',
          'replied', 'closed_won', 'closed_lost', 'unresponsive'
        )),
        first_contact_subject TEXT,
        first_contact_body TEXT,
        first_contact_sent_at TIMESTAMPTZ,
        f1_sent_at TIMESTAMPTZ,
        f2_sent_at TIMESTAMPTZ,
        f3_sent_at TIMESTAMPTZ,
        reply_received_at TIMESTAMPTZ,
        reply_summary TEXT,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created vending_outreach table');
    
    // Create placements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vending_placements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES vending_leads(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pipeline' CHECK (status IN ('pipeline', 'closed_won', 'closed_lost')),
        meeting_date TIMESTAMPTZ,
        placement_date DATE,
        location_details TEXT,
        agreement_summary TEXT,
        lost_reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created vending_placements table');
    
    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_leads_status ON vending_leads(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_leads_batch_date ON vending_leads(batch_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_leads_tier ON vending_leads(tier);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_outreach_status ON vending_outreach(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_outreach_lead_id ON vending_outreach(lead_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vending_placements_status ON vending_placements(status);`);
    console.log('✓ Created indexes');
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
