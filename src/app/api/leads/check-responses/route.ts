import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limit = 50 } = body;

    // Get drafted leads (the ones we're sending)
    const result = await pool.query(
      "SELECT id, company_name, phone FROM leads WHERE status = 'drafted' AND phone IS NOT NULL AND phone != '' LIMIT $1",
      [limit]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ checked: 0, responses: [] });
    }

    const responses: any[] = [];

    // Check each number in iMessage
    for (const lead of result.rows) {
      const phone = (lead.phone || '').replace(/\D/g, '');
      if (!phone) continue;

      try {
        // Search for messages from this number - check both directions
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
              
              // Check if last message is FROM them (not us) - meaning they responded
              // Or if there's a recent message that's not from us
              if (lastMsg && !lastMsg.isFromMe) {
                responses.push({
                  leadId: lead.id,
                  company: lead.company_name,
                  phone: lead.phone,
                  lastMessage: lastMsg.text,
                  respondedAt: lastMsg.date
                });
                
                // Update status to responded
                await pool.query(
                  "UPDATE leads SET status = 'responded', updated_at = NOW() WHERE id = $1",
                  [lead.id]
                );
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
      respondedCount: responses.length
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
