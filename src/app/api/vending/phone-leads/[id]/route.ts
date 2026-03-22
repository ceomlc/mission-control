export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { outcome, notes } = body;

    // outcome: 'interested' | 'voicemail' | 'not_interested' | 'callback'
    if (!outcome) {
      return NextResponse.json({ error: 'outcome is required' }, { status: 400 });
    }

    if (outcome === 'not_interested') {
      // Discard the lead
      await pool.query(
        `UPDATE vending_leads
         SET status = 'discarded', phone_outcome = $1, updated_at = NOW()
         WHERE id = $2`,
        [outcome, id]
      );
      return NextResponse.json({ success: true, action: 'discarded' });
    }

    if (outcome === 'interested') {
      // Mark lead, then create a placement record
      await pool.query(
        `UPDATE vending_leads
         SET phone_outcome = $1, last_called_at = NOW(),
             call_attempts = COALESCE(call_attempts, 0) + 1,
             updated_at = NOW()
         WHERE id = $2`,
        [outcome, id]
      );

      // Create pipeline placement
      await pool.query(
        `INSERT INTO vending_placements (lead_id, notes, status)
         VALUES ($1, $2, 'pipeline')
         ON CONFLICT DO NOTHING`,
        [id, notes || 'Interested via phone call']
      );

      return NextResponse.json({ success: true, action: 'moved_to_pipeline' });
    }

    // voicemail or callback — log the attempt, keep in queue
    const outcomeNote = notes
      ? `[${new Date().toLocaleDateString()}] ${outcome}: ${notes}`
      : `[${new Date().toLocaleDateString()}] ${outcome}`;

    await pool.query(
      `UPDATE vending_leads
       SET phone_outcome = $1,
           call_attempts = COALESCE(call_attempts, 0) + 1,
           last_called_at = NOW(),
           qualifier_notes = CASE
             WHEN qualifier_notes IS NULL THEN $2
             ELSE qualifier_notes || E'\n' || $2
           END,
           updated_at = NOW()
       WHERE id = $3`,
      [outcome, outcomeNote, id]
    );

    return NextResponse.json({ success: true, action: 'logged' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
