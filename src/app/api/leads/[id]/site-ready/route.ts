export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = parseInt(params.id);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const body = await request.json();
    const { preview_url } = body;

    if (!preview_url) {
      return NextResponse.json({ error: 'preview_url is required' }, { status: 400 });
    }

    // Verify lead exists and is hot
    const lead = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (lead.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.rows[0].status !== 'hot') {
      return NextResponse.json({ error: 'Lead is not in hot status' }, { status: 400 });
    }

    // Append site URL to notes
    const siteNote = `[SITE READY: ${preview_url}]`;
    await pool.query(
      `UPDATE leads SET notes = COALESCE(notes || ' ', '') || $1, updated_at = NOW() WHERE id = $2`,
      [siteNote, leadId]
    );

    return NextResponse.json({ ok: true, message: 'Site URL saved. Jaivien can now review and approve.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
