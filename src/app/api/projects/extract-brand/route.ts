import { NextResponse } from 'next/server';
import { web_fetch, web_search } from '@/lib/research';

interface BrandExtractionResult {
  clientName: string;
  slug: string;
  websiteUrl: string;
  industry: string;
  city: string;
  state: string;
  services: string[];
  tagline: string;
  targetAudience: string;
  designPreferences: {
    colors: string[];
    style: string;
    competitors: string[];
  };
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client, url, city, state } = body;

    if (!client || !url) {
      return NextResponse.json({ error: 'client and url are required' }, { status: 400 });
    }

    const slug = client.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Determine industry from context or search
    let industry = 'Trade Services';
    if (client.toLowerCase().includes('hvac')) industry = 'HVAC';
    else if (client.toLowerCase().includes('plumb')) industry = 'Plumbing';
    else if (client.toLowerCase().includes('roof')) industry = 'Roofing';
    else if (client.toLowerCase().includes('electr')) industry = 'Electrical';
    else if (client.toLowerCase().includes('landscape')) industry = 'Landscaping';

    // Fetch the website for brand extraction
    let websiteContent = '';
    let tagline = '';
    let services: string[] = [];
    let phone = '';
    let email = '';
    let address = '';
    let colors: string[] = [];
    let style = 'Professional, modern';

    try {
      const fetchResult = await web_fetch(url, 15000);
      websiteContent = fetchResult.text || '';
    } catch (e) {
      // Continue without website content
    }

    // Extract what we can from the content
    if (websiteContent) {
      // Look for tagline (often in hero sections or about)
      const taglineMatch = websiteContent.match(/(?:tagline|slogan)[:\s]*["']?([^"'<\n]{10,80})["']?/i);
      if (taglineMatch) tagline = taglineMatch[1].trim();

      // Look for phone numbers
      const phoneMatch = websiteContent.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
      if (phoneMatch) phone = phoneMatch[0];

      // Look for email
      const emailMatch = websiteContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) email = emailMatch[0];

      // Look for address
      const addressMatch = websiteContent.match(/\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)[,\s]+[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}/i);
      if (addressMatch) address = addressMatch[0];
    }

    // Search for more info about the company
    try {
      const searchResult = await web_search(`${client} ${city} ${state} services offered`, 3);
      
      if (searchResult.length) {
        // Try to extract services from search results
        const serviceKeywords = ['repair', 'install', 'replacement', 'maintenance', 'service', 'heating', 'cooling', 'air conditioning'];
        for (const result of searchResult.slice(0, 2)) {
          const snippet = result.description || '';
          for (const keyword of serviceKeywords) {
            if (snippet.toLowerCase().includes(keyword) && !services.some(s => snippet.toLowerCase().includes(s.toLowerCase()))) {
              // Extract the service phrase
              const idx = snippet.toLowerCase().indexOf(keyword);
              const service = snippet.slice(Math.max(0, idx - 30), idx + 40).trim();
              if (service.length > 5 && service.length < 60) {
                services.push(service);
              }
            }
          }
        }
      }
    } catch (e) {
      // Continue without search
    }

    // Search for competitors
    let competitors: string[] = [];
    try {
      const compResult = await web_search(`top ${industry} companies ${city} ${state}`, 5);
      
      if (compResult.length) {
        competitors = compResult
          .map((r: any) => r.title?.replace(/ - .*/g, '').trim())
          .filter((c: string) => c && c !== client && c.length < 50)
          .slice(0, 4);
      }
    } catch (e) {
      // Continue without competitor research
    }

    const result: BrandExtractionResult = {
      clientName: client,
      slug,
      websiteUrl: url,
      industry,
      city: city || '',
      state: state || '',
      services: services.slice(0, 6),
      tagline,
      targetAudience: `Homeowners and businesses in ${city || 'the area'} needing ${industry.toLowerCase()} services`,
      designPreferences: {
        colors,
        style,
        competitors
      },
      contact: {
        phone,
        email,
        address
      }
    };

    // Save to database for future reference (optional - skip if table doesn't exist)
    /*
    try {
      await pool.query(
        `INSERT INTO brand_cards (client_name, slug, website_url, industry, city, state, brand_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (slug) DO UPDATE SET brand_data = $6, updated_at = NOW()`,
        [client, slug, url, industry, city, state, JSON.stringify(result)]
      );
    } catch (e) {
      // Continue even if DB save fails
    }
    */

    return NextResponse.json({
      success: true,
      brand: result,
      message: `Brand extracted for ${client}`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
