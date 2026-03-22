export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';
import { VendingLead } from '@/lib/vending-types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tier = searchParams.get('tier');
    const batchDate = searchParams.get('batch_date');
    
    let query = 'SELECT * FROM vending_leads';
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (tier) {
      params.push(tier);
      conditions.push(`tier = $${params.length}`);
    }
    if (batchDate) {
      params.push(batchDate);
      conditions.push(`batch_date = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const limitParam = searchParams.get('limit');
    if (limitParam) {
      const limitVal = parseInt(limitParam, 10);
      if (!isNaN(limitVal) && limitVal > 0) {
        query += ` LIMIT ${limitVal}`;
      }
    }

    const result = await pool.query(query, params);
    return NextResponse.json({ leads: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leads = Array.isArray(body) ? body : [body];
    
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }
    
    const inserted: string[] = [];
    
    for (const lead of leads) {
      const {
        batch_date,
        business_name,
        vertical,
        address,
        city,
        state,
        phone,
        email,
        contact_name,
        website,
        size_indicator,
        scout_notes,
      } = lead;
      
      const result = await pool.query(
        `INSERT INTO vending_leads (
          batch_date, business_name, vertical, address, city, state,
          phone, email, contact_name, website, size_indicator, scout_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [batch_date, business_name, vertical, address, city, state, phone, email, contact_name, website, size_indicator, scout_notes]
      );
      
      inserted.push(result.rows[0].id);
    }
    
    return NextResponse.json({ success: true, inserted: inserted.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
