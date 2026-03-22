export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        -- Total leads ever sourced
        (SELECT COUNT(*)::int FROM vending_leads) AS total_leads,

        -- Leads added this week (Mon–today)
        (SELECT COUNT(*)::int FROM vending_leads
         WHERE created_at >= date_trunc('week', NOW())) AS leads_this_week,

        -- Pending approval = draft outreach waiting for user to click Approve
        (SELECT COUNT(*)::int FROM vending_outreach
         WHERE status::text IN ('draft', 'pending_approval')) AS pending_approval_count,

        -- Active sequences = emails sent, lead not yet closed/rejected (status-label agnostic)
        (SELECT COUNT(*)::int FROM vending_outreach
         WHERE first_contact_sent_at IS NOT NULL
           AND status::text NOT IN ('rejected', 'discarded', 'closed_won', 'opted_out')) AS active_sequences_count,

        -- Emails sent all-time
        (SELECT COUNT(*)::int FROM vending_outreach
         WHERE first_contact_sent_at IS NOT NULL) AS total_sent,

        -- Emails sent today (for daily cap display)
        (SELECT COUNT(*)::int FROM vending_outreach
         WHERE first_contact_sent_at >= CURRENT_DATE) AS sent_today,

        -- Replies received
        (SELECT COUNT(*)::int FROM vending_outreach
         WHERE reply_received_at IS NOT NULL
            OR status::text IN ('replied', 'interested')) AS reply_count,

        -- Meetings / calls booked (pipeline stage)
        (SELECT COUNT(*)::int FROM vending_placements
         WHERE status::text = 'pipeline') AS meetings_booked,

        -- Placements closed (machine placed, contract signed)
        (SELECT COUNT(*)::int FROM vending_placements
         WHERE status::text = 'closed_won') AS placements_closed_won,

        -- Tier breakdown (all-time)
        (SELECT COUNT(*)::int FROM vending_leads WHERE tier::text = 'A') AS a_tier_count,
        (SELECT COUNT(*)::int FROM vending_leads WHERE tier::text = 'B') AS b_tier_count,
        (SELECT COUNT(*)::int FROM vending_leads WHERE tier::text = 'C') AS c_tier_count
    `);

    const row = result.rows[0];
    const totalSent = row.total_sent || 1;
    const replyCount = row.reply_count || 0;

    return NextResponse.json({
      // Overview KPIs (shown on /vending home)
      leadsThisWeek:        row.leads_this_week,
      totalLeads:           row.total_leads,
      pendingApprovalCount: row.pending_approval_count,
      activeSequencesCount: row.active_sequences_count,
      sentToday:            row.sent_today,
      totalSent:            row.total_sent,
      replyCount,
      replyRate:            Math.round((replyCount / totalSent) * 100),
      meetingsBooked:       row.meetings_booked,
      placementsClosedWon:  row.placements_closed_won,
      // Tier breakdown
      aTierCount:           row.a_tier_count,
      bTierCount:           row.b_tier_count,
      cTierCount:           row.c_tier_count,
      // Legacy compat
      discardedCount:       0,
      outreachSentThisWeek: row.sent_today,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
