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

    const relayUrl = process.env.IMESSAGE_RELAY_URL;
    if (!relayUrl) {
      return NextResponse.json({ error: 'IMESSAGE_RELAY_URL not configured' }, { status: 500 });
    }

    // Fetch lead
    const result = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = result.rows[0];

    if (lead.status !== 'hot') {
      return NextResponse.json({ error: 'Lead must be hot status to send loom' }, { status: 400 });
    }

    if (!lead.loom_url) {
      return NextResponse.json({ error: 'No loom_url set on this lead' }, { status: 400 });
    }

    if (!lead.phone) {
      return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 });
    }

    const firstName = lead.contact_name?.split(' ')[0] || lead.company_name?.split(' ')[0] || 'there';
    const company = lead.company_name || 'your business';

    const message = `Hey ${firstName} — you said YES so I put ${company}'s site together.\n\nHere's a quick walkthrough: ${lead.loom_url}\n\nSite is ready to go live. Want to move forward?\n\n— Jaivien`;

    // Send via relay
    const relayRes = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: lead.phone, message })
    });

    const relayData = await relayRes.json().catch(() => ({}));

    if (!relayRes.ok || relayData.success === false) {
      return NextResponse.json({ error: 'Relay failed to send', detail: relayData }, { status: 502 });
    }

    // Update lead — sequence_day = 3, mark as approved (awaiting delivery confirmation)
    await pool.query(
      `UPDATE leads SET sequence_day = 3, status = 'approved', updated_at = NOW() WHERE id = $1`,
      [leadId]
    );

    return NextResponse.json({ ok: true, message: 'Loom follow-up sent', sequence_day: 3 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
