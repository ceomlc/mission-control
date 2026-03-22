export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function classifyResponse(text: string): 'opted_out' | 'hot' | 'cold' | 'replied' {
  if (!text) return 'replied';
  const lower = text.toLowerCase();

  // Opt-out — highest priority
  const optOutKeywords = ['stop', 'remove', 'unsubscribe', 'opt out', 'dont text', "don't text"];
  for (const kw of optOutKeywords) {
    if (lower.includes(kw)) return 'opted_out';
  }

  // Hot (YES / interested)
  const hotKeywords = ['yes', 'yeah', 'yep', 'sure', 'interested', 'tell me more', 'sounds good', "let's do it", 'lets do it', 'go ahead'];
  for (const kw of hotKeywords) {
    if (lower.includes(kw)) return 'hot';
  }

  // Cold (NO / not interested)
  const coldKeywords = ['no', 'not interested', 'no thanks', 'pass', 'nope'];
  for (const kw of coldKeywords) {
    if (lower.includes(kw)) return 'cold';
  }

  // Neutral — they replied but unclear
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
      "SELECT id, company_name, phone FROM leads WHERE status = 'sent' AND phone IS NOT NULL AND phone != ''"
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0, breakdown: { hot: 0, cold: 0, opted_out: 0, replied: 0 } });
    }

    let updated = 0;
    const breakdown = { hot: 0, cold: 0, opted_out: 0, replied: 0 };

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
        const status = classifyResponse(lastMessage);

        breakdown[status]++;
        updated++;

        if (status === 'hot') {
          const note = `[YES — replied ${timestamp}. Build site next.]`;
          await pool.query(
            "UPDATE leads SET status = 'hot', response_text = $2, notes = $3, updated_at = NOW() WHERE id = $1",
            [lead.id, lastMessage, note]
          );
        } else {
          await pool.query(
            `UPDATE leads SET status = $2, response_text = $3, updated_at = NOW() WHERE id = $1`,
            [lead.id, status, lastMessage]
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
