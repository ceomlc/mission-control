'use client';

import React, { useState, useEffect } from 'react';

interface FacilityResult {
  vertical: string;
  a_sends: number;
  a_replies: number;
  a_reply_rate: number;
  b_sends: number;
  b_replies: number;
  b_reply_rate: number;
  winner: {
    status: 'winner' | 'tie' | 'building' | 'insufficient_data' | 'no_data';
    winner?: string;
    margin?: string;
    needed?: number;
    diff?: number;
  };
}

interface KpiData {
  summary: {
    total_sent: number;
    total_bounced: number;
    deliverable: number;
    total_replied: number;
    total_interested: number;
    opted_out: number;
    touch2_sent: number;
    touch3_sent: number;
    reply_rate: number;
    interest_rate: number;
    end_to_end: number;
    opt_out_rate: number;
    bounce_rate: number;
  };
  splits: Array<{
    variant: string;
    label: string;
    sends: number;
    replies: number;
    interested: number;
    reply_rate: number;
    interest_rate: number;
    sample_status: 'sufficient' | 'building' | 'too_early';
  }>;
  touch_performance: Array<{ touch: string; replies: number }>;
  facility_results: FacilityResult[];
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

function SampleBadge({ status }: { status: string }) {
  if (status === 'sufficient') return <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded-full">✅ Sufficient</span>;
  if (status === 'building')   return <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded-full">⏳ Building</span>;
  return <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded-full">Too early</span>;
}

export default function VendingKpiPage() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/vending/kpi')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-400 p-8">Loading KPI data...</div>;
  if (error)   return <div className="text-red-400 p-8">Error: {error}</div>;
  if (!data)   return null;

  const { summary, splits, touch_performance, facility_results = [] } = data;
  const maxTouchReplies = Math.max(...touch_performance.map(t => t.replies), 1);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Vending KPI</h1>

