'use client';

import React, { useState, useEffect } from 'react';

interface OutreachItem {
  id: string;
  lead_id: string;
  status: string;
  first_contact_subject?: string;
  first_contact_body?: string;
  first_contact_sent_at?: string;
  f1_sent_at?: string;
  f2_sent_at?: string;
  f3_sent_at?: string;
  f1_subject?: string;
  f1_body?: string;
  f2_subject?: string;
  f2_body?: string;
  business_name: string;
  city: string;
  state: string;
  tier?: string;
  vertical: string;
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

function getSequenceStage(outreach: OutreachItem): string {
  if (outreach.f3_sent_at) return 'F3';
  if (outreach.f2_sent_at) return 'F2';
  if (outreach.f1_sent_at) return 'F1';
  if (outreach.first_contact_sent_at) return 'First Contact';
  return 'Pending';
}

function getDaysInSequence(outreach: OutreachItem): number {
  const startDate = outreach.first_contact_sent_at 
    ? new Date(outreach.first_contact_sent_at)
    : new Date(outreach.created_at);
  const now = new Date();
  return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

export default function OutreachPage() {
  const [pendingApproval, setPendingApproval] = useState<OutreachItem[]>([]);
  const [noEmailLeads, setNoEmailLeads] = useState<OutreachItem[]>([]);
  const [activeSequences, setActiveSequences] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [showNoEmail, setShowNoEmail] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [pendingRes, activeRes, noEmailRes] = await Promise.all([
          // Only leads WITH an email — backend now filters these
          fetch('/api/vending/outreach?status=draft,pending_approval'),
          // All actually-sent emails regardless of status label
          fetch('/api/vending/outreach?sent=true'),
          // Leads with no email on file — shown separately, not in main queue
          fetch('/api/vending/outreach?no_email=true'),
        ]);
        const pendingData = await pendingRes.json();
        const activeData = await activeRes.json();
        const noEmailData = await noEmailRes.json();
        setPendingApproval(pendingData.outreach || []);
        setActiveSequences(activeData.outreach || []);
        setNoEmailLeads(noEmailData.outreach || []);
      } catch (error) {
        console.error('Failed to fetch outreach:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [discardingAll, setDiscardingAll] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [findingEmails, setFindingEmails] = useState(false);
  const [findEmailsResult, setFindEmailsResult] = useState<{ found: number; checked: number; hunter_available: boolean } | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; total: number } | null>(null);

  const handleApprove = async (id: string) => {
    setApproving(id);
    setApproveError(null);
    try {
      const res = await fetch(`/api/vending/outreach/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setPendingApproval(prev => prev.filter(item => item.id !== id));
        window.dispatchEvent(new Event('vending-outreach-updated'));
      } else {
        const data = await res.json();
        setApproveError(data.error || `Failed to send (${res.status})`);
      }
    } catch (error) {
      setApproveError('Network error — check console');
      console.error('Failed to approve:', error);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejecting(id);
    try {
      const res = await fetch(`/api/vending/outreach/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        // Remove from both queues — no-email discards show in noEmailLeads, not pendingApproval
        setPendingApproval(prev => prev.filter(item => item.id !== id));
        setNoEmailLeads(prev => prev.filter(item => item.id !== id));
        window.dispatchEvent(new Event('vending-outreach-updated'));
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setRejecting(null);
    }
  };

  const handleDiscardAll = async () => {
    if (!confirm(`Permanently discard all ${noEmailLeads.length} no-email drafts? This cannot be undone.`)) return;
    setDiscardingAll(true);
    setDiscardError(null);
    try {
      const res = await fetch('/api/vending/outreach/bulk-discard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        setNoEmailLeads([]);
        setShowNoEmail(false);
        window.dispatchEvent(new Event('vending-outreach-updated'));
      } else {
        const data = await res.json().catch(() => ({}));
        setDiscardError(data.error || `Server error (${res.status}) — check Vercel logs`);
      }
    } catch (error) {
      setDiscardError('Network error — check console');
      console.error('Failed to discard all:', error);
    } finally {
      setDiscardingAll(false);
    }
  };

  const handleRegenerate = async (leadId: string, outreachId: string) => {
    setRegenerating(outreachId);
    try {
      const res = await fetch('/api/vending/outreach/generate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (res.ok) {
        // Re-fetch the approval queue to show fresh copy
        const pendingRes = await fetch('/api/vending/outreach?status=draft,pending_approval');
        const pendingData = await pendingRes.json();
        setPendingApproval(pendingData.outreach || []);
      }
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setRegenerating(null);
    }
  };

  const allSelected = pendingApproval.length > 0 && pendingApproval.every(item => selected.has(item.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingApproval.map(item => item.id)));
    }
  };

  const handleBulkSend = async () => {
    const ids = [...selected];
    setBulkSending(true);
    setBulkProgress({ sent: 0, total: ids.length });
    setApproveError(null);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const res = await fetch(`/api/vending/outreach/${id}/approve`, { method: 'POST' });
        if (res.ok || res.status === 409) {
          setPendingApproval(prev => prev.filter(item => item.id !== id));
          setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
          window.dispatchEvent(new Event('vending-outreach-updated'));
        } else {
          const data = await res.json();
          setApproveError(`${data.error || 'Send failed'} — remaining items skipped`);
          break;
        }
      } catch {
        setApproveError('Network error during batch send — some items may not have sent');
        break;
      }
      setBulkProgress({ sent: i + 1, total: ids.length });
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    setBulkSending(false);
    setBulkProgress(null);
  };

