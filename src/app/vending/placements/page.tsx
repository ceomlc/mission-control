'use client';

import { useState, useEffect } from 'react';

interface Placement {
  id: string;
  lead_id: string;
  status: 'pipeline' | 'closed_won' | 'closed_lost';
  meeting_date?: string;
  placement_date?: string;
  location_details?: string;
  agreement_summary?: string;
  lost_reason?: string;
  notes?: string;
  business_name: string;
  city: string;
  state: string;
  vertical: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export default function PlacementsPage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'won' | 'lost'>('pipeline');
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlacements() {
      setLoading(true);
      try {
        const statusMap = { pipeline: 'pipeline', won: 'closed_won', lost: 'closed_lost' };
        const res = await fetch(`/api/vending/placements?status=${statusMap[activeTab]}`);
        const data = await res.json();
        setPlacements(data.placements || []);
      } catch (error) {
        console.error('Failed to fetch placements:', error);
        setPlacements([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPlacements();
  }, [activeTab]);

  const tabs = [
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ] as const;

  const isMeetingToday = (date?: string) => {
    if (!date) return false;
    const meetingDate = new Date(date).toDateString();
    const today = new Date().toDateString();
    return meetingDate === today;
  };

  const isMeetingTomorrow = (date?: string) => {
    if (!date) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return new Date(date).toDateString() === tomorrow.toDateString();
  };

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Placements</h1>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2A2A3E] pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#1A1A2E] text-[#22d3ee]'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      {placements.length === 0 ? (
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-8 text-center text-gray-400">
          No {activeTab} placements yet.
        </div>
      ) : activeTab === 'pipeline' ? (
        <div className="grid gap-4">
          {placements.map((placement) => (
            <div key={placement.id} className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-white">{placement.business_name}</h3>
                  <p className="text-gray-400 text-sm">{placement.city}, {placement.state}</p>
                  {placement.contact_name && (
                    <p className="text-gray-500 text-sm">{placement.contact_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500">
                    Mark Won
                  </button>
                  <button className="px-3 py-1.5 border border-red-500 text-red-400 text-xs rounded-lg hover:bg-red-500/10">
                    Mark Lost
                  </button>
                </div>
              </div>
              
              {placement.meeting_date && (
                <div className={`mt-3 inline-block px-3 py-1 rounded text-xs ${
                  isMeetingToday(placement.meeting_date) 
                    ? 'bg-orange-900 text-orange-300'
                    : isMeetingTomorrow(placement.meeting_date)
                    ? 'bg-yellow-900 text-yellow-300'
                    : 'bg-[#0A0A0F] text-gray-400'
                }`}>
                  📅 Meeting: {new Date(placement.meeting_date).toLocaleDateString()}
                </div>
              )}
              
              {placement.notes && (
                <p className="mt-2 text-gray-400 text-sm">{placement.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-[#2A2A3E]">
              <tr className="text-left text-gray-400 text-xs">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">{activeTab === 'won' ? 'Placement Date' : 'Date Closed'}</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-sm">
              {placements.map((placement) => (
                <tr key={placement.id} className="border-b border-[#2A2A3E]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{placement.business_name}</div>
                    <div className="text-gray-500 text-xs">{placement.city}, {placement.state}</div>
                  </td>
                  <td className="px-4 py-3">
                    {activeTab === 'won' && placement.placement_date 
                      ? new Date(placement.placement_date).toLocaleDateString()
                      : new Date(placement.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{placement.location_details || '-'}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {placement.agreement_summary || placement.lost_reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
