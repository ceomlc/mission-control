import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET() {
  try {
    // Get start of week (Monday)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    // Leads this week
    const leadsResult = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE tier = 'A') as a_tier,
         COUNT(*) FILTER (WHERE tier = 'B') as b_tier,
         COUNT(*) FILTER (WHERE status = 'discarded') as discarded
       FROM vending_leads 
       WHERE batch_date >= $1`,
      [weekStartStr]
    );
    
    // Outreach sent this week
    const outreachResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_outreach WHERE first_contact_sent_at >= $1`,
      [weekStart]
    );
    
    // Pending approval count
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_outreach WHERE status = 'pending_approval'`
    );
    
    // Active sequences
    const activeResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_outreach WHERE status = 'active'`
    );
    
    // Replies
    const repliesResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_outreach WHERE reply_received_at IS NOT NULL`
    );
    
    // Total outreach sent for reply rate
    const totalSentResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_outreach WHERE first_contact_sent_at IS NOT NULL`
    );
    
    // Meetings booked (pipeline count)
    const pipelineResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_placements WHERE status = 'pipeline'`
    );
    
    // Closed won
    const wonResult = await pool.query(
      `SELECT COUNT(*) as total FROM vending_placements WHERE status = 'closed_won'`
    );
    
    const leads = leadsResult.rows[0];
    const totalSent = parseInt(totalSentResult.rows[0].total) || 1;
    const replyCount = parseInt(repliesResult.rows[0].total) || 0;
    
    const stats = {
      leadsThisWeek: parseInt(leads.total) || 0,
      aTierCount: parseInt(leads.a_tier) || 0,
      bTierCount: parseInt(leads.b_tier) || 0,
      discardedCount: parseInt(leads.discarded) || 0,
      outreachSentThisWeek: parseInt(outreachResult.rows[0].total) || 0,
      pendingApprovalCount: parseInt(pendingResult.rows[0].total) || 0,
      activeSequencesCount: parseInt(activeResult.rows[0].total) || 0,
      replyCount,
      replyRate: Math.round((replyCount / totalSent) * 100),
      meetingsBooked: parseInt(pipelineResult.rows[0].total) || 0,
      placementsClosedWon: parseInt(wonResult.rows[0].total) || 0,
    };
    
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
