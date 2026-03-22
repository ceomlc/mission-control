export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const callSid       = formData.get('CallSid') as string;
    const recordingUrl  = formData.get('RecordingUrl') as string;
    const recordingSid  = formData.get('RecordingSid') as string;
    const recordingDuration = parseInt((formData.get('RecordingDuration') as string) || '0');

    if (callSid && recordingUrl) {
      await pool.query(
        `UPDATE vending_call_logs
         SET recording_url    = $1,
             recording_sid    = $2,
             duration_seconds = CASE WHEN duration_seconds = 0 THEN $3 ELSE duration_seconds END
         WHERE call_sid = $4`,
        [`${recordingUrl}.mp3`, recordingSid, recordingDuration, callSid]
      );
    }

    return new NextResponse('OK', { status: 200 });
  } catch {
    return new NextResponse('OK', { status: 200 }); // Always 200 for Twilio webhooks
  }
}
