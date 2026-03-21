export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Accepts both the old Hermes format and the new job-sourcer.py format.
// Old Hermes: { company, role, salary, remoteType, score, rationale, coverNote, applyUrl }
// New sourcer: { job_title, company_name, location, salary_range, description, job_url, my_assessment, status, cover_note }

const VALID_STATUSES = new Set(['new', 'reviewing', 'approved', 'rejected', 'applied', 'interviewing', 'offered']);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jobs = Array.isArray(body) ? body : [body];

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 });
    }

    const inserted: number[] = [];

    for (const job of jobs) {
      // Support both field-name conventions
      const jobTitle    = job.job_title    || job.role        || '';
      const companyName = job.company_name || job.company     || '';
      const location    = job.location     || job.remoteType  || '';
      const salaryRange = job.salary_range || job.salary      || '';
      const jobUrl      = job.job_url      || job.applyUrl    || '';
      const coverNote   = job.cover_note   || job.coverNote   || '';

      // Build assessment — merge score/rationale for old format
      let myAssessment = job.my_assessment || '';
      if (!myAssessment && (job.rationale || job.score != null)) {
        const scorePart = job.score != null ? `[Score ${job.score}/10] ` : '';
        myAssessment = `${scorePart}${job.rationale || ''}\n\n${coverNote}`.trim();
      }

      const description = job.description
        || (job.score != null ? `Sourced by Hermes. Score: ${job.score}/10` : '');

      // Only allow valid statuses; default to 'new'
      const status = VALID_STATUSES.has(job.status) ? job.status : 'new';

      // Skip exact duplicates (same title + company already exists)
      const existing = await pool.query(
        `SELECT id FROM jobs WHERE LOWER(job_title) = LOWER($1) AND LOWER(company_name) = LOWER($2) LIMIT 1`,
        [jobTitle, companyName]
      );
      if (existing.rows.length > 0) {
        console.log(`[shortlist] Skipping duplicate: ${jobTitle} @ ${companyName}`);
        continue;
      }

      const result = await pool.query(
        `INSERT INTO jobs (
          job_title, company_name, location, salary_range, description,
          job_url, my_assessment, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [jobTitle, companyName, location, salaryRange, description, jobUrl, myAssessment, status]
      );

      inserted.push(result.rows[0].id);
    }

    return NextResponse.json({ success: true, inserted: inserted.length, ids: inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
