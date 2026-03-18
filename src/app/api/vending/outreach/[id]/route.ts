export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await pool.query(
      `SELECT o.*, l.business_name, l.city, l.state, l.tier, l.vertical, l.email, l.contact_name
       FROM vending_outreach o
       JOIN vending_leads l ON o.lead_id = l.id
       WHERE o.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Outreach not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    const allowedFields = [
      'status', 'first_contact_subject', 'first_contact_body',
      'first_contact_sent_at', 'f1_sent_at', 'f2_sent_at', 'f3_sent_at',
      'reply_received_at', 'reply_summary'
    ];
    
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    fields.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `UPDATE vending_outreach SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Outreach not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
