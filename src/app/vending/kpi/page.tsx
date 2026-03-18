'use client';

import { useState, useEffect } from 'react';

interface KPIStats {
  total_leads: number;
  by_status: Record<string, number>;
  by_tier: Record<string, number>;
  sequence: {
    touch_1_sent: number;
    touch_2_sent: number;
    touch_3_sent: number;
    touch_4_sent: number;
    touch_5_sent: number;
    total_replies: number;
    booked_calls: number;
    closed_won: number;
  };
  reply_rate: number;
  sent: number;
  replies: number;
}

export default function KPIPage() {
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/vending/kpi');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch KPIs:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading KPIs...</div>;
  }

  if (!stats) {
    return <div className="text-gray-400">No data available</div>;
  }

  const s = stats.sequence || {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">KPI Dashboard</h1>
      
      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Total Leads</div>
          <div className="text-3xl font-bold text-white">{stats.total_leads}</div>
        </div>
        
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Messages Sent</div>
          <div className="text-3xl font-bold text-cyan-400">{stats.sent}</div>
        </div>
        
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Replies</div>
          <div className="text-3xl font-bold text-green-400">{stats.replies}</div>
        </div>
        
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Reply Rate</div>
          <div className="text-3xl font-bold text-orange-400">{stats.reply_rate}%</div>
        </div>
      </div>
      
      {/* Pipeline Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Touch 1</div>
          <div className="text-2xl font-bold text-white">{s.touch_1_sent || 0}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Touch 2</div>
          <div className="text-2xl font-bold text-white">{s.touch_2_sent || 0}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Touch 3</div>
          <div className="text-2xl font-bold text-white">{s.touch_3_sent || 0}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Touch 4</div>
          <div className="text-2xl font-bold text-white">{s.touch_4_sent || 0}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Touch 5</div>
          <div className="text-2xl font-bold text-white">{s.touch_5_sent || 0}</div>
        </div>
      </div>
      
      {/* Outcomes Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Booked Calls</div>
          <div className="text-2xl font-bold text-purple-400">{s.booked_calls || 0}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Closed Won</div>
          <div className="text-2xl font-bold text-green-400">{s.closed_won || 0}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">A-Tier Leads</div>
          <div className="text-2xl font-bold text-green-400">{stats.by_tier?.A || 0}</div>
        </div>
      </div>
      
      {/* Status Breakdown */}
      <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Leads by Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.by_status || {}).map(([status, count]) => (
            <div key={status} className="flex justify-between items-center p-2 rounded bg-[#0A0A0F]">
              <span className="text-gray-400 text-sm capitalize">{status.replace('_', ' ')}</span>
              <span className="text-white font-medium">{count as number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
