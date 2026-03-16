import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function generateMessage(lead: any): string {
  const firstName = lead.company_name?.split(' ')[0] || 'there';
  const city = lead.city || 'Baltimore';
  const industry = lead.industry || 'trade';
  
  // Use personal_observation from database if available
  const personalObservation = lead.personal_observation;
  
  if (personalObservation) {
    return `Hey ${firstName} — I was looking into ${lead.company_name} online and noticed ${personalObservation}.\n\nI went ahead and put together a free website concept for you — already built it out. Want to see it?`;
  }
  
  // Fallback to old logic if no personal_observation
  const hasWebsite = lead.has_website;
  const rating = lead.google_rating;
  const reviewCount = lead.review_count || 0;

  // NO WEBSITE - reference what we actually saw
  if (hasWebsite === false || hasWebsite === 'false' || hasWebsite === 0) {
    return `Hey ${firstName} — searched for ${lead.company_name} on Google, your info comes up but there's nowhere to send people. Most ${industry.toLowerCase()} calls in ${city} go to whoever shows up first with a site. Happy to fix that fast if it's useful. — Jaivien`;
  }
  
  // HAS WEBSITE but LOW RATING - specific to their situation
  if (rating && rating < 4.0) {
    return `Hey ${firstName} — ${lead.company_name} is sitting at ${rating} stars. Most customers filter below 4.0 without realizing it. We fix that for ${industry.toLowerCase()} businesses in ${city} pretty quickly — worth a 10 min call? — Jaivien`;
  }
  
  // HAS WEBSITE and OK RATING - growth angle
  if (rating && rating >= 4.0) {
    return `Hey ${firstName} — looked at ${lead.company_name} online, you've got a ${rating} star rating. A few updates to your site could pull you ahead of the other ${industry.toLowerCase()} companies in ${city}. Happy to show you what's possible — no push. — Jaivien`;
  }
  
  // FALLBACK - no research data available, keep it simple
  return `Hey ${firstName} — quick question about ${lead.company_name} in ${city}. What's the #1 thing keeping you from getting more calls? — Jaivien`;
}

export async function POST() {
  try {
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
      generated,
      message: `Generated research-based messages for ${generated} leads`
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
