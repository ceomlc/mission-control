'use client';

import { useState, useEffect } from 'react';

// ---- Types ----------------------------------------------------------------

interface KPISummary {
  // Raw counts
  messages_sent: number;
  relay_pending: number;
  queue_depth: number;
  in_sequence: number;
  total_replied: number;
  // Rate metrics
  touch1_reply_rate: number;
  yes_rate: number;
  loom_reply_rate: number;
  call_booking_rate: number;
  breakup_reply_rate: number;
  end_to_end_conversion: number;
  opt_out_rate: number;
}

interface KPISplit {
  variant: string;
  trade: string;
  sends: number;
  reply_rate: number;
  yes_rate: number;
  sample_status: string;
}

interface KPIResponse {
  summary: KPISummary;
  splits: KPISplit[];
}

interface FunnelStep {
  touch: number;
  entered: number;
  responded: number;
  dropped: number;
}

interface DigestEntry {
  id: string;
  week_of: string;
  metrics: KPISummary;
  recommendation: string | null;
  created_at: string;
}

// ---- Benchmark config -----------------------------------------------------

interface MetricConfig {
  key: keyof KPISummary;
  label: string;
  target: string;
  green: (v: number) => boolean;
  amber: (v: number) => boolean;
}

const METRICS: MetricConfig[] = [
  {
    key: 'touch1_reply_rate',
    label: 'Touch 1 Reply Rate',
    target: 'Target: >12%',
    green: (v) => v >= 0.12,
    amber: (v) => v >= 0.05 && v < 0.12,
  },
  {
    key: 'yes_rate',
    label: 'YES Rate',
    target: 'Target: >8%',
    green: (v) => v >= 0.08,
    amber: (v) => v >= 0.03 && v < 0.08,
  },
  {
    key: 'loom_reply_rate',
    label: 'Loom-to-Reply Rate',
    target: 'Target: >40%',
    green: (v) => v >= 0.4,
    amber: (v) => v >= 0.2 && v < 0.4,
  },
  {
    key: 'call_booking_rate',
    label: 'Call-to-Booking Rate',
    target: 'Target: >15%',
    green: (v) => v >= 0.15,
    amber: (v) => v >= 0.05 && v < 0.15,
  },
  {
    key: 'breakup_reply_rate',
    label: 'Breakup Reply Rate',
    target: 'Target: >8%',
    green: (v) => v >= 0.08,
    amber: (v) => v >= 0.03 && v < 0.08,
  },
  {
    key: 'end_to_end_conversion',
    label: 'End-to-End Conversion',
    target: 'Target: >3%',
    green: (v) => v >= 0.03,
    amber: (v) => v >= 0.01 && v < 0.03,
  },
  {
    key: 'opt_out_rate',
    label: 'Opt-Out Rate',
    target: 'Target: <5%',
    // For opt-out: lower is better
    green: (v) => v <= 0.05,
    amber: (v) => v > 0.05 && v <= 0.1,
  },
];

function statusDotColor(cfg: MetricConfig, value: number): string {
  if (cfg.green(value)) return '#22c55e';
  if (cfg.amber(value)) return '#f59e0b';
  return '#DC143C';
}

