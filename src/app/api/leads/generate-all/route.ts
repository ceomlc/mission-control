export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Helper to check if website loads and get status
async function checkWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return 'none';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!response.ok) return 'outdated';

    const html = await response.text().catch(() => '');

    const hasTailwind = html.includes('tailwind') || html.includes('bootstrap') || html.includes('foundation');
    const hasReact = html.includes('react') || html.includes('vue') || html.includes('angular');
    const hasModernCss = html.includes('grid') || html.includes('flexbox') || html.includes('var(--');

    if (hasTailwind || hasReact || hasModernCss) return 'modern';
    return 'outdated';
  } catch {
    return 'none';
  }
}

// Generate personal observation based on priority
function generatePersonalObservation(websiteStatus: string, googleRating: number | null, reviewCount: number): string {
  if (websiteStatus === 'none') {
    return "you don't have a website yet";
  }
  if (googleRating !== null && googleRating < 4.0) {
    return `your Google rating is sitting at ${googleRating} stars`;
  }
  if (reviewCount < 5) {
    return `you only have ${reviewCount} Google reviews showing up`;
  }
  if (websiteStatus === 'outdated') {
    return "your website looks like it could use a refresh";
  }
  return "there's room to get more calls coming in online";
}

// Returns which test pair is active this week
function getActiveTestPair(): string[] {
  const weekParity = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % 2;
  if (weekParity === 0) return ['a1', 'b1', 'a2', 'b2'];
  return ['a3', 'b3', 'a4', 'b4'];
}

// Randomly assigns one variant from the pair
function assignVariant(pair: string[]): string {
  // Split pair in half: first two = test A variants, last two = test B variants
  const half = Math.random() < 0.5 ? pair.slice(0, 2) : pair.slice(2);
  return Math.random() < 0.5 ? half[0] : half[1];
}

function generateMessage(lead: any, variant: string): string {
  const firstName = lead.owner_name?.split(' ')[0] || 'there';
  const company = lead.company_name || 'your business';
  const industry = lead.industry || 'trade';
  const city = lead.city || 'Baltimore';

  const messages: Record<string, string> = {
    a1: `Hey ${firstName}, it's Jaivien. I noticed ${company} doesn't have a site yet — every time someone hears your name and Googles you, they're finding your competitors instead. I fix that for $97/mo, no contract. Worth it?\n\n— Jaivien`,
    b1: `Hey ${firstName}, it's Jaivien. One of your competitors is getting calls right now just because they show up on Google and ${company} doesn't. I can flip that for $97/mo, no contract. Want to see how?\n\n— Jaivien`,
    a2: `Hey ${firstName}, it's Jaivien. ${company} doesn't have a website — when people Google you after a referral, they're calling whoever shows up instead. $97/mo, I handle everything, no contract. Interested?\n\n— Jaivien`,
    b2: `Hey ${firstName}, it's Jaivien with More Life Consulting. When someone hears your name and Googles ${company}, right now they find nothing — and roughly half of them end up calling a competitor who has a site. I fix that for $97/mo, no contract, all edits included. Would it be worth a look?\n\n— Jaivien`,
    a3: `Hey ${firstName}, Jaivien here. ${company} has no website — people Google you after a referral and call whoever shows up instead. I fix that for $97/mo, no contract, I handle everything. Reply yes if you want in, no if you want me to leave you alone.\n\n— Jaivien`,
    b3: `Hey ${firstName}, it's Jaivien. I build websites for ${industry} guys in ${city} who are losing jobs to whoever shows up first on Google. $97/mo and I take care of everything — no contracts, no tech headaches. If that sounds useful, just say yes. If not, say no and I'm out of your hair.\n\n— Jaivien`,
    a4: `Hey ${firstName}, it's Jaivien. When customers Google ${company} after a referral right now, nothing comes up — and most of them move on to whoever does. I build sites for ${industry} businesses in ${city} for $97/mo, no contract. Say yes and I'll send you a mockup of what yours could look like. No interest? Just say no.\n\n— Jaivien`,
    b4: `Hey ${firstName}, it's Jaivien. Noticed ${company} doesn't have a website yet — every referral who Googles you is hitting a dead end and calling someone else. I build sites for ${industry} businesses in ${city} for $97/mo, no contract. Would it be worth taking a look? If not, just say no and I won't bother you again.\n\n— Jaivien`,
  };

  return messages[variant] || messages['a1'];
}

// Auto-research a single lead
async function runResearchOnLead(lead: any) {
  const websiteStatus = await checkWebsite(lead.website_url || '');
  const personalObservation = generatePersonalObservation(websiteStatus, lead.google_rating, lead.review_count || 0);
  const googlePresence = lead.google_rating
    ? `${lead.google_rating} stars, ${lead.review_count || 0} reviews`
    : 'not in Google Maps';

  await pool.query(
    `UPDATE leads SET
      website_status = $1,
      personal_observation = $2,
      google_presence = $3,
      research_completed = TRUE
     WHERE id = $4`,
    [websiteStatus, personalObservation, googlePresence, lead.id]
  );

  return { websiteStatus, personalObservation, googlePresence };
}

export async function POST() {
  try {
    // First, get leads that need research
    const leadsNeedingResearch = await pool.query(
      "SELECT * FROM leads WHERE (research_completed IS NULL OR research_completed = FALSE) AND website_url IS NOT NULL AND website_url != '' LIMIT 50"
    );

    let researched = 0;

    // Run research on leads that don't have it yet
    for (const lead of leadsNeedingResearch.rows) {
      try {
        await runResearchOnLead(lead);
        researched++;
      } catch (e) {
        console.error('Research error for lead', lead.id, e);
      }
    }

    // Now generate messages for no-website leads that don't have a drafted message yet
    // Status must not be already in the outreach or terminal pipeline
    const result = await pool.query(
      `SELECT * FROM leads
       WHERE has_website = false
         AND (message_drafted IS NULL OR message_drafted = '')
         AND status NOT IN ('sent', 'cold', 'opted_out', 'bad_data', 'hot', 'replied', 'waiting_on_loom', 'pending_approval', 'approved')`
    );

    let generated = 0;
    const pair = getActiveTestPair();

    // Map a1-b4 letter variants to the DB enum (script_1-4) for KPI compatibility.
    // The full letter variant (a1, b1, etc.) is stored in case_study_ref for A/B analysis.
    const variantToEnum: Record<string, string> = {
      a1: 'script_1', b1: 'script_1',
      a2: 'script_2', b2: 'script_2',
      a3: 'script_3', b3: 'script_3',
      a4: 'script_4', b4: 'script_4',
    };

    for (const lead of result.rows) {
      const letterVariant = assignVariant(pair);
      const enumVariant = variantToEnum[letterVariant] || 'script_1';
      const message = generateMessage(lead, letterVariant);

      await pool.query(
        `UPDATE leads SET
           message_drafted = $1,
           variant = $2,
           case_study_ref = $3,
           sequence_day = 1,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [message, enumVariant, letterVariant, lead.id]
      );
      generated++;

    }

    return NextResponse.json({
      success: true,
      researched,
      generated,
      message: `Researched ${researched} leads, generated messages for ${generated} leads`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
