import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limit = 25 } = body;

    // Get drafted leads (ready to send)
    const result = await pool.query(
      "SELECT company_name, phone, message_drafted, city, industry, google_rating FROM leads WHERE status = 'drafted' AND phone IS NOT NULL AND phone != '' ORDER BY created_at DESC LIMIT $1",
      [limit]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No drafted leads to export' }, { status: 400 });
    }

    // Create CSV content
    const csvHeader = 'firstName,lastName,phone,companyName,message\n';
    const csvContent = csvHeader + result.rows.map(lead => {
      const names = (lead.company_name || '').split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';
      // Clean phone - remove non-digits
      const phone = (lead.phone || '').replace(/\D/g, '');
      // Escape quotes in message
      const message = (lead.message_drafted || '').replace(/"/g, '""');
      return `${firstName},${lastName},${phone},"${lead.company_name}","${message}"`;
    }).join('\n');

    // Save to desktop
    const desktopPath = path.join(process.env.HOME || '/Users/jaivienkendrick', 'Desktop');
    const filename = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(desktopPath, filename);
    
    fs.writeFileSync(filepath, csvContent);

    return NextResponse.json({ 
      success: true,
      exported: result.rows.length,
      filename,
      filepath,
      sample: result.rows.slice(0, 3).map(l => ({
        company: l.company_name,
        phone: l.phone
      }))
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
