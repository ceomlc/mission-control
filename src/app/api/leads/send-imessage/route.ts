export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const IMessageRelayUrl = process.env.IMESSAGE_RELAY_URL || 'http://127.0.0.1:8765/send';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    // Fetch the lead
    const leadResult = await pool.query(
      'SELECT * FROM leads WHERE id = $1',
      [lead_id]
    );

    if (leadResult.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leadResult.rows[0];

    // Validate lead is in pending_approval status
    if (lead.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `Lead must be in 'pending_approval' status to send. Current status: ${lead.status}` },
        { status: 400 }
      );
    }

    // Validate phone and message exist
    if (!lead.phone) {
      return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 });
    }

    if (!lead.message_drafted) {
      return NextResponse.json({ error: 'Lead has no drafted message' }, { status: 400 });
    }

    // Call the iMessage relay server
    let relayResult;
    try {
      console.log('[iMessage Relay] URL:', IMessageRelayUrl);
      console.log('[iMessage Relay] Payload:', { recipient: lead.phone, message: lead.message_drafted });
      
      const response = await fetch(IMessageRelayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: lead.phone,
          message: lead.message_drafted
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      relayResult = await response.json();
    } catch (fetchError: any) {
      // Relay unreachable — leave as pending_approval so it stays in queue
      return NextResponse.json(
        { error: 'Failed to connect to iMessage relay server', details: fetchError.message },
        { status: 500 }
      );
    }

    // Update lead based on result
    if (relayResult.success) {
      // Mark as 'approved' = relay accepted, pending iMessage delivery confirmation.
      // Athena's relay will call /api/leads/delivery-receipt to confirm actual delivery,
      // at which point status moves to 'sent' and counts in KPI.
      await pool.query(
        `UPDATE leads SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [lead_id]
      );

      return NextResponse.json({
        success: true,
        lead_id,
        recipient: lead.phone,
        timestamp: relayResult.timestamp,
        message: 'iMessage handed to relay — awaiting delivery confirmation'
      });
    } else {
      // Relay rejected — leave as pending_approval so it stays in queue
      const errorMsg = relayResult.error || 'Unknown error';
      const note = `[Relay error: ${errorMsg}]`;
      await pool.query(
        `UPDATE leads SET notes = COALESCE(notes || ' ', '') || $2, updated_at = NOW() WHERE id = $1`,
        [lead_id, note]
      );

      return NextResponse.json({
        success: false,
        lead_id,
        recipient: lead.phone,
        error: errorMsg,
        error_type: relayResult.error_type || 'unknown'
      }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
