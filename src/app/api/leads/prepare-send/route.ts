export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limit = 25 } = body;

    // Enforce maximum 25 leads per day
    const MAX_DAILY = 25;
    const effectiveLimit = Math.min(limit, MAX_DAILY);

    // Check how many leads are already pending_approval today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM leads 
       WHERE status = 'pending_approval' 
       AND DATE(updated_at) >= CURRENT_DATE`,
    );

    const alreadyPending = parseInt(countResult.rows[0].count);
    const remainingSlots = MAX_DAILY - alreadyPending;

    if (remainingSlots <= 0) {
      return NextResponse.json({
        success: false,
        error: `Daily limit reached. ${MAX_DAILY} leads already moved to pending_approval today.`,
        alreadyPending,
        maxDaily: MAX_DAILY
      }, { status: 400 });
    }

    // Get drafted leads that haven't been sent yet
    const draftedResult = await pool.query(
      `SELECT id, company_name, phone, message_drafted 
       FROM leads 
       WHERE status = 'drafted' 
       AND phone IS NOT NULL 
       AND phone != ''
       AND message_drafted IS NOT NULL
       AND message_drafted != ''
       ORDER BY created_at DESC 
       LIMIT $1`,
      [effectiveLimit]
    );

    if (draftedResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No drafted leads ready to send. Generate messages first.',
        alreadyPending,
        remainingSlots
      });
    }

    // Calculate how many we can actually move
    const leadsToMove = Math.min(draftedResult.rows.length, remainingSlots);
    const leadsToUpdate = draftedResult.rows.slice(0, leadsToMove);

    // Update each lead to pending_approval
    for (const lead of leadsToUpdate) {
      await pool.query(
        `UPDATE leads SET 
          status = 'pending_approval', 
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [lead.id]
      );
    }

    return NextResponse.json({
      success: true,
      leadsMoved: leadsToUpdate.length,
      alreadyPending,
      remainingSlots: remainingSlots - leadsToUpdate.length,
      totalAvailable: draftedResult.rows.length,
      leads: leadsToUpdate.map(l => ({
        id: l.id,
        company: l.company_name,
        phone: l.phone
      })),
      message: `Moved ${leadsToUpdate.length} leads to pending approval. They will appear in the Outreach Queue.`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
