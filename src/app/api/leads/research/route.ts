import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { web_search } from '@/lib/research';

const TRADES = ['HVAC', 'Plumbing', 'Roofing'];
const CITIES = ['Baltimore', 'Towson', 'Columbia', 'Silver Spring', 'Annapolis', ' Glen Burnie', 'Catonsville', 'Owings Mills', 'Pikesville', 'Randallstown'];

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

function extractPhone(text: string): string | null {
  const phoneMatch = text.match(/(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);
  return phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, '') : null;
}

function cleanText(text: string): string {
  // Remove markdown/image tags and clean up
  return text
    .replace(/<<<.*?>>>/g, '')
    .replace(/Source:.*?\n/g, '')
    .replace(/---/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function classifyIndustry(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('hvac') || lower.includes('heating') || lower.includes('air conditioning') || lower.includes('furnace')) return 'HVAC';
  if (lower.includes('plumb') || lower.includes('drain') || lower.includes('water heater')) return 'Plumbing';
  if (lower.includes('roof') || lower.includes('roofing') || lower.includes('shingle') || lower.includes('metal roof')) return 'Roofing';
  return 'HVAC'; // default
}

export async function POST(request: Request) {
  const body = await request.json();
  const { trade, city, limit = 10 } = body;

  const results: any[] = [];

  try {
    // Search for each trade + city combination
    for (const t of trade ? [trade] : TRADES) {
      for (const c of city ? [city] : CITIES.slice(0, 3)) {
        try {
          const query = `${t} companies ${c} Maryland`;
          const searchResults = await web_search(query, Math.ceil(limit / (TRADES.length * 3)));
          
          for (const result of searchResults) {
            const cleanTitle = cleanText(result.title);
            const cleanDesc = cleanText(result.description);
            const phone = extractPhone(cleanTitle + ' ' + cleanDesc);
            
            // Extract company name - take first part before dash or pipe
            let companyName = cleanTitle.split(/[-|]/)[0].trim();
            if (!companyName || companyName.length < 2) {
              companyName = cleanTitle;
            }
            
            const industry = classifyIndustry(cleanTitle + ' ' + cleanDesc);
            
            if (companyName && companyName.length > 2) {
              results.push({
                company_name: companyName,
                phone: phone || '',
                city: c,
                state: 'MD',
                industry,
                website_url: '',
                has_website: false,
                google_rating: null,
                review_count: 0,
                status: 'researched',
                source: 'automated_research',
                notes: `Source: ${result.url}`
              });
            }
          }
        } catch (e) {
          console.error(`Search error for ${t} ${c}:`, e);
        }
      }
    }

    // De-duplicate by company name
    const unique = results.filter((v, i, a) => a.findIndex(t => t.company_name.toLowerCase() === t.company_name.toLowerCase()) === i);

    // Insert into database
    let added = 0;
    for (const lead of unique.slice(0, limit)) {
      try {
        await pool.query(
          `INSERT INTO leads (company_name, phone, city, state, industry, status, source, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [lead.company_name, lead.phone, lead.city, lead.state, lead.industry, lead.status, lead.source, lead.notes]
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
