export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';
import nodemailer from 'nodemailer';

const DAILY_CAP = 40;

// Gmail SMTP transporter using App Password
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── 1. Fetch the outreach record + lead email ──────────────────────────
    const { rows } = await pool.query(
      `SELECT o.*, l.business_name, l.email, l.contact_name, l.city, l.state
       FROM vending_outreach o
       JOIN vending_leads l ON o.lead_id = l.id
       WHERE o.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Outreach not found' }, { status: 404 });
    }

    const outreach = rows[0];

    // ── 2. Guard: must have recipient email ────────────────────────────────
    if (!outreach.email) {
      return NextResponse.json(
        { error: `No email on file for ${outreach.business_name}. Add an email to the lead first.` },
        { status: 422 }
      );
    }

    // ── 3. Enforce 40/day cap ──────────────────────────────────────────────
    const { rows: [cap] } = await pool.query(
      `SELECT COUNT(*)::int AS sent_today
       FROM vending_outreach
       WHERE status = 'approved'
         AND first_contact_sent_at >= CURRENT_DATE`
    );

    if (cap.sent_today >= DAILY_CAP) {
      return NextResponse.json(
        { error: `Daily cap of ${DAILY_CAP} emails reached. Remaining emails will send tomorrow.` },
        { status: 429 }
      );
    }

    // ── 4. Send email via Gmail ────────────────────────────────────────────
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"Jaivien Kendrick | More Life Vending" <${process.env.GMAIL_USER}>`,
      to: outreach.email,
      subject: outreach.first_contact_subject,
      text: outreach.first_contact_body,
    });

    // ── 5. Mark as approved + record send time ─────────────────────────────
    const { rows: updated } = await pool.query(
      `UPDATE vending_outreach
       SET status = 'approved',
           approved_at = NOW(),
           first_contact_sent_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return NextResponse.json({
      success: true,
      sent_to: outreach.email,
      business: outreach.business_name,
      sent_today: cap.sent_today + 1,
      remaining_today: DAILY_CAP - cap.sent_today - 1,
      outreach: updated[0],
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
