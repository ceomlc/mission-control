'use client';

import { useState, useEffect } from 'react';

interface Lead {
  id: string;
  business_name: string;
  vertical: string;
  address?: string;
  city: string;
  state: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  website?: string;
  size_indicator?: string;
  scout_notes?: string;
  status: string;
  score?: number;
  tier?: string;
  score_breakdown?: Record<string, any>;
  qualifier_notes?: string;
  batch_date: string;
  created_at: string;
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

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<'raw' | 'qualified' | 'discarded'>('qualified');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        const res = await fetch(`/api/vending/leads?status=${activeTab}`);
        const data = await res.json();
        setLeads(data.leads || []);
      } catch (error) {
        console.error('Failed to fetch leads:', error);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLeads();
  }, [activeTab]);

  const tabs = [
    { key: 'raw', label: 'Raw', count: leads.length },
    { key: 'qualified', label: 'Qualified', count: leads.length },
    { key: 'discarded', label: 'Discarded', count: leads.length },
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Leads</h1>
      
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
      
      {/* Table */}
      <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#2A2A3E]">
              <tr className="text-left text-gray-400 text-xs">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Contact</th>
                {(activeTab === 'qualified' || activeTab === 'discarded') && (
                  <th className="px-4 py-3">Score / Tier</th>
                )}
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No {activeTab} leads found
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="border-b border-[#2A2A3E] hover:bg-[#2A2A3E]/50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-white">{lead.business_name}</td>
                    <td className="px-4 py-3">{lead.vertical}</td>
                    <td className="px-4 py-3">{lead.city}, {lead.state}</td>
                    <td className="px-4 py-3">
                      {lead.contact_name || lead.email ? (
                        <div>
                          <div>{lead.contact_name || '-'}</div>
                          <div className="text-xs text-gray-500">{lead.email || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Not found</span>
                      )}
                    </td>
                    {(activeTab === 'qualified' || activeTab === 'discarded') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {lead.tier && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getTierBadge(lead.tier)}`}>
                              {lead.tier}
                            </span>
                          )}
                          {lead.score != null && lead.score > 0 ? (
                            <span className="text-gray-400 text-xs">{lead.score}/10</span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Detail Panel */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedLead.business_name}</h2>
                <p className="text-gray-400">{selectedLead.vertical}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Location</span>
                <p className="text-white">{selectedLead.address || ''}</p>
                <p className="text-white">{selectedLead.city}, {selectedLead.state}</p>
              </div>
              <div>
                <span className="text-gray-500">Contact</span>
                <p className="text-white">{selectedLead.contact_name || 'Not found'}</p>
                <p className="text-white">{selectedLead.email || 'Not found'}</p>
                <p className="text-white">{selectedLead.phone || 'Not found'}</p>
              </div>
              <div>
                <span className="text-gray-500">Website</span>
                <p className="text-white">{selectedLead.website || 'Not found'}</p>
              </div>
              <div>
                <span className="text-gray-500">Size</span>
                <p className="text-white">{selectedLead.size_indicator || 'Unknown'}</p>
              </div>
              {selectedLead.score && (
                <div>
                  <span className="text-gray-500">Score</span>
                  <p className="text-white">{selectedLead.score}/10</p>
                </div>
              )}
              {selectedLead.tier && (
                <div>
                  <span className="text-gray-500">Tier</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${getTierBadge(selectedLead.tier)}`}>
                    {selectedLead.tier}
                  </span>
                </div>
              )}
            </div>
            
            {selectedLead.scout_notes && (
              <div className="mt-4">
                <span className="text-gray-500 text-sm">Scout Notes</span>
                <p className="text-white text-sm mt-1">{selectedLead.scout_notes}</p>
              </div>
            )}
            
            {selectedLead.qualifier_notes && (
              <div className="mt-4">
                <span className="text-gray-500 text-sm">Qualifier Notes</span>
                <p className="text-white text-sm mt-1">{selectedLead.qualifier_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
