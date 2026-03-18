export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      const { rows } = await client.query(`
        SELECT id, week_of, metrics, recommendation, created_at
        FROM weekly_digests
        ORDER BY week_of DESC
      `);

      return NextResponse.json({ digests: rows });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
