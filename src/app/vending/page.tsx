import Link from 'next/link';

interface Stats {
  totalLeads: number;
  leadsThisWeek: number;
  pendingApprovalCount: number;
  activeSequencesCount: number;
  sentToday: number;
  totalSent: number;
  replyCount: number;
  replyRate: number;
  meetingsBooked: number;
  placementsClosedWon: number;
  aTierCount: number;
  bTierCount: number;
  cTierCount: number;
}

async function getStats(): Promise<Stats> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/vending/stats`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return {
      totalLeads: 0, leadsThisWeek: 0, pendingApprovalCount: 0,
      activeSequencesCount: 0, sentToday: 0, totalSent: 0,
      replyCount: 0, replyRate: 0, meetingsBooked: 0,
      placementsClosedWon: 0, aTierCount: 0, bTierCount: 0, cTierCount: 0,
    };
  }
}

async function getRecentLeads() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    // Show most recent 10 leads regardless of date
    const res = await fetch(`${baseUrl}/api/vending/leads?limit=10`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.leads || [];
  } catch {
    return [];
  }
}

async function getPendingApprovals() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/vending/outreach?status=draft`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.outreach?.slice(0, 5) || [];
  } catch {
    return [];
  }
}

function getTierBadge(tier?: string) {
  if (!tier) return null;
  const colors: Record<string, string> = {
    A: 'bg-green-900 text-green-300',
    B: 'bg-blue-900 text-blue-300',
    C: 'bg-yellow-900 text-yellow-300',
    D: 'bg-red-900 text-red-300',
  };
  return colors[tier] || 'bg-gray-700 text-gray-300';
}

export default async function VendingPage() {
  const [stats, recentLeads, pendingApprovals] = await Promise.all([
    getStats(),
    getRecentLeads(),
    getPendingApprovals(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Vending Pipeline</h1>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Total Leads</div>
          <div className="text-2xl font-bold text-white">{stats.totalLeads}</div>
          <div className="text-gray-500 text-xs mt-1">+{stats.leadsThisWeek} this week</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Pending Approval</div>
          <div className="text-2xl font-bold text-orange-400">{stats.pendingApprovalCount}</div>
          <div className="text-gray-500 text-xs mt-1">drafts waiting for you</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Active Sequences</div>
          <div className="text-2xl font-bold text-cyan-400">{stats.activeSequencesCount}</div>
          <div className="text-gray-500 text-xs mt-1">{stats.totalSent} sent · {stats.replyRate}% reply rate</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Placements Won</div>
          <div className="text-2xl font-bold text-green-400">{stats.placementsClosedWon}</div>
          <div className="text-gray-500 text-xs mt-1">{stats.meetingsBooked} in pipeline</div>
        </div>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Emails Sent Today</div>
          <div className="text-xl font-bold text-white">{stats.sentToday}
            <span className="text-gray-500 text-xs font-normal"> / 40 cap</span>
          </div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Replies Received</div>
          <div className="text-xl font-bold text-purple-400">{stats.replyCount}</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="text-gray-400 text-xs mb-1">Lead Tiers</div>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-300">A: {stats.aTierCount}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900 text-blue-300">B: {stats.bTierCount}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-900 text-yellow-300">C: {stats.cTierCount}</span>
          </div>
        </div>
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Leads</h2>
            <Link href="/vending/leads" className="text-xs text-[#22d3ee] hover:underline">
              View all →
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">
              No leads yet. Run Scout to add leads.
            </div>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((lead: any) => (
                <div key={lead.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-[#2A2A3E]">
                  <div>
                    <div className="text-white text-sm font-medium">{lead.business_name}</div>
                    <div className="text-gray-500 text-xs">{lead.vertical} · {lead.city}, {lead.state}</div>
                  </div>
                  {lead.tier && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getTierBadge(lead.tier)}`}>
                      {lead.tier}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
            <Link href="/vending/outreach" className="text-xs text-[#22d3ee] hover:underline">
              View all →
            </Link>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">
              No drafts pending approval.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingApprovals.map((outreach: any) => (
                <div key={outreach.id} className="p-2 rounded-lg hover:bg-[#2A2A3E]">
                  <div className="flex justify-between items-center">
                    <div className="text-white text-sm font-medium">{outreach.business_name}</div>
                    {outreach.tier && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getTierBadge(outreach.tier)}`}>
                        {outreach.tier}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs">{outreach.city}, {outreach.state}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
