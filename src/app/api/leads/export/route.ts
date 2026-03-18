export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limit = 25 } = body;

    // Get drafted leads with first names
    const result = await pool.query(
      `SELECT l.company_name, l.phone, l.message_drafted, l.city, l.industry, l.google_rating, fn.first_name 
       FROM leads l 
       LEFT JOIN lead_first_names fn ON l.id = fn.lead_id 
       WHERE l.status = 'drafted' AND l.phone IS NOT NULL AND l.phone != '' 
       ORDER BY l.created_at DESC LIMIT $1`,
      [limit]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No drafted leads to export' }, { status: 400 });
    }

    // Create CSV content - firstName from research, company name in lastName, include city/state
    const csvHeader = 'firstName,lastName,phone,companyName,city,state,message\n';
    const csvContent = csvHeader + result.rows.map(lead => {
      const firstName = lead.first_name || '';
      const lastName = lead.company_name || '';
      const city = lead.city || '';
      const state = lead.state || '';
      // Clean phone - remove non-digits
      const phone = (lead.phone || '').replace(/\D/g, '');
      // Escape quotes in message
      const message = (lead.message_drafted || '').replace(/"/g, '""');
      return `${firstName},${lastName},${phone},"${lead.company_name}","${city}","${state}","${message}"`;
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
