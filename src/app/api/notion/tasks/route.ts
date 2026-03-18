export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const NOTION_KEY = process.env.NOTION_API_KEY;

export async function GET() {
  if (!NOTION_KEY) {
    return NextResponse.json({ error: 'NOTION_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Search for all pages (tasks)
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        page_size: 50,
      }),
    });

    const data = await response.json();
    
    // Extract tasks from results
    const tasks = data.results?.map((page: any) => {
      const props = page.properties || {};
      return {
        id: page.id,
        title: props['Task name']?.title?.[0]?.plain_text || 'Untitled',
        status: props['Status']?.status?.name || props['Project']?.status?.name || 'Unknown',
        priority: props['Priority']?.select?.name || 'Normal',
        assignee: props['Assignee']?.people?.[0]?.name || 'Unassigned',
        dueDate: props['Due date']?.date?.start || null,
        project: props['Project']?.status?.name || props['Project']?.select?.name || 'Unknown',
      };
    }) || [];

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Notion API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
