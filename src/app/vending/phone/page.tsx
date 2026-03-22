'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PhoneLead {
  id: string;
  business_name: string;
  vertical: string;
  city: string;
  state: string;
  phone: string;
  contact_name?: string;
  website?: string;
  size_indicator?: string;
  scout_notes?: string;
  qualifier_notes?: string;
  tier?: string;
  score?: number;
  phone_script?: string;
  phone_outcome?: string;
  call_attempts?: number;
  last_called_at?: string;
}

interface CallLog {
  id: string;
  lead_id: string;
  call_sid?: string;
  touch_number: number;
  duration_seconds: number;
  recording_url?: string;
  outcome?: string;
  notes?: string;
  called_at: string;
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-progress' | 'ended';
type DeviceState = 'offline' | 'initializing' | 'ready' | 'error';

function getDefaultScript(lead: PhoneLead): string {
  const name = lead.contact_name?.split(' ').length! <= 3 && lead.contact_name
    ? lead.contact_name.split(' ')[0]
    : 'there';

  const map: Record<string, string> = {
    gym: `Hey ${name}, my name's Jaivien with More Life Vending. We work with independent gyms to place a free vending machine — we stock it, maintain it, you earn a commission on every sale with no cost to you. Is that worth a quick 2-minute conversation?`,
    fitness: `Hey ${name}, Jaivien from More Life Vending. We help fitness studios offer snacks and drinks to members at zero cost — we handle everything and you earn a percentage. Worth a quick chat?`,
    'auto': `Hey ${name}, Jaivien here from More Life Vending. We set up free vending machines in auto shops for customers while they wait. No cost to you, we handle restocking, and you earn a cut of every sale. Got 2 minutes?`,
    hotel: `Hey ${name}, Jaivien with More Life Vending. We place free vending machines in hotels — snacks and drinks for guests around the clock. Zero upfront cost, you earn a percentage of sales, we handle everything. Quick question — is the GM available?`,
    apartment: `Hey ${name}, Jaivien from More Life Vending. We install free vending machines in apartment complexes — great amenity for residents, zero cost to the property, and you earn a commission. Is the property manager available?`,
    medical: `Hey ${name}, Jaivien with More Life Vending. We help medical and dental offices offer a free vending machine for patients and staff. No upfront cost, we restock and maintain it, you earn a percentage. Is the office manager available?`,
    dental: `Hey ${name}, Jaivien with More Life Vending. We help medical and dental offices offer a free vending machine for patients and staff. No upfront cost, we restock and maintain it, you earn a percentage. Is the office manager available?`,
  };

  const v = lead.vertical?.toLowerCase() || '';
  for (const [key, script] of Object.entries(map)) {
    if (v.includes(key)) return script;
  }

  return `Hey ${name}, my name's Jaivien with More Life Vending. We place vending machines in businesses like yours at no cost — we stock it, maintain it, and you earn a cut of every sale just for providing the space. Is that something worth a quick 2-minute conversation?`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTierColor(tier?: string) {
  const colors: Record<string, string> = {
    A: 'bg-green-900 text-green-300 border-green-700',
    B: 'bg-blue-900 text-blue-300 border-blue-700',
    C: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  };
  return colors[tier || ''] || 'bg-gray-800 text-gray-300 border-gray-700';
}

function outcomeLabel(outcome?: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    interested:     { label: '✅ Interested',     color: 'text-green-400' },
    not_interested: { label: '❌ Not interested', color: 'text-red-400' },
    voicemail:      { label: '📞 Voicemail',      color: 'text-yellow-400' },
    callback:       { label: '🔄 Callback',       color: 'text-purple-400' },
    no_answer:      { label: '📵 No answer',      color: 'text-gray-400' },
  };
  return map[outcome || ''] || { label: outcome || '—', color: 'text-gray-400' };
}

export default function PhonePage() {
  const [leads, setLeads] = useState<PhoneLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLead, setActiveLead] = useState<PhoneLead | null>(null);
  const [callLogs, setCallLogs] = useState<Record<string, CallLog[]>>({});
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [callNote, setCallNote] = useState('');

