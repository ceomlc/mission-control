'use client';

import { useEffect, useState, useCallback } from 'react';

interface Overview {
  messages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolsUsed: number;
  errors: number;
  avgTokensPerMsg: number;
  avgCostPerMsg: number;
  totalCost: number;
  totalTokens: number;
  sessions: number;
  sessionsInRange: number;
  throughputTokMin: number;
  costPerMin: number;
  errorRatePct: number;
  avgSessionDurationMin: number;
  cachedTokens: number;
  promptTokens: number;
  cacheHitRatePct: number;
}

interface TopEntry { name: string; cost?: number; tokens?: number; messages?: number; calls?: number }
interface DailyUsage { date: string; input: number; output: number; cacheWrite: number; cacheRead: number; total: number }
interface SessionEntry { name: string; agent: string; provider: string; model: string; messages: number; tools: number; errors: number; durationMin: number; tokens: number }
interface MetricsData {
  period: string;
  overview: Overview;
  topModels: TopEntry[];
  topProviders: TopEntry[];
  topTools: TopEntry[];
  topAgents: TopEntry[];
  topChannels: TopEntry[];
  peakErrorDays: Array<{ date: string; errorRatePct: number; errors: number; messages: number }>;
  activityByDay: Record<string, number>;
  activityByHour: number[];
  dailyTokenUsage: DailyUsage[];
  tokensByType: { output: number; input: number; cacheWrite: number; cacheRead: number; total: number };
  sessions: SessionEntry[];
}

const PERIODS = ['today', '7d', '30d'] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function heatColor(val: number, max: number): string {
  if (!val || !max) return 'bg-[#141414]';
  const ratio = val / max;
  if (ratio > 0.8) return 'bg-orange-500';
  if (ratio > 0.5) return 'bg-orange-600';
  if (ratio > 0.2) return 'bg-orange-800';
  return 'bg-orange-950';
}

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 leading-tight">{sub}</div>}
    </div>
  );
}

