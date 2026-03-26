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
  tags?: string[];
  called_at: string;
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-progress' | 'ended';
type DeviceState = 'offline' | 'initializing' | 'ready' | 'error';

function getDefaultScript(lead: PhoneLead): string {
  const vertical = lead.vertical?.toLowerCase() || '';
  const biz = lead.business_name || 'your business';
  const city = lead.city || 'your area';

  const scripts: Record<string, string> = {
    factory: `Hi, is the facilities manager available?\n\n[When connected]\nHey, my name's Jaivien with More Life Vending — I'll keep this under 2 minutes. We place free vending machines in factories and warehouses in ${city}. No cost to you at all — we stock it, service it, handle everything. Your team just gets a machine in the break room. If it ever doesn't work out, we remove it within 14 days. Would it be worth a quick in-person visit to see if ${biz} is a good fit?`,

    warehouse: `Hi, is the facilities manager available?\n\n[When connected]\nHey, Jaivien with More Life Vending. Quick one — we set up free vending machines in warehouses in ${city}. Zero cost, we handle all stocking and maintenance, you just provide the outlet. Workers on multiple shifts actually get to eat without leaving. Would a 15-minute visit make sense to take a look at the space?`,

    apartment: `Hi, is the property manager available?\n\n[When connected]\nHey, Jaivien with More Life Vending. We add free vending machines to apartment common areas — laundry rooms, lobbies, wherever your residents hang out. Zero cost to the property, we handle everything, and residents love having snacks and drinks available after hours. Would it be worth a quick visit to walk the space?`,

    auto: `Hi, is the owner or manager available?\n\n[When connected]\nHey, Jaivien here with More Life Vending. Quick question — do your customers have anything to eat or drink while they're waiting on their car? We set up free vending machines in auto shops at no cost to you. Customers waiting 1-4 hours actually appreciate it, and it's a zero-hassle setup — we stock it, service it, you just provide the outlet. Worth a quick look?`,

    laundromat: `Hi, is the owner available?\n\n[When connected]\nJaivien with More Life Vending — short version: we put free vending machines in laundromats. Your customers are sitting there for 45 minutes to an hour with nothing to do. Zero cost to you, we handle stocking and maintenance. Would it be worth a visit to see how it'd fit in your space?`,

    gym: `Hi, is the facilities manager or owner available?\n\n[When connected]\nHey, Jaivien with More Life Vending. We place free vending machines in gyms — protein bars, sports drinks, water — all stocked and maintained by us at no cost. Members spend more and it adds real value without any work on your end. Would a quick in-person visit make sense?`,

    fitness: `Hi, is the facilities manager or owner available?\n\n[When connected]\nJaivien with More Life Vending. We help fitness studios offer snacks and drinks to members at zero cost — we handle everything and you earn a percentage of every sale. Worth a quick visit to look at the space?`,

    hotel: `Hi, can I speak with the facilities manager?\n\n[When connected]\nHey, Jaivien with More Life Vending. We work with hotels in ${city} to add vending machines for guests — chargers, snacks, drinks, toiletries, whatever makes sense for your property. Guests need things at 2 AM when nothing else is open. Zero cost to the hotel, we handle stocking and maintenance, you earn a percentage. Would it be worth a 15-minute conversation?`,

    office: `Hi, is the facilities manager available?\n\n[When connected]\nJaivien from More Life Vending. We add free vending machines to office buildings in ${city} — employees can grab snacks and drinks without leaving the building. No cost to the property, we manage everything, and it's a simple amenity that keeps staff happy. Worth a quick visit to walk the space?`,

    medical: `Hi, is the office manager or facilities manager available?\n\n[When connected]\nHey, Jaivien with More Life Vending. We place free vending machines in medical offices — for patients waiting and staff on long shifts. Zero cost, we handle all stocking and service. Worth a quick visit to take a look?`,

    dental: `Hi, is the office manager available?\n\n[When connected]\nJaivien with More Life Vending. We set up free vending machines in dental offices for patients and staff. No cost to you, we handle everything. Is a quick visit worth 15 minutes of your time?`,
  };

  for (const [key, script] of Object.entries(scripts)) {
    if (vertical.includes(key)) return script;
  }

  return `Hi, is the facilities manager or owner available?\n\n[When connected]\nHey, my name's Jaivien with More Life Vending — I'll keep this under 2 minutes. We place free vending machines in businesses like ${biz} in ${city}. Zero cost to you — we stock it, service it, handle everything. You just provide the outlet. If it ever doesn't work out, we remove it within 14 days. Worth a quick in-person visit to see if you'd be a good fit?`;
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
  const [walkInExpanded, setWalkInExpanded] = useState(false);
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
  const [callTags, setCallTags] = useState<string[]>([]);

  const QUICK_TAGS = ['Gatekeeper', 'Decision Maker', 'Left VM', 'Called Back', 'Interested', 'Price Objection', 'Has Vendor', 'Follow Up'];

  useEffect(() => { fetchLeads(); }, []);

  // Auto-initialize dialer on mount
  useEffect(() => { initDevice(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        setCallingLeadId(null);
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

  async function updateScore(lead: PhoneLead, score: number) {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, score } : l));
    if (activeLead?.id === lead.id) setActiveLead(prev => prev ? { ...prev, score } : prev);
    await fetch(`/api/vending/phone-leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
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
        tags:             callTags,
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
    setCallTags([]);
  }

  function selectLead(lead: PhoneLead) {
    setActiveLead(lead);
    setScriptExpanded(false);
    setCallNote('');
    setCallState('idle');
    fetchCallLogs(lead.id);

  }

  function getWalkInScript(lead: PhoneLead): string {
    const biz = lead.business_name || 'your business';
    const vertical = lead.vertical?.toLowerCase() || '';

    let contactTarget = 'facilities manager';
    if (vertical.includes('apartment')) contactTarget = 'property manager';
    if (vertical.includes('auto') || vertical.includes('laundromat')) contactTarget = 'owner';
    if (vertical.includes('hotel')) contactTarget = 'facilities manager (not the GM)';
    if (vertical.includes('medical') || vertical.includes('dental')) contactTarget = 'office manager';

    const objections = [
      {
        q: '"We already have a vending company"',
        a: 'How\'s the service been? Are employees happy with the selection and machine condition? We hear that a lot — and it usually means the current vendor isn\'t showing up consistently. When does their contract expire?'
      },
      {
        q: '"We don\'t have space"',
        a: 'Our machines fit in a 2×3 foot space — do you mind if I take a quick look? Takes 2 minutes.'
      },
      {
        q: '"We\'re not interested"',
        a: 'Totally understand. Would it be okay if I left some info and followed up in 3 months? Things change.'
      },
      {
        q: '"Let me think about it"',
        a: 'Of course — how about we do a 30-day trial? If it\'s not working, I\'ll remove it at no cost. Can we schedule a specific date to start?'
      },
    ];

    return `TARGET: Ask for the ${contactTarget}\n\nOPENING:\n"Hi, my name is Jaivien with More Life Vending, a local vending service. I noticed ${biz} doesn't have a modern vending setup, and I think your employees would really benefit from one. We provide brand-new machines with cashless payment — completely free to you. We handle all stocking, maintenance, and service. If it ever doesn't work, we remove it within 14 days. All you'd need is a standard electrical outlet. Would you have a couple of minutes to chat?"\n\nOBJECTIONS:\n${objections.map(o => `${o.q}\n→ ${o.a}`).join('\n\n')}`;
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
                      {lead.score !== undefined && lead.score !== null && (
                        <span className="text-xs text-yellow-400 font-mono">⭐ {lead.score}</span>
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
                          {/* Walk-In Script */}
                          <div className="mt-3">
                            <button
                              onClick={() => setWalkInExpanded(!walkInExpanded)}
                              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                            >
                              🚶 {walkInExpanded ? 'Hide' : 'Show'} Walk-In Script
                            </button>
                            {walkInExpanded && (
                              <div className="mt-2 p-3 bg-orange-950/30 border border-orange-800/40 rounded-lg">
                                <p className="text-xs text-orange-400 font-semibold mb-2">WALK-IN SCRIPT</p>
                                <pre className="text-xs text-orange-100 whitespace-pre-wrap font-mono leading-relaxed">
                                  {getWalkInScript(activeLead)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Research notes */}
                        {(lead.scout_notes || lead.qualifier_notes) && (
                          <div className="bg-[#0D0D14] rounded-lg border border-[#2A2A3E] p-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Research Notes</p>
                            {lead.scout_notes && <p className="text-gray-400 text-xs">{lead.scout_notes}</p>}
                            {lead.qualifier_notes && <p className="text-gray-400 text-xs mt-1">{lead.qualifier_notes}</p>}
                          </div>
                        )}

                        {/* Likelihood score */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">Likelihood (0–10)</span>
                          <input
                            type="range" min={0} max={10} step={0.5}
                            value={lead.score ?? 5}
                            onChange={e => updateScore(lead, parseFloat(e.target.value))}
                            className="flex-1 accent-[#22d3ee]"
                          />
                          <span className="text-xs text-yellow-400 font-mono w-6 text-right">{lead.score ?? '—'}</span>
                        </div>

                        {/* Tag picker */}
                        <div>
                          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_TAGS.map(tag => {
                              const selected = callTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={() => setCallTags(prev =>
                                    selected ? prev.filter(t => t !== tag) : [...prev, tag]
                                  )}
                                  className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                                    selected
                                      ? 'bg-[#22d3ee]/20 border-[#22d3ee] text-[#22d3ee]'
                                      : 'bg-transparent border-[#2A2A3E] text-gray-500 hover:border-gray-500'
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

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
                                className="bg-[#0D0D14] rounded-lg px-3 py-2.5 border border-[#2A2A3E] space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 w-14">Touch {log.touch_number}</span>
                                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                                    {log.duration_seconds > 0 && (
                                      <span className="text-xs text-gray-500">{formatDuration(log.duration_seconds)}</span>
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
                                {log.tags && log.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {log.tags.map(tag => (
                                      <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee]">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {log.notes && (
                                  <p className="text-xs text-gray-400 italic">{log.notes}</p>
                                )}
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
