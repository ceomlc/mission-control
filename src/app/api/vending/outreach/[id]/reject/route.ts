import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await pool.query(
      `UPDATE vending_outreach 
       SET status = 'draft', approved_at = NULL, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
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
