import { NextResponse } from 'next/server';
import psycopg2 from 'psycopg2';

export async function GET() {
  try {
    const conn = psycopg2.connect({
      host: process.env.DB_HOST || 'aws-1-us-east-2.pooler.supabase.com',
      port: process.env.DB_PORT || '6543',
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres.woqoxeeyuzujgcdvgqot',
      password: process.env.DB_PASSWORD || 'MoreLife2026Thoth99',
      sslmode: 'require',
    });

    const cursor = conn.cursor();
    cursor.execute('SELECT * FROM vending_cron_jobs ORDER BY time');
    const jobs = cursor.fetchall();
    conn.close();

    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
