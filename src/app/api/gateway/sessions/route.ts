export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const mockSessions = [
  { id: 'main', kind: 'main', active: true, model: 'MiniMax-M2.5', created_at: new Date().toISOString() },
  { id: 'heartbeat', kind: 'isolated', active: false, model: 'MiniMax-M2.5', created_at: new Date().toISOString() },
];

export async function GET() {
  return NextResponse.json({
    sessions: mockSessions,
    activeSessions: 1,
    cronJobs: 3,
    lastUpdated: new Date().toISOString()
  });
}