function fmt(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

function formatWeekOf(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Component ------------------------------------------------------------

export default function KPIPage() {
  const [kpiData, setKpiData] = useState<KPIResponse | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [digests, setDigests] = useState<DigestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [kpiRes, funnelRes, digestsRes] = await Promise.all([
          fetch('/api/kpi'),
          fetch('/api/kpi/funnel'),
          fetch('/api/kpi/digests'),
        ]);
        const kpiJson = await kpiRes.json();
        const funnelJson = await funnelRes.json();
        const digestsJson = await digestsRes.json();
        setKpiData(kpiJson);
        setFunnelData(funnelJson.funnel ?? []);
        setDigests(digestsJson.digests ?? []);
      } catch (error) {
        console.error('Failed to fetch KPI data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) {
    return <div className="p-8 text-center" style={{ color: '#e2e8f0' }}>Loading KPIs...</div>;
  }

  const summary = kpiData?.summary ?? {
    messages_sent: 0,
    relay_pending: 0,
    queue_depth: 0,
    in_sequence: 0,
    total_replied: 0,
    touch1_reply_rate: 0,
    yes_rate: 0,
    loom_reply_rate: 0,
    call_booking_rate: 0,
    breakup_reply_rate: 0,
    end_to_end_conversion: 0,
    opt_out_rate: 0,
  };
  const splits = kpiData?.splits ?? [];

  // For the A/B table: find highest reply_rate per trade (among sufficient rows)
  const bestPerTrade: Record<string, number> = {};
  for (const split of splits) {
    if (split.sample_status === 'sufficient') {
      if (bestPerTrade[split.trade] == null || split.reply_rate > bestPerTrade[split.trade]) {
        bestPerTrade[split.trade] = split.reply_rate;
      }
    }
  }

  return (
    <div className="space-y-8" style={{ color: 'white' }}>
      <h1 className="text-2xl font-bold text-white">KPI Dashboard</h1>

      {/* ------------------------------------------------------------------ */}
      {/* Activity counters — raw pipeline numbers                           */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold mb-1" style={{ color: '#e2e8f0' }}>In-Sequence</h2>
        <p className="text-xs mb-3" style={{ color: '#e2e8f0', opacity: 0.5 }}>Leads that have been sent — these add up to your active pipeline</p>
        <div className="grid grid-cols-3 gap-4 mb-2">
          {[
            { label: 'iMessage Confirmed', value: summary.messages_sent, icon: '✅', color: '#22c55e', sub: 'Delivery confirmed by relay' },
            { label: 'Relay Pending',      value: summary.relay_pending,  icon: '📡', color: '#f97316', sub: 'Sent, awaiting delivery receipt' },
            { label: 'Replied',            value: summary.total_replied,  icon: '💬', color: '#a855f7', sub: 'Responded to your message' },
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
        <div className="text-xs mb-8 px-1" style={{ color: '#e2e8f0', opacity: 0.4 }}>
          Total in-sequence: {summary.messages_sent + summary.relay_pending + summary.total_replied}
        </div>

        <div className="rounded-xl p-4 flex items-center gap-4 mb-8"
          style={{ background: '#141414', border: '1px solid #f59e0b40' }}>
          <span className="text-3xl">⏳</span>
          <div>
            <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{summary.queue_depth}</div>
            <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Approval Queue</div>
            <div className="text-xs" style={{ color: '#e2e8f0', opacity: 0.5 }}>Fresh leads staged by Thoth — not yet sent, separate from the pipeline above</div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STEP 4 — Summary bar: 7 KPI cards                                  */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>Performance Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {METRICS.map((cfg) => {
            const value = summary[cfg.key];
            const dotColor = statusDotColor(cfg, value);
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
                    style={{ background: dotColor }}
                  />
                </div>
                <div className="text-3xl font-bold text-white">{fmt(value)}</div>
                <div className="text-xs" style={{ color: '#e2e8f0', opacity: 0.7 }}>{cfg.target}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STEP 5 — A/B variant table                                         */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>A/B Variant Results</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252525' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#0D0D0D' }}>
              <tr>
                {['Variant', 'Trade', 'Sends', 'Reply Rate', 'YES Rate', 'Sample Status'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-medium"
                    style={{ color: '#e2e8f0', borderBottom: '1px solid #252525' }}
                  >
                    {h}
                  </th>
                ))}
                <th
                  className="px-4 py-3 text-left font-medium"
                  style={{ color: '#e2e8f0', borderBottom: '1px solid #252525' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {splits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center" style={{ color: '#e2e8f0', opacity: 0.5, background: '#141414' }}>
                    No variant data yet.
                  </td>
                </tr>
              ) : (
                splits.map((row, idx) => {
                  const isInsufficient = row.sample_status === 'insufficient_data';
                  const isBest =
                    !isInsufficient &&
                    bestPerTrade[row.trade] != null &&
                    row.reply_rate === bestPerTrade[row.trade];
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: '#141414',
                        borderBottom: '1px solid #252525',
                        opacity: isInsufficient ? 0.5 : 1,
                        borderLeft: isBest ? '3px solid #DC143C' : '3px solid transparent',
                      }}
                    >
                      <td className="px-4 py-3 text-white">{row.variant}</td>
                      <td className="px-4 py-3 text-white">{row.trade}</td>
                      <td className="px-4 py-3 text-white">{row.sends}</td>
                      <td className="px-4 py-3 text-white">{fmt(row.reply_rate)}</td>
                      <td className="px-4 py-3 text-white">{fmt(row.yes_rate)}</td>
                      <td className="px-4 py-3" style={{ color: isInsufficient ? '#9ca3af' : '#252525' }}>
                        {isInsufficient ? 'Insufficient Data' : 'Sufficient'}
                      </td>
                      <td className="px-4 py-3">
                        {/* TODO: Approve button — placeholder for future per-row script approval action */}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STEP 6 — Sequence funnel                                           */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>Sequence Funnel</h2>
        <div className="rounded-xl p-4 space-y-4" style={{ background: '#141414', border: '1px solid #252525' }}>
          {funnelData.length === 0 ? (
            <div className="text-center py-4" style={{ color: '#e2e8f0', opacity: 0.5 }}>No funnel data yet.</div>
          ) : (
            funnelData.map((step) => {
              const barWidth = step.entered > 0 ? (step.responded / step.entered) * 100 : 0;
              return (
                <div key={step.touch} className="flex items-center gap-4">
                  <div className="w-16 text-sm font-medium flex-shrink-0" style={{ color: '#e2e8f0' }}>
                    Touch {step.touch}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="text-xs" style={{ color: '#e2e8f0', opacity: 0.7 }}>
                      Entered: {step.entered} | Responded: {step.responded} | Dropped: {step.dropped}
                    </div>
                    <div className="h-4 rounded-full overflow-hidden" style={{ background: '#252525' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${barWidth}%`, background: '#DC143C' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STEP 7 — Weekly digest log                                         */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e2e8f0' }}>Weekly Digest Log</h2>
        <div
          className="rounded-xl overflow-y-auto"
          style={{ maxHeight: '24rem', border: '1px solid #252525', background: '#141414' }}
        >
          {digests.length === 0 ? (
            <div className="px-6 py-8 text-center" style={{ color: '#e2e8f0', opacity: 0.5 }}>
              No weekly digests yet.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#252525' }}>
              {digests.map((entry) => (
                <li key={entry.id} className="px-6 py-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">
                      Week of {formatWeekOf(entry.week_of)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mb-3">
                    {METRICS.map((cfg) => {
                      const v = entry.metrics?.[cfg.key] ?? 0;
                      return (
                        <div key={cfg.key} className="text-xs">
                          <span style={{ color: '#e2e8f0', opacity: 0.6 }}>{cfg.label}: </span>
                          <span className="text-white font-medium">{fmt(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {entry.recommendation && (
                    <p className="text-sm italic" style={{ color: '#e2e8f0' }}>
                      {entry.recommendation}
                    </p>
                  )}
                  {/* TODO: Approve/Reject buttons — placeholder for Athena recommendation approval action */}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
