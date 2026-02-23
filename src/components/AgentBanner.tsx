'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/openclaw';

interface AgentStatus {
  agent?: string;
  version?: string;
  model?: string;
  mode?: string;
  runtime?: string;
  sessions?: number;
}

export function AgentBanner() {
  const [status, setStatus] = useState<AgentStatus>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await invoke<AgentStatus>('session_status', {});
        setStatus(data);
      } catch (e) {
        console.error('Failed to fetch status:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-[#1A1A2E] rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-[#2A2A3E] rounded w-32 mb-3" />
        <div className="flex gap-3">
          <div className="h-5 bg-[#2A2A3E] rounded w-20" />
          <div className="h-5 bg-[#2A2A3E] rounded w-16" />
          <div className="h-5 bg-[#2A2A3E] rounded w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A2E] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦉</span>
          <div>
            <h2 className="font-semibold text-white">Athena</h2>
            <p className="text-xs text-gray-400">v{status.version || '1.0.0'}</p>
          </div>
        </div>
        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
          {status.runtime || 'Running'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>{status.model || 'minimax-m2.5'}</Badge>
        <Badge>{status.sessions || 1} sessions</Badge>
        <Badge>{status.mode || 'gateway'}</Badge>
      </div>

      <div className="flex gap-2">
        <span className="text-xs text-gray-500">Capabilities:</span>
        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Web</span>
        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">Shell</span>
        <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">Files</span>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-1 bg-[#2A2A3E] text-gray-300 rounded-lg">
      {children}
    </span>
  );
}
