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

function generateMessage(lead: any): string {
  const firstName = lead.company_name?.split(' ')[0] || 'there';
  const city = lead.city || 'Baltimore';
  const industry = lead.industry || 'trade';
  const hasWebsite = lead.has_website;
  const rating = lead.google_rating;

  // NO WEBSITE
  if (hasWebsite === false || hasWebsite === 'false' || hasWebsite === 0) {
    return `Hey ${firstName} — searched for ${lead.company_name} on Google, your info comes up but there's nowhere to send people. Most ${industry.toLowerCase()} calls in ${city} go to whoever shows up first with a site. Happy to fix that fast if it's useful. — Jaivien`;
  }
  
  // LOW RATING
  if (rating && rating < 4.0) {
    return `Hey ${firstName} — ${lead.company_name} is sitting at ${rating} stars. Most customers filter below 4.0 without realizing it. We fix that for ${industry.toLowerCase()} businesses in ${city} pretty quickly — worth a 10 min call? — Jaivien`;
  }
  
  // OK RATING
  if (rating && rating >= 4.0) {
    return `Hey ${firstName} — looked at ${lead.company_name} online, you've got a ${rating} star rating. A few updates to your site could pull you ahead of the other ${industry.toLowerCase()} companies in ${city}. Happy to show you what's possible — no push. — Jaivien`;
  }
  
  // FALLBACK
  return `Hey ${firstName} — quick question about ${lead.company_name} in ${city}. What's the #1 thing keeping you from getting more calls? — Jaivien`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { trade, city, limit = 100 } = body;

  const results: any[] = [];

  try {
    const locations = city ? [city] : CITIES.slice(0, 5); // Start with 5 cities
    
    for (const t of trade ? [trade] : TRADES) {
      for (const loc of locations) {
        try {
          const query = `${t} in ${loc}`;
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          for (const result of data.results || []) {
            const addressParts = result.formatted_address.split(',');
            const cityMatch = addressParts[1]?.trim() || loc;
            
            results.push({
              company_name: result.name,
              phone: result.formatted_phone_number || '',
              city: cityMatch,
              state: addressParts[2]?.trim().split(' ')[0] || 'MD',
              industry: t,
              website_url: result.website || '',
              has_website: !!result.website,
              google_rating: result.rating || null,
              review_count: result.user_ratings_total || 0,
              status: 'drafted', // Goes straight to drafted!
              source: 'google_maps_automated',
              notes: `Google Maps: ${result.formatted_address}`
            });
          }
        } catch (e) {
          console.error(`Google Maps error for ${t} ${loc}:`, e);
        }
      }
    }

    // De-duplicate
    const unique = results.filter((v, i, a) => a.findIndex(t => t.company_name.toLowerCase() === v.company_name.toLowerCase()) === i);

    // Insert and generate messages
    let added = 0;
    let skipped = 0;
    
    for (const lead of unique.slice(0, limit)) {
      try {
        // Generate message for this lead
        const message = generateMessage(lead);
        
        const result = await pool.query(
          `INSERT INTO leads (company_name, phone, city, state, industry, website_url, has_website, google_rating, review_count, status, source, notes, message_drafted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [lead.company_name, lead.phone, lead.city, lead.state, lead.industry, lead.website_url, lead.has_website, lead.google_rating, lead.review_count, lead.status, lead.source, lead.notes, message]
        );
        
        if (result.rows.length > 0) {
          added++;
        } else {
          skipped++;
        }
      } catch (e) {
        console.error('Insert error:', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      researched: unique.length,
      added,
      skipped,
      results: unique.slice(0, limit).map(l => ({ company_name: l.company_name, city: l.city, industry: l.industry }))
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
