import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const jobId = searchParams.get('jobId');

    // Thoth polls for next job
    if (action === 'poll') {
      const result = await pool.query(
        `SELECT * FROM build_jobs 
         WHERE status = 'queued' 
         ORDER BY priority DESC, created_at ASC 
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ job: null, message: 'No jobs in queue' });
      }

      // Claim the job (mark as in_progress)
      await pool.query(
        `UPDATE build_jobs SET status = 'in_progress', started_at = NOW() WHERE id = $1`,
        [result.rows[0].id]
      );

      return NextResponse.json({ job: { ...result.rows[0], status: 'in_progress' } });
    }

    // Get job by ID
    if (jobId && action === 'status') {
      const result = await pool.query('SELECT * FROM build_jobs WHERE id = $1', [jobId]);
      return NextResponse.json({ job: result.rows[0] || null });
    }

    // Get all jobs
    const result = await pool.query(
      `SELECT * FROM build_jobs ORDER BY priority DESC, created_at ASC`
    );

    return NextResponse.json({ jobs: result.rows });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const body = await request.json();
    const { jobId, clientSlug, clientName, websiteUrl, priority, deployedUrl, errorMessage } = body;

    // Add new job to queue
    if (action === 'add' || !action) {
      if (!clientSlug) {
        return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 });
      }

      // Check if job already exists
      const existing = await pool.query(
        'SELECT id, status FROM build_jobs WHERE client_slug = $1',
        [clientSlug]
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].status === 'completed') {
          // Re-queue completed job
          await pool.query(
            `UPDATE build_jobs SET status = 'queued', priority = $1, created_at = NOW() WHERE client_slug = $2`,
            [priority || 0, clientSlug]
          );
          return NextResponse.json({ success: true, message: 'Job re-queued', clientSlug });
        }
        return NextResponse.json({ error: 'Job already exists', status: existing.rows[0].status }, { status: 400 });
      }

      // Create new job
      await pool.query(
        `INSERT INTO build_jobs (client_slug, client_name, website_url, priority, status, created_at)
         VALUES ($1, $2, $3, $4, 'queued', NOW())`,
        [clientSlug, clientName, websiteUrl, priority || 0]
      );

      return NextResponse.json({ success: true, message: 'Job added to queue', clientSlug });
    }

    // Complete job
    if (action === 'complete') {
      if (!jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
      }

      // Get job details for deployment
      const jobResult = await pool.query('SELECT * FROM build_jobs WHERE id = $1', [jobId]);
      const job = jobResult.rows[0];

      // Trigger automated deployment
      let deployResult = null;
      try {
        const deployRes = await fetch('http://localhost:3000/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: job.client_slug })
        });
        deployResult = await deployRes.json();
      } catch (e) {
        console.error('Auto-deploy failed:', e);
      }

      // Mark job as completed
      await pool.query(
        `UPDATE build_jobs SET status = 'completed', deployed_url = $1, completed_at = NOW() WHERE id = $2`,
        [deployResult?.deployUrl || '', jobId]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Job completed',
        deployment: deployResult
      });
    }

    // Fail job
    if (action === 'fail') {
      if (!jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
      }
      await pool.query(
        `UPDATE build_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
        [errorMessage || 'Unknown error', jobId]
      );
      return NextResponse.json({ success: true, message: 'Job marked as failed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
