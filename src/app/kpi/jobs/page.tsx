'use client';

import { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface JobsKPI {
  pipeline: {
    total: number;
    in_review: number;
    applied: number;
    interviewing: number;
    offered: number;
    rejected: number;
  };
  rates: {
    apply_rate: number | null;
    interview_rate: number | null;
    offer_rate: number | null;
  };
  activity: {
    added_this_week: number;
    added_this_month: number;
    applied_this_week: number;
    applied_this_month: number;
  };
  by_platform: Array<{
    platform: string;
    total: number;
    applied: number;
  }>;
}

// ── Rate metric config ───────────────────────────────────────────────────────

interface RateConfig {
  key: keyof JobsKPI['rates'];
  label: string;
  target: string;
  description: string;
  green: (v: number) => boolean;
  amber: (v: number) => boolean;
}

const RATES: RateConfig[] = [
  {
    key: 'apply_rate',
    label: 'Apply Rate',
    target: 'Target: >30%',
    description: 'Applied ÷ (Applied + Rejected) — quality of sourcing',
    green: (v) => v >= 0.30,
    amber: (v) => v >= 0.10 && v < 0.30,
  },
  {
    key: 'interview_rate',
    label: 'Interview Rate',
    target: 'Target: >20%',
    description: 'Interviews ÷ Applied — resume & application strength',
    green: (v) => v >= 0.20,
    amber: (v) => v >= 0.10 && v < 0.20,
  },
  {
    key: 'offer_rate',
    label: 'Offer Rate',
    target: 'Target: >30%',
    description: 'Offers ÷ Interviews — interview performance',
    green: (v) => v >= 0.30,
    amber: (v) => v >= 0.15 && v < 0.30,
  },
];

function dotColor(cfg: RateConfig, value: number): string {
  if (cfg.green(value)) return '#22c55e';
  if (cfg.amber(value)) return '#f59e0b';
  return '#DC143C';
}

function pct(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return (v * 100).toFixed(1) + '%';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function JobsKPIPage() {
  const [data, setData] = useState<JobsKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/kpi/jobs')
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center" style={{ color: '#e2e8f0' }}>Loading Jobs KPIs...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center" style={{ color: '#DC143C' }}>
        Failed to load: {error}
      </div>
    );
  }

  const { pipeline, rates, activity, by_platform } = data!;

  return (
    <div className="space-y-8" style={{ color: 'white' }}>
      <h1 className="text-2xl font-bold text-white">Jobs KPI Dashboard</h1>

      {/* ── Pipeline Overview ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-1" style={{ color: '#e2e8f0' }}>Pipeline</h2>
        <p className="text-xs mb-3" style={{ color: '#e2e8f0', opacity: 0.5 }}>
          Live status of every job in the tracker
        </p>

        {/* 4 primary stage cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Applied',      value: pipeline.applied,      icon: '📤', color: '#3b82f6', sub: 'Applications sent' },
            { label: 'Interviewing', value: pipeline.interviewing,  icon: '🎙️',  color: '#a855f7', sub: 'Active interview process' },
            { label: 'Offers',       value: pipeline.offered,       icon: '🏆', color: '#22c55e', sub: 'Offers received' },
            { label: 'Rejected',     value: pipeline.rejected,      icon: '✗',  color: '#6b7280', sub: 'Skipped or declined' },
          ].map(({ label, value, icon, color, sub }) => (
            <div
              key={label}
              className="rounded-xl p-4 flex flex-col gap-1"
              style={{ background: '#141414', border: `1px solid ${color}40` }}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-3xl font-bold" style={{ color }}>{value}</span>
              <span className="text-xs font-medium" style={{ color: '#e2e8f0' }}>{label}</span>
              <span className="text-xs" style={{ color: '#e2e8f0', opacity: 0.5 }}>{sub}</span>
            </div>
          ))}
        </div>

        {/* Secondary totals */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#141414', border: '1px solid #f59e0b40' }}
          >
            <span className="text-2xl">📋</span>
            <div>
              <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{pipeline.in_review}</div>
              <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>In Review</div>
              <div className="text-xs" style={{ color: '#e2e8f0', opacity: 0.5 }}>New, reviewing, or approved — not yet applied</div>
            </div>
          </div>
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#141414', border: '1px solid #52525b40' }}
          >
            <span className="text-2xl">📦</span>
            <div>
              <div className="text-3xl font-bold" style={{ color: '#a1a1aa' }}>{pipeline.total}</div>
              <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Total Sourced</div>
              <div className="text-xs" style={{ color: '#e2e8f0', opacity: 0.5 }}>All jobs ever tracked</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Conversion Rates ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>Conversion Funnel</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RATES.map((cfg) => {
            const value = rates[cfg.key];
            const color = value !== null ? dotColor(cfg, value) : '#52525b';
            return (
              <div
                key={cfg.key}
                className="rounded-xl p-4 flex flex-col gap-1"
                style={{ background: '#141414', border: '1px solid #252525' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: '#e2e8f0' }}>{cfg.label}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                </div>
                <div className="text-3xl font-bold text-white">{pct(value)}</div>
                <div className="text-xs" style={{ color: '#e2e8f0', opacity: 0.7 }}>{cfg.target}</div>
                <div className="text-xs mt-1" style={{ color: '#e2e8f0', opacity: 0.45 }}>{cfg.description}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Activity ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>Activity</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* This week */}
          <div
            className="rounded-xl p-5"
            style={{ background: '#141414', border: '1px solid #252525' }}
          >
            <div className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#DC143C' }}>
              This Week
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm" style={{ color: '#e2e8f0' }}>Jobs sourced</span>
                <span className="text-xl font-bold text-white">{activity.added_this_week}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm" style={{ color: '#e2e8f0' }}>Applications sent</span>
                <span className="text-xl font-bold text-white">{activity.applied_this_week}</span>
              </div>
            </div>
          </div>
          {/* This month */}
          <div
            className="rounded-xl p-5"
            style={{ background: '#141414', border: '1px solid #252525' }}
          >
            <div className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#DC143C' }}>
              Last 30 Days
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm" style={{ color: '#e2e8f0' }}>Jobs sourced</span>
                <span className="text-xl font-bold text-white">{activity.added_this_month}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm" style={{ color: '#e2e8f0' }}>Applications sent</span>
                <span className="text-xl font-bold text-white">{activity.applied_this_month}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform Breakdown ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>Platform Breakdown</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252525' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#0D0D0D' }}>
              <tr>
                {['Platform', 'Total Sourced', 'Applied', 'Apply Rate'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-medium"
                    style={{ color: '#e2e8f0', borderBottom: '1px solid #252525' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {by_platform.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center"
                    style={{ color: '#e2e8f0', opacity: 0.5, background: '#141414' }}
                  >
                    No platform data yet.
                  </td>
                </tr>
              ) : (
                by_platform.map((row, idx) => {
                  const rowApplyRate = row.total > 0 ? row.applied / row.total : null;
                  return (
                    <tr
                      key={idx}
                      style={{ background: '#141414', borderBottom: '1px solid #252525' }}
                    >
                      <td className="px-4 py-3 text-white font-medium">{row.platform}</td>
                      <td className="px-4 py-3 text-white">{row.total}</td>
                      <td className="px-4 py-3 text-white">{row.applied}</td>
                      <td className="px-4 py-3" style={{ color: '#e2e8f0' }}>{pct(rowApplyRate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
