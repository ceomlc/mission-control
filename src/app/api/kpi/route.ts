export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function safe(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Hardcoded known-safe status values — not user input, safe to inline in SQL
// 'warm' excluded: it's now the initial status for new uncontacted leads (not a reply signal)
const REPLIED_STATUSES = "('replied','hot','cold','opted_out')";

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // ----------------------------------------------------------------
      // Summary metrics — all from leads table in leads_production
      // ----------------------------------------------------------------
      const { rows: [s] } = await client.query(`
        SELECT
          -- Raw activity counts
          -- messages_sent: iMessage confirmed (delivery-receipt callback received)
          COUNT(*) FILTER (WHERE status = 'sent' AND variant::text LIKE 'script_%')::int                          AS messages_sent,
          -- relay_accepted: relay received, pending iMessage confirmation
          COUNT(*) FILTER (WHERE status = 'approved' AND variant::text LIKE 'script_%')::int                      AS relay_pending,
          COUNT(*) FILTER (WHERE status = 'pending_approval')::int                                                 AS queue_depth,
          COUNT(*) FILTER (WHERE sequence_day >= 1 AND variant::text LIKE 'script_%'
            AND status NOT IN ('pending_approval','bad_data'))::int                                                AS in_sequence,
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES})::int                                               AS total_replied,

          -- leads_contacted: leads that have had a message actually sent or delivered
          COUNT(*) FILTER (WHERE status IN ('sent','approved','replied','hot','cold','opted_out','waiting_on_loom'))::int AS leads_contacted,

          -- Touch 1 reply rate: replied at touch 1 / all contacted at touch 1+
          COUNT(*) FILTER (WHERE sequence_day >= 1)::int                                                           AS touch1_total,
          COUNT(*) FILTER (WHERE sequence_day = 1 AND status IN ${REPLIED_STATUSES})::int                          AS touch1_replied,

          -- YES rate: response contains "yes" (or status=hot) / total replied
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES}
            AND (response_text ILIKE '%yes%' OR status = 'hot'))::int                                              AS yes_count,

          -- Loom-to-reply rate: replied at touch 3 / loom_url not null
          COUNT(*) FILTER (WHERE loom_url IS NOT NULL)::int                                                        AS looms_sent,
          COUNT(*) FILTER (WHERE sequence_day = 3 AND status IN ${REPLIED_STATUSES})::int                          AS t3_replied,

          -- Call-to-booking rate: call_outcome='booked' / call_outcome IS NOT NULL
          COUNT(*) FILTER (WHERE call_outcome IS NOT NULL)::int                                                    AS calls_attempted,
          COUNT(*) FILTER (WHERE call_outcome = 'booked')::int                                                     AS calls_booked,

          -- Breakup reply rate: replied at touch 5 / sent touch 5
          COUNT(*) FILTER (WHERE sequence_day >= 5)::int                                                           AS t5_total,
          COUNT(*) FILTER (WHERE sequence_day = 5 AND status IN ${REPLIED_STATUSES})::int                          AS t5_replied,

          -- Opt-out rate: opted_out / leads_contacted
          COUNT(*) FILTER (WHERE status = 'opted_out')::int                                                        AS opted_out

        FROM leads
      `);

      const summary = {
        // Raw counts
        messages_sent:        s.messages_sent,
        relay_pending:        s.relay_pending,
        queue_depth:          s.queue_depth,
        in_sequence:          s.in_sequence,
        total_replied:        s.total_replied,
        // Rate metrics
        touch1_reply_rate:    safe(s.touch1_replied,  s.touch1_total),
        yes_rate:             safe(s.yes_count,        s.total_replied),
        loom_reply_rate:      safe(s.t3_replied,       s.looms_sent),
        call_booking_rate:    safe(s.calls_booked,     s.calls_attempted),
        breakup_reply_rate:   safe(s.t5_replied,       s.t5_total),
        end_to_end_conversion: safe(s.calls_booked,    s.leads_contacted),
        opt_out_rate:         safe(s.opted_out,        s.leads_contacted),
      };

      // ----------------------------------------------------------------
      // A/B splits — grouped by variant only
      // send_day/time_window breakdowns unlock at 50+ sends per variant
      // ----------------------------------------------------------------
      const { rows: splitRows } = await client.query(`
        SELECT
          COALESCE(variant::text, 'unassigned')               AS variant,
          COUNT(*) FILTER (WHERE variant::text LIKE 'script_%')::int  AS sends,
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES})::int  AS replies,
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES}
            AND (response_text ILIKE '%yes%' OR status = 'hot'))::int AS yes_count
        FROM leads
        WHERE variant::text LIKE 'script_%'
          AND status != 'pending_approval'
        GROUP BY variant
        ORDER BY variant
      `);

      const splits = splitRows.map((row) => ({
        variant:          row.variant,
        trade:            'all',
        send_day:         null,
        send_time_window: null,
        sends:            row.sends,
        reply_rate:       safe(row.replies,    row.sends),
        yes_rate:         safe(row.yes_count,  row.replies),
        sample_status:    row.sends >= 30 ? 'sufficient' : 'insufficient_data',
      }));

      return NextResponse.json({ summary, splits });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
