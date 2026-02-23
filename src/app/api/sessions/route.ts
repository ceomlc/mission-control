import { NextResponse } from 'next/server';

// Mock session data for demo
const mockSessions = [
  { id: 'main-session', kind: 'main', active: true, model: 'MiniMax-M2.5', created_at: new Date().toISOString() },
  { id: 'heartbeat', kind: 'isolated', active: false, model: 'MiniMax-M2.5', created_at: new Date().toISOString() },
];

export async function GET() {
  try {
    // Try to get sessions from gateway, fallback to mock
    let sessions = mockSessions;
    
    try {
      const response = await fetch('http://localhost:18789/api/sessions_list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 })
      });
      if (response.ok) {
        const data = await response.json();
        sessions = data.result || mockSessions;
      }
    } catch (e) {
      // Use mock data
    }

    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json(mockSessions);
  }
}
