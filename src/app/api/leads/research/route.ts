export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const TRADES = ['HVAC', 'Plumbing', 'Roofing'];
const CITIES = [
  'Baltimore', 'Towson', 'Columbia', 'Silver Spring', 'Annapolis',
  'Washington DC', 'Alexandria', 'Arlington', 'Bethesda', 'Rockville',
  'Philadelphia', 'Newark', 'New York', 'Brooklyn', 'Queens',
  'Boston', 'Providence', 'Norfolk', 'Virginia Beach', 'Richmond'
];

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
    
    // Simple check for modern website indicators
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

export async function POST(request: Request) {
  const body = await request.json();
  const { trade, city, limit = 100 } = body;

  const results: any[] = [];

  try {
    // Use Google Maps Places API
    const locations = city ? [city] : CITIES.slice(0, 3);
    
    for (const t of trade ? [trade] : TRADES) {
      for (const loc of locations) {
        try {
          const query = `${t} in ${loc}, Maryland`;
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          for (const result of data.results || []) {
            // Extract city from address
            const addressParts = result.formatted_address.split(',');
            const cityMatch = addressParts[1]?.trim() || loc;
            
            results.push({
              company_name: result.name,
              phone: result.formatted_phone_number || '',
              city: cityMatch,
              state: 'MD',
              industry: t,
              website_url: result.website || '',
              has_website: !!result.website,
              google_rating: result.rating || null,
              review_count: result.user_ratings_total || 0,
              status: 'warm',
              source: 'google_maps_automated',
              research_notes: `Google Maps: ${result.formatted_address}`,
              // Additional research fields
              google_presence: result.rating 
                ? `${result.rating} stars, ${result.user_ratings_total || 0} reviews, in map pack`
                : 'not in Google Maps'
            });
          }
        } catch (e) {
          console.error(`Google Maps error for ${t} ${loc}:`, e);
        }
      }
    }

    // De-duplicate by normalized 10-digit phone first, then company name fallback
    const seen = new Set<string>();
    const unique = results.filter(v => {
      const digits = (v.phone || '').replace(/\D/g, '');
      const key = digits.length >= 10
        ? digits.slice(-10)
        : v.company_name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Normalize phone numbers to 10-digit format before DB insert
    for (const lead of unique) {
      const digits = (lead.phone || '').replace(/\D/g, '');
      lead.phone = digits.length >= 10 ? digits.slice(-10) : digits;
    }

    // Insert into database
    let added = 0;
    for (const lead of unique.slice(0, limit)) {
      try {
        await pool.query(
          `INSERT INTO leads (company_name, phone, city, state, industry, website_url, has_website, google_rating, review_count, status, source, research_notes, google_presence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT DO NOTHING`,
          [lead.company_name, lead.phone, lead.city, lead.state, lead.industry, lead.website_url, lead.has_website, lead.google_rating, lead.review_count, lead.status, lead.source, lead.research_notes, lead.google_presence]
        );
        added++;
      } catch (e) {
        console.error('Insert error:', e);
      }
    }

    // Second research pass: check websites and generate personal observations
    const leadsToResearch = await pool.query(
      `SELECT id, company_name, website_url, google_rating, review_count, personal_observation 
       FROM leads WHERE research_completed = FALSE AND website_url IS NOT NULL AND website_url != '' 
       LIMIT 50`
    );

    for (const lead of leadsToResearch.rows) {
      try {
        // Check website status
        const websiteStatus = await checkWebsite(lead.website_url);
        
        // Generate personal observation
        const personalObservation = generatePersonalObservation(
          websiteStatus, 
          lead.google_rating, 
          lead.review_count
        );
        
        // Get latest data for this lead
        const latestLead = unique.find(l => l.company_name.toLowerCase() === lead.company_name.toLowerCase());
        const googlePresence = latestLead?.google_presence || (lead.google_rating 
          ? `${lead.google_rating} stars, ${lead.review_count} reviews`
          : 'not in Google Maps');
        
        await pool.query(
          `UPDATE leads SET 
            website_status = $1,
            personal_observation = $2,
            google_presence = $3,
            research_completed = TRUE
           WHERE id = $4`,
          [websiteStatus, personalObservation, googlePresence, lead.id]
        );
      } catch (e) {
        console.error('Research update error:', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      researched: unique.length,
      added,
      results: unique.slice(0, limit)
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
