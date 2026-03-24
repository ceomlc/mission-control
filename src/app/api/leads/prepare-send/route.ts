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

    // Determine active test pair for this week
    const weekParity = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % 2;
    const activePair = weekParity === 0
      ? ['a1', 'b1', 'a2', 'b2']
      : ['a3', 'b3', 'a4', 'b4'];

    // Map letter variants to DB enum (script_1-4). Full letter variant stored in case_study_ref.
    const variantToEnum: Record<string, string> = {
      a1: 'script_1', b1: 'script_1',
      a2: 'script_2', b2: 'script_2',
      a3: 'script_3', b3: 'script_3',
      a4: 'script_4', b4: 'script_4',
    };

    // Pre-assigned rotation: A1, B1, A2, B2, A1, B1, A2, B2...
    // Guarantees even distribution regardless of batch size
    for (let i = 0; i < leadsToUpdate.length; i++) {
      const lead = leadsToUpdate[i];
      const letterVariant = activePair[i % activePair.length];
      const enumVariant = variantToEnum[letterVariant] || 'script_1';
      await pool.query(
        `UPDATE leads SET
          status = 'pending_approval',
          variant = COALESCE(variant, $2),
          case_study_ref = COALESCE(case_study_ref, $3),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [lead.id, enumVariant, letterVariant]
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
