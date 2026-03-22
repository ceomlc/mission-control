export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_hooks (
      id         SERIAL PRIMARY KEY,
      hook       TEXT NOT NULL,
      category   TEXT,
      platform   TEXT DEFAULT 'all',
      example    TEXT,
      times_used INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

const SEED_HOOKS = [
  {
    hook: "I automated my entire [task] with AI and nobody in my city is doing this yet",
    category: "curiosity",
    platform: "tiktok",
    example: "I automated my entire outreach with AI and nobody in Baltimore is doing this yet",
  },
  {
    hook: "Here's what they don't teach you about AI in school",
    category: "controversy",
    platform: "all",
    example: "Here's what they don't teach you about AI in school — and it's costing people jobs",
  },
  {
    hook: "POV: You just saved 3 hours using a free AI tool most people don't know exists",
    category: "relatability",
    platform: "tiktok",
    example: "POV: You just saved 3 hours using a free AI tool most people don't know exists",
  },
  {
    hook: "I built a system that [outcome] while I slept — here's exactly how",
    category: "curiosity",
    platform: "all",
    example: "I built a system that generates leads while I slept — here's exactly how",
  },
  {
    hook: "Stop using ChatGPT like this. Do this instead",
    category: "controversy",
    platform: "all",
    example: "Stop using ChatGPT like a search engine. Do this instead",
  },
  {
    hook: "Real talk — AI isn't taking jobs from people who know how to use it",
    category: "controversy",
    platform: "all",
    example: "Real talk — AI isn't taking jobs from people who know how to use it",
  },
  {
    hook: "The AI tool that [specific outcome] in [short time] — completely free",
    category: "curiosity",
    platform: "tiktok",
    example: "The AI tool that wrote my entire proposal in 8 minutes — completely free",
  },
  {
    hook: "Nobody in [community] is talking about this AI strategy",
    category: "relatability",
    platform: "all",
    example: "Nobody in the Black entrepreneur space is talking about this AI strategy",
  },
  {
    hook: "I went from [before state] to [after state] using one AI workflow",
    category: "transformation",
    platform: "all",
    example: "I went from 40-hour weeks to 20-hour weeks using one AI workflow",
  },
  {
    hook: "Watch me build a [thing] with AI in real time",
    category: "curiosity",
    platform: "tiktok",
    example: "Watch me build a lead generation system with AI in real time",
  },
  {
    hook: "This is what AI actually looks like when Black entrepreneurs use it",
    category: "relatability",
    platform: "all",
    example: "This is what AI actually looks like when Black entrepreneurs use it",
  },
  {
    hook: "I made [amount] this month and AI did 80% of the work",
    category: "transformation",
    platform: "all",
    example: "I closed 3 clients this month and AI did 80% of the work",
  },
  {
    hook: "3 AI tools I use every single day that most people overlook",
    category: "curiosity",
    platform: "all",
    example: "3 AI tools I use every single day that most people overlook",
  },
  {
    hook: "The honest truth about [popular AI claim] — I tested it",
    category: "controversy",
    platform: "all",
    example: "The honest truth about AI replacing designers — I tested it for 30 days",
  },
  {
    hook: "If you're not using AI for [task] you're working 3x harder than you need to",
    category: "urgency",
    platform: "all",
    example: "If you're not using AI for client proposals you're working 3x harder than you need to",
  },
  {
    hook: "My [role/business] almost failed until I added AI to this one thing",
    category: "transformation",
    platform: "all",
    example: "My consulting business almost failed until I added AI to my outreach",
  },
  {
    hook: "I gave AI my entire business and here's what it said",
    category: "curiosity",
    platform: "tiktok",
    example: "I gave AI my entire business plan and here's what it said",
  },
  {
    hook: "What [days] days of posting AI content taught me about [lesson]",
    category: "transformation",
    platform: "youtube",
    example: "What 30 days of posting AI content taught me about building an audience",
  },
  {
    hook: "The AI workflow no one shows you — step by step",
    category: "curiosity",
    platform: "all",
    example: "The AI workflow no one shows you for automating client onboarding — step by step",
  },
  {
    hook: "They said AI was just a trend. Here's my bank account 6 months later",
    category: "controversy",
    platform: "all",
    example: "They said AI was just a trend. Here's what my business looks like 6 months later",
  },
];

async function seedIfEmpty() {
  const count = await pool.query('SELECT COUNT(*) FROM content_hooks');
  if (parseInt(count.rows[0].count, 10) === 0) {
    for (const h of SEED_HOOKS) {
      await pool.query(
        `INSERT INTO content_hooks (hook, category, platform, example) VALUES ($1, $2, $3, $4)`,
        [h.hook, h.category, h.platform, h.example]
      );
    }
  }
}

export async function GET() {
  try {
    await ensureTable();
    await seedIfEmpty();
    const result = await pool.query(
      `SELECT * FROM content_hooks ORDER BY category, created_at ASC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Hooks GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch hooks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const { hook, category, platform, example } = body;

    if (!hook || typeof hook !== 'string' || hook.trim() === '') {
      return NextResponse.json({ error: 'hook is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO content_hooks (hook, category, platform, example) VALUES ($1, $2, $3, $4) RETURNING *`,
      [hook.trim(), category || null, platform || 'all', example || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Hooks POST error:', error);
    return NextResponse.json({ error: 'Failed to create hook' }, { status: 500 });
  }
}
