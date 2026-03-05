import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limit = 20 } = body;

    // Get drafted leads (ready to send)
    const result = await pool.query(
      "SELECT * FROM leads WHERE status = 'drafted' AND phone IS NOT NULL AND phone != '' ORDER BY created_at DESC LIMIT $1",
      [limit]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No drafted leads to send' }, { status: 400 });
    }

    // Create CSV for StraightText
    const csvPath = '/tmp/straighttext_leads.csv';
    const csvContent = 'firstName,lastName,phone,companyName,message\n' + 
      result.rows.map(lead => {
        const names = (lead.company_name || '').split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';
        // Clean phone - remove non-digits
        const phone = (lead.phone || '').replace(/\D/g, '');
        // Escape quotes in message
        const message = (lead.message_drafted || '').replace(/"/g, '""');
        return `${firstName},${lastName},${phone},"${lead.company_name}","${message}"`;
      }).join('\n');

    fs.writeFileSync(csvPath, csvContent);

    // Build AppleScript to control StraightText
    const appleScript = `
      tell application "StraightText"
        activate
        delay 1
      end tell
      
      tell application "System Events"
        tell process "StraightText"
          -- Click "New Broadcast" button
          click button "New Broadcast" of group 1 of group 4 of group 1 of UI element "StraightText" of group 1 of group 1 of group 1 of group 1 of window 1
          delay 2
        end tell
      end tell
    `;

    // For now, just return what would be sent
    return NextResponse.json({ 
      success: true,
      leadsPrepared: result.rows.length,
      csvPath,
      sampleLeads: result.rows.slice(0, 3).map(l => ({
        company: l.company_name,
        phone: l.phone,
        message: l.message_drafted?.substring(0, 80) + '...'
      })),
      message: `Prepared ${result.rows.length} leads for sending. Open StraightText and import ${csvPath}`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
