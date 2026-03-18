export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const NOTION_KEY = process.env.NOTION_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const databaseId = searchParams.get('database');

  if (!NOTION_KEY) {
    return NextResponse.json({ error: 'NOTION_API_KEY not configured' }, { status: 500 });
  }

  try {
    let url = 'https://api.notion.com/v1/search';
    let method = 'POST';
    let body: string | undefined;

    if (databaseId) {
      url = `https://api.notion.com/v1/databases/${databaseId}/query`;
      body = JSON.stringify({});
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notion API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
