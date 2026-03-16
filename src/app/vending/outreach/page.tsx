'use client';

import { useState, useEffect } from 'react';

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
  const [activeSequences, setActiveSequences] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [pendingRes, activeRes] = await Promise.all([
          fetch('/api/vending/outreach?status=pending_approval'),
          fetch('/api/vending/outreach?status=active'),
        ]);
        const pendingData = await pendingRes.json();
        const activeData = await activeRes.json();
        setPendingApproval(pendingData.outreach || []);
        setActiveSequences(activeData.outreach || []);
      } catch (error) {
        console.error('Failed to fetch outreach:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await fetch(`/api/vending/outreach/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setPendingApproval(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
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
        setPendingApproval(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setRejecting(null);
    }
  };

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Outreach</h1>
      
      {/* Approval Queue */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Approval Queue</h2>
        
        {pendingApproval.length === 0 ? (
          <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-8 text-center text-gray-400">
            No drafts pending approval. Thoth will surface the next batch after tonight&apos;s run.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApproval.map((item) => (
              <div key={item.id} className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4">
                <div className="flex justify-between items-start mb-3">
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={approving === item.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                    >
                      {approving === item.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={rejecting === item.id}
                      className="px-4 py-2 border border-red-500 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {rejecting === item.id ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>
                
                {item.first_contact_subject && (
                  <div className="mt-3 p-3 bg-[#0A0A0F] rounded-lg border border-[#2A2A3E]">
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
          <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-8 text-center text-gray-400">
            No active outreach sequences.
          </div>
        ) : (
          <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-[#2A2A3E]">
                <tr className="text-left text-gray-400 text-xs">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Last Sent</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 text-sm">
                {activeSequences.map((item) => (
                  <tr key={item.id} className="border-b border-[#2A2A3E]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{item.business_name}</div>
                      <div className="text-gray-500 text-xs">{item.city}, {item.state}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-cyan-900 text-cyan-300 rounded text-xs">
                        {getSequenceStage(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getDaysInSequence(item)} days</td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.first_contact_sent_at 
                        ? new Date(item.first_contact_sent_at).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
