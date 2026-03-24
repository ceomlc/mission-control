export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro allows up to 300s for long-running cron routes
import { NextResponse } from 'next/server';
import vendingPool from '@/lib/vending-db';
import leadsPool from '@/lib/db';

// ── Configuration ────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Verticals → Google Maps search keywords
const VERTICALS: Record<string, string[]> = {
  'gym':        ['gym', 'fitness center', 'crossfit', 'yoga studio', 'health club'],
  'warehouse':  ['warehouse', 'distribution center', 'fulfillment center', 'storage facility'],
  'apartment':  ['apartment complex', 'residential complex', 'apartment community'],
  'office':     ['office building', 'coworking space', 'business center'],
  'hotel':      ['hotel', 'motel', 'extended stay', 'inn'],
};

const CITIES = [
  'Arlington VA', 'Alexandria VA', 'Bethesda MD', 'Rockville MD',
  'Silver Spring MD', 'Washington DC', 'Baltimore MD', 'Columbia MD',
];

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreLead(place: any): { score: number; tier: string } {
  let score = 50; // base

  const rating = place.rating || 0;
  const reviews = place.user_ratings_total || 0;

  if (rating >= 4.5) score += 20;
  else if (rating >= 4.0) score += 10;
  else if (rating < 3.5 && rating > 0) score -= 10;

  if (reviews >= 200) score += 15;
  else if (reviews >= 50) score += 8;
  else if (reviews < 10) score -= 5;

  if (place.website) score += 10;

  // Size signal from types
  const types: string[] = place.types || [];
  if (types.includes('establishment') && reviews >= 50) score += 5;

  const tier = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 45 ? 'C' : 'D';
  return { score, tier };
}

// ── Google Maps Places text search ──────────────────────────────────────────

async function searchPlaces(query: string, location: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// ── Heartbeat writer ─────────────────────────────────────────────────────────

async function writeHeartbeat(task: string) {
  try {
    await leadsPool.query(
      `INSERT INTO agent_heartbeats (agent_id, agent_name, role, current_task, task_type, status, machine, updated_at)
       VALUES ('vending-scout', 'Scout', 'Lead Sourcing', $1, 'research', 'active', 'vercel-cron', NOW())
       ON CONFLICT (agent_id) DO UPDATE
         SET current_task = EXCLUDED.current_task,
             status = EXCLUDED.status,
             machine = EXCLUDED.machine,
             updated_at = NOW()`,
      [task]
    );
  } catch (e) {
    // Heartbeat failure is non-fatal
    console.error('Heartbeat write failed:', e);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const runStart = Date.now();

  // If no API key — still write heartbeat so MC shows the cron is alive
  if (!GOOGLE_MAPS_API_KEY) {
    await writeHeartbeat('Scout is configured — waiting for GOOGLE_MAPS_API_KEY');
    return NextResponse.json({
      new_leads: 0,
      heartbeat: true,
      message: 'No GOOGLE_MAPS_API_KEY set. Add it in Vercel env to enable lead sourcing.',
    });
  }

  let totalNew = 0;
  const errors: string[] = [];

  await writeHeartbeat('Vending scout starting…');

  for (const [vertical, keywords] of Object.entries(VERTICALS)) {
    for (const city of CITIES) {
      for (const keyword of keywords.slice(0, 2)) { // 2 keywords per vertical per city = keep within Maps quota
        try {
          const places = await searchPlaces(keyword, city);

          for (const place of places) {
            const name: string = place.name || '';
            const address: string = place.formatted_address || '';
            // State code is always the last word; city is everything before it
            // e.g. "Silver Spring MD" → city="Silver Spring", state="MD"
            const cityTokens = city.split(' ');
            const statePart = cityTokens[cityTokens.length - 1];
            const cityPart = cityTokens.slice(0, -1).join(' ');
            const phone: string = place.formatted_phone_number || '';
            const website: string = place.website || '';
            const { score, tier } = scoreLead(place);

            // Skip D-tier (low quality)
            if (tier === 'D') continue;

            // Deduplicate: skip if same name+city already exists
            const { rows: exists } = await vendingPool.query(
              `SELECT id FROM vending_leads WHERE lower(business_name) = lower($1) AND lower(city) = lower($2) LIMIT 1`,
              [name, cityPart]
            );
            if (exists.length > 0) continue;

            // Insert new lead
            await vendingPool.query(
              `INSERT INTO vending_leads
                (business_name, vertical, address, city, state, phone, website, score, tier, status, batch_date, scout_notes, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'raw', CURRENT_DATE, $10, NOW(), NOW())`,
              [
                name, vertical, address, cityPart, statePart,
                phone, website, score, tier,
                `Google Maps · rating: ${place.rating ?? 'n/a'} · reviews: ${place.user_ratings_total ?? 0}`,
              ]
            );
            totalNew++;
          }
        } catch (e: any) {
          errors.push(`${vertical}/${city}/${keyword}: ${e.message}`);
        }
      }
    }
  }

  const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
  const task = `Scout completed — ${totalNew} new leads in ${elapsed}s`;
  await writeHeartbeat(task);

  return NextResponse.json({
    new_leads: totalNew,
    heartbeat: true,
    elapsed_seconds: parseFloat(elapsed),
    errors: errors.length > 0 ? errors : undefined,
  });
}
