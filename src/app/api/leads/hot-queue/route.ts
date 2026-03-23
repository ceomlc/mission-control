export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/leads/hot-queue
 *
 * Returns hot leads flagged with INTAKE_NEEDED.
 * STEWARD polls this endpoint to know when to trigger INTAKE research.
 *
 * Response:
 * {
 *   count: number,
 *   leads: [{ id, company_name, industry, city, phone, website_url, google_rating, personal_observation, site_ready_url, notes }]
 * }
 *
 * After INTAKE completes research, it should PATCH the lead notes to replace
 * INTAKE_NEEDED with INTAKE_DONE so it no longer appears in this queue.
 */
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, company_name, industry, city, phone, website_url,
              google_rating, personal_observation, notes, updated_at
       FROM leads
       WHERE status = 'hot'
         AND notes LIKE '%INTAKE_NEEDED%'
       ORDER BY updated_at DESC`
    );

    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mission-control-app-theta.vercel.app';

    const leads = result.rows.map(lead => ({
      id:                  lead.id,
      company_name:        lead.company_name,
      industry:            lead.industry || 'trade',
      city:                lead.city || 'Baltimore',
      phone:               lead.phone,
      website_url:         lead.website_url || null,
      google_rating:       lead.google_rating || null,
      personal_observation: lead.personal_observation || null,
      notes:               lead.notes,
      // Convenience: the URL Forge/INTAKE should POST the finished site URL to
      site_ready_url:      `${BASE_URL}/api/leads/${lead.id}/site-ready`,
      replied_at:          lead.updated_at
    }));

    return NextResponse.json({ count: leads.length, leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/hot-queue
 * Body: { id: number, status: 'intake_done' | 'intake_failed' }
 *
 * Called by INTAKE/STEWARD after research is complete or failed.
 * Replaces INTAKE_NEEDED with INTAKE_DONE (or INTAKE_FAILED) in notes.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const flag = status === 'intake_done' ? 'INTAKE_DONE' : 'INTAKE_FAILED';

    await pool.query(
      `UPDATE leads
       SET notes = REPLACE(notes, 'INTAKE_NEEDED', $2),
           updated_at = NOW()
       WHERE id = $1`,
      [id, flag]
    );

    return NextResponse.json({ ok: true, id, flag });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
