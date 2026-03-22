export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function POST(request: Request) {
  try {
    const formData      = await request.formData();
    const callSid       = formData.get('CallSid') as string;
    const callStatus    = formData.get('CallStatus') as string;
    const callDuration  = parseInt((formData.get('CallDuration') as string) || '0');

    if (callSid && callStatus === 'completed' && callDuration > 0) {
      await pool.query(
        `UPDATE vending_call_logs
         SET duration_seconds = $1
         WHERE call_sid = $2 AND duration_seconds = 0`,
        [callDuration, callSid]
      );
    }

    return new NextResponse('OK', { status: 200 });
  } catch {
    return new NextResponse('OK', { status: 200 });
  }
}
