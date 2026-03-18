export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

function safe(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // Fetch all relevant lead data joined with outreach
      const { rows } = await client.query(`
        SELECT
          vl.id,
          vl.sequence_day,
          vl.loom_url,
          vl.call_outcome::TEXT AS call_outcome,
          vl.variant::TEXT AS variant,
          vl.trade,
          vo.status::TEXT AS status,
          vo.reply_summary
        FROM vending_leads vl
        LEFT JOIN vending_outreach vo ON vo.lead_id = vl.id
      `);

      // --- summary metrics ---

      // touch1_reply_rate: sequence_day=1 AND status='replied' / sequence_day >= 1
      const touch1_total = rows.filter(r => (r.sequence_day ?? 0) >= 1).length;
      const touch1_replied = rows.filter(r => (r.sequence_day ?? 0) === 1 && r.status === 'replied').length;

      // yes_rate: reply_summary ILIKE '%yes%' / status='replied'
      const total_replied = rows.filter(r => r.status === 'replied').length;
      const yes_count = rows.filter(r => r.reply_summary && r.reply_summary.toLowerCase().includes('yes')).length;

      // loom_reply_rate: sequence_day=3 AND status='replied' / loom_url IS NOT NULL
      const loom_sent = rows.filter(r => r.loom_url != null).length;
      const loom_replied = rows.filter(r => (r.sequence_day ?? 0) === 3 && r.status === 'replied').length;

      // call_booking_rate: call_outcome='booked' / call_outcome IS NOT NULL
      const call_total = rows.filter(r => r.call_outcome != null).length;
      const call_booked = rows.filter(r => r.call_outcome === 'booked').length;

      // breakup_reply_rate: sequence_day=5 AND status='replied' / sequence_day=5
      const touch5_total = rows.filter(r => (r.sequence_day ?? 0) === 5).length;
      const touch5_replied = rows.filter(r => (r.sequence_day ?? 0) === 5 && r.status === 'replied').length;

      // end_to_end_conversion: call_outcome='booked' / status != 'pending_approval'
      const total_contacted = rows.filter(r => r.status !== 'pending_approval').length;

      // opt_out_rate: status='opted_out' / status != 'pending_approval'
      const opted_out = rows.filter(r => r.status === 'opted_out').length;

      const summary = {
        touch1_reply_rate: safe(touch1_replied, touch1_total),
        yes_rate: safe(yes_count, total_replied),
        loom_reply_rate: safe(loom_replied, loom_sent),
        call_booking_rate: safe(call_booked, call_total),
        breakup_reply_rate: safe(touch5_replied, touch5_total),
        end_to_end_conversion: safe(call_booked, total_contacted),
        opt_out_rate: safe(opted_out, total_contacted),
      };

      // --- A/B splits ---
      // Group by (variant, trade)
      const splitMap: Record<string, { sends: number; replies: number; yes_count: number }> = {};

      for (const row of rows) {
        if (row.variant == null || row.trade == null) continue;
        const key = `${row.variant}|||${row.trade}`;
        if (!splitMap[key]) {
          splitMap[key] = { sends: 0, replies: 0, yes_count: 0 };
        }
        splitMap[key].sends += 1;
        if (row.status === 'replied') {
          splitMap[key].replies += 1;
          if (row.reply_summary && row.reply_summary.toLowerCase().includes('yes')) {
            splitMap[key].yes_count += 1;
          }
        }
      }

      const splits = Object.entries(splitMap).map(([key, data]) => {
        const [variant, trade] = key.split('|||');
        const reply_rate = safe(data.replies, data.sends);
        const yes_rate = safe(data.yes_count, data.replies);
        const sample_status = data.sends >= 50 ? 'sufficient' : 'insufficient_data';
        return { variant, trade, sends: data.sends, reply_rate, yes_rate, sample_status };
      });

      return NextResponse.json({ summary, splits });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
