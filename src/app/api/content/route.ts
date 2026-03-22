export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Ensure table exists on first request
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_ideas (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      source_url  TEXT,
      type        TEXT DEFAULT 'video',
      status      TEXT DEFAULT 'ready',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const result = await pool.query('SELECT * FROM content_ideas ORDER BY created_at DESC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Content GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch content ideas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const { title, description, source_url, type, status } = body;

    const result = await pool.query(
      `INSERT INTO content_ideas (title, description, source_url, type, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || null, source_url || null, type || 'video', status || 'ready']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Content POST error:', error);
    return NextResponse.json({ error: 'Failed to create content idea' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureTable();
    const { id, status } = await request.json();
    const result = await pool.query(
      `UPDATE content_ideas SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Content PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
