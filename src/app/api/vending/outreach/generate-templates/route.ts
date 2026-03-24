export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

// ─── Facility type helpers ────────────────────────────────────────────────────

function getPeople(vertical: string): string {
  const v = vertical.toLowerCase();
  if (v.includes('apartment')) return 'residents';
  if (v.includes('hotel') || v.includes('motel')) return 'guests';
  if (v.includes('factory') || v.includes('warehouse')) return 'workers';
  if (v.includes('gym') || v.includes('fitness')) return 'members';
  return 'employees';
}

function getSubject(vertical: string, biz: string): string {
  const v = vertical.toLowerCase();
  // Subject leads with THEIR world — never mention "vending"
  if (v.includes('warehouse') || v.includes('factory')) return `Free employee perk for ${biz}`;
  if (v.includes('apartment')) return `Amenity idea for ${biz}`;
  if (v.includes('office') || v.includes('coworking')) return `Perk idea for ${biz} employees`;
  if (v.includes('hotel') || v.includes('motel')) return `Guest experience idea for ${biz}`;
  if (v.includes('gym') || v.includes('fitness')) return `Member perk for ${biz}`;
  return `Quick question about ${biz}`;
}

// Variant A — Operational / logistical pain
function getOperationalPain(vertical: string, biz: string): string {
  const v = vertical.toLowerCase();
  if (v.includes('warehouse') || v.includes('factory'))
    return `Workers leaving the floor for food disrupts production. Overnight shifts at ${biz} have no food options at all.`;
  if (v.includes('apartment'))
    return `High turnover is expensive. Competing properties near ${biz} are adding amenities that push renewal decisions.`;
  if (v.includes('hotel') || v.includes('motel'))
    return `Front desk staff at ${biz} handle late-night snack requests that shouldn't require a person at all.`;
  if (v.includes('gym') || v.includes('fitness'))
    return `Members leave ${biz} after a workout to buy what they could have purchased on-site — that's revenue walking out the door.`;
  // office / coworking / default
  return `Employees at ${biz} leaving mid-day for food don't always come back on time. That's a real productivity leak.`;
}

// Variant B — Human / emotional pain
function getHumanPain(vertical: string, biz: string): string {
  const v = vertical.toLowerCase();
  if (v.includes('warehouse') || v.includes('factory'))
    return `Workers on long shifts with nothing available don't feel taken care of. That erodes morale quietly — and it shows up in retention.`;
  if (v.includes('apartment'))
    return `Tenants who feel like just a rent check don't renew. Small amenities are what make people feel like ${biz} actually has their back.`;
  if (v.includes('hotel') || v.includes('motel'))
    return `A guest stranded at 11 PM with nowhere to get a snack remembers that when they write their review — and when they book next time.`;
  if (v.includes('gym') || v.includes('fitness'))
    return `Members who feel like ${biz} doesn't support their full fitness experience start quietly looking at other gyms. It's the small things.`;
  // office / coworking / default
  return `Employees whose basic needs aren't covered at work feel like the culture is hollow. It's a small thing — but it affects how they talk about ${biz}.`;
}

// Variant B — Reply question CTA
function getReplyQuestion(vertical: string): string {
  const v = vertical.toLowerCase();
  if (v.includes('warehouse') || v.includes('factory'))
    return `Do your workers currently have anywhere to grab food without leaving the building?`;
  if (v.includes('apartment'))
    return `Are your residents asking for more amenities in common areas?`;
  if (v.includes('hotel') || v.includes('motel'))
    return `How are guests getting snacks and essentials after the front desk closes?`;
  if (v.includes('gym') || v.includes('fitness'))
    return `Are your members asking for anything to eat or drink after sessions?`;
  // office / coworking / default
  return `Does your team have a vending option on-site, or do they have to leave the building?`;
}