  // Twilio state
  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const [deviceState, setDeviceState] = useState<DeviceState>('offline');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callSid, setCallSid] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  useEffect(() => { fetchLeads(); }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      deviceRef.current?.unregister();
      deviceRef.current?.destroy();
    };
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await fetch('/api/vending/phone-leads');
      const data = await res.json();
      setLeads(data.leads || []);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCallLogs(leadId: string) {
    const res = await fetch(`/api/vending/call-logs?lead_id=${leadId}`);
    const data = await res.json();
    setCallLogs(prev => ({ ...prev, [leadId]: data.logs || [] }));
  }

  const initDevice = useCallback(async () => {
    if (deviceRef.current || deviceState === 'initializing') return;
    setDeviceState('initializing');
    try {
      const tokenRes = await fetch('/api/vending/twilio/token', { method: 'POST' });
      const { token, error } = await tokenRes.json();
      if (error) throw new Error(error);

      // Dynamic import — Twilio SDK is browser-only
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(token, { logLevel: 1, allowIncomingWhileBusy: false });

      device.on('registered', () => setDeviceState('ready'));
      device.on('error', (err: any) => {
        console.error('Twilio Device error:', err);
        setDeviceState('error');
      });
      device.on('tokenWillExpire', async () => {
        const r = await fetch('/api/vending/twilio/token', { method: 'POST' });
        const d = await r.json();
        device.updateToken(d.token);
      });

      await device.register();
      deviceRef.current = device;
    } catch (err: any) {
      console.error('Device init error:', err);
      setDeviceState('error');
    }
  }, [deviceState]);

  async function startCall(lead: PhoneLead) {
    if (!deviceRef.current || deviceState !== 'ready') {
      alert('Phone not ready yet. Please wait a moment and try again.');
      return;
    }

    setCallingLeadId(lead.id);
    setCallState('connecting');
    setCallDuration(0);
    setCallSid(null);

    try {
      const call = await deviceRef.current.connect({
        params: {
          To: lead.phone,
          LeadId: lead.id,
        },
      });

      activeCallRef.current = call;

      call.on('accept', () => {
        setCallState('in-progress');
        const sid = call.parameters?.CallSid;
        if (sid) setCallSid(sid);
        // Start timer
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      });

      call.on('ringing', () => setCallState('ringing'));

      call.on('disconnect', () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCallState('ended');
        activeCallRef.current = null;
      });

      call.on('cancel', () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCallState('idle');
        setCallingLeadId(null);
        activeCallRef.current = null;
      });

      call.on('error', (err: any) => {
        console.error('Call error:', err);
        if (timerRef.current) clearInterval(timerRef.current);
        setCallState('idle');
        setCallingLeadId(null);
      });

    } catch (err: any) {
      console.error('Connect error:', err);
      setCallState('idle');
      setCallingLeadId(null);
    }
  }

  function hangUp() {
    activeCallRef.current?.disconnect();
  }

  async function logOutcome(outcome: 'interested' | 'voicemail' | 'not_interested' | 'callback' | 'no_answer') {
    if (!activeLead) return;

    const logs = callLogs[activeLead.id] || [];
    const touchNumber = logs.length + 1;

    await fetch('/api/vending/call-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id:          activeLead.id,
        call_sid:         callSid,
        touch_number:     touchNumber,
        outcome,
        notes:            callNote,
        duration_seconds: callDuration,
      }),
    });

    if (outcome === 'not_interested') {
      setLeads(prev => prev.filter(l => l.id !== activeLead.id));
      setActiveLead(null);
    } else if (outcome === 'interested') {
      setLeads(prev => prev.filter(l => l.id !== activeLead.id));
      setActiveLead(null);
    } else {
      // Update local lead state
      setLeads(prev => prev.map(l =>
        l.id === activeLead.id
          ? { ...l, phone_outcome: outcome, call_attempts: (l.call_attempts || 0) + 1 }
          : l
      ));
      await fetchCallLogs(activeLead.id);
    }

    setCallState('idle');
    setCallingLeadId(null);
    setCallNote('');
    setCallDuration(0);
    setCallSid(null);
  }

  function selectLead(lead: PhoneLead) {
    setActiveLead(lead);
    setScriptExpanded(false);
    setCallNote('');
    setCallState('idle');
    fetchCallLogs(lead.id);

    // Initialize device when user first selects a lead
    if (deviceState === 'offline') {
      initDevice();
    }
  }

  const isCalling = callingLeadId !== null && callState !== 'idle';

  if (loading) {
    return <div className="text-gray-400 p-4">Loading phone leads...</div>;
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Phone Outreach</h1>
          <p className="text-gray-400 text-sm mt-1">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} · phone only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            deviceState === 'ready'        ? 'bg-green-400' :
            deviceState === 'initializing' ? 'bg-yellow-400 animate-pulse' :
            deviceState === 'error'        ? 'bg-red-400' : 'bg-gray-500'
          }`} />
          <span className="text-xs text-gray-400">
            {deviceState === 'ready'        ? 'Dialer ready' :
             deviceState === 'initializing' ? 'Connecting...' :
             deviceState === 'error'        ? 'Dialer error' : 'Dialer offline'}
          </span>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-8 text-center text-gray-400">
          No phone leads in queue. All caught up 🎉
        </div>
      ) : (
        <div className="grid gap-3">
          {leads.map((lead) => {
            const isActive = activeLead?.id === lead.id;
            const logs = callLogs[lead.id] || [];
            const isThisCallActive = callingLeadId === lead.id;

            return (
              <div
                key={lead.id}
                className={`bg-[#1A1A2E] rounded-xl border transition-all ${
                  isActive ? 'border-[#22d3ee] ring-1 ring-[#22d3ee]/20' : 'border-[#2A2A3E] hover:border-[#3A3A5E]'
                }`}
              >
                {/* Lead row */}
                <div
                  className="flex items-start justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => isActive ? setActiveLead(null) : selectLead(lead)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{lead.business_name}</h3>
                      {lead.tier && (
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${getTierColor(lead.tier)}`}>
                          {lead.tier}
                        </span>
                      )}
                      {(lead.call_attempts || 0) > 0 && (
                        <span className="text-xs text-gray-500">
                          Touch {lead.call_attempts}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-0.5">{lead.vertical} · {lead.city}, {lead.state}</p>
                    {lead.contact_name && (
                      <p className="text-gray-500 text-xs mt-0.5">{lead.contact_name}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-gray-500 font-mono bg-[#0D0D14] px-2 py-1 rounded border border-[#2A2A3E]">
                    {lead.phone}
                  </div>
                </div>

                {/* Expanded panel */}
                {isActive && (
                  <div className="border-t border-[#2A2A3E] p-4 space-y-4">

                    {/* ── Active call UI ── */}
                    {isThisCallActive && (
                      <div className="bg-[#0D1F0D] border border-green-800 rounded-lg p-4 text-center space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-green-300 text-sm font-medium">
                            {callState === 'connecting' ? 'Connecting...' :
                             callState === 'ringing'    ? 'Ringing...' :
                             callState === 'in-progress'? 'Call in progress' : 'Call ended'}
                          </span>
                          {callState === 'in-progress' && (
                            <span className="text-green-400 font-mono text-sm ml-2">
                              {formatDuration(callDuration)}
                            </span>
                          )}
                        </div>
                        {callState !== 'ended' && callState !== 'idle' && (
                          <button
                            onClick={hangUp}
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition-colors"
                          >
                            🔴 Hang Up
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Outcome buttons (after call or manual log) ── */}
                    {(callState === 'ended' || callState === 'idle') && (
                      <>
                        {/* Call / Dialer button */}
                        {callState === 'idle' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => startCall(lead)}
                              disabled={isCalling || deviceState !== 'ready'}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#22d3ee] rounded-lg text-sm font-medium hover:bg-[#22d3ee]/20 disabled:opacity-40 transition-colors"
                            >
                              📞 Call {lead.phone}
                            </button>
                          </div>
                        )}

                        {/* Script */}
                        <div className="bg-[#0D0D14] rounded-lg border border-[#2A2A3E] p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                              {lead.phone_script ? '✍️ Custom Script' : '📋 Suggested Script'}
                            </span>
                            <button
                              onClick={() => setScriptExpanded(!scriptExpanded)}
                              className="text-xs text-[#22d3ee] hover:underline"
                            >
                              {scriptExpanded ? 'Collapse' : 'Expand'}
                            </button>
                          </div>
                          <p className={`text-gray-200 text-sm leading-relaxed ${!scriptExpanded ? 'line-clamp-3' : ''}`}>
                            {lead.phone_script || getDefaultScript(lead)}
                          </p>
                        </div>

                        {/* Research notes */}
                        {(lead.scout_notes || lead.qualifier_notes) && (
                          <div className="bg-[#0D0D14] rounded-lg border border-[#2A2A3E] p-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Research Notes</p>
                            {lead.scout_notes && <p className="text-gray-400 text-xs">{lead.scout_notes}</p>}
                            {lead.qualifier_notes && <p className="text-gray-400 text-xs mt-1">{lead.qualifier_notes}</p>}
                          </div>
                        )}

                        {/* Call note */}
                        <textarea
                          value={callNote}
                          onChange={e => setCallNote(e.target.value)}
                          placeholder="Notes from the call (optional)..."
                          className="w-full bg-[#0D0D14] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#22d3ee] resize-none"
                          rows={2}
                        />

                        {/* Outcome buttons */}
                        <div>
                          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Log Outcome</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <button onClick={() => logOutcome('interested')}
                              className="px-3 py-2.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg font-medium transition-colors">
                              ✅ Interested
                            </button>
                            <button onClick={() => logOutcome('voicemail')}
                              className="px-3 py-2.5 bg-yellow-700 hover:bg-yellow-600 text-white text-xs rounded-lg font-medium transition-colors">
                              📞 Voicemail
                            </button>
                            <button onClick={() => logOutcome('no_answer')}
                              className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg font-medium transition-colors">
                              📵 No Answer
                            </button>
                            <button onClick={() => logOutcome('callback')}
                              className="px-3 py-2.5 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded-lg font-medium transition-colors">
                              🔄 Callback
                            </button>
                            <button onClick={() => logOutcome('not_interested')}
                              className="px-3 py-2.5 border border-red-700 text-red-400 hover:bg-red-900/30 text-xs rounded-lg font-medium transition-colors">
                              ❌ Not Interested
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── Call history ── */}
                    {logs.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Call History</p>
                        <div className="space-y-2">
                          {logs.map((log) => {
                            const { label, color } = outcomeLabel(log.outcome);
                            return (
                              <div
                                key={log.id}
                                className="flex items-center justify-between bg-[#0D0D14] rounded-lg px-3 py-2 border border-[#2A2A3E]"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500 w-14">
                                    Touch {log.touch_number}
                                  </span>
                                  <span className={`text-xs ${color}`}>{label}</span>
                                  {log.duration_seconds > 0 && (
                                    <span className="text-xs text-gray-500">
                                      {formatDuration(log.duration_seconds)}
                                    </span>
                                  )}
                                  {log.notes && (
                                    <span className="text-xs text-gray-500 italic truncate max-w-[120px]">
                                      {log.notes}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600">
                                    {new Date(log.called_at).toLocaleDateString()}
                                  </span>
                                  {log.recording_url && (
                                    <a
                                      href={log.recording_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-[#22d3ee] hover:underline"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      🎙️ Recording
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
