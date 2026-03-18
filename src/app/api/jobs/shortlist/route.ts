export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Accept either a single object or an array
    const jobs = Array.isArray(body) ? body : [body];
    
    if (jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 });
    }
    
    const inserted: number[] = [];
    
    for (const job of jobs) {
      const { company, role, salary, remoteType, score, rationale, coverNote, applyUrl } = job;
      
      // Map Hermes payload to jobs table schema
      const jobTitle = role;
      const companyName = company;
      const location = remoteType;
      const salaryRange = salary;
      const description = `Sourced by Hermes. Score: ${score}/10`;
      const jobUrl = applyUrl;
      const myAssessment = `${rationale || ''}\n\n${coverNote || ''}`.trim();
      const status = 'new';
      
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
    
    return NextResponse.json({ success: true, inserted: inserted.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
