export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const REPLIED_STATUSES = `('replied','hot','warm','cold','opted_out')`;

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // Each touch stage: leads that reached it, responded at it, dropped from it
      // A lead "entered" touch N if sequence_day >= N
      // A lead "responded" at touch N if sequence_day = N and status indicates a reply
      // A lead "dropped" = entered - responded
      const { rows } = await client.query(`
        SELECT
          sequence_day,
          status
        FROM leads
        WHERE status != 'pending_approval'
          AND sequence_day >= 1
      `);

      const funnel = [1, 2, 3, 4, 5].map((touch) => {
        const entered   = rows.filter(r => (r.sequence_day ?? 0) >= touch).length;
        const responded = rows.filter(r => r.sequence_day === touch &&
          ['replied','hot','warm','cold','opted_out'].includes(r.status)).length;
        const dropped   = entered - responded;
        return { touch, entered, responded, dropped };
      });

      return NextResponse.json({ funnel });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
