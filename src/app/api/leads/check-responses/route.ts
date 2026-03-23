export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function classifyResponse(text: string): 'hot' | 'cold' | 'replied' {
  const t = text.toLowerCase().trim();
  const yesSignals = ['yes','yeah','yep','sure','sounds good','interested',"let's do it",'go ahead','ok','okay','worth it','how','look','send it','show me','want in','sounds useful',"let's see",'go for it'];
  const noSignals = ['no','nope','not interested','stop','remove me',"don't text me",'unsubscribe','leave me alone','out of my hair',"don't bother","please stop",'take me off'];
  if (yesSignals.some(s => t.includes(s))) return 'hot';
  if (noSignals.some(s => t.includes(s))) return 'cold';
  return 'replied';
}

export async function POST() {
  try {
    // Require relay URL
    const relayUrl = process.env.IMESSAGE_RELAY_URL;
    if (!relayUrl) {
      return NextResponse.json({ error: 'IMESSAGE_RELAY_URL not configured' }, { status: 500 });
    }

    // Derive relay base URL
    const relayBase = process.env.IMESSAGE_RELAY_BASE
      || relayUrl.replace(/\/send$/, '');

    // Fetch all leads with status 'sent'
    const result = await pool.query(
      "SELECT * FROM leads WHERE status = 'sent' AND phone IS NOT NULL AND phone != ''"
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0, breakdown: { hot: 0, cold: 0, replied: 0 } });
    }

    let updated = 0;
    const breakdown = { hot: 0, cold: 0, replied: 0 };

    for (const lead of result.rows) {
      const phone = (lead.phone || '').replace(/\D/g, '');
      if (!phone) continue;

      try {
        const relayRes = await fetch(`${relayBase}/responses?phone=${encodeURIComponent(phone)}`);
        if (!relayRes.ok) {
          console.error(`Relay returned ${relayRes.status} for phone ${phone}`);
          continue;
        }

        const data = await relayRes.json();

        if (!data.hasResponse) continue;

        const lastMessage: string = data.lastMessage || '';
        const timestamp: string = data.timestamp || new Date().toISOString();
        const newStatus = classifyResponse(lastMessage);

        breakdown[newStatus]++;
        updated++;

        if (newStatus === 'hot') {
          // Mark hot + flag for INTAKE research — STEWARD polls /api/leads/hot-queue to pick this up
          const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mission-control-app-theta.vercel.app';
          const note = `[YES — replied ${timestamp}. INTAKE_NEEDED] Build site: ${BASE_URL}/api/leads/${lead.id}/site-ready`;
          await pool.query(
            "UPDATE leads SET status = 'hot', response_text = $2, notes = $3, updated_at = NOW() WHERE id = $1",
            [lead.id, lastMessage, note]
          );
        } else {
          await pool.query(
            `UPDATE leads SET status = $2, response_text = $3, updated_at = NOW() WHERE id = $1`,
            [lead.id, newStatus, lastMessage]
          );
        }
      } catch (e) {
        console.error(`Failed to check relay for lead ${lead.id} (${phone}):`, e);
        // Skip this lead — don't crash the whole run
        continue;
      }
    }

    return NextResponse.json({
      checked: result.rows.length,
      updated,
      breakdown
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
