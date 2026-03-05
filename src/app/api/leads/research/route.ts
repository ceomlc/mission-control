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
              status: 'researched',
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
    const unique = results.filter((v, i, a) => a.findIndex(t => t.company_name.toLowerCase() === t.company_name.toLowerCase()) === i);

    // Insert into database
    let added = 0;
    for (const lead of unique.slice(0, limit)) {
      try {
        await pool.query(
          `INSERT INTO leads (company_name, phone, city, state, industry, website_url, has_website, google_rating, review_count, status, source, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT DO NOTHING`,
          [lead.company_name, lead.phone, lead.city, lead.state, lead.industry, lead.website_url, lead.has_website, lead.google_rating, lead.review_count, lead.status, lead.source, lead.notes]
        );
        added++;
      } catch (e) {
        console.error('Insert error:', e);
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
