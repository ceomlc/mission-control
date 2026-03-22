export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let query = `
      SELECT o.*, l.business_name, l.city, l.state, l.tier, l.vertical
      FROM vending_outreach o
      JOIN vending_leads l ON o.lead_id = l.id
    `;
    const params: any[] = [];
    
    const sent = searchParams.get('sent'); // ?sent=true → all emails with first_contact_sent_at set

    if (sent === 'true') {
      // Show anything actually sent regardless of status label Thoth used
      query += ` WHERE o.first_contact_sent_at IS NOT NULL
                   AND o.status::text NOT IN ('rejected', 'discarded', 'opted_out')`;
      query += ' ORDER BY o.first_contact_sent_at DESC';
    } else if (status) {
      // Support comma-separated statuses: ?status=draft,pending_approval
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        params.push(statuses[0]);
        query += ` WHERE o.status::text = $${params.length}`;
      } else {
        const placeholders = statuses.map(s => {
          params.push(s);
          return `$${params.length}`;
        }).join(', ');
        query += ` WHERE o.status::text IN (${placeholders})`;
      }

      // Cap the approval queue at 40, oldest first
      const isPendingQueue = status.includes('draft') || status.includes('pending_approval');
      if (isPendingQueue) {
        query += ' ORDER BY o.created_at ASC LIMIT 40';
      } else {
        query += ' ORDER BY o.created_at DESC';
      }
    } else {
      query += ' ORDER BY o.created_at DESC';
    }

    const result = await pool.query(query, params);
    return NextResponse.json({ outreach: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead_id, first_contact_subject, first_contact_body } = body;
    
    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }
    
    const result = await pool.query(
      `INSERT INTO vending_outreach (lead_id, first_contact_subject, first_contact_body, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING *`,
      [lead_id, first_contact_subject, first_contact_body]
    );
    
    // Also update the lead status to qualified
    await pool.query(
      "UPDATE vending_leads SET status = 'qualified', updated_at = NOW() WHERE id = $1",
      [lead_id]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
