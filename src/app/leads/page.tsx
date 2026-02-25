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
  google_rating: number;
  status: string;
  message_drafted: string;
  message_sent_date: string;
  response_received: boolean;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-100 text-gray-800',
  researched: 'bg-blue-100 text-blue-800',
  drafted: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  responded: 'bg-purple-100 text-purple-800',
  dead: 'bg-red-100 text-red-800',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<string>('all');

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

  const generateMessage = (lead: Lead) => {
    const businessName = lead.company_name;
    const trade = lead.industry?.toLowerCase() || 'home service';
    
    return `Hi! I noticed ${businessName} is serving the ${lead.city || 'local'} area. We help ${trade} businesses get more calls with a professional website - just $97/mo with free updates anytime you need changes.

Would you be interested in learning more?`;
  };

  const handleApprove = async (lead: Lead) => {
    const message = generateMessage(lead);
    // Update status to drafted
    await fetch(`/api/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: 'drafted', message_drafted: message }),
    });
    fetchLeads();
    setSelectedLead(null);
  };

  if (loading) return <div className="p-8 text-center">Loading leads...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lead Generation</h1>
          <div className="text-sm text-gray-500">
            Total: {leads.length} leads
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === status 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>

        {/* Leads Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <div 
              key={lead.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg text-gray-900">{lead.company_name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-100'}`}>
                  {lead.status}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>📍 {lead.city}, {lead.state}</p>
                <p>🏭 {lead.industry}</p>
                <p>📱 {lead.phone}</p>
                <p>🌐 {lead.has_website ? 'Has Website' : 'No Website'}</p>
                {lead.google_rating && <p>⭐ {lead.google_rating} rating</p>}
              </div>

              {lead.status === 'new' && (
                <button
                  onClick={() => setSelectedLead(lead)}
                  className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Preview Message
                </button>
              )}
            </div>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leads found with this status.
          </div>
        )}
      </div>

      {/* Message Preview Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4">{selectedLead.company_name}</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500 mb-2">Message Preview:</p>
              <p className="text-gray-800 whitespace-pre-wrap">{generateMessage(selectedLead)}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedLead(null)}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(selectedLead)}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Approve & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
