export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id, business_name, vertical, city, state, phone,
        contact_name, website, size_indicator,
        scout_notes, qualifier_notes, tier, score,
        phone_script, phone_outcome, call_attempts, last_called_at,
        created_at
      FROM vending_leads
      WHERE phone IS NOT NULL
        AND phone != ''
        AND (email IS NULL OR email = '')
        AND status::text = 'qualified'
        AND (phone_outcome IS NULL OR phone_outcome::text = 'voicemail' OR phone_outcome::text = 'callback')
      ORDER BY
        CASE tier WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
        call_attempts ASC NULLS FIRST,
        created_at ASC
    `);
    return NextResponse.json({ leads: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
