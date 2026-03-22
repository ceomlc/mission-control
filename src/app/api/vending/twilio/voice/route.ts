export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import twilio from 'twilio';

// Normalize any phone format to E.164
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const to = formData.get('To') as string;
    const leadId = formData.get('LeadId') as string;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mission-control-app-theta.vercel.app';
    const callerId = process.env.TWILIO_PHONE_NUMBER!;

    const twiml = new twilio.twiml.VoiceResponse();

    if (to) {
      const dial = twiml.dial({
        callerId,
        record: 'record-from-answer-dual',
        recordingStatusCallback: `${appUrl}/api/vending/twilio/recording`,
        recordingStatusCallbackMethod: 'POST',
        action: `${appUrl}/api/vending/twilio/status`,
        method: 'POST',
      } as any);

      dial.number(
        {
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'] as any,
          statusCallback: `${appUrl}/api/vending/twilio/status?lead_id=${leadId}`,
          statusCallbackMethod: 'POST',
        },
        toE164(to)
      );
    } else {
      twiml.say('No destination number provided.');
    }

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('An error occurred. Please try again.');
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
