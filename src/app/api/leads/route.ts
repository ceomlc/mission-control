import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = searchParams.get('limit') || '500';
  
  try {
    let query = `SELECT l.*, fn.first_name 
                 FROM leads l 
                 LEFT JOIN lead_first_names fn ON l.id = fn.lead_id 
                 ORDER BY l.created_at DESC LIMIT $1`;
    const params: any[] = [limit];
    
    if (status) {
      query = `SELECT l.*, fn.first_name 
               FROM leads l 
               LEFT JOIN lead_first_names fn ON l.id = fn.lead_id 
               WHERE l.status = $1 ORDER BY l.created_at DESC LIMIT $2`;
      params.push(status, limit);
    }
    
    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  
  const {
    company_name,
    phone,
    address,
    city,
    state,
    zip,
    industry,
    website_url,
    has_website,
    google_rating,
    review_count,
    notes,
    status,
    message_drafted,
  } = body;
  
  try {
    const result = await pool.query(
      `INSERT INTO leads (
        company_name, phone, address, city, state, zip, industry,
        website_url, has_website, google_rating, review_count,
        notes, status, message_drafted, insert_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        company_name, phone, address, city, state, zip, industry,
        website_url, has_website, google_rating, review_count,
        notes, status || 'new', message_drafted, 'mission_control'
      ]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, ...updates } = body;
  
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    
    values.push(id);
    
    const result = await pool.query(
      `UPDATE leads SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
