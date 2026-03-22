export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT type, description, timestamp, meta
      FROM (
        SELECT
          'lead' AS type,
          company_name || ' — ' || status AS description,
          updated_at AS timestamp,
          status AS meta
        FROM leads
        WHERE updated_at > NOW() - INTERVAL '7 days'
        ORDER BY updated_at DESC
        LIMIT 10
      ) leads_activity

      UNION ALL

      SELECT
        type, description, timestamp, meta
      FROM (
        SELECT
          'job' AS type,
          job_title || ' @ ' || company_name AS description,
          updated_at AS timestamp,
          status AS meta
        FROM jobs
        WHERE updated_at > NOW() - INTERVAL '7 days'
        ORDER BY updated_at DESC
        LIMIT 10
      ) jobs_activity

      UNION ALL

      SELECT
        type, description, timestamp, meta
      FROM (
        SELECT
          'content' AS type,
          title || ' [' || status || ']' AS description,
          updated_at AS timestamp,
          status AS meta
        FROM content_ideas
        WHERE updated_at > NOW() - INTERVAL '7 days'
        ORDER BY updated_at DESC
        LIMIT 10
      ) content_activity

      ORDER BY timestamp DESC
      LIMIT 25
    `);

    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
