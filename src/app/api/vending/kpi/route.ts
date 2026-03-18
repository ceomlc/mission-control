import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET() {
  try {
    // Total leads
    const totalLeads = await pool.query('SELECT COUNT(*) as count FROM vending_leads');
    
    // Leads by status
    const byStatus = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM vending_leads 
      GROUP BY status
    `);
    
    // Leads by tier
    const byTier = await pool.query(`
      SELECT tier, COUNT(*) as count 
      FROM vending_leads 
      WHERE tier IS NOT NULL 
      GROUP BY tier
    `);
    
    // Sequence stats
    const sequenceStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE sequence_day = 1) as touch_1_sent,
        COUNT(*) FILTER (WHERE sequence_day = 2) as touch_2_sent,
        COUNT(*) FILTER (WHERE sequence_day = 3) as touch_3_sent,
        COUNT(*) FILTER (WHERE sequence_day = 4) as touch_4_sent,
        COUNT(*) FILTER (WHERE sequence_day = 5) as touch_5_sent,
        COUNT(*) FILTER (WHERE reply_received_at IS NOT NULL) as total_replies,
        COUNT(*) FILTER (WHERE status = 'booked_call') as booked_calls,
        COUNT(*) FILTER (WHERE status = 'closed_won') as closed_won
      FROM vending_leads
      WHERE sequence_day > 0
    `);
    
    // Response rate
    const responseRate = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE sequence_day > 0) as total_sent,
        COUNT(*) FILTER (WHERE reply_received_at IS NOT NULL) as total_replies
      FROM vending_leads
    `);
    
    const sent = parseInt(responseRate.rows[0]?.total_sent) || 0;
    const replies = parseInt(responseRate.rows[0]?.total_replies) || 0;
    
    const stats = {
      total_leads: parseInt(totalLeads.rows[0]?.count) || 0,
      by_status: byStatus.rows.reduce((acc: Record<string, number>, r: any) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
      by_tier: byTier.rows.reduce((acc: Record<string, number>, r: any) => { acc[r.tier] = parseInt(r.count); return acc; }, {}),
      sequence: sequenceStats.rows[0] || {},
      reply_rate: sent > 0 ? Math.round((replies / sent) * 100) : 0,
      sent,
      replies,
    };
    
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
