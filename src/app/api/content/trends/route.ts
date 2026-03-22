export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_trends (
      id           SERIAL PRIMARY KEY,
      topic        TEXT NOT NULL,
      platform     TEXT NOT NULL,
      description  TEXT,
      source_url   TEXT,
      trend_score  INT DEFAULT 0,
      developed    BOOLEAN DEFAULT FALSE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT * FROM content_trends WHERE developed = FALSE ORDER BY trend_score DESC, created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Trends GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const { topic, platform, description, source_url, trend_score } = body;

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }
    if (!platform || typeof platform !== 'string' || platform.trim() === '') {
      return NextResponse.json({ error: 'platform is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO content_trends (topic, platform, description, source_url, trend_score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        topic.trim(),
        platform.trim(),
        description || null,
        source_url || null,
        typeof trend_score === 'number' ? trend_score : 0,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Trends POST error:', error);
    return NextResponse.json({ error: 'Failed to create trend' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const { id, developed } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE content_trends SET developed = $1 WHERE id = $2 RETURNING *`,
      [developed === true ? true : false, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Trends PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update trend' }, { status: 500 });
  }
}
