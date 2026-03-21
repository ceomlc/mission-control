export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Ensure table exists on first use
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_heartbeats (
      agent_id    TEXT PRIMARY KEY,
      agent_name  TEXT NOT NULL,
      role        TEXT,
      current_task TEXT,
      task_type   TEXT DEFAULT 'idle',
      status      TEXT DEFAULT 'active',
      machine     TEXT DEFAULT 'athena',
      metadata    JSONB,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add machine column if it doesn't exist (for existing tables)
  await pool.query(`
    ALTER TABLE agent_heartbeats ADD COLUMN IF NOT EXISTS machine TEXT DEFAULT 'athena'
  `).catch(() => {});
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, agent_name, role, current_task, task_type, status, machine, metadata } = body;

    if (!agent_id || !agent_name) {
      return NextResponse.json({ error: 'agent_id and agent_name are required' }, { status: 400 });
    }

    await ensureTable();

    // Derive machine from explicit field or agent_id prefix
    const resolvedMachine = machine || (agent_id.startsWith('thoth') ? 'thoth' : 'athena');

    await pool.query(
      `INSERT INTO agent_heartbeats (agent_id, agent_name, role, current_task, task_type, status, machine, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (agent_id) DO UPDATE SET
         agent_name   = EXCLUDED.agent_name,
         role         = EXCLUDED.role,
         current_task = EXCLUDED.current_task,
         task_type    = EXCLUDED.task_type,
         status       = EXCLUDED.status,
         machine      = EXCLUDED.machine,
         metadata     = EXCLUDED.metadata,
         updated_at   = NOW()`,
      [
        agent_id,
        agent_name,
        role || 'Agent',
        current_task || 'Idle',
        task_type || 'idle',
        status || 'active',
        resolvedMachine,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    return NextResponse.json({ ok: true, agent_id, updated_at: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: agent going offline
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { agent_id } = body;
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });

    await pool.query(`DELETE FROM agent_heartbeats WHERE agent_id = $1`, [agent_id]);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
