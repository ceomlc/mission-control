export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { recording_url, duration_seconds, outcome } = body;

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (recording_url !== undefined) { fields.push(`recording_url = $${i++}`); values.push(recording_url); }
    if (duration_seconds !== undefined) { fields.push(`duration_seconds = $${i++}`); values.push(duration_seconds); }
    if (outcome !== undefined) { fields.push(`outcome = $${i++}`); values.push(outcome); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE vending_call_logs SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
