export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Return agents that checked in within the last 3 minutes
    const result = await pool.query(`
      SELECT agent_id, agent_name, role, current_task, task_type, status, machine, metadata, updated_at
      FROM agent_heartbeats
      WHERE updated_at > NOW() - INTERVAL '3 minutes'
      ORDER BY updated_at DESC
    `);

    return NextResponse.json({ agents: result.rows });
  } catch (error: any) {
    // Table may not exist yet — return empty
    return NextResponse.json({ agents: [] });
  }
}
