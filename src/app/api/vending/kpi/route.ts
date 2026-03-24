export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

function safe(num: number, den: number) {
  return den === 0 ? 0 : num / den;
}

type VariantRow = { variant: string; sends: number; replies: number };
function detectWinner(rows: VariantRow[]): Record<string, any> {
  const a = rows.find(r => r.variant === 'a');
  const b = rows.find(r => r.variant === 'b');
  if (!a && !b) return { status: 'no_data' };
  if (!a || !b) return { status: 'insufficient_data' };
  if (a.sends < 20 || b.sends < 20) {
    return { status: 'building', needed: Math.max(20 - a.sends, 20 - b.sends) };
  }
  const rateA = a.replies / a.sends;
  const rateB = b.replies / b.sends;
  const diff = Math.abs(rateA - rateB);
  if (diff < 0.05) return { status: 'tie', diff };
  const winner = rateA >= rateB ? 'A' : 'B';
  return { status: 'winner', winner, margin: `${(diff * 100).toFixed(1)}%` };
}

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // ── Summary funnel metrics ────────────────────────────────────────────
      const { rows: [s] } = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE first_contact_sent_at IS NOT NULL)::int                        AS total_sent,
          COUNT(*) FILTER (WHERE status::text = 'bounced')::int                                  AS total_bounced,
          COUNT(*) FILTER (WHERE reply_received_at IS NOT NULL
                             AND status::text != 'bounced')::int                                 AS total_replied,
          COUNT(*) FILTER (WHERE status::text = 'interested')::int                              AS total_interested,
          COUNT(*) FILTER (WHERE status::text IN ('opted_out', 'not_interested'))::int           AS opted_out,
          COUNT(*) FILTER (WHERE f1_sent_at IS NOT NULL)::int                                   AS touch2_sent,
          COUNT(*) FILTER (WHERE f2_sent_at IS NOT NULL)::int                                   AS touch3_sent
        FROM vending_outreach
      `);

      // Deliverable sends = total sent minus bounces (denominator for reply rate)
      const deliverable = s.total_sent - s.total_bounced;

      const summary = {
        total_sent:         s.total_sent,
        total_bounced:      s.total_bounced,
        deliverable:        deliverable,
        total_replied:      s.total_replied,
        total_interested:   s.total_interested,
        opted_out:          s.opted_out,
        touch2_sent:        s.touch2_sent,
        touch3_sent:        s.touch3_sent,
        reply_rate:         safe(s.total_replied, deliverable),
        interest_rate:      safe(s.total_interested, s.total_replied),
        end_to_end:         safe(s.total_interested, deliverable),
        opt_out_rate:       safe(s.opted_out, deliverable),
        bounce_rate:        safe(s.total_bounced, s.total_sent),
      };

      // ── A/B split by variant ──────────────────────────────────────────────
      const { rows: splitRows } = await client.query(`
        SELECT
          COALESCE(variant, 'a')                                             AS variant,
          COUNT(*)::int                                                       AS sends,
          COUNT(*) FILTER (WHERE reply_received_at IS NOT NULL)::int         AS replies,
          COUNT(*) FILTER (WHERE status = 'interested')::int                 AS interested
        FROM vending_outreach
        WHERE first_contact_sent_at IS NOT NULL
        GROUP BY variant
        ORDER BY variant
      `);

      const splits = splitRows.map(r => ({
        variant:       r.variant,
        label:         r.variant === 'a' ? 'Benefit frame' : 'Question frame',
        sends:         r.sends,
        replies:       r.replies,
        interested:    r.interested,
        reply_rate:    safe(r.replies, r.sends),
        interest_rate: safe(r.interested, r.replies),
        sample_status: r.sends >= 30 ? 'sufficient' : r.sends >= 10 ? 'building' : 'too_early',
      }));

      // ── Touch performance ─────────────────────────────────────────────────
      const { rows: touchRows } = await client.query(`
        SELECT
          CASE
            WHEN f2_sent_at IS NOT NULL AND reply_received_at >= f2_sent_at THEN 'Touch 3'
            WHEN f1_sent_at IS NOT NULL AND reply_received_at >= f1_sent_at THEN 'Touch 2'
            ELSE 'Touch 1'
          END AS touch,
          COUNT(*)::int AS replies
        FROM vending_outreach
        WHERE reply_received_at IS NOT NULL
        GROUP BY touch
        ORDER BY touch
      `);

      // ── Per-facility-type A/B splits with winner logic ────────────────────
      const { rows: facilityRows } = await client.query(`
        SELECT
          l.vertical,
          COALESCE(o.variant, 'a')                                                          AS variant,
          COUNT(*) FILTER (WHERE o.first_contact_sent_at IS NOT NULL)::int                  AS sends,
          COUNT(*) FILTER (WHERE o.reply_received_at IS NOT NULL
                             AND o.status::text != 'bounced')::int                          AS replies
        FROM vending_outreach o
        JOIN vending_leads l ON o.lead_id = l.id
        WHERE o.first_contact_sent_at IS NOT NULL
        GROUP BY l.vertical, o.variant
        ORDER BY l.vertical, o.variant
      `);

      // Group by vertical, run winner detection per vertical
      const verticalMap: Record<string, VariantRow[]> = {};
      for (const row of facilityRows) {
        if (!verticalMap[row.vertical]) verticalMap[row.vertical] = [];
        verticalMap[row.vertical].push({ variant: row.variant, sends: row.sends, replies: row.replies });
      }

      const facilityResults = Object.entries(verticalMap).map(([vertical, rows]) => {
        const a = rows.find(r => r.variant === 'a') ?? { variant: 'a', sends: 0, replies: 0 };
        const b = rows.find(r => r.variant === 'b') ?? { variant: 'b', sends: 0, replies: 0 };
        return {
          vertical,
          a_sends:     a.sends,
          a_replies:   a.replies,
          a_reply_rate: safe(a.replies, a.sends),
          b_sends:     b.sends,
          b_replies:   b.replies,
          b_reply_rate: safe(b.replies, b.sends),
          winner:      detectWinner(rows),
        };
      });

      return NextResponse.json({ summary, splits, touch_performance: touchRows, facility_results: facilityResults });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
