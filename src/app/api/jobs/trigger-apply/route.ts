export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Called by Mission Control when user approves a job for application.
// Athena can GET this endpoint to find all jobs queued for application.
// Athena should POST back when it has submitted the application.

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, job_title, company_name, job_url, my_assessment, salary_range
       FROM jobs WHERE status = 'approved' ORDER BY updated_at ASC`
    );
    return NextResponse.json({ queued: result.rows, count: result.rows.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Athena calls this after successfully submitting an application
// Body: { job_id, success, notes? }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { job_id, success, notes } = body;

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    const newStatus = success ? 'applied' : 'approved'; // keep in queue if failed
    const updateQuery = notes
      ? `UPDATE jobs SET status = $1, my_assessment = COALESCE(my_assessment || E'\n\n', '') || $3, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`
      : `UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;

    const params = notes ? [newStatus, job_id, `[Apply log] ${notes}`] : [newStatus, job_id];
    const result = await pool.query(updateQuery, params);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      job_id,
      status: newStatus,
      job: result.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
