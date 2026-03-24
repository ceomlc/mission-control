export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

// POST /api/vending/outreach/bulk-discard
// Body: { ids: string[] }  — OR omit ids to discard ALL no-email drafts
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { ids } = body as { ids?: string[] };

    let result;

    if (ids && ids.length > 0) {
      // Discard specific outreach IDs
      result = await pool.query(
        `UPDATE vending_outreach
         SET status = 'discarded', updated_at = NOW()
         WHERE id = ANY($1::uuid[])
         RETURNING id`,
        [ids]
      );
    } else {
      // Discard ALL drafts where the linked lead has no email
      result = await pool.query(
        `UPDATE vending_outreach o
         SET status = 'discarded', updated_at = NOW()
         FROM vending_leads l
         WHERE o.lead_id = l.id
           AND o.status::text IN ('draft', 'pending_approval')
           AND (l.email IS NULL OR l.email = '')
         RETURNING o.id`
      );
    }

    return NextResponse.json({ discarded: result.rowCount, ids: result.rows.map((r: any) => r.id) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
