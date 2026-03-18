export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// Mock activity for demo
const mockActivity = [
  {
    id: '1',
    type: 'cron',
    message: 'Morning Brief completed',
    timestamp: Date.now() - 3600000,
    status: 'success'
  },
  {
    id: '2',
    type: 'session',
    message: 'Main session started',
    timestamp: Date.now() - 7200000,
    status: 'success'
  },
  {
    id: '3',
    type: 'build',
    message: 'Website built: joes-plumbing-theta.vercel.app',
    timestamp: Date.now() - 86400000,
    status: 'success'
  },
  {
    id: '4',
    type: 'cron',
    message: 'Daily Research Report delivered',
    timestamp: Date.now() - 28800000,
    status: 'success'
  }
];

export async function GET() {
  // In production, this would fetch from gateway
  // For now, return mock data
  return NextResponse.json(mockActivity);
}
