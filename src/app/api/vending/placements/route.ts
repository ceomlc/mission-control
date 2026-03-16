import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let query = `
      SELECT p.*, l.business_name, l.city, l.state, l.vertical, l.contact_name, l.email, l.phone
      FROM vending_placements p
      JOIN vending_leads l ON p.lead_id = l.id
    `;
    const params: any[] = [];
    
    if (status) {
      params.push(status);
      query += ` WHERE p.status = $${params.length}`;
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await pool.query(query, params);
    return NextResponse.json({ placements: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead_id, meeting_date, location_details, agreement_summary, notes } = body;
    
    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }
    
    const result = await pool.query(
      `INSERT INTO vending_placements (lead_id, meeting_date, location_details, agreement_summary, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'pipeline')
       RETURNING *`,
      [lead_id, meeting_date, location_details, agreement_summary, notes]
    );
    
    // Update the outreach status to closed_won
    await pool.query(
      "UPDATE vending_outreach SET status = 'closed_won', updated_at = NOW() WHERE lead_id = $1",
      [lead_id]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
