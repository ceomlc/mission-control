import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM leads WHERE status = 'approved' ORDER BY updated_at DESC"
    );

    return NextResponse.json({ leads: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
