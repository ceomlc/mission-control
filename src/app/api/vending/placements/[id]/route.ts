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
      `SELECT p.*, l.business_name, l.city, l.state, l.vertical, l.contact_name, l.email, l.phone
       FROM vending_placements p
       JOIN vending_leads l ON p.lead_id = l.id
       WHERE p.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
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
      'status', 'meeting_date', 'placement_date',
      'location_details', 'agreement_summary', 'lost_reason', 'notes'
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
    
    const query = `UPDATE vending_placements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
