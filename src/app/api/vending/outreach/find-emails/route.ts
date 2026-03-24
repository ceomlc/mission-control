export const dynamic = 'force-dynamic';
export const maxDuration = 120;
import { NextResponse } from 'next/server';
import pool from '@/lib/vending-db';

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// ── Scrape a URL for email addresses ────────────────────────────────────────

async function scrapeEmailFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const emails = html.match(EMAIL_REGEX) || [];
    // Filter out common false positives (image files, tracking pixels, etc.)
    const valid = emails.filter(e =>
      !e.includes('example.') &&
      !e.includes('sentry.') &&
      !e.endsWith('.png') &&
      !e.endsWith('.jpg') &&
      !e.endsWith('.gif') &&
      !e.includes('noreply') &&
      !e.includes('no-reply') &&
      !e.includes('@2x') &&
      e.length < 80
    );
    return valid[0] || null;
  } catch {
    return null;
  }
}

// ── Scrape website: try homepage + /contact + /about ────────────────────────

async function findEmailFromWebsite(website: string): Promise<string | null> {
  const base = website.replace(/\/$/, '');
  const urls = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`, `${base}/about-us`];
  for (const url of urls) {
    const email = await scrapeEmailFromUrl(url);
    if (email) return email;
  }
  return null;
}

// ── Hunter.io domain search ──────────────────────────────────────────────────

async function hunterDomainSearch(domain: string): Promise<string | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const emails: any[] = data?.data?.emails || [];
    // Prefer generic/info addresses over personal names
    const generic = emails.find(e => /^(info|contact|hello|sales|admin|office|general)@/.test(e.value));
    return generic?.value || emails[0]?.value || null;
  } catch {
    return null;
  }
}

// ── Hunter.io company name search ────────────────────────────────────────────

async function hunterCompanySearch(company: string, city: string): Promise<string | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const query = encodeURIComponent(`${company} ${city}`);
    const url = `https://api.hunter.io/v2/email-finder?company=${query}&api_key=${HUNTER_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.email || null;
  } catch {
    return null;
  }
}

// ── Extract domain from website URL ─────────────────────────────────────────

function getDomain(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST() {
  // Get all no-email outreach leads that are still in draft/pending queue
  const { rows: leads } = await pool.query(`
    SELECT DISTINCT l.id AS lead_id, l.business_name, l.website, l.city, o.id AS outreach_id
    FROM vending_outreach o
    JOIN vending_leads l ON o.lead_id = l.id
    WHERE o.status::text IN ('draft', 'pending_approval')
      AND (l.email IS NULL OR l.email = '')
    ORDER BY l.business_name
  `);

  if (leads.length === 0) {
    return NextResponse.json({ found: 0, checked: 0, message: 'No no-email leads in queue.' });
  }

  let found = 0;
  const results: { business: string; email: string; method: string }[] = [];
  const noFind: string[] = [];

  for (const lead of leads) {
    let email: string | null = null;
    let method = '';

    // 1. Try scraping the website
    if (lead.website) {
      email = await findEmailFromWebsite(lead.website);
      if (email) method = 'website';
    }

    // 2. Try Hunter.io domain search
    if (!email && lead.website && HUNTER_API_KEY) {
      email = await hunterDomainSearch(getDomain(lead.website));
      if (email) method = 'hunter_domain';
    }

    // 3. Try Hunter.io company name search
    if (!email && HUNTER_API_KEY) {
      email = await hunterCompanySearch(lead.business_name, lead.city || '');
      if (email) method = 'hunter_company';
    }

    if (email) {
      // Update the lead with the found email
      await pool.query(
        `UPDATE vending_leads SET email = $1, updated_at = NOW() WHERE id = $2`,
        [email, lead.lead_id]
      );
      // Move outreach back to pending_approval so it enters the normal queue
      await pool.query(
        `UPDATE vending_outreach SET status = 'pending_approval', updated_at = NOW() WHERE id = $1`,
        [lead.outreach_id]
      );
      found++;
      results.push({ business: lead.business_name, email, method });
    } else {
      noFind.push(lead.business_name);
    }
  }

  return NextResponse.json({
    found,
    checked: leads.length,
    results,
    not_found: noFind,
    hunter_available: !!HUNTER_API_KEY,
  });
}
