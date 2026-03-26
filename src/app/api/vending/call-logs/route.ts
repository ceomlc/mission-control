export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT * FROM vending_call_logs
       WHERE lead_id = $1
       ORDER BY called_at ASC`,
      [leadId]
    );

    return NextResponse.json({ logs: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead_id, call_sid, touch_number, outcome, notes, duration_seconds, tags } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO vending_call_logs
         (lead_id, call_sid, touch_number, outcome, notes, duration_seconds, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [lead_id, call_sid || null, touch_number || 1, outcome || null, notes || null, duration_seconds || 0, tags || []]
    );

    // Mirror outcome to vending_leads
    if (outcome === 'not_interested') {
      await pool.query(
        `UPDATE vending_leads
         SET phone_outcome = $1, status = 'discarded',
             call_attempts = COALESCE(call_attempts, 0) + 1,
             last_called_at = NOW()
         WHERE id = $2`,
        [outcome, lead_id]
      );
    } else if (outcome === 'interested') {
      await pool.query(
        `UPDATE vending_leads
         SET phone_outcome = $1,
             call_attempts = COALESCE(call_attempts, 0) + 1,
             last_called_at = NOW()
         WHERE id = $2`,
        [outcome, lead_id]
      );
      await pool.query(
        `INSERT INTO vending_placements (lead_id, notes, status)
         VALUES ($1, $2, 'pipeline')
         ON CONFLICT DO NOTHING`,
        [lead_id, notes || 'Interested via phone call']
      );
    } else {
      await pool.query(
        `UPDATE vending_leads
         SET phone_outcome = $1,
             call_attempts = COALESCE(call_attempts, 0) + 1,
             last_called_at = NOW()
         WHERE id = $2`,
        [outcome || 'voicemail', lead_id]
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
