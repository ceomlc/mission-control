export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_ideas (
      id             SERIAL PRIMARY KEY,
      title          TEXT NOT NULL,
      description    TEXT,
      source_url     TEXT,
      status         TEXT DEFAULT 'idea',
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const alterStatements = [
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS hook TEXT`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS script TEXT`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS personal_angle TEXT`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT ARRAY['tiktok','instagram']`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'reel'`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'personal'`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS thoth_notes TEXT`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS scheduled_week DATE`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ`,
    `ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0`,
  ];

  for (const stmt of alterStatements) {
    await pool.query(stmt);
  }
}

export async function GET(request: Request) {
  try {
    await ensureTable();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const week = searchParams.get('week');

    let query = 'SELECT * FROM content_ideas WHERE 1=1';
    const params: (string | null)[] = [];
    let idx = 1;

    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }

    if (week) {
      query += ` AND scheduled_week = $${idx++}`;
      params.push(week);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
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
    const {
      title,
      hook,
      script,
      description,
      personal_angle,
      source_url,
      platforms,
      content_type,
      source,
      status,
      thoth_notes,
      scheduled_week,
    } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO content_ideas
         (title, hook, script, description, personal_angle, source_url, platforms, content_type, source, status, thoth_notes, scheduled_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        title.trim(),
        hook || null,
        script || null,
        description || null,
        personal_angle || null,
        source_url || null,
        platforms || ['tiktok', 'instagram'],
        content_type || 'reel',
        source || 'personal',
        status || 'idea',
        thoth_notes || null,
        scheduled_week || null,
      ]
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
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const allowed = [
      'title', 'hook', 'script', 'description', 'personal_angle', 'source_url',
      'platforms', 'content_type', 'source', 'status', 'thoth_notes',
      'scheduled_week', 'posted_at', 'view_count',
    ];

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in fields) {
        setClauses.push(`${key} = $${idx++}`);
        params.push(fields[key]);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE content_ideas SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Content PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update content idea' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await pool.query(
      'DELETE FROM content_ideas WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Content DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete content idea' }, { status: 500 });
  }
}
