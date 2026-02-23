'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  tokens: {
    input: number;
    output: number;
    total: number;
    cacheRead: number;
    cacheWrite: number;
  };
  context: {
    current: number;
    max: number;
    percentage: number;
  };
  compactions: number;
  session: {
    id: string;
    model: string;
    runtime: string;
    thinking: boolean;
  };
  cost: {
    inputCostPerM: number;
    outputCostPerM: number;
    estimatedTotal: number;
  };
  usage: {
    websitesBuilt: number;
    messagesProcessed: number;
    cronRuns: number;
    totalSessions: number;
  };
}

export default function MetricsPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/usage');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error('Failed to fetch usage:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Usage & Metrics</h1>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : data ? (
        <>
          {/* Token Usage */}
          <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2A2A3E] rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Token Usage</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#22d3ee]">{formatNumber(data.tokens.input)}</div>
                <div className="text-sm text-gray-400">Input</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{formatNumber(data.tokens.output)}</div>
                <div className="text-sm text-gray-400">Output</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{formatNumber(data.tokens.total)}</div>
                <div className="text-sm text-gray-400">Total</div>
              </div>
            </div>
          </div>

          {/* Context & Compactions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1A1A2E] rounded-xl p-6">
              <h3 className="text-sm text-gray-400 mb-2">Context Usage</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold">{formatNumber(data.context.current)}</span>
                <span className="text-gray-500">/ {formatNumber(data.context.max)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-[#22d3ee] h-2 rounded-full transition-all" 
                  style={{ width: `${data.context.percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{data.context.percentage}% used</div>
            </div>

            <div className="bg-[#1A1A2E] rounded-xl p-6">
              <h3 className="text-sm text-gray-400 mb-2">Compactions</h3>
              <div className="text-3xl font-bold text-orange-400">{data.compactions}</div>
              <div className="text-sm text-gray-500">memory optimizations</div>
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="bg-[#1A1A2E] rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Estimated Cost</h2>
            <div className="text-4xl font-bold text-green-400">
              ${data.cost.estimatedTotal.toFixed(2)}
              <span className="text-sm text-gray-400 font-normal ml-2">/ today</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Model: {data.session.model} • {data.cost.inputCostPerM > 0 ? `$${data.cost.inputCostPerM}/1M in` : 'Free tier'}
            </div>
          </div>

          {/* Activity Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#22d3ee]">{data.usage.websitesBuilt}</div>
              <div className="text-sm text-gray-400">Websites Built</div>
            </div>
            <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{data.usage.messagesProcessed}</div>
              <div className="text-sm text-gray-400">Messages</div>
            </div>
            <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{data.usage.cronRuns}</div>
              <div className="text-sm text-gray-400">Cron Runs</div>
            </div>
            <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{data.usage.totalSessions}</div>
              <div className="text-sm text-gray-400">Sessions</div>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-[#1A1A2E] rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Current Session</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Session ID:</span>
                <span className="ml-2 font-mono">{data.session.id}</span>
              </div>
              <div>
                <span className="text-gray-400">Model:</span>
                <span className="ml-2 text-[#22d3ee]">{data.session.model}</span>
              </div>
              <div>
                <span className="text-gray-400">Runtime:</span>
                <span className="ml-2">{data.session.runtime}</span>
              </div>
              <div>
                <span className="text-gray-400">Thinking:</span>
                <span className="ml-2">{data.session.thinking ? 'On' : 'Off'}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">Failed to load metrics</div>
      )}
    </div>
  );
}