function makeTag(vertical: string, biz: string, variant: string): string {
  const vSlug = vertical.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const bSlug = biz.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${vSlug}-${bSlug}-${variant.toUpperCase()}-${date}`;
}

// ─── Main template generator ──────────────────────────────────────────────────

function generateTemplates(lead: {
  business_name: string;
  contact_name?: string;
  city: string;
  vertical: string;
}, variant: 'a' | 'b') {
  const firstName = lead.contact_name?.split(' ')[0] || 'there';
  const biz = lead.business_name;
  const city = lead.city;
  const vertical = lead.vertical || '';
  const people = getPeople(vertical);
  const People = people.charAt(0).toUpperCase() + people.slice(1);

  // Subject is IDENTICAL across A and B — we are testing the body, not the subject
  const subject = getSubject(vertical, biz);

  // Risk reversal — same across both variants
  const riskReversal = `No cost to you. We handle all stocking, maintenance, and service. If it's not working in 30 days, we remove it.`;
  const signOff = `Best,\nJaivien Kendrick\nMore Life Vending`;

  let touch1Body: string;

  if (variant === 'a') {
    // ── Variant A ─────────────────────────────────────────────────────────────
    // Opening: operational/logistical pain
    // Benefit order: Satisfaction → Income → Amenity
    // CTA: 10-minute call this week
    const pain = getOperationalPain(vertical, biz);

    touch1Body = [
      `Hi ${firstName},`,
      ``,
      pain,
      ``,
      `We place fully stocked vending machines at facilities in ${city} at zero cost to the location. Here's what changes for ${biz}:`,
      ``,
      `• Your ${people} stay on-site and on-task — no unnecessary trips out`,
      `• You earn a monthly commission on every sale`,
      `• The machine is fully managed — stocked, maintained, and serviced by us`,
      ``,
      riskReversal,
      ``,
      `Worth a 10-minute call this week to see if ${biz} would be a good fit?`,
      ``,
      signOff,
    ].join('\n');

  } else {
    // ── Variant B ─────────────────────────────────────────────────────────────
    // Opening: human/emotional pain
    // Benefit order: Income → Amenity → Satisfaction
    // CTA: single reply question
    const pain = getHumanPain(vertical, biz);
    const replyQ = getReplyQuestion(vertical);

    touch1Body = [
      `Hi ${firstName},`,
      ``,
      pain,
      ``,
      `We place fully stocked vending machines at facilities in ${city} at zero cost to the location. Here's what it looks like for ${biz}:`,
      ``,
      `• You earn a monthly commission on every sale`,
      `• The machine is fully managed — we handle everything`,
      `• Your ${people} get an amenity that signals ${biz} actually has their back`,
      ``,
      riskReversal,
      ``,
      replyQ,
      ``,
      signOff,
    ].join('\n');
  }

  // Touch 2 — Variant A: pre-empts "we already have a vendor" objection
  //           Variant B: leads with reliability stat
  const f1Subject = `Re: ${subject}`;

  const f1Body = variant === 'a'
    ? [
        `Hey ${firstName}, following up on my last note.`,
        ``,
        `If you already have a vending company — I get it. I'd just ask: how's the service been? Are your ${people} happy with the selection and machine condition?`,
        ``,
        `Our biggest advantage is response time. Most operators take days to restock or fix a down machine. We're same-day.`,
        ``,
        `A 30-day trial lets you see the difference with zero commitment.`,
        ``,
        `— Jaivien`,
      ].join('\n')
    : [
        `Hey ${firstName}, circling back on my last note.`,
        ``,
        `Something worth knowing: most vending operators take 3–5 days to respond to a down machine or restock request. We're same-day. Your ${people} actually feel that difference.`,
        ``,
        `A 30-day trial costs nothing — if it's not working, we remove it. Worth a look?`,
        ``,
        `— Jaivien`,
      ].join('\n');

  // Touch 3 — Variant A: soft exit ("circle back in 90 days")
  //           Variant B: concrete picture close
  const f2Subject = variant === 'a' ? `Last note — ${biz}` : `Last thing — ${biz}`;

  const f2Body = variant === 'a'
    ? [
        `Hey ${firstName} — keeping this short.`,
        ``,
        `If the timing isn't right, no problem. I'll circle back in 90 days.`,
        ``,
        `If you're ever curious, reply here or reach out directly.`,
        ``,
        signOff,
      ].join('\n')
    : [
        `Hey ${firstName} — one last note.`,
        ``,
        `Here's what this would look like for ${biz} specifically: a machine placed in your common area, stocked weekly, cashless payment built in, zero cost to you. If it underperforms in 30 days, it's gone.`,
        ``,
        `If now isn't the right time, no worries — I'll check back in 90 days.`,
        ``,
        signOff,
      ].join('\n');

  return { subject, touch1Body, f1Subject, f1Body, f2Subject, f2Body };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    // Ensure tag and outcome columns exist (safe to run every time)
    await pool.query(`ALTER TABLE vending_outreach ADD COLUMN IF NOT EXISTS tag TEXT`);
    await pool.query(`ALTER TABLE vending_outreach ADD COLUMN IF NOT EXISTS outcome TEXT`);

    const { rows } = await pool.query(
      `SELECT id, business_name, contact_name, city, vertical FROM vending_leads WHERE id = $1`,
      [lead_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = rows[0];

    // Determine variant by alternating: even total count → 'a', odd → 'b'
    const { rows: [countRow] } = await pool.query(`SELECT COUNT(*) AS total FROM vending_outreach`);
    const variant: 'a' | 'b' = parseInt(countRow.total) % 2 === 0 ? 'a' : 'b';

    const t = generateTemplates(lead, variant);
    const tag = makeTag(lead.vertical || 'general', lead.business_name, variant);

    const { rows: existing } = await pool.query(
      `SELECT id FROM vending_outreach WHERE lead_id = $1`,
      [lead_id]
    );

    let outreach;
    if (existing.length > 0) {
      const { rows: updated } = await pool.query(
        `UPDATE vending_outreach SET
          first_contact_subject = $1,
          first_contact_body = $2,
          variant = $3,
          tag = $4,
          status = 'draft',
          updated_at = NOW()
         WHERE lead_id = $5 RETURNING *`,
        [t.subject, t.touch1Body, variant, tag, lead_id]
      );
      outreach = updated[0];
    } else {
      const { rows: created } = await pool.query(
        `INSERT INTO vending_outreach (lead_id, first_contact_subject, first_contact_body, variant, tag, status)
         VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
        [lead_id, t.subject, t.touch1Body, variant, tag]
      );
      outreach = created[0];
      await pool.query(
        `UPDATE vending_leads SET status = 'qualified', updated_at = NOW() WHERE id = $1`,
        [lead_id]
      );
    }

    return NextResponse.json({ success: true, outreach, variant, tag, templates: t });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
