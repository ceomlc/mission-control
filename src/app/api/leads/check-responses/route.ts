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

// Keywords that indicate NOT interested (stop the workflow)
const DISINTEREST_KEYWORDS = [
  'no thanks', 'not interested', 'don\'t want', 'not looking',
  'stop', 'remove', 'unsubscribe', 'leave me alone'
];

function detectInterest(messageText: string): 'interested' | 'not_interested' | 'neutral' {
  if (!messageText) return 'neutral';
  
  const lower = messageText.toLowerCase();
  
  // Check for disinterest first
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

    // Get drafted leads (the ones we're sending)
    const result = await pool.query(
      "SELECT id, company_name, phone, website, google_rating FROM leads WHERE status = 'drafted' AND phone IS NOT NULL AND phone != '' LIMIT $1",
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
                if (interest === 'interested') {
                  await pool.query(
                    "UPDATE leads SET status = 'interested', updated_at = NOW() WHERE id = $1",
                    [lead.id]
                  );
                  
                  // AUTO-TRIGGER BUILD WORKFLOW
                  if (autoBuild && lead.website) {
                    try {
                      // Extract brand
                      const brandRes = await fetch('http://localhost:3000/api/projects/extract-brand', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          client: lead.company_name,
                          url: lead.website,
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
                    "UPDATE leads SET status = 'not_interested', updated_at = NOW() WHERE id = $1",
                    [lead.id]
                  );
                } else {
                  // Just responded but neutral
                  await pool.query(
                    "UPDATE leads SET status = 'responded', updated_at = NOW() WHERE id = $1",
                    [lead.id]
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
