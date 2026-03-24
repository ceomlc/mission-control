export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

function safe(num: number, den: number) {
  return den === 0 ? 0 : num / den;
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

      return NextResponse.json({ summary, splits, touch_performance: touchRows });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