      {/* Email Funnel */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Email Funnel</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            {
              label: 'Total Sent',
              value: summary.total_sent.toLocaleString(),
              sub: `${summary.touch2_sent} Touch 2 • ${summary.touch3_sent} Touch 3`,
              color: 'text-white',
            },
            {
              label: 'Bounced',
              value: summary.total_bounced.toLocaleString(),
              sub: `${pct(summary.bounce_rate)} bounce rate`,
              color: summary.total_bounced > 0 ? 'text-red-400' : 'text-white',
            },
            {
              label: 'Reply Rate',
              value: pct(summary.reply_rate),
              sub: `${summary.total_replied} replies of ${summary.deliverable} deliverable`,
              color: 'text-white',
            },
            {
              label: 'Interest Rate',
              value: pct(summary.interest_rate),
              sub: `${summary.total_interested} interested`,
              color: 'text-white',
            },
            {
              label: 'End-to-End',
              value: pct(summary.end_to_end),
              sub: `Deliverable → Interested`,
              color: 'text-white',
            },
          ].map(card => (
            <div key={card.label} className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-gray-500 text-xs mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
        {summary.total_bounced > 0 && (
          <p className="text-xs text-red-400/70 mt-2 pl-1">
            ⚠️ {summary.total_bounced} bounced email{summary.total_bounced !== 1 ? 's' : ''} — tell Thoth to mark these as <code className="font-mono">bounced</code> in vending_outreach and <code className="font-mono">bad_data</code> in vending_leads.
          </p>
        )}
      </section>

      {/* A/B Split */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">A/B Split</h2>
        <p className="text-gray-500 text-sm mb-4">Sufficient sample = 30+ sends per variant</p>
        <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#2A2A3E]">
              <tr className="text-left text-gray-400 text-xs">
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Framing</th>
                <th className="px-4 py-3">Sends</th>
                <th className="px-4 py-3">Replies</th>
                <th className="px-4 py-3">Reply Rate</th>
                <th className="px-4 py-3">Interested</th>
                <th className="px-4 py-3">Interest Rate</th>
                <th className="px-4 py-3">Sample</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {splits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No data yet — emails need to be sent first
                  </td>
                </tr>
              ) : splits.map(row => (
                <tr key={row.variant} className="border-b border-[#2A2A3E]">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                      row.variant === 'a'
                        ? 'bg-cyan-900/50 text-cyan-300'
                        : 'bg-purple-900/50 text-purple-300'
                    }`}>
                      {row.variant.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{row.label}</td>
                  <td className="px-4 py-3 font-medium text-white">{row.sends}</td>
                  <td className="px-4 py-3">{row.replies}</td>
                  <td className="px-4 py-3 font-semibold text-white">{pct(row.reply_rate)}</td>
                  <td className="px-4 py-3">{row.interested}</td>
                  <td className="px-4 py-3 font-semibold text-white">{pct(row.interest_rate)}</td>
                  <td className="px-4 py-3"><SampleBadge status={row.sample_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {splits.length > 0 && (
          <div className="mt-3 text-xs text-gray-500 pl-1">
            {splits[0]?.reply_rate > splits[1]?.reply_rate
              ? `Variant A is leading by ${pct(splits[0].reply_rate - (splits[1]?.reply_rate || 0))} reply rate`
              : splits[1]?.reply_rate > splits[0]?.reply_rate
              ? `Variant B is leading by ${pct(splits[1].reply_rate - (splits[0]?.reply_rate || 0))} reply rate`
              : 'Variants tied — keep building sample'}
          </div>
        )}
      </section>

      {/* Touch Performance */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Touch Performance</h2>
        <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-6 space-y-4">
          {touch_performance.length === 0 ? (
            <p className="text-gray-500 text-sm">No replies yet — check back after first emails are sent</p>
          ) : touch_performance.map(t => (
            <div key={t.touch} className="flex items-center gap-4">
              <span className="text-gray-400 text-sm w-20">{t.touch}</span>
              <div className="flex-1 bg-[#0A0A0F] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${(t.replies / maxTouchReplies) * 100}%` }}
                />
              </div>
              <span className="text-white text-sm font-medium w-16 text-right">
                {t.replies} {t.replies === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Facility Type Results */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">Facility Type Results</h2>
        <p className="text-gray-500 text-sm mb-4">
          Winner declared after 20+ sends per variant per facility type. 5% reply rate gap required.
        </p>
        <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#2A2A3E]">
              <tr className="text-left text-gray-400 text-xs">
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">A Sends</th>
                <th className="px-4 py-3">A Reply%</th>
                <th className="px-4 py-3">B Sends</th>
                <th className="px-4 py-3">B Reply%</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {facility_results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No facility data yet — results appear after first sends
                  </td>
                </tr>
              ) : facility_results.map(row => {
                const w = row.winner;
                let statusEl: React.ReactNode;
                if (w.status === 'winner') {
                  const color = w.winner === 'A' ? 'text-cyan-300' : 'text-purple-300';
                  statusEl = <span className={`font-semibold ${color}`}>🏆 {w.winner} wins (+{w.margin})</span>;
                } else if (w.status === 'tie') {
                  statusEl = <span className="text-yellow-400">⚖️ Too close — tied</span>;
                } else if (w.status === 'building') {
                  statusEl = <span className="text-gray-400">🔨 Building ({w.needed} more needed)</span>;
                } else {
                  statusEl = <span className="text-gray-600">⏳ Not enough data</span>;
                }

                return (
                  <tr key={row.vertical} className="border-b border-[#2A2A3E]">
                    <td className="px-4 py-3 text-white font-medium capitalize">{row.vertical}</td>
                    <td className="px-4 py-3">
                      <span className="text-cyan-300 font-mono">{row.a_sends}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {row.a_sends > 0 ? pct(row.a_reply_rate) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-purple-300 font-mono">{row.b_sends}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {row.b_sends > 0 ? pct(row.b_reply_rate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">{statusEl}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
