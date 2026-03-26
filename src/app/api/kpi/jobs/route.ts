export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // ── Pipeline counts ──────────────────────────────────────────────────────
    const pipelineResult = await pool.query(`
      SELECT
        COUNT(*)                                                             AS total,
        COUNT(CASE WHEN status IN ('new','reviewing','approved') THEN 1 END) AS in_review,
        COUNT(CASE WHEN status = 'applied'                       THEN 1 END) AS applied,
        COUNT(CASE WHEN status = 'interviewing'                  THEN 1 END) AS interviewing,
        COUNT(CASE WHEN status = 'offered'                       THEN 1 END) AS offered,
        COUNT(CASE WHEN status = 'rejected'                      THEN 1 END) AS rejected
      FROM jobs
    `);

    // ── Activity (time-windowed) ──────────────────────────────────────────────
    const activityResult = await pool.query(`
      SELECT
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days'  THEN 1 END) AS added_this_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS added_this_month,
        COUNT(CASE WHEN status IN ('applied','interviewing','offered')
                    AND updated_at >= NOW() - INTERVAL '7 days'  THEN 1 END) AS applied_this_week,
        COUNT(CASE WHEN status IN ('applied','interviewing','offered')
                    AND updated_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS applied_this_month
      FROM jobs
    `);

    // ── Platform breakdown ────────────────────────────────────────────────────
    const platformResult = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(platform), ''), 'Unknown') AS platform,
        COUNT(*)                                          AS total,
        COUNT(CASE WHEN status IN ('applied','interviewing','offered') THEN 1 END) AS applied
      FROM jobs
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 10
    `);

    const p = pipelineResult.rows[0];

    const total        = parseInt(p.total)        || 0;
    const in_review    = parseInt(p.in_review)    || 0;
    const applied      = parseInt(p.applied)      || 0;
    const interviewing = parseInt(p.interviewing) || 0;
    const offered      = parseInt(p.offered)      || 0;
    const rejected     = parseInt(p.rejected)     || 0;

    const a = activityResult.rows[0];

    // Rates — guard against division by zero
    const apply_rate     = (applied + rejected) > 0 ? applied / (applied + rejected) : null;
    const interview_rate = applied > 0              ? interviewing / applied          : null;
    const offer_rate     = interviewing > 0         ? offered / interviewing          : null;

    return NextResponse.json({
      pipeline: { total, in_review, applied, interviewing, offered, rejected },
      rates: { apply_rate, interview_rate, offer_rate },
      activity: {
        added_this_week:   parseInt(a.added_this_week)   || 0,
        added_this_month:  parseInt(a.added_this_month)  || 0,
        applied_this_week: parseInt(a.applied_this_week) || 0,
        applied_this_month:parseInt(a.applied_this_month)|| 0,
      },
      by_platform: platformResult.rows.map((row) => ({
        platform: row.platform,
        total:    parseInt(row.total)   || 0,
        applied:  parseInt(row.applied) || 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
