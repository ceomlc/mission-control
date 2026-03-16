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

function generateMessage(lead: any): string {
  const firstName = lead.company_name?.split(' ')[0] || 'there';
  const city = lead.city || 'Baltimore';
  const industry = lead.industry || 'trade';
  
  // Use personal_observation from database if available
  const personalObservation = lead.personal_observation;
  
  if (personalObservation) {
    return `Hey ${firstName} — I was looking into ${lead.company_name} online and noticed ${personalObservation}.\n\nI went ahead and put together a free website concept for you — already built it out. Want to see it?\n\nReply YES to check it out or NO and I'll leave you alone 🤝\n— Jaivien, More Life Consulting`;
  }
  
  // Fallback to old logic if no personal_observation
  const hasWebsite = lead.has_website;
  const rating = lead.google_rating;
  const reviewCount = lead.review_count || 0;

  if (hasWebsite === false || hasWebsite === 'false' || hasWebsite === 0) {
    return `Hey ${firstName} — searched for ${lead.company_name} on Google, your info comes up but there's nowhere to send people. Most ${industry.toLowerCase()} calls in ${city} go to whoever shows up first with a site. Happy to fix that fast if it's useful. — Jaivien`;
  }
  
  if (rating && rating < 4.0) {
    return `Hey ${firstName} — ${lead.company_name} is sitting at ${rating} stars. Most customers filter below 4.0 without realizing it. We fix that for ${industry.toLowerCase()} businesses in ${city} pretty quickly — worth a 10 min call? — Jaivien`;
  }
  
  if (rating && rating >= 4.0) {
    return `Hey ${firstName} — looked at ${lead.company_name} online, you've got a ${rating} star rating. A few updates to your site could pull you ahead of the other ${industry.toLowerCase()} companies in ${city}. Happy to show you what's possible — no push. — Jaivien`;
  }
  
  return `Hey ${firstName} — quick question about ${lead.company_name} in ${city}. What's the #1 thing keeping you from getting more calls? — Jaivien`;
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
    
    // Now generate messages for all leads
    const result = await pool.query(
      "SELECT * FROM leads WHERE status IN ('new', 'researched', 'drafted')"
    );
    
    let generated = 0;
    
    for (const lead of result.rows) {
      const message = generateMessage(lead);
      
      await pool.query(
        "UPDATE leads SET message_drafted = $1, status = 'drafted', updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [message, lead.id]
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
