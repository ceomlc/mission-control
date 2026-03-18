export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const leadResult = await pool.query(
      'SELECT * FROM vending_leads WHERE id = $1',
      [id]
    );
    
    if (leadResult.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    const lead = leadResult.rows[0];
    
    // Get outreach record if it exists
    const outreachResult = await pool.query(
      'SELECT * FROM vending_outreach WHERE lead_id = $1',
      [id]
    );
    
    const outreach = outreachResult.rows[0] || null;
    
    return NextResponse.json({ lead, outreach });
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
      'business_name', 'vertical', 'address', 'city', 'state',
      'phone', 'email', 'contact_name', 'website', 'size_indicator',
      'scout_notes', 'status', 'score', 'tier', 'score_breakdown', 'qualifier_notes'
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
    
    const query = `UPDATE vending_leads SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await pool.query(
      'DELETE FROM vending_leads WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