  const handleFindEmails = async () => {
    setFindingEmails(true);
    setFindEmailsResult(null);
    try {
      const res = await fetch('/api/vending/outreach/find-emails', { method: 'POST' });
      const data = await res.json();
      setFindEmailsResult(data);
      if (data.found > 0) {
        // Leads with newly found emails are now in the approval queue — re-fetch everything
        const [pendingRes, noEmailRes] = await Promise.all([
          fetch('/api/vending/outreach?status=draft,pending_approval'),
          fetch('/api/vending/outreach?no_email=true'),
        ]);
        const pendingData = await pendingRes.json();
        const noEmailData = await noEmailRes.json();
        setPendingApproval(pendingData.outreach || []);
        setNoEmailLeads(noEmailData.outreach || []);
      }
    } catch (error) {
      console.error('Failed to find emails:', error);
    } finally {
      setFindingEmails(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Outreach</h1>

      {/* No Email Warning */}
      {noEmailLeads.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-red-400 font-semibold text-sm">
              ⚠️ {noEmailLeads.length} draft{noEmailLeads.length !== 1 ? 's' : ''} have no email on file
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Find Emails button */}
              <button
                onClick={handleFindEmails}
                disabled={findingEmails}
                className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-3 py-1.5 font-medium"
              >
                {findingEmails ? '🔍 Searching…' : '🔍 Find Emails'}
              </button>
              {/* Discard All button */}
              <button
                onClick={handleDiscardAll}
                disabled={discardingAll}
                className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded px-3 py-1.5 font-medium"
              >
                {discardingAll ? 'Discarding…' : 'Discard All'}
              </button>
              {/* Show/Hide toggle */}
              <button
                onClick={() => setShowNoEmail(v => !v)}
                className="text-xs text-red-400 hover:text-red-200 underline"
              >
                {showNoEmail ? 'Hide' : 'Show'} →
              </button>
            </div>
          </div>

          {/* Discard error banner */}
          {discardError && (
            <div className="mt-2 text-xs rounded px-3 py-2 bg-[#141414] text-red-400 flex justify-between items-center">
              <span>⚠️ {discardError}</span>
              <button onClick={() => setDiscardError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
            </div>
          )}

          {/* Find emails result banner */}
          {findEmailsResult && (
            <div className="mt-2 text-xs rounded px-3 py-2 bg-[#141414]">
              {findEmailsResult.found > 0 ? (
                <span className="text-green-400">
                  ✅ Found {findEmailsResult.found} email{findEmailsResult.found !== 1 ? 's' : ''} out of {findEmailsResult.checked} searched — moved to Approval Queue
                </span>
              ) : (
                <span className="text-yellow-400">
                  No emails found for {findEmailsResult.checked} lead{findEmailsResult.checked !== 1 ? 's' : ''}.
                  {!findEmailsResult.hunter_available && ' Add HUNTER_API_KEY to Vercel env for deeper searching.'}
                </span>
              )}
            </div>
          )}

          {/* Individual lead list */}
          {showNoEmail && (
            <div className="mt-3 space-y-2">
              {noEmailLeads.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-[#141414] rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="text-white font-medium">{item.business_name}</span>
                    <span className="text-gray-500 ml-2 text-xs">{item.city}, {item.state} • {item.vertical}</span>
                  </div>
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={rejecting === item.id}
                    className="text-xs text-red-400 hover:text-red-200 border border-red-500/30 rounded px-2 py-1 disabled:opacity-50"
                  >
                    {rejecting === item.id ? '...' : 'Discard'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approve error banner */}
      {approveError && (
        <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-xl px-4 py-3 text-sm flex justify-between items-center">
          <span>⚠️ {approveError}</span>
          <button onClick={() => setApproveError(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
        </div>
      )}

      {/* Approval Queue */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Approval Queue</h2>
          {pendingApproval.length > 0 && (
            <div className="flex items-center gap-3">
              {bulkProgress && (
                <span className="text-sm text-gray-400">
                  Sending {bulkProgress.sent} of {bulkProgress.total}…
                </span>
              )}
              {selected.size > 0 && !bulkSending && (
                <button
                  onClick={handleBulkSend}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500"
                >
                  Send Selected ({selected.size})
                </button>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-green-500"
                />
                Select All
              </label>
            </div>
          )}
        </div>

        {pendingApproval.length === 0 ? (
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-8 text-center text-gray-400">
            No drafts pending approval. Thoth will surface the next batch after tonight&apos;s run.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApproval.map((item) => (
              <div key={item.id} className={`bg-[#141414] rounded-xl border p-4 transition-colors ${selected.has(item.id) ? 'border-green-500/50' : 'border-[#252525]'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      disabled={bulkSending}
                      className="mt-1 w-4 h-4 accent-green-500 cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{item.business_name}</h3>
                        {item.tier && (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getTierBadge(item.tier)}`}>
                            {item.tier}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{item.city}, {item.state} • {item.vertical}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={approving === item.id || bulkSending}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                    >
                      {approving === item.id ? '...' : 'Send'}
                    </button>
                    <button
                      onClick={() => handleRegenerate(item.lead_id, item.id)}
                      disabled={regenerating === item.id || bulkSending}
                      title="Regenerate copy from template"
                      className="px-3 py-2 border border-gray-600 text-gray-400 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
                    >
                      {regenerating === item.id ? '...' : '🔄'}
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={rejecting === item.id || bulkSending}
                      className="px-4 py-2 border border-red-500 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {rejecting === item.id ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>

                {item.first_contact_subject && (
                  <div className="mt-3 p-3 bg-[#0D0D0D] rounded-lg border border-[#252525]">
                    <div className="text-gray-500 text-xs mb-1">Subject:</div>
                    <div className="text-white text-sm mb-2">{item.first_contact_subject}</div>
                    <div className="text-gray-500 text-xs mb-1">Body:</div>
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono">
                      {item.first_contact_body}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* Active Sequences */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Active Sequences</h2>
        
        {activeSequences.length === 0 ? (
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-8 text-center text-gray-400">
            No active outreach sequences.
          </div>
        ) : (
          <div className="bg-[#141414] rounded-xl border border-[#252525] overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-[#252525]">
                <tr className="text-left text-gray-400 text-xs">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Last Sent</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="text-gray-300 text-sm">
                {activeSequences.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr
                      className="border-b border-[#252525] hover:bg-[#2A2A3E]/30 cursor-pointer"
                      onClick={() => setExpandedSequence(expandedSequence === item.id ? null : item.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{item.business_name}</div>
                        <div className="text-gray-500 text-xs">{item.city}, {item.state}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-[#DC2626]/20 text-[#DC2626] rounded text-xs">
                          {getSequenceStage(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getDaysInSequence(item)} days</td>
                      <td className="px-4 py-3 text-gray-500">
                        {item.first_contact_sent_at
                          ? new Date(item.first_contact_sent_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{expandedSequence === item.id ? '▲' : '▼'}</td>
                    </tr>
                    {expandedSequence === item.id && (
                      <tr className="border-b border-[#252525]">
                        <td colSpan={5} className="px-4 py-3 bg-[#0D0D0D]">
                          <div className="space-y-3">
                            {item.first_contact_body && (
                              <div>
                                <p className="text-xs text-[#DC2626] font-semibold mb-1">Touch 1 — First Contact</p>
                                <p className="text-xs text-gray-400 mb-1">Subject: {item.first_contact_subject}</p>
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{item.first_contact_body}</pre>
                              </div>
                            )}
                            {item.f1_body && (
                              <div className="border-t border-[#252525] pt-3">
                                <p className="text-xs text-yellow-400 font-semibold mb-1">Touch 2 — Follow-Up (Day 3-4)</p>
                                <p className="text-xs text-gray-400 mb-1">Subject: {item.f1_subject}</p>
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{item.f1_body}</pre>
                              </div>
                            )}
                            {item.f2_body && (
                              <div className="border-t border-[#252525] pt-3">
                                <p className="text-xs text-orange-400 font-semibold mb-1">Touch 3 — Final (Day 7)</p>
                                <p className="text-xs text-gray-400 mb-1">Subject: {item.f2_subject}</p>
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{item.f2_body}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