export default function MetricsPage() {
  const [period, setPeriod] = useState<string>('today');
  const [data, setData] = useState<MetricsData | null>(null);
  const [pushedAt, setPushedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: string, showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch(`/api/openclaw/metrics?period=${p}`);
      const json = await res.json();
      setData(json.data || null);
      setPushedAt(json.pushedAt || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);
  useEffect(() => {
    const t = setInterval(() => load(period), 30_000);
    return () => clearInterval(t);
  }, [period, load]);

  const o = data?.overview;
  const maxDay = data ? Math.max(...Object.values(data.activityByDay || {})) : 0;
  const maxHour = data ? Math.max(...(data.activityByHour || [])) : 0;
  const maxBar = data ? Math.max(...(data.dailyTokenUsage || []).map(d => d.total)) : 0;

  return (
    <div className="space-y-6 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Usage</h1>
          <p className="text-gray-500 text-xs mt-0.5">See where tokens go, when sessions spike, and what drives cost.</p>
        </div>
        <div className="flex items-center gap-2">
          {pushedAt && (
            <span className="text-gray-600 text-xs">Updated {new Date(pushedAt).toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => load(period, true)}
            disabled={refreshing}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded text-xs font-medium"
          >
            {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Period tabs + summary */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p ? 'bg-orange-600 text-white' : 'bg-[#141414] text-gray-400 hover:text-white'
              }`}
            >
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
        {o && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="text-white font-medium">{fmt(o.totalTokens)} tokens</span>
            <span className="text-white font-medium">${o.totalCost.toFixed(2)} cost</span>
            <span className="text-white font-medium">{o.sessions} sessions</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-[#141414] animate-pulse" />)}
        </div>
      ) : !data ? (
        <div className="bg-[#141414] rounded-xl border border-[#252525] p-12 text-center space-y-3">
          <div className="text-4xl">📊</div>
          <div className="text-white font-semibold">No metrics yet</div>
          <p className="text-gray-500 text-xs max-w-md mx-auto">
            Waiting for Athena to push data. Give Athena the push command to start syncing OpenClaw metrics here.
          </p>
          <div className="mt-4 bg-[#0D0D0D] rounded-lg p-3 text-left font-mono text-xs text-gray-400 max-w-lg mx-auto">
            POST https://mission-control-app-theta.vercel.app/api/openclaw/ingest
          </div>
        </div>
      ) : (
        <>
          {/* Usage Overview */}
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Usage Overview</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-6">
              <StatCard label="Messages" value={fmt(o!.messages)} sub={`${o!.userMessages} user · ${o!.assistantMessages} assistant`} />
              <StatCard label="Tool Calls" value={fmt(o!.toolCalls)} sub={`${o!.toolsUsed} tools used`} />
              <StatCard label="Errors" value={String(o!.errors)} color={o!.errors > 0 ? 'text-red-400' : 'text-white'} />
              <StatCard label="Avg Tokens/Msg" value={fmt(o!.avgTokensPerMsg)} sub={`Across ${fmt(o!.messages)} messages`} />
              <StatCard label="Avg Cost/Msg" value={`$${o!.avgCostPerMsg.toFixed(4)}`} sub={`$${o!.totalCost.toFixed(2)} total`} />
              <StatCard label="Sessions" value={String(o!.sessions)} sub={`of ${o!.sessionsInRange} in range`} />
              <StatCard label="Throughput" value={`${fmt(o!.throughputTokMin)} tok/min`} sub={`$${o!.costPerMin.toFixed(4)}/min`} />
              <StatCard
                label="Error Rate"
                value={`${o!.errorRatePct.toFixed(2)}%`}
                color={o!.errorRatePct > 2 ? 'text-red-400' : o!.errorRatePct > 0.5 ? 'text-yellow-400' : 'text-green-400'}
                sub={`${o!.avgSessionDurationMin.toFixed(0)}m avg session`}
              />
              <StatCard
                label="Cache Hit Rate"
                value={`${o!.cacheHitRatePct.toFixed(1)}%`}
                color="text-green-400"
                sub={`${fmt(o!.cachedTokens)} cached · ${fmt(o!.promptTokens)} prompt`}
              />
            </div>
          </div>

          {/* Top breakdowns: 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Models */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Models</h3>
              <div className="space-y-2">
                {(data.topModels || []).map(m => (
                  <div key={m.name} className="flex justify-between items-start">
                    <div>
                      <div className="text-white text-xs font-medium">{m.name}</div>
                      <div className="text-gray-600 text-[10px]">{fmt(m.tokens!)} · {m.messages} msgs</div>
                    </div>
                    <div className="text-orange-400 text-xs font-medium">${m.cost!.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Providers */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Providers</h3>
              <div className="space-y-2">
                {(data.topProviders || []).map(p => (
                  <div key={p.name} className="flex justify-between items-start">
                    <div>
                      <div className="text-white text-xs font-medium">{p.name}</div>
                      <div className="text-gray-600 text-[10px]">{fmt(p.tokens!)} · {p.messages} msgs</div>
                    </div>
                    <div className="text-orange-400 text-xs font-medium">${p.cost!.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Tools */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Tools</h3>
              <div className="space-y-2">
                {(data.topTools || []).map(t => (
                  <div key={t.name} className="flex justify-between items-center">
                    <span className="text-white text-xs font-medium">{t.name}</span>
                    <span className="text-gray-400 text-xs">{t.calls} calls</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Agents */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Agents</h3>
              <div className="space-y-2">
                {(data.topAgents || []).map(a => (
                  <div key={a.name} className="flex justify-between items-start">
                    <div>
                      <div className="text-white text-xs font-medium">{a.name}</div>
                      <div className="text-gray-600 text-[10px]">{fmt(a.tokens!)}</div>
                    </div>
                    <div className="text-orange-400 text-xs font-medium">${a.cost!.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Channels */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Channels</h3>
              <div className="space-y-2">
                {(data.topChannels || []).map(c => (
                  <div key={c.name} className="flex justify-between items-start">
                    <div>
                      <div className="text-white text-xs font-medium">{c.name}</div>
                      <div className="text-gray-600 text-[10px]">{fmt(c.tokens!)}</div>
                    </div>
                    <div className="text-orange-400 text-xs font-medium">${c.cost!.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Peak Error Days */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Peak Error Days</h3>
              <div className="space-y-2">
                {(data.peakErrorDays || []).map(d => (
                  <div key={d.date} className="flex justify-between items-start">
                    <div>
                      <div className="text-white text-xs font-medium">{d.date}</div>
                      <div className="text-gray-600 text-[10px]">{d.errors} errors · {d.messages} msgs</div>
                    </div>
                    <div className="text-red-400 text-xs font-medium">{d.errorRatePct.toFixed(2)}%</div>
                  </div>
                ))}
                {(!data.peakErrorDays || data.peakErrorDays.length === 0) && (
                  <div className="text-gray-600 text-xs">No errors in range</div>
                )}
              </div>
            </div>
          </div>

          {/* Activity by Time */}
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity by Time</h2>
              <span className="text-orange-400 text-sm font-bold">{fmt(o!.totalTokens)} tokens</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Day of week */}
              <div>
                <div className="text-xs text-gray-500 mb-2">Day of Week</div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(d => {
                    const val = data.activityByDay?.[d] || 0;
                    return (
                      <div key={d} className="flex flex-col items-center gap-1">
                        <div className="text-[10px] text-gray-500">{d}</div>
                        <div className={`w-full h-10 rounded ${heatColor(val, maxDay)} flex items-end justify-center pb-1`}>
                          <span className="text-[9px] text-white/70">{val > 0 ? fmt(val) : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hours */}
              <div>
                <div className="text-xs text-gray-500 mb-2">Hours</div>
                <div className="flex gap-0.5">
                  {(data.activityByHour || Array(24).fill(0)).map((val, h) => (
                    <div
                      key={h}
                      title={`${h === 0 ? 'Midnight' : h === 12 ? 'Noon' : h > 12 ? `${h-12}pm` : `${h}am`}: ${fmt(val)}`}
                      className={`flex-1 h-10 rounded-sm ${heatColor(val, maxHour)}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                  <span>Midnight</span><span>4am</span><span>8am</span><span>Noon</span><span>4pm</span><span>8pm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Token Usage + Sessions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily bar chart */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Daily Token Usage</h3>
              {(data.dailyTokenUsage || []).length === 0 ? (
                <div className="text-gray-600 text-xs py-4 text-center">No daily data</div>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {(data.dailyTokenUsage || []).map(d => {
                    const pct = maxBar > 0 ? (d.total / maxBar) * 100 : 0;
                    const cachePct = d.total > 0 ? ((d.cacheRead + d.cacheWrite) / d.total) * 100 : 0;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${fmt(d.total)}`}>
                        <div className="w-full flex flex-col justify-end" style={{ height: `${pct}%`, minHeight: '2px' }}>
                          <div className="w-full bg-orange-400 rounded-sm" style={{ height: `${cachePct}%`, minHeight: '2px' }} />
                          <div className="w-full bg-cyan-600 rounded-sm flex-1" />
                        </div>
                        <div className="text-[8px] text-gray-600 truncate w-full text-center">
                          {d.date.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sessions list */}
            <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sessions</h3>
                <span className="text-gray-600 text-xs">{(data.sessions || []).length} shown</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(data.sessions || []).map((s, i) => (
                  <div key={i} className="flex justify-between items-start border-b border-[#252525] pb-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-white text-xs font-medium truncate">{s.name}</div>
                      <div className="text-gray-600 text-[10px]">
                        {s.agent} · {s.provider} · {s.model} · {s.messages}msgs · {s.tools}tools
                        {s.errors > 0 && <span className="text-red-400 ml-1">{s.errors}err</span>}
                        {' · '}{s.durationMin.toFixed(0)}m
                      </div>
                    </div>
                    <div className="text-gray-400 text-xs whitespace-nowrap">{fmt(s.tokens)}</div>
                  </div>
                ))}
                {(!data.sessions || data.sessions.length === 0) && (
                  <div className="text-gray-600 text-xs py-2">No sessions</div>
                )}
              </div>
            </div>
          </div>

          {/* Tokens by Type */}
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tokens by Type</h3>
            {data.tokensByType && (
              <>
                <div className="flex h-5 rounded overflow-hidden gap-px mb-3">
                  {(['output','input','cacheWrite','cacheRead'] as const).map((k, i) => {
                    const colors = ['bg-orange-400','bg-cyan-600','bg-green-600','bg-blue-600'];
                    const pct = data.tokensByType.total > 0 ? (data.tokensByType[k] / data.tokensByType.total) * 100 : 0;
                    return pct > 0 ? (
                      <div key={k} className={`${colors[i]} h-full`} style={{ width: `${pct}%` }} title={`${k}: ${fmt(data.tokensByType[k])}`} />
                    ) : null;
                  })}
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1" />Output {fmt(data.tokensByType.output)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-cyan-600 mr-1" />Input {fmt(data.tokensByType.input)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-green-600 mr-1" />Cache Write {fmt(data.tokensByType.cacheWrite)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-600 mr-1" />Cache Read {fmt(data.tokensByType.cacheRead)}</span>
                  <span className="text-gray-400 ml-auto">Total: {fmt(data.tokensByType.total)}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
