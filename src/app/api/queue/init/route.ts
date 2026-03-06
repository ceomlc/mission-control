import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    // Create build_jobs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS build_jobs (
        id SERIAL PRIMARY KEY,
        client_slug VARCHAR(255) UNIQUE NOT NULL,
        client_name VARCHAR(255),
        website_url VARCHAR(500),
        status VARCHAR(50) DEFAULT 'queued',
        priority INT DEFAULT 0,
        spec_path VARCHAR(500),
        deployed_url VARCHAR(500),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    return NextResponse.json({ success: true, message: 'build_jobs table created' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
