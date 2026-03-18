import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function safe(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

const REPLIED_STATUSES = `('replied','hot','warm','cold','opted_out')`;

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // ----------------------------------------------------------------
      // Summary metrics — all from leads table in leads_production
      // ----------------------------------------------------------------
      const { rows: [s] } = await client.query(`
        SELECT
          -- leads_contacted: all leads that have left pending_approval
          COUNT(*) FILTER (WHERE status != 'pending_approval')::int                                                AS leads_contacted,

          -- Touch 1 reply rate: replied at touch 1 / all contacted at touch 1+
          COUNT(*) FILTER (WHERE sequence_day >= 1)::int                                                           AS touch1_total,
          COUNT(*) FILTER (WHERE sequence_day = 1 AND status IN ${REPLIED_STATUSES})::int                          AS touch1_replied,

          -- YES rate: response contains "yes" (or status=hot) / total replied
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES})::int                                               AS total_replied,
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
        touch1_reply_rate:    safe(s.touch1_replied,  s.touch1_total),
        yes_rate:             safe(s.yes_count,        s.total_replied),
        loom_reply_rate:      safe(s.t3_replied,       s.looms_sent),
        call_booking_rate:    safe(s.calls_booked,     s.calls_attempted),
        breakup_reply_rate:   safe(s.t5_replied,       s.t5_total),
        end_to_end_conversion: safe(s.calls_booked,    s.leads_contacted),
        opt_out_rate:         safe(s.opted_out,        s.leads_contacted),
      };

      // ----------------------------------------------------------------
      // A/B splits — grouped by variant + trade
      // Also includes send_day and send_time_window breakdowns
      // Minimum 50 leads per split before flagging as valid
      // ----------------------------------------------------------------
      const { rows: splitRows } = await client.query(`
        SELECT
          COALESCE(variant::text, 'unassigned')               AS variant,
          COALESCE(trade, 'unassigned')                        AS trade,
          TO_CHAR(message_sent_date, 'Day')                    AS send_day,
          CASE
            WHEN EXTRACT(HOUR FROM last_contact) BETWEEN 6  AND 11 THEN 'morning'
            WHEN EXTRACT(HOUR FROM last_contact) BETWEEN 12 AND 16 THEN 'afternoon'
            WHEN EXTRACT(HOUR FROM last_contact) BETWEEN 17 AND 20 THEN 'evening'
            ELSE 'other'
          END                                                  AS send_time_window,
          COUNT(*)::int                                        AS sends,
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES})::int   AS replies,
          COUNT(*) FILTER (WHERE status IN ${REPLIED_STATUSES}
            AND (response_text ILIKE '%yes%' OR status = 'hot'))::int  AS yes_count
        FROM leads
        WHERE status != 'pending_approval'
          AND variant IS NOT NULL
          AND trade IS NOT NULL
        GROUP BY variant, trade, send_day, send_time_window
        ORDER BY variant, trade, sends DESC
      `);

      const splits = splitRows.map((row) => ({
        variant:          row.variant,
        trade:            row.trade,
        send_day:         row.send_day?.trim() ?? null,
        send_time_window: row.send_time_window,
        sends:            row.sends,
        reply_rate:       safe(row.replies,    row.sends),
        yes_rate:         safe(row.yes_count,  row.replies),
        sample_status:    row.sends >= 50 ? 'sufficient' : 'insufficient_data',
      }));

      return NextResponse.json({ summary, splits });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
