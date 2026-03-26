'use client';

import { useState, useEffect } from 'react';

interface Check {
  id: string;
  name: string;
  category: string;
  status: 'passed' | 'warning' | 'failed';
  details: string;
  checkedAt: string;
}

interface HealthData {
  checks: Check[];
  summary: { passed: number; warnings: number; failed: number; total: number };
}

const CATEGORY_ORDER = ['Agents', 'Databases', 'Environment', 'Services'];

const STATUS_DOT: Record<string, string> = {
  passed: 'bg-green-500',
  warning: 'bg-orange-500',
  failed: 'bg-red-500',
};
const STATUS_TEXT: Record<string, string> = {
  passed: 'text-green-400',
  warning: 'text-orange-400',
  failed: 'text-red-400',
};
const STATUS_BADGE: Record<string, string> = {
  passed: 'bg-green-900/40 text-green-400',
  warning: 'bg-orange-900/40 text-orange-400',
  failed: 'bg-red-900/40 text-red-400',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function SecurityPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/security/health')
      .then(r => r.json())
      .then(d => { setData(d); setLastRefresh(new Date()); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  const checks = data?.checks ?? [];
  const filtered = category === 'all' ? checks : checks.filter(c => c.category === category);
  const categories = CATEGORY_ORDER.filter(cat => checks.some(c => c.category === cat));

  const overallStatus = data
    ? data.summary.failed > 0 ? 'failed' : data.summary.warnings > 0 ? 'warning' : 'passed'
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Health</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {lastRefresh ? `Last checked ${timeAgo(lastRefresh.toISOString())}` : 'Checking…'}
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 bg-[#141414] rounded-lg hover:bg-[#252525] text-sm text-gray-400 hover:text-white transition-colors"
        >
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      {loading && !data ? (
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-20 bg-[#141414] rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#141414] rounded-xl p-4 text-center border border-[#252525]">
              <div className="text-2xl font-bold text-green-400">{data?.summary.passed ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">Passed</div>
            </div>
            <div className="bg-[#141414] rounded-xl p-4 text-center border border-[#252525]">
              <div className="text-2xl font-bold text-orange-400">{data?.summary.warnings ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">Warnings</div>
            </div>
            <div className="bg-[#141414] rounded-xl p-4 text-center border border-[#252525]">
              <div className="text-2xl font-bold text-red-400">{data?.summary.failed ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">Failed</div>
            </div>
          </div>

          {/* Overall status banner */}
          {overallStatus && (
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm ${
              overallStatus === 'passed' ? 'bg-green-900/20 border border-green-800/40' :
              overallStatus === 'warning' ? 'bg-orange-900/20 border border-orange-800/40' :
              'bg-red-900/20 border border-red-800/40'
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[overallStatus]}`} />
              <span className={STATUS_TEXT[overallStatus]}>
                {overallStatus === 'passed' ? 'All systems operational' :
                 overallStatus === 'warning' ? `${data?.summary.warnings} check${data?.summary.warnings !== 1 ? 's' : ''} need attention` :
                 `${data?.summary.failed} check${data?.summary.failed !== 1 ? 's' : ''} failing`}
              </span>
              <span className="text-gray-600 ml-auto">{data?.summary.total} checks total</span>
            </div>
          )}

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', ...categories] as string[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  category === cat
                    ? 'bg-[#DC2626] text-white font-medium'
                    : 'bg-[#141414] text-gray-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Checks grouped by category */}
          <div className="space-y-4">
            {(category === 'all' ? CATEGORY_ORDER.filter(c => checks.some(x => x.category === c)) : [category]).map(cat => {
              const catChecks = filtered.filter(c => c.category === cat);
              if (!catChecks.length) return null;
              return (
                <div key={cat} className="bg-[#141414] rounded-xl border border-[#252525] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#0D0D0D] border-b border-[#252525]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{cat}</span>
                  </div>
                  <div className="divide-y divide-[#252525]">
                    {catChecks.map(check => (
                      <div key={check.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[check.status]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{check.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[check.status]}`}>
                              {check.status}
                            </span>
                          </div>
                          <div className="text-gray-500 text-xs mt-0.5">{check.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
