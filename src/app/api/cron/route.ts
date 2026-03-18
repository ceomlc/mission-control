export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try gateway cron API first
    const gatewayRes = await fetch('http://localhost:18789/api/cron/jobs', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
      }
    });

    if (gatewayRes.ok) {
      const data = await gatewayRes.json();
      return NextResponse.json(data);
    }
    
    // Fallback to empty
    return NextResponse.json({ jobs: [] });
  } catch (error) {
    console.error('Cron API error:', error);
    return NextResponse.json({ jobs: [] }, { status: 200 });
  }
}
