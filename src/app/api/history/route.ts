import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

interface GatewayResponse {
  ok: boolean;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
    details?: unknown;
  };
  error?: string;
}

function unwrap<T>(response: GatewayResponse): T {
  if (!response.ok) {
    throw new Error(response.error || 'Gateway error');
  }
  if (!response.result?.content?.[0]?.text) {
    throw new Error('No content in response');
  }
  return JSON.parse(response.result.content[0].text) as T;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionKey = searchParams.get('session');
  const limit = searchParams.get('limit');

  if (!sessionKey) {
    return NextResponse.json({ error: 'session required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({ 
        tool: 'sessions_history', 
        args: { 
          sessionKey,
          limit: limit ? parseInt(limit) : 20
        } 
      }),
    });

    const data: GatewayResponse = await response.json();
    const history = unwrap<Array<{
      role: string;
      content: string;
      timestamp?: number;
    }>>(data);
    return NextResponse.json(history);
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
