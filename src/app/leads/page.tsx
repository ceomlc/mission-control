'use client';
// Mission Control - Lead Generation Module
// Updated: 2026-03-15 - Added retry functionality

import { useState, useEffect, useCallback } from 'react';

interface Lead {
  id: number;
  company_name: string;
  first_name?: string;
  contact_name?: string;
  owner_name?: string;
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
  message_sent_date?: string;
  source: string;
  research_notes: string;
  created_at: string;
  loom_url?: string;
  // Research fields
  personal_observation?: string;
  website_status?: string;
  google_presence?: string;
  review_highlights?: string;
  social_media?: string;
  research_completed?: boolean;
  // Priority scoring
  priority_score?: number;
  gap_severity?: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-700 text-gray-300',
  researched: 'bg-blue-900 text-blue-300',
  drafted: 'bg-yellow-900 text-yellow-300',
  pending_approval: 'bg-orange-900 text-orange-300',
  approved: 'bg-[#3D0007] text-[#DC143C]',
  sent: 'bg-green-900 text-green-300',
  failed: 'bg-red-900 text-red-300',
  responded: 'bg-purple-900 text-purple-300',
  dead: 'bg-gray-900 text-gray-500',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [researching, setResearching] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [preparingSend, setPreparingSend] = useState(false);
  const [checkingResponses, setCheckingResponses] = useState(false);
  const [sendingLeadId, setSendingLeadId] = useState<number | null>(null);
  const [loomInput, setLoomInput] = useState('');
  const [callOutcomeInput, setCallOutcomeInput] = useState('');
  const [savingField, setSavingField] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; total: number } | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [sortByPriority, setSortByPriority] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      setLoomInput((selectedLead as any).loom_url || '');
      setCallOutcomeInput((selectedLead as any).call_outcome || '');
    }
  }, [selectedLead]);

  const handleSaveField = async (field: string, value: string) => {
    if (!selectedLead || !value) return;
    setSavingField(true);
    try {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLead.id, [field]: value }),
      });
      fetchLeads();
    } finally {
      setSavingField(false);
    }
  };

  const fetchLeads = async (priority?: boolean) => {
    const usePriority = priority ?? sortByPriority;
    try {
      const res = await fetch(`/api/leads${usePriority ? '?sort=priority' : ''}`);
      const data = await res.json();
      setLeads(data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Statuses that require a phone number to be valid
  const CONTACT_STATUSES = new Set(['replied', 'hot', 'cold', 'opted_out', 'sent', 'approved', 'pending_approval']);

  const filteredLeads = (() => {
    let base = filter === 'all'
      ? leads.filter(l => l.status !== 'dead')
      : leads.filter(l => l.status === filter);

    // For reply-type statuses, only show leads that actually have a phone
    // (no phone = data issue, couldn't have been contacted)
    if (CONTACT_STATUSES.has(filter)) {
      base = base.filter(l => l.phone && l.phone.trim() !== '');
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      base = base.filter(l => l.gap_severity === priorityFilter);
    }

    return base;
  })();

  // Phoneless leads that ended up in a contact-required status — data problems
  const phonelessContactLeads = leads.filter(
    l => CONTACT_STATUSES.has(l.status) && (!l.phone || l.phone.trim() === '')
  );

  // Get leads for Outreach Queue (pending_approval or failed status)
  const outreachLeads = leads.filter(l => l.status === 'pending_approval' || l.status === 'failed');

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
    const rawName = (lead.owner_name || '').trim();
    const firstName = rawName.length > 1 && rawName.split(' ').length <= 3
      ? rawName.split(' ')[0].replace(/[^a-zA-Z]/g, '')
      : 'there';
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

  const handlePrepareSend = async () => {
    setPreparingSend(true);
    try {
      const res = await fetch('/api/leads/prepare-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Moved ${data.leadsMoved} leads to Outreach Queue! Remaining today: ${data.remainingSlots}`, 'success');
      } else {
        showToast(data.error || 'Failed to prepare leads', 'error');
      }
      fetchLeads();
    } catch (error) {
      showToast('Prepare failed: ' + error, 'error');
    } finally {
      setPreparingSend(false);
    }
  };

  const handleReject = async (lead: Lead) => {
    if (!confirm(`Reject "${lead.company_name}"? This will permanently remove them from the pipeline.`)) return;

    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`Failed to reject: ${data.error || 'Unknown error'}`, 'error');
        return;
      }
      fetchLeads();
    } catch (err) {
      showToast('Reject failed: ' + err, 'error');
    }
  };

  const handleSendIMessage = async (lead: Lead) => {
    setSendingLeadId(lead.id);

    // Optimistically mark as sent in local state immediately — this removes the lead
    // from the Outreach Queue section AND the table Send button before the network
    // request completes, making it impossible to double-click and double-send.
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'sent' } : l));

    try {
      const res = await fetch('/api/leads/send-imessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`iMessage sent to ${lead.company_name}!`, 'success');
      } else {
        // Revert the optimistic update on failure so lead returns to queue
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'pending_approval' } : l));
        showToast(`Send failed: ${data.error || 'Unknown error'}`, 'error');
      }
      fetchLeads();
    } catch (error) {
      // Revert on network error too
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'pending_approval' } : l));
      console.error('Send error', error);
      showToast('Send failed: ' + error, 'error');
    } finally {
      setSendingLeadId(null);
    }
  };

  const pendingLeads = outreachLeads.filter(l => l.status === 'pending_approval');
  const allPendingSelected = pendingLeads.length > 0 && pendingLeads.every(l => selectedLeads.has(l.id));

  const toggleLeadSelect = (id: number) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllLeads = () => {
    if (allPendingSelected) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(pendingLeads.map(l => l.id)));
    }
  };

  const handleBulkSendIMessage = async () => {
    const ids = [...selectedLeads];
    setBulkSending(true);
    setBulkProgress({ sent: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const lead = leads.find(l => l.id === id);
      if (!lead) continue;
      // Optimistic update
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'sent' } : l));
      try {
        const res = await fetch('/api/leads/send-imessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: id }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Revert on failure
          setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'pending_approval' } : l));
          showToast(`Failed to send to ${lead.company_name}: ${data.error || 'Unknown error'}`, 'error');
        } else {
          setSelectedLeads(prev => { const next = new Set(prev); next.delete(id); return next; });
        }
      } catch {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'pending_approval' } : l));
        showToast(`Network error sending to ${lead.company_name}`, 'error');
      }
      setBulkProgress({ sent: i + 1, total: ids.length });
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    setBulkSending(false);
    setBulkProgress(null);
    showToast(`Batch complete — sent ${ids.length} messages`, 'success');
    fetchLeads();
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
      showToast(`Research complete! Added ${data.added} new leads.`, 'success');
      fetchLeads();
    } catch (error) {
      showToast('Research failed: ' + error, 'error');
    } finally {
      setResearching(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!confirm('Generate curiosity-gap messages for ALL researched leads?')) return;
    setGeneratingAll(true);
    try {
      const res = await fetch('/api/leads/generate-all', { method: 'POST' });
      const data = await res.json();
      showToast(`Generated messages for ${data.generated} leads!`, 'success');
      fetchLeads();
    } catch (error) {
      showToast('Generation failed: ' + error, 'error');
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleCheckResponses = async () => {
    setCheckingResponses(true);
    try {
      const res = await fetch('/api/leads/check-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      if (data.respondedCount > 0) {
        showToast(`Found ${data.respondedCount} responses!`, 'success');
      } else {
        showToast(`Checked ${data.checked} leads. No responses yet.`, 'success');
      }
      fetchLeads();
    } catch (error) {
      showToast('Check failed: ' + error, 'error');
    } finally {
      setCheckingResponses(false);
    }
  };

  const handleSendLoom = useCallback(async (leadId: number) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/send-loom`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send loom');
      alert('Loom follow-up sent!');
      fetchLeads();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading leads...</div>;

  return (
    <div className="p-6">
      <div className="max-w-full mx-auto">

        {/* OUTREACH QUEUE SECTION */}
        {outreachLeads.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                📬 Outreach Queue
                <span className="bg-orange-600 text-white text-xs px-2 py-1 rounded-full">
                  {outreachLeads.length}
                </span>
              </h2>
              {pendingLeads.length > 0 && (
                <div className="flex items-center gap-3">
                  {bulkProgress && (
                    <span className="text-sm text-gray-400">
                      Sending {bulkProgress.sent} of {bulkProgress.total}…
                    </span>
                  )}
                  {selectedLeads.size > 0 && !bulkSending && (
                    <button
                      onClick={handleBulkSendIMessage}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500"
                    >
                      Send Selected ({selectedLeads.size})
                    </button>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={toggleSelectAllLeads}
                      disabled={bulkSending}
                      className="w-4 h-4 accent-green-500"
                    />
                    Select All
                  </label>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {outreachLeads.map((lead) => (
                <div
                  key={lead.id}
                  className={`bg-[#141414] rounded-xl border p-4 transition-colors ${
                    lead.status === 'failed'
                      ? 'border-red-500/50'
                      : selectedLeads.has(lead.id)
                      ? 'border-green-500/50'
                      : 'border-orange-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {lead.status === 'pending_approval' && (
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleLeadSelect(lead.id)}
                          disabled={bulkSending}
                          className="w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0"
                        />
                      )}
                      <h3 className="font-semibold text-white text-sm">{lead.company_name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${lead.status === 'failed' ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>
                      {lead.status === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    📞 {lead.phone}
                  </div>
                  <div className="relative bg-[#0D0D0D] rounded-lg p-3 mb-3 border border-[#252525]">
                    {editingMessageId === lead.id ? (
                      <div>
                        <textarea
                          value={editingMessageText}
                          onChange={e => setEditingMessageText(e.target.value)}
                          className="w-full bg-transparent text-xs text-gray-200 resize-none outline-none min-h-[80px]"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            onClick={() => setEditingMessageId(null)}
                            className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              await fetch('/api/leads', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: lead.id, message_drafted: editingMessageText }),
                              });
                              setEditingMessageId(null);
                              fetchLeads();
                            }}
                            className="px-2 py-1 text-[10px] bg-green-700 text-green-200 rounded hover:bg-green-600"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-300 pr-6">{lead.message_drafted}</p>
                        <button
                          onClick={() => { setEditingMessageId(lead.id); setEditingMessageText(lead.message_drafted); }}
                          className="absolute top-2 right-2 text-gray-600 hover:text-gray-300 text-[10px]"
                          title="Edit message"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {lead.status === 'failed' ? (
                      <button
                        onClick={() => handleSendIMessage(lead)}
                        disabled={sendingLeadId === lead.id || bulkSending}
                        className="flex-1 py-2 px-3 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-500 font-medium disabled:opacity-50"
                      >
                        {sendingLeadId === lead.id ? 'Retrying...' : '🔄 Retry'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendIMessage(lead)}
                        disabled={sendingLeadId === lead.id || bulkSending}
                        className="flex-1 py-2 px-3 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500 font-medium disabled:opacity-50"
                      >
                        {sendingLeadId === lead.id ? 'Approving...' : '✅ Approve'}
                      </button>
                    )}
                    <button
                      onClick={() => handleReject(lead)}
                      disabled={sendingLeadId === lead.id || bulkSending}
                      className="py-2 px-3 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600 disabled:opacity-50"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Lead Generation</h1>
          <div className="flex gap-2">
            <button
              onClick={handleResearch}
              disabled={researching}
              className="px-4 py-2 bg-[#DC143C] text-white rounded-lg hover:bg-[#b01030] font-medium disabled:opacity-50"
            >
              {researching ? 'Researching...' : 'Research New Leads'}
            </button>
            <button
              onClick={handleGenerateAll}
              disabled={generatingAll}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
            >
              {generatingAll ? 'Generating...' : 'Generate All Messages'}
            </button>
            <button
              onClick={handlePrepareSend}
              disabled={preparingSend}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
            >
              {preparingSend ? 'Preparing...' : 'Move to Outreach Queue'}
            </button>
            <button
              onClick={handleCheckResponses}
              disabled={checkingResponses}
              className="px-4 py-2 bg-[#DC143C] text-white rounded-lg hover:bg-[#b01030] font-medium disabled:opacity-50"
            >
              {checkingResponses ? 'Checking...' : 'Check Responses'}
            </button>
            <div className="text-sm text-gray-500 flex items-center">
              {leads.length} total leads
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === status
                  ? 'bg-[#DC143C] text-white'
                  : 'bg-[#141414] text-gray-400 hover:bg-[#2A2A3E]'
              }`}
            >
              {status === 'pending_approval' ? 'pending' : status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>

        {/* Priority Filter + Sort Row */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Priority:</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => {
            const colors: Record<string, string> = {
              all:      'bg-[#141414] text-gray-400 hover:bg-[#252525]',
              critical: priorityFilter === 'critical' ? 'bg-red-700 text-white' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50',
              high:     priorityFilter === 'high'     ? 'bg-amber-700 text-white' : 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50',
              medium:   priorityFilter === 'medium'   ? 'bg-yellow-700 text-white' : 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50',
              low:      priorityFilter === 'low'      ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
            };
            const activeAll = p === 'all' && priorityFilter === 'all' ? 'bg-[#DC143C] text-white' : '';
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${activeAll || colors[p]}`}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
          <div className="ml-auto">
            <button
              onClick={() => {
                const next = !sortByPriority;
                setSortByPriority(next);
                fetchLeads(next);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                sortByPriority
                  ? 'bg-[#DC143C] text-white'
                  : 'bg-[#141414] text-gray-400 border border-[#252525] hover:bg-[#252525]'
              }`}
            >
              ↓ Sort by Priority
            </button>
          </div>
        </div>

        {/* Data Issues Banner */}
        {phonelessContactLeads.length > 0 && (
          <div className="mb-4 bg-red-950/40 border border-red-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-red-300">
              <span className="font-semibold">⚠️ {phonelessContactLeads.length} data issue{phonelessContactLeads.length > 1 ? 's' : ''}:</span>
              {' '}leads in <span className="font-mono">{[...new Set(phonelessContactLeads.map(l => l.status))].join(', ')}</span> status with no phone number.
              These are hidden from their status views.
            </div>
            <button
              onClick={() => setFilter('all')}
              className="text-xs text-red-400 hover:text-red-200 underline ml-4 flex-shrink-0"
            >
              View All →
            </button>
          </div>
        )}

        {/* Spreadsheet Layout */}
        <div className="bg-[#141414] rounded-xl border border-[#252525] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0D0D0D] text-gray-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Owner</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Company</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Phone</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">City</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Industry</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Website</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Rating</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Priority</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Source</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Status</th>
                  <th className="px-4 py-3 font-medium border-b border-[#252525]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[#252525] hover:bg-[#252525]/50">
                    <td className="px-4 py-3 text-gray-400">{lead.first_name || '-'}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      {lead.company_name}
                      {lead.research_completed && <span className="ml-1 text-green-400" title="Research complete">🔍</span>}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {lead.phone && lead.phone.trim() !== '' ? (
                        lead.phone
                      ) : (
                        <span className="text-red-400 text-xs font-sans">⚠️ No phone</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{lead.city}, {lead.state}</td>
                    <td className="px-4 py-3">{lead.industry}</td>
                    <td className="px-4 py-3">
                      {lead.website_url ? (
                        <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="text-[#DC143C] hover:underline">
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
                    <td className="px-4 py-3">
                      {(() => {
                        const sev = lead.gap_severity;
                        const score = lead.priority_score;
                        if (!sev || sev === 'none') {
                          return <span className="px-2 py-0.5 rounded text-xs bg-[#141414] text-[#555] border border-[#252525]">—</span>;
                        }
                        const styles: Record<string, string> = {
                          critical: 'bg-red-900/50 text-red-400 border border-red-700',
                          high:     'bg-amber-900/50 text-amber-400 border border-amber-700',
                          medium:   'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
                          low:      'bg-gray-800 text-gray-400 border border-gray-600',
                        };
                        return (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[sev]}`}>
                            {sev.toUpperCase()} {score !== undefined ? score : ''}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-700'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.status === 'failed' && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Retry sending to "${lead.company_name}"? This will move them back to the Outreach Queue.`)) return;
                            await fetch(`/api/leads`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: lead.id, status: 'pending_approval' }),
                            });
                            fetchLeads();
                            showToast('Moved back to Outreach Queue!', 'success');
                          }}
                          className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-500"
                        >
                          🔄 Retry
                        </button>
                      )}
                      {lead.status === 'new' && (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="px-3 py-1 bg-[#DC143C] text-white text-xs rounded hover:bg-[#b01030] mr-2"
                        >
                          Preview
                        </button>
                      )}
                      {lead.status === 'drafted' && (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                        >
                          View
                        </button>
                      )}
                      {lead.status === 'pending_approval' && (
                        <button
                          onClick={() => handleSendIMessage(lead)}
                          disabled={sendingLeadId === lead.id}
                          className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-500 disabled:opacity-50"
                        >
                          {sendingLeadId === lead.id ? 'Sending...' : 'Send'}
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
          <div className="bg-[#141414] rounded-2xl max-w-lg w-full p-6 border border-[#252525]">
            <h2 className="text-xl font-bold mb-4 text-white">{selectedLead.company_name}</h2>

            <div className="space-y-3 mb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {selectedLead.first_name && <div><span className="text-gray-500">Owner:</span> <span className="text-white">{selectedLead.first_name}</span></div>}
                <div><span className="text-gray-500">Phone:</span> <span className="text-white font-mono">{selectedLead.phone}</span></div>
                <div><span className="text-gray-500">Location:</span> <span className="text-white">{selectedLead.city}, {selectedLead.state}</span></div>
                <div><span className="text-gray-500">Industry:</span> <span className="text-white">{selectedLead.industry}</span></div>
                <div><span className="text-gray-500">Rating:</span> <span className="text-yellow-400">{selectedLead.google_rating || '-'} ⭐</span></div>
                <div><span className="text-gray-500">Source:</span> <span className="text-white">{selectedLead.source}</span></div>
                {selectedLead.gap_severity && selectedLead.gap_severity !== 'none' && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Gap Priority:</span>{' '}
                    <span className={`font-semibold ${
                      selectedLead.gap_severity === 'critical' ? 'text-red-400' :
                      selectedLead.gap_severity === 'high'     ? 'text-amber-400' :
                      selectedLead.gap_severity === 'medium'   ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {selectedLead.gap_severity.toUpperCase()} ({selectedLead.priority_score}/100)
                    </span>
                  </div>
                )}
                <div><span className="text-gray-500">Website:</span> <span className="text-white">{selectedLead.website_url || 'None'}</span></div>
              </div>
            </div>

            {/* Research Summary */}
            {selectedLead.research_completed && (
              <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4 border border-[#252525]">
                <p className="text-sm text-gray-500 mb-3 font-medium">🔍 Research Summary</p>
                <div className="space-y-2 text-xs">
                  {selectedLead.website_status && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Website:</span>
                      <span className={`${selectedLead.website_status === 'none' ? 'text-red-400' : selectedLead.website_status === 'outdated' ? 'text-yellow-400' : 'text-green-400'}`}>
                        {selectedLead.website_status === 'none' ? '❌ No website' : selectedLead.website_status === 'outdated' ? '⚠️ Outdated' : '✅ Modern'}
                      </span>
                    </div>
                  )}
                  {selectedLead.google_presence && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Google:</span>
                      <span className="text-gray-300">{selectedLead.google_presence}</span>
                    </div>
                  )}
                  {selectedLead.review_highlights && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Reviews:</span>
                      <span className="text-gray-300">{selectedLead.review_highlights}</span>
                    </div>
                  )}
                  {selectedLead.social_media && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Social:</span>
                      <span className="text-gray-300">{selectedLead.social_media}</span>
                    </div>
                  )}
                  {selectedLead.personal_observation && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-[#252525]">
                      <span className="text-gray-500 w-24 flex-shrink-0">Hook:</span>
                      <span className="italic" style={{ color: '#DC143C' }}>"{selectedLead.personal_observation}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4 border border-[#252525]">
              <p className="text-sm text-gray-500 mb-2">Message Preview:</p>
              <p className="text-gray-200 whitespace-pre-wrap text-sm">
                {selectedLead.message_drafted || generateMessage(selectedLead)}
              </p>
            </div>

            {/* Loom & Call Outcome — shown for leads that have been sent */}
            {['sent', 'hot', 'replied', 'cold', 'booked'].includes(selectedLead.status) && (
              <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4 border border-[#252525] space-y-3">
                <p className="text-sm text-gray-500 font-medium">📋 Log Outreach Data</p>

                {/* Site Ready for Review */}
                {selectedLead.status === 'hot' && selectedLead.research_notes?.includes('[SITE READY:') && (() => {
                  const siteUrl = selectedLead.research_notes.match(/\[SITE READY: ([^\]]+)\]/)?.[1];
                  return (
                    <div style={{ border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 12, background: 'rgba(245,158,11,0.08)' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>🔥 Site Ready for Review</div>
                      {siteUrl && (
                        <a href={siteUrl} target="_blank" rel="noopener noreferrer"
                           style={{ color: '#22d3ee', fontSize: 13, textDecoration: 'underline' }}>
                          Preview Site →
                        </a>
                      )}
                      <div style={{ marginTop: 8, color: '#aaa', fontSize: 12 }}>
                        Add your Loom link below, then approve to send.
                      </div>
                    </div>
                  );
                })()}

                {/* Loom URL */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Loom URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={loomInput}
                      onChange={e => setLoomInput(e.target.value)}
                      placeholder="https://loom.com/share/..."
                      className="flex-1 bg-[#141414] border border-[#252525] rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#DC143C]"
                    />
                    <button
                      onClick={() => handleSaveField('loom_url', loomInput)}
                      disabled={savingField || !loomInput}
                      className="px-3 py-1.5 bg-[#DC143C] text-white text-xs rounded hover:bg-[#b01030] disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                  {selectedLead.status === 'hot' && selectedLead.research_notes?.includes('[SITE READY:') && (
                    <button
                      onClick={() => handleSendLoom(selectedLead.id)}
                      disabled={!selectedLead.loom_url && !loomInput}
                      style={{
                        marginTop: 8,
                        padding: '8px 16px',
                        background: (selectedLead.loom_url || loomInput) ? '#f59e0b' : '#3a3a4a',
                        color: (selectedLead.loom_url || loomInput) ? '#000' : '#666',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 700,
                        cursor: (selectedLead.loom_url || loomInput) ? 'pointer' : 'not-allowed',
                        fontSize: 13,
                        width: '100%'
                      }}
                    >
                      {(selectedLead.loom_url || loomInput) ? 'Approve & Send Loom →' : 'Add Loom URL to enable'}
                    </button>
                  )}
                </div>

                {/* Call Outcome */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Call Outcome</label>
                  <div className="flex gap-2">
                    <select
                      value={callOutcomeInput}
                      onChange={e => setCallOutcomeInput(e.target.value)}
                      className="flex-1 bg-[#141414] border border-[#252525] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#DC143C]"
                    >
                      <option value="">— select outcome —</option>
                      <option value="booked">✅ Booked</option>
                      <option value="callback_requested">📅 Callback Requested</option>
                      <option value="voicemail">📭 Voicemail</option>
                      <option value="no_answer">📵 No Answer</option>
                      <option value="not_interested">❌ Not Interested</option>
                      <option value="wrong_number">🚫 Wrong Number</option>
                    </select>
                    <button
                      onClick={() => handleSaveField('call_outcome', callOutcomeInput)}
                      disabled={savingField || !callOutcomeInput}
                      className="px-3 py-1.5 bg-[#DC143C] text-white text-xs rounded hover:bg-[#b01030] disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedLead(null)}
                className="flex-1 py-2 px-4 border border-[#252525] text-gray-400 rounded-lg hover:bg-[#2A2A3E]"
              >
                Cancel
              </button>
              {selectedLead.status === 'new' ? (
                <button
                  onClick={() => handleApprove(selectedLead)}
                  className="flex-1 py-2 px-4 bg-[#DC143C] text-white rounded-lg hover:bg-[#b01030] font-medium"
                >
                  Generate Message
                </button>
              ) : selectedLead.status === 'drafted' ? (
                <button
                  onClick={async () => {
                    // Move to pending_approval directly from drafted
                    await fetch(`/api/leads`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: selectedLead.id, status: 'pending_approval' }),
                    });
                    fetchLeads();
                    setSelectedLead(null);
                    showToast('Moved to Outreach Queue!', 'success');
                  }}
                  className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Move to Queue
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
