export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST() {
  try {
    const { AccessToken } = twilio.jwt;
    const { VoiceGrant } = AccessToken;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: 'mission-control-user', ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: false,
    });

    token.addGrant(voiceGrant);

    return NextResponse.json({ token: token.toJwt() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
