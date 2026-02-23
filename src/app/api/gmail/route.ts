import { NextRequest, NextResponse } from 'next/server';

// Gmail API integration
const GMAIL_API_KEY = process.env.GMAIL_API_KEY;

export async function GET() {
  try {
    // If no API key, return mock data for demo
    if (!GMAIL_API_KEY) {
      return NextResponse.json({
        unread: 0,
        messages: [],
        error: 'Gmail API not configured'
      });
    }

    // Fetch unread count
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      headers: {
        'Authorization': `Bearer ${GMAIL_API_KEY}`,
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Gmail');
    }

    const data = await response.json();
    
    return NextResponse.json({
      unread: data.resultSizeEstimate || 0,
      messages: data.messages?.slice(0, 5) || []
    });
  } catch (error) {
    console.error('Gmail API error:', error);
    return NextResponse.json({ 
      unread: 0, 
      messages: [],
      error: String(error) 
    }, { status: 500 });
  }
}
