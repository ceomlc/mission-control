export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS thoth_inbox (
      id         SERIAL PRIMARY KEY,
      message    TEXT NOT NULL,
      source     TEXT DEFAULT 'user',
      status     TEXT DEFAULT 'pending',
      content_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT * FROM thoth_inbox ORDER BY created_at DESC LIMIT 20`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Inbox GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const { message, source } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO thoth_inbox (message, source) VALUES ($1, $2) RETURNING *`,
      [message.trim(), source || 'user']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Inbox POST error:', error);
    return NextResponse.json({ error: 'Failed to add inbox message' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const { id, status, content_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'picked_up', 'developed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      setClauses.push(`status = $${idx++}`);
      params.push(status);
    }

    if (content_id !== undefined) {
      setClauses.push(`content_id = $${idx++}`);
      params.push(content_id);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE thoth_inbox SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Inbox PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update inbox item' }, { status: 500 });
  }
}
