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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, limit = 10 } = body;

  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({ 
        tool: 'memory_search', 
        args: { query, maxResults: limit } 
      }),
    });

    const data: GatewayResponse = await response.json();
    const results = unwrap<Array<{
      path: string;
      lines?: string;
      snippet?: string;
    }>>(data);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Memory search error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
