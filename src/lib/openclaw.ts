import { env } from 'process';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

export interface GatewayResponse {
  ok: boolean;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
    details?: unknown;
  };
  error?: string;
}

/**
 * Unwrap the gateway response to extract actual data
 */
export function unwrap<T>(response: GatewayResponse): T {
  if (!response.ok) {
    throw new Error(response.error || 'Gateway error');
  }
  if (!response.result?.content?.[0]?.text) {
    throw new Error('No content in response');
  }
  return JSON.parse(response.result.content[0].text) as T;
}

/**
 * Call a gateway tool
 */
export async function invoke<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({ tool, args }),
  });

  const data: GatewayResponse = await response.json();
  return unwrap<T>(data);
}

// Session types
export interface Session {
  key: string;
  agentId?: string;
  created: number;
  activeMinutes?: number;
  mode?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
}

// Cron types
export interface CronJob {
  id: string;
  name?: string;
  schedule: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface CronRun {
  id: string;
  jobId: string;
  status: 'success' | 'failed' | 'running';
  startTime: number;
  endTime?: number;
  output?: string;
}
