export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Called by Athena's relay server after verifying iMessage delivery.
// Lead must be in 'approved' (relay accepted) status to confirm.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead_id, delivered, error_detail } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const leadResult = await pool.query(
      'SELECT id, company_name, status FROM leads WHERE id = $1',
      [lead_id]
    );

    if (leadResult.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leadResult.rows[0];

    if (delivered) {
      // iMessage confirmed — mark as truly sent
      await pool.query(
        `UPDATE leads SET status = 'sent', message_sent_date = CURRENT_TIMESTAMP, updated_at = NOW() WHERE id = $1`,
        [lead_id]
      );
      return NextResponse.json({
        ok: true,
        lead_id,
        company: lead.company_name,
        status: 'sent',
        message: 'iMessage delivery confirmed'
      });
    } else {
      // iMessage failed to deliver — log the error in notes, keep as approved
      // (stays out of pending queue, but not counted as sent)
      const note = `[iMessage delivery failed${error_detail ? `: ${error_detail}` : ''}]`;
      await pool.query(
        `UPDATE leads SET research_notes = COALESCE(research_notes || ' ', '') || $2, updated_at = NOW() WHERE id = $1`,
        [lead_id, note]
      );
      return NextResponse.json({
        ok: false,
        lead_id,
        company: lead.company_name,
        status: lead.status,
        message: 'Delivery unconfirmed — lead kept in approved state'
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
