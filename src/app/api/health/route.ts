import { NextResponse } from 'next/server';
import { invoke } from '@/lib/openclaw';

export async function GET() {
  try {
    const status = await invoke<{ host: string }>('session_status', {});
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }
}
