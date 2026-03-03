'use client';

import { useState, useEffect } from 'react';

interface Lead {
  id: number;
  company_name: string;
  phone: string;
  city: string;
  state: string;
  industry: string;
  has_website: boolean;
  website_url: string;
  google_rating: number;
  review_count: number;
  status: string;
  message_drafted: string;
  source: string;
  notes: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-700 text-gray-300',
  researched: 'bg-blue-900 text-blue-300',
  drafted: 'bg-yellow-900 text-yellow-300',
  sent: 'bg-green-900 text-green-300',
  responded: 'bg-purple-900 text-purple-300',
  dead: 'bg-red-900 text-red-300',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [researching, setResearching] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = filter === 'all' 
    ? leads 
    : leads.filter(l => l.status === filter);

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach(l => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  // Curiosity gap message generator
  const templates = {
    HVAC: [
      "Quick question for you... Most HVAC companies in {city} are losing 30% of leads to competitors with better websites. What's the #1 thing holding you back from updating yours?",
      "Hey {first_name}, there's a reason some HVAC companies never run out of calls... What's yours?",
      "{first_name} - what if you could double your calls without spending another dollar on ads?"
    ],
    Plumbing: [
      "Quick question... Most plumbing companies in {city} are losing 30% of leads because of this. What's your biggest challenge?",
      "Hey {first_name}, why are some plumbers booked out 3 weeks while others scramble?"
    ],
    Roofing: [
      "Quick question for you... Storm season is coming - is your roof ready to be found?",
      "Hey {first_name}, the secret weapon top roofing companies use to get more calls... want to know what it is?"
    ]
  };

  const generateMessage = (lead: Lead) => {
    const firstName = lead.company_name.split(' ')[0];
    const city = lead.city || 'Baltimore';
    const industryTemplates = templates[lead.industry as keyof typeof templates] || templates['HVAC'];
    const template = industryTemplates[Math.floor(Math.random() * industryTemplates.length)];
    const message = template.replace('{first_name}', firstName).replace('{city}', city);
    return message + ' Reply YES for details. - Jaivien';
  };

  const handleApprove = async (lead: Lead) => {
    const message = generateMessage(lead);
    await fetch(`/api/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: 'drafted', message_drafted: message }),
    });
    fetchLeads();
    setSelectedLead(null);
  };

  const handleResearch = async () => {
    setResearching(true);
    try {
      const res = await fetch('/api/leads/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      alert(`Research complete! Added ${data.added} new leads.`);
      fetchLeads();
    } catch (error) {
      alert('Research failed: ' + error);
    } finally {
      setResearching(false);
    }
  };

  const handleSend = async (lead: Lead) => {
    // Mark as sent - in production, this would trigger Clawd Cursor to send via StraightText
    await fetch(`/api/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: 'sent', message_sent_date: new Date().toISOString() }),
    });
    fetchLeads();
    setSelectedLead(null);
    alert('SMS sent! (Demo - would trigger Clawd Cursor in production)');
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading leads...</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Lead Generation</h1>
          <button
            onClick={handleResearch}
            disabled={researching}
            className="px-4 py-2 bg-[#22d3ee] text-black rounded-lg hover:bg-[#06b6d4] font-medium disabled:opacity-50"
          >
            {researching ? 'Researching...' : 'Research New Leads'}
          </button>
          <div className="text-sm text-gray-500">
            {leads.length} total leads
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === status 
                  ? 'bg-[#22d3ee] text-black' 
                  : 'bg-[#1A1A2E] text-gray-400 hover:bg-[#2A2A3E]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>

        {/* Spreadsheet Layout */}
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0A0A0F] text-gray-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Company</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Phone</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">City</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Industry</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Website</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Rating</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Source</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Status</th>
                  <th className="px-4 py-3 font-medium border-b border-[#2A2A3E]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[#2A2A3E] hover:bg-[#2A2A3E]/50">
                    <td className="px-4 py-3 font-medium text-white">{lead.company_name}</td>
                    <td className="px-4 py-3 font-mono">{lead.phone}</td>
                    <td className="px-4 py-3">{lead.city}, {lead.state}</td>
                    <td className="px-4 py-3">{lead.industry}</td>
                    <td className="px-4 py-3">
                      {lead.website_url ? (
                        <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="text-[#22d3ee] hover:underline">
                          Visit →
                        </a>
                      ) : (
                        <span className="text-red-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.google_rating ? (
                        <span className="text-yellow-400">⭐ {lead.google_rating}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-700'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.status === 'new' && (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="px-3 py-1 bg-[#22d3ee] text-black text-xs rounded hover:bg-[#06b6d4] mr-2"
                        >
                          Preview
                        </button>
                      )}
                      {lead.status === 'drafted' && (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                        >
                          View & Send
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leads found.
          </div>
        )}
      </div>

      {/* Message Preview Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] rounded-2xl max-w-lg w-full p-6 border border-[#2A2A3E]">
            <h2 className="text-xl font-bold mb-4 text-white">{selectedLead.company_name}</h2>
            
            <div className="space-y-3 mb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Phone:</span> <span className="text-white font-mono">{selectedLead.phone}</span></div>
                <div><span className="text-gray-500">Location:</span> <span className="text-white">{selectedLead.city}, {selectedLead.state}</span></div>
                <div><span className="text-gray-500">Industry:</span> <span className="text-white">{selectedLead.industry}</span></div>
                <div><span className="text-gray-500">Rating:</span> <span className="text-yellow-400">{selectedLead.google_rating || '-'} ⭐</span></div>
                <div><span className="text-gray-500">Source:</span> <span className="text-white">{selectedLead.source}</span></div>
                <div><span className="text-gray-500">Website:</span> <span className="text-white">{selectedLead.website_url || 'None'}</span></div>
              </div>
            </div>

            <div className="bg-[#0A0A0F] rounded-lg p-4 mb-4 border border-[#2A2A3E]">
              <p className="text-sm text-gray-500 mb-2">Message Preview:</p>
              <p className="text-gray-200 whitespace-pre-wrap text-sm">
                {selectedLead.message_drafted || generateMessage(selectedLead)}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedLead(null)}
                className="flex-1 py-2 px-4 border border-[#2A2A3E] text-gray-400 rounded-lg hover:bg-[#2A2A3E]"
              >
                Cancel
              </button>
              {selectedLead.status === 'new' ? (
                <button
                  onClick={() => handleApprove(selectedLead)}
                  className="flex-1 py-2 px-4 bg-[#22d3ee] text-black rounded-lg hover:bg-[#06b6d4] font-medium"
                >
                  Generate Message
                </button>
              ) : (
                <button
                  onClick={() => handleSend(selectedLead)}
                  className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Send SMS
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
