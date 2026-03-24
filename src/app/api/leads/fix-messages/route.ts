export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── Message templates (mirrors generate-all/route.ts) ─────────────────────────

const VARIANTS: Record<string, (firstName: string, company: string, city: string, industry: string) => string> = {
  a1: (fn, co) =>
    `Hey ${fn}, it's Jaivien. I noticed ${co} doesn't have a site yet — every time someone hears your name and Googles you, they're finding your competitors instead. I fix that for $97/mo, no contract. Worth it?\n— Jaivien`,
  b1: (fn, co) =>
    `Hey ${fn}, it's Jaivien. One of your competitors is getting calls right now just because they show up on Google and ${co} doesn't. I can flip that for $97/mo, no contract. Want to see how?\n— Jaivien`,
  a2: (fn, co) =>
    `Hey ${fn}, it's Jaivien. ${co} doesn't have a website — when people Google you after a referral, they're calling whoever shows up instead. $97/mo, I handle everything, no contract. Interested?\n— Jaivien`,
  b2: (fn, co) =>
    `Hey ${fn}, it's Jaivien with More Life Consulting. When someone hears your name and Googles ${co}, right now they find nothing — and roughly half of them end up calling a competitor who has a site. I fix that for $97/mo, no contract, all edits included. Would it be worth a look?\n— Jaivien`,
  a3: (fn, co) =>
    `Hey ${fn}, Jaivien here. ${co} has no website — people Google you after a referral and call whoever shows up instead. I fix that for $97/mo, no contract, I handle everything. Reply yes if you want in, no if you want me to leave you alone.\n— Jaivien`,
  b3: (fn, _co, city, industry) =>
    `Hey ${fn}, it's Jaivien. I build websites for ${industry} guys in ${city} who are losing jobs to whoever shows up first on Google. $97/mo and I take care of everything — no contracts, no tech headaches. If that sounds useful, just say yes. If not, say no and I'm out of your hair.\n— Jaivien`,
  a4: (fn, co, city, industry) =>
    `Hey ${fn}, it's Jaivien. When customers Google ${co} after a referral right now, nothing comes up — and most of them move on to whoever does. I build sites for ${industry} businesses in ${city} for $97/mo, no contract. Say yes and I'll send you a mockup of what yours could look like. No interest? Just say no.\n— Jaivien`,
  b4: (fn, co, city, industry) =>
    `Hey ${fn}, it's Jaivien. Noticed ${co} doesn't have a website yet — every referral who Googles you is hitting a dead end and calling someone else. I build sites for ${industry} businesses in ${city} for $97/mo, no contract. Would it be worth taking a look? If not, just say no and I won't bother you again.\n— Jaivien`,
};

const VARIANT_TO_ENUM: Record<string, string> = {
  a1: 'script_1', b1: 'script_1',
  a2: 'script_2', b2: 'script_2',
  a3: 'script_3', b3: 'script_3',
  a4: 'script_4', b4: 'script_4',
};

export async function POST() {
  try {
    // Determine active test pair from week parity
    const weekParity = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % 2;
    const activePair = weekParity === 0
      ? ['a1', 'b1', 'a2', 'b2']
      : ['a3', 'b3', 'a4', 'b4'];

    // Find all pending_approval leads with old-format messages (no $97 = old template)
    const result = await pool.query(`
      SELECT id, company_name, city, industry, owner_name
      FROM leads
      WHERE status = 'pending_approval'
        AND (message_drafted NOT ILIKE '%97%' OR message_drafted IS NULL OR message_drafted = '')
      ORDER BY id ASC
    `);

    const leads = result.rows;
    let updated = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];

      // Derive first name from owner_name or company name
      const firstName = lead.owner_name?.split(' ')[0] || 'there';

      const variantKey = activePair[i % activePair.length];
      const enumVal = VARIANT_TO_ENUM[variantKey];
      const message = VARIANTS[variantKey](
        firstName,
        lead.company_name || 'your company',
        lead.city || 'your area',
        (lead.industry || 'trade').toLowerCase(),
      );

      await pool.query(
        `UPDATE leads
         SET message_drafted = $1,
             variant         = $2,
             case_study_ref  = $3,
             sequence_day    = 1,
             updated_at      = NOW()
         WHERE id = $4`,
        [message, enumVal, variantKey, lead.id],
      );
      updated++;
    }

    return NextResponse.json({
      ok: true,
      updated,
      active_pair: activePair,
      message: `Regenerated messages for ${updated} leads using ${activePair.join('/')} templates`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
