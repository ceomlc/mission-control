export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Keywords that indicate interest in getting a website
const INTEREST_KEYWORDS = [
  'yes', 'interested', 'tell me more', 'more info', 'how much', 
  'pricing', 'cost', 'quote', 'can you', 'please', 'sure', 
  'ok', 'okay', 'sounds good', 'lets do', 'start', 'build',
  'website', 'web design', 'design', 'marketing'
];

// Legal opt-out keywords — must map to opted_out, not just cold
const OPT_OUT_KEYWORDS = [
  'stop', 'remove', 'unsubscribe', 'opt out', 'opt-out',
  'leave me alone', 'do not contact', 'dont contact'
];

// Keywords that indicate NOT interested (but not a legal opt-out)
const DISINTEREST_KEYWORDS = [
  'no thanks', 'not interested', 'don\'t want', 'not looking', 'no thank you'
];

function detectInterest(messageText: string): 'interested' | 'not_interested' | 'opted_out' | 'neutral' {
  if (!messageText) return 'neutral';

  const lower = messageText.toLowerCase();

  // Check for legal opt-outs first — highest priority
  for (const keyword of OPT_OUT_KEYWORDS) {
    if (lower.includes(keyword)) return 'opted_out';
  }

  // Check for disinterest
  for (const keyword of DISINTEREST_KEYWORDS) {
    if (lower.includes(keyword)) return 'not_interested';
  }

  // Check for interest
  for (const keyword of INTEREST_KEYWORDS) {
    if (lower.includes(keyword)) return 'interested';
  }

  return 'neutral';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limit = 50, autoBuild = true } = body;

    // Get sent leads (the ones we're waiting on replies for)
    const result = await pool.query(
      "SELECT id, company_name, phone, website_url, google_rating FROM leads WHERE status = 'sent' AND phone IS NOT NULL AND phone != '' LIMIT $1",
      [limit]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ checked: 0, responses: [], buildsTriggered: [] });
    }

    const responses: any[] = [];
    const buildsTriggered: any[] = [];

    // Check each number in iMessage
    for (const lead of result.rows) {
      const phone = (lead.phone || '').replace(/\D/g, '');
      if (!phone) continue;

      try {
        // Search for messages from this number
        const { stdout } = await execAsync(`imsg chats --json 2>/dev/null | grep -i "${phone}" || echo ""`);
        
        if (stdout.trim()) {
          // Get chat history with this number
          const chatResult = await execAsync(`imsg chats --json 2>/dev/null`);
          const chats = JSON.parse(chatResult.stdout || '[]');
          const chat = chats.find((c: any) => c.identifier?.includes(phone));
          
          if (chat) {
            // Get last message in this chat
            const { stdout: historyOut } = await execAsync(`imsg history --chat-id ${chat.id} --limit 1 --json 2>/dev/null`);
            if (historyOut.trim()) {
              const history = JSON.parse(historyOut);
              const lastMsg = history[0];
              
              // Check if last message is FROM them (not us)
              if (lastMsg && !lastMsg.isFromMe) {
                const interest = detectInterest(lastMsg.text);
                
                responses.push({
                  leadId: lead.id,
                  company: lead.company_name,
                  phone: lead.phone,
                  lastMessage: lastMsg.text,
                  respondedAt: lastMsg.date,
                  interest
                });

                // Update status based on interest
                if (interest === 'opted_out') {
                  await pool.query(
                    "UPDATE leads SET status = 'opted_out', response_text = $2, updated_at = NOW() WHERE id = $1",
                    [lead.id, lastMsg.text]
                  );
                } else if (interest === 'interested') {
                  await pool.query(
                    "UPDATE leads SET status = 'hot', response_text = $2, updated_at = NOW() WHERE id = $1",
                    [lead.id, lastMsg.text]
                  );

                  // AUTO-TRIGGER BUILD WORKFLOW
                  if (autoBuild && lead.website_url) {
                    try {
                      // Extract brand
                      const brandRes = await fetch('http://localhost:3000/api/projects/extract-brand', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          client: lead.company_name,
                          url: lead.website_url,
                          city: lead.city || '',
                          state: lead.state || 'MD'
                        })
                      });
                      const brandData = await brandRes.json();
                      
                      if (brandData.success) {
                        // Generate SPEC.md
                        const specRes = await fetch('http://localhost:3000/api/projects/spec', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            clientName: brandData.brand.clientName,
                            slug: brandData.brand.slug,
                            websiteUrl: brandData.brand.websiteUrl,
                            industry: brandData.brand.industry,
                            city: brandData.brand.city,
                            state: brandData.brand.state,
                            services: brandData.brand.services,
                            tagline: brandData.brand.tagline,
                            targetAudience: brandData.brand.targetAudience,
                            designPreferences: brandData.brand.designPreferences,
                            contact: brandData.brand.contact
                          })
                        });
                        const specData = await specRes.json();
                        
                        buildsTriggered.push({
                          leadId: lead.id,
                          company: lead.company_name,
                          brandExtracted: true,
                          specGenerated: specData.success,
                          slug: brandData.brand.slug
                        });
                      }
                    } catch (buildError) {
                      console.error('Auto-build trigger failed:', buildError);
                    }
                  }
                } else if (interest === 'not_interested') {
                  await pool.query(
                    "UPDATE leads SET status = 'cold', response_text = $2, updated_at = NOW() WHERE id = $1",
                    [lead.id, lastMsg.text]
                  );
                } else {
                  // Replied but neutral — log the text, keep in sequence
                  await pool.query(
                    "UPDATE leads SET status = 'replied', response_text = $2, updated_at = NOW() WHERE id = $1",
                    [lead.id, lastMsg.text]
                  );
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip this number if check fails
        continue;
      }
    }

    return NextResponse.json({ 
      checked: result.rows.length,
      responses,
      respondedCount: responses.filter(r => r.interest !== 'not_interested').length,
      interestedCount: responses.filter(r => r.interest === 'interested').length,
      buildsTriggered
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
