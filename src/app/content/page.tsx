'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentIdea {
  id: number;
  title: string;
  hook: string | null;
  script: string | null;
  description: string | null;
  personal_angle: string | null;
  source_url: string | null;
  platforms: string[];
  content_type: string;
  source: string;
  status: string;
  thoth_notes: string | null;
  scheduled_week: string | null;
  posted_at: string | null;
  view_count: number;
  created_at: string;
}

interface ContentTrend {
  id: number;
  topic: string;
  platform: string;
  description: string | null;
  source_url: string | null;
  trend_score: number;
  developed: boolean;
  created_at: string;
}

interface InboxItem {
  id: number;
  message: string;
  source: string;
  status: string;
  created_at: string;
}

type TabStatus = 'idea' | 'scripted' | 'to_record' | 'recorded' | 'posted';

interface NewIdeaForm {
  title: string;
  description: string;
  hook: string;
  platforms: string[];
  content_type: string;
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function platformTag(platform: string) {
  switch (platform.toLowerCase()) {
    case 'tiktok':
      return (
        <span
          key={platform}
          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-black text-white border border-gray-700"
        >
          TikTok
        </span>
      );
    case 'instagram':
      return (
        <span
          key={platform}
          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
          }}
        >
          Instagram
        </span>
      );
    case 'youtube':
      return (
        <span
          key={platform}
          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white"
        >
          YouTube
        </span>
      );
    case 'linkedin':
      return (
        <span
          key={platform}
          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-700 text-white"
        >
          LinkedIn
        </span>
      );
    default:
      return (
        <span
          key={platform}
          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-700 text-gray-200"
        >
          {platform}
        </span>
      );
  }
}

function sourceBadge(source: string) {
  const map: Record<string, string> = {
    trending: 'bg-amber-900 text-amber-300 border border-amber-700',
    personal: 'bg-cyan-900 text-cyan-300 border border-cyan-700',
    thoth: 'bg-purple-900 text-purple-300 border border-purple-700',
    inbox: 'bg-green-900 text-green-300 border border-green-700',
  };
  const cls = map[source] || 'bg-gray-800 text-gray-400 border border-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {source}
    </span>
  );
}

const TAB_LABELS: Record<TabStatus, string> = {
  idea: 'Ideas',
  scripted: 'Scripted',
  to_record: 'To Record',
  recorded: 'Recorded',
  posted: 'Posted',
};

const EMPTY_MESSAGES: Record<TabStatus, string> = {
  idea: 'No ideas yet. Drop something in the Thoth inbox or wait for Athena to find trends.',
  scripted: 'Nothing scripted yet. Move ideas here when Thoth writes the script.',
  to_record: 'Nothing ready to record yet.',
  recorded: 'Nothing recorded yet.',
  posted: 'Nothing posted yet. Keep going — 7/week is the goal.',
};

const ALL_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'linkedin'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContentStudio() {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [trends, setTrends] = useState<ContentTrend[]>([]);
  const [lastScouted, setLastScouted] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabStatus>('idea');
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null);
  const [inboxInput, setInboxInput] = useState('');
  const [inboxSending, setInboxSending] = useState(false);
  const [showNewIdeaModal, setShowNewIdeaModal] = useState(false);
  const [newIdea, setNewIdea] = useState<NewIdeaForm>({
    title: '',
    description: '',
    hook: '',
    platforms: ['tiktok', 'instagram'],
    content_type: 'reel',
    source: 'personal',
  });
  const [newIdeaSaving, setNewIdeaSaving] = useState(false);

  // Edit state inside detail modal
  const [editFields, setEditFields] = useState<Partial<ContentIdea>>({});
  const [detailSaving, setDetailSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ideasRes, trendsRes, inboxRes] = await Promise.all([
        fetch('/api/content'),
        fetch('/api/content/trends'),
        fetch('/api/content/inbox'),
      ]);

      const [ideasData, trendsData, inboxData] = await Promise.all([
        ideasRes.json(),
        trendsRes.json(),
        inboxRes.json(),
      ]);

      setIdeas(Array.isArray(ideasData) ? ideasData : []);
      const allTrends = Array.isArray(trendsData) ? trendsData : [];
      // Separate health-check rows (used for "Last scouted" timestamp) from real trends
      const healthChecks = allTrends.filter((t: ContentTrend) => t.topic === '_health_check');
      setLastScouted(healthChecks.length > 0 ? healthChecks[0].created_at : null);
      setTrends(allTrends.filter((t: ContentTrend) => t.topic !== '_health_check'));
      setInbox(Array.isArray(inboxData) ? inboxData : []);
    } catch (err) {
      console.error('fetchAll error:', err);
      setError('Failed to load Content Studio. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Weekly progress ────────────────────────────────────────────────────────

  const monday = getMondayOfCurrentWeek();
  const weeklyPosted = ideas.filter((i) => {
    if (i.status !== 'posted' || !i.posted_at) return false;
    return new Date(i.posted_at) >= monday;
  }).length;
  const weeklyGoal = 7;
  const progressPct = Math.min((weeklyPosted / weeklyGoal) * 100, 100);

  // ── Filtered ideas ─────────────────────────────────────────────────────────

  const filteredIdeas = ideas.filter((i) => i.status === activeTab);

  // ── Tab counts ─────────────────────────────────────────────────────────────

  const tabCounts: Record<TabStatus, number> = {
    idea: ideas.filter((i) => i.status === 'idea').length,
    scripted: ideas.filter((i) => i.status === 'scripted').length,
    to_record: ideas.filter((i) => i.status === 'to_record').length,
    recorded: ideas.filter((i) => i.status === 'recorded').length,
    posted: ideas.filter((i) => i.status === 'posted').length,
  };

  // ── PATCH helper ──────────────────────────────────────────────────────────

  const patchIdea = useCallback(async (id: number, fields: Partial<ContentIdea>) => {
    const res = await fetch('/api/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) throw new Error('PATCH failed');
    return res.json();
  }, []);

  // ── Advance status ─────────────────────────────────────────────────────────

  const advanceStatus = useCallback(
    async (idea: ContentIdea) => {
      const next: Record<string, string> = {
        idea: 'scripted',
        scripted: 'to_record',
        to_record: 'recorded',
        recorded: 'posted',
      };
      const nextStatus = next[idea.status];
      if (!nextStatus) return;

      const fields: Partial<ContentIdea> = { status: nextStatus as ContentIdea['status'] };
      if (nextStatus === 'posted') {
        fields.posted_at = new Date().toISOString();
      }

      try {
        await patchIdea(idea.id, fields);
        await fetchAll();
        if (selectedIdea?.id === idea.id) {
          setSelectedIdea(null);
        }
      } catch {
        setError('Failed to update status.');
      }
    },
    [patchIdea, fetchAll, selectedIdea]
  );

  // ── Send to Thoth inbox ────────────────────────────────────────────────────

  const sendToInbox = useCallback(async () => {
    if (!inboxInput.trim()) return;
    setInboxSending(true);
    try {
      const res = await fetch('/api/content/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inboxInput.trim() }),
      });
      if (!res.ok) throw new Error('POST inbox failed');
      setInboxInput('');
      const updated = await fetch('/api/content/inbox');
      const data = await updated.json();
      setInbox(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to send message to Thoth inbox.');
    } finally {
      setInboxSending(false);
    }
  }, [inboxInput]);

  // ── Develop trend ─────────────────────────────────────────────────────────

  const developTrend = useCallback(
    async (trend: ContentTrend) => {
      try {
        // Create content idea from trend
        const createRes = await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trend.topic,
            source: 'trending',
            thoth_notes: trend.description,
            platforms: trend.platform === 'all' ? ['tiktok', 'instagram'] : [trend.platform],
            status: 'idea',
          }),
        });
        if (!createRes.ok) throw new Error('Failed to create idea from trend');

        // Mark trend as developed
        await fetch('/api/content/trends', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: trend.id, developed: true }),
        });

        await fetchAll();
      } catch {
        setError('Failed to develop trend.');
      }
    },
    [fetchAll]
  );

  // ── Create new idea ───────────────────────────────────────────────────────

  const createIdea = useCallback(async () => {
    if (!newIdea.title.trim()) return;
    setNewIdeaSaving(true);
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIdea.title.trim(),
          description: newIdea.description || null,
          hook: newIdea.hook || null,
          platforms: newIdea.platforms,
          content_type: newIdea.content_type,
          source: newIdea.source,
          status: 'idea',
        }),
      });
      if (!res.ok) throw new Error('POST failed');
      setShowNewIdeaModal(false);
      setNewIdea({
        title: '',
        description: '',
        hook: '',
        platforms: ['tiktok', 'instagram'],
        content_type: 'reel',
        source: 'personal',
      });
      await fetchAll();
    } catch {
      setError('Failed to create idea.');
    } finally {
      setNewIdeaSaving(false);
    }
  }, [newIdea, fetchAll]);

  // ── Save detail edits ─────────────────────────────────────────────────────

  const saveDetailEdits = useCallback(async () => {
    if (!selectedIdea) return;
    setDetailSaving(true);
    try {
      await patchIdea(selectedIdea.id, editFields);
      await fetchAll();
      setSelectedIdea(null);
      setEditFields({});
    } catch {
      setError('Failed to save changes.');
    } finally {
      setDetailSaving(false);
    }
  }, [selectedIdea, editFields, patchIdea, fetchAll]);

  // ── Open detail modal ─────────────────────────────────────────────────────

  const openDetail = useCallback((idea: ContentIdea) => {
    setSelectedIdea(idea);
    setEditFields({
      hook: idea.hook ?? '',
      script: idea.script ?? '',
      personal_angle: idea.personal_angle ?? '',
      platforms: idea.platforms ?? ['tiktok', 'instagram'],
      content_type: idea.content_type ?? 'reel',
    });
  }, []);

  // ── Action button per status ──────────────────────────────────────────────

  function actionButton(idea: ContentIdea, inModal = false) {
    const baseClass = inModal
      ? 'px-4 py-2 rounded-lg text-sm font-semibold transition'
      : 'px-3 py-1 rounded-lg text-xs font-semibold transition';

    if (idea.status === 'idea') {
      if (idea.hook || idea.script) {
        return (
          <button
            className={`${baseClass} bg-[#22d3ee] text-black hover:bg-cyan-300`}
            onClick={(e) => {
              e.stopPropagation();
              advanceStatus(idea);
            }}
          >
            Mark Scripted
          </button>
        );
      }
      return (
        <button
          className={`${baseClass} bg-[#2A2A3E] text-[#22d3ee] border border-[#22d3ee] hover:bg-[#22d3ee] hover:text-black`}
          onClick={(e) => {
            e.stopPropagation();
            openDetail(idea);
          }}
        >
          Add Script
        </button>
      );
    }
    if (idea.status === 'scripted') {
      return (
        <button
          className={`${baseClass} bg-yellow-600 text-white hover:bg-yellow-500`}
          onClick={(e) => {
            e.stopPropagation();
            advanceStatus(idea);
          }}
        >
          Ready to Record
        </button>
      );
    }
    if (idea.status === 'to_record') {
      return (
        <button
          className={`${baseClass} bg-orange-600 text-white hover:bg-orange-500`}
          onClick={(e) => {
            e.stopPropagation();
            advanceStatus(idea);
          }}
        >
          Mark Recorded
        </button>
      );
    }
    if (idea.status === 'recorded') {
      return (
        <button
          className={`${baseClass} bg-green-600 text-white hover:bg-green-500`}
          onClick={(e) => {
            e.stopPropagation();
            advanceStatus(idea);
          }}
        >
          Mark Posted
        </button>
      );
    }
    if (idea.status === 'posted' && idea.view_count > 0) {
      return (
        <span className="text-xs text-gray-400">
          {idea.view_count.toLocaleString()} views
        </span>
      );
    }
    return null;
  }

  // ── Inbox status dot ──────────────────────────────────────────────────────

  function inboxDot(status: string) {
    if (status === 'pending') {
      return (
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
      );
    }
    if (status === 'picked_up') {
      return <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />;
    }
    return <span className="inline-block w-2 h-2 rounded-full bg-green-400" />;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Error Banner */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-600 text-red-200 px-5 py-3 rounded-xl text-sm flex items-center gap-3 shadow-xl">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-white font-bold ml-2"
          >
            x
          </button>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Content Studio</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI for everyday people — weekly target: 7 pieces</p>
          </div>
          <button
            onClick={() => setShowNewIdeaModal(true)}
            className="px-4 py-2 bg-[#22d3ee] text-black text-sm font-semibold rounded-xl hover:bg-cyan-300 transition"
          >
            + New Idea
          </button>
        </div>

        {/* Weekly Progress */}
        <div className="bg-[#1A1A2E] rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Weekly Progress</span>
            <span className="text-sm font-bold text-[#22d3ee]">
              {weeklyPosted} / {weeklyGoal} this week
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#2A2A3E] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#22d3ee] transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            {Array.from({ length: weeklyGoal }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < weeklyPosted ? 'bg-[#22d3ee]' : 'bg-[#2A2A3E]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="flex gap-5 items-start flex-col lg:flex-row">
          {/* Left — Content List */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(TAB_LABELS) as TabStatus[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                    activeTab === tab
                      ? 'bg-[#22d3ee] text-black'
                      : 'bg-[#1A1A2E] text-gray-400 hover:text-white hover:bg-[#252542]'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {tabCounts[tab] > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        activeTab === tab ? 'bg-black/20 text-black' : 'bg-[#2A2A3E] text-gray-300'
                      }`}
                    >
                      {tabCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Cards */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[#1A1A2E] rounded-xl h-24 animate-pulse" />
                ))}
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="bg-[#1A1A2E] rounded-xl p-8 text-center">
                <p className="text-gray-500 text-sm">{EMPTY_MESSAGES[activeTab]}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    onClick={() => openDetail(idea)}
                    className="bg-[#1A1A2E] rounded-xl p-4 cursor-pointer hover:bg-[#252542] transition border border-transparent hover:border-[#2A2A4E] group"
                  >
                    {/* Row 1: platforms + source badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {(idea.platforms || []).map((p) => (
                        <span key={p}>{platformTag(p)}</span>
                      ))}
                      {sourceBadge(idea.source || 'personal')}
                      {idea.content_type && (
                        <span className="px-2 py-0.5 rounded text-xs bg-[#2A2A3E] text-gray-400">
                          {idea.content_type}
                        </span>
                      )}
                    </div>

                    {/* Row 2: title + action */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white leading-snug group-hover:text-[#22d3ee] transition">
                          {idea.title}
                        </h3>
                        {idea.hook && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2 italic">
                            &ldquo;{idea.hook}&rdquo;
                          </p>
                        )}
                        {!idea.hook && idea.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {idea.description}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {actionButton(idea)}
                      </div>
                    </div>

                    {/* Row 3: meta */}
                    {idea.posted_at && (
                      <p className="text-xs text-gray-600 mt-2">
                        Posted {new Date(idea.posted_at).toLocaleDateString()}
                        {idea.view_count > 0 && ` · ${idea.view_count.toLocaleString()} views`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
            {/* Thoth Inbox */}
            <div className="bg-[#1A1A2E] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <h2 className="font-semibold text-sm">Thoth Inbox</h2>
              </div>
              <textarea
                value={inboxInput}
                onChange={(e) => setInboxInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendToInbox();
                }}
                rows={3}
                placeholder="Drop an idea for Thoth..."
                className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#22d3ee] transition"
              />
              <button
                onClick={sendToInbox}
                disabled={inboxSending || !inboxInput.trim()}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-purple-700 hover:bg-purple-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inboxSending ? 'Sending...' : 'Send to Thoth'}
              </button>

              {/* Recent inbox items */}
              <div className="space-y-2 pt-1">
                {inbox.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 shrink-0">{inboxDot(item.status)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 line-clamp-2 leading-snug">{item.message}</p>
                      <p className="text-gray-600 mt-0.5 capitalize">{item.status}</p>
                    </div>
                  </div>
                ))}
                {inbox.length === 0 && !loading && (
                  <p className="text-xs text-gray-600 text-center py-2">No messages yet</p>
                )}
              </div>
            </div>

            {/* Trending Now */}
            <div className="bg-[#1A1A2E] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <h2 className="font-semibold text-sm">Trending Now</h2>
                <span className="text-xs text-gray-600 ml-auto">
                  {lastScouted
                    ? `Last scouted ${(() => {
                        const diff = Date.now() - new Date(lastScouted).getTime();
                        const h = Math.floor(diff / 3600000);
                        return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
                      })()}`
                    : "Athena's feed"}
                </span>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-[#0A0A0F] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : trends.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">
                  Athena will drop trending topics here
                </p>
              ) : (
                <div className="space-y-2">
                  {trends.slice(0, 5).map((trend) => (
                    <div
                      key={trend.id}
                      className="bg-[#0A0A0F] rounded-lg p-3 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white leading-snug line-clamp-1">
                            {trend.topic}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {platformTag(trend.platform)}
                            {trend.trend_score > 0 && (
                              <span className="text-xs text-amber-400 font-medium">
                                {trend.trend_score}pt
                              </span>
                            )}
                          </div>
                          {trend.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {trend.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => developTrend(trend)}
                        className="w-full text-xs py-1.5 rounded-lg bg-amber-900/50 text-amber-300 hover:bg-amber-800 border border-amber-800 transition font-medium"
                      >
                        Develop →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── New Idea Modal ─────────────────────────────────────────────────────── */}
      {showNewIdeaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1A1A2E] rounded-2xl w-full max-w-lg shadow-2xl border border-[#2A2A3E] overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#2A2A3E]">
              <h2 className="text-lg font-bold">New Content Idea</h2>
              <button
                onClick={() => setShowNewIdeaModal(false)}
                className="text-gray-500 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newIdea.title}
                  onChange={(e) => setNewIdea((p) => ({ ...p, title: e.target.value }))}
                  placeholder="What's the idea?"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#22d3ee] transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newIdea.description}
                  onChange={(e) => setNewIdea((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief context or notes..."
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#22d3ee] transition"
                />
              </div>

              {/* Hook */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Opening Hook
                </label>
                <input
                  type="text"
                  value={newIdea.hook}
                  onChange={(e) => setNewIdea((p) => ({ ...p, hook: e.target.value }))}
                  placeholder="First line that stops the scroll..."
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#22d3ee] transition"
                />
              </div>

              {/* Platforms */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-2">
                  Platforms
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setNewIdea((prev) => ({
                          ...prev,
                          platforms: prev.platforms.includes(p)
                            ? prev.platforms.filter((x) => x !== p)
                            : [...prev.platforms, p],
                        }))
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        newIdea.platforms.includes(p)
                          ? 'bg-[#22d3ee] text-black border-[#22d3ee]'
                          : 'bg-[#0A0A0F] text-gray-400 border-[#2A2A3E] hover:border-gray-500'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content type + Source row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1.5">
                    Content Type
                  </label>
                  <select
                    value={newIdea.content_type}
                    onChange={(e) => setNewIdea((p) => ({ ...p, content_type: e.target.value }))}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22d3ee] transition"
                  >
                    <option value="reel">Reel</option>
                    <option value="post">Post</option>
                    <option value="long-form">Long-form</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1.5">
                    Source
                  </label>
                  <select
                    value={newIdea.source}
                    onChange={(e) => setNewIdea((p) => ({ ...p, source: e.target.value }))}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22d3ee] transition"
                  >
                    <option value="personal">Personal</option>
                    <option value="thoth">Thoth</option>
                    <option value="trending">Trending</option>
                    <option value="inbox">Inbox</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#2A2A3E] flex gap-3">
              <button
                onClick={() => setShowNewIdeaModal(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-[#0A0A0F] text-gray-400 hover:text-white border border-[#2A2A3E] transition"
              >
                Cancel
              </button>
              <button
                onClick={createIdea}
                disabled={newIdeaSaving || !newIdea.title.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-[#22d3ee] text-black hover:bg-cyan-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {newIdeaSaving ? 'Creating...' : 'Create Idea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / Edit Modal ────────────────────────────────────────────────── */}
      {selectedIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1A1A2E] rounded-2xl w-full max-w-2xl shadow-2xl border border-[#2A2A3E] overflow-y-auto max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-[#2A2A3E]">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(selectedIdea.platforms || []).map((p) => (
                    <span key={p}>{platformTag(p)}</span>
                  ))}
                  {sourceBadge(selectedIdea.source)}
                </div>
                <h2 className="text-lg font-bold leading-snug">{selectedIdea.title}</h2>
              </div>
              <button
                onClick={() => {
                  setSelectedIdea(null);
                  setEditFields({});
                }}
                className="text-gray-500 hover:text-white text-2xl leading-none shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Hook */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Opening Hook
                </label>
                <input
                  type="text"
                  value={(editFields.hook as string) ?? ''}
                  onChange={(e) => setEditFields((p) => ({ ...p, hook: e.target.value }))}
                  placeholder="First line that stops the scroll..."
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#22d3ee] transition"
                />
              </div>

              {/* Script */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Script
                </label>
                <textarea
                  rows={6}
                  value={(editFields.script as string) ?? ''}
                  onChange={(e) => setEditFields((p) => ({ ...p, script: e.target.value }))}
                  placeholder="Full script or talking points..."
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#22d3ee] transition font-mono"
                />
              </div>

              {/* Personal Angle */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Personal Angle
                </label>
                <textarea
                  rows={3}
                  value={(editFields.personal_angle as string) ?? ''}
                  onChange={(e) =>
                    setEditFields((p) => ({ ...p, personal_angle: e.target.value }))
                  }
                  placeholder="How does this connect to your story or your audience?"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#22d3ee] transition"
                />
              </div>

              {/* Thoth Notes (read-only display if present) */}
              {selectedIdea.thoth_notes && (
                <div>
                  <label className="text-xs font-medium text-purple-400 block mb-1.5">
                    Thoth&apos;s Notes
                  </label>
                  <div className="bg-purple-900/20 border border-purple-800 rounded-lg px-3 py-2 text-sm text-purple-200 whitespace-pre-wrap">
                    {selectedIdea.thoth_notes}
                  </div>
                </div>
              )}

              {/* Platforms checkboxes */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-2">
                  Platforms
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map((p) => {
                    const current = (editFields.platforms as string[]) ?? selectedIdea.platforms ?? [];
                    const active = current.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setEditFields((prev) => {
                            const cur = (prev.platforms as string[]) ?? selectedIdea.platforms ?? [];
                            return {
                              ...prev,
                              platforms: active
                                ? cur.filter((x) => x !== p)
                                : [...cur, p],
                            };
                          })
                        }
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                          active
                            ? 'bg-[#22d3ee] text-black border-[#22d3ee]'
                            : 'bg-[#0A0A0F] text-gray-400 border-[#2A2A3E] hover:border-gray-500'
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Type */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Content Type
                </label>
                <select
                  value={(editFields.content_type as string) ?? selectedIdea.content_type ?? 'reel'}
                  onChange={(e) =>
                    setEditFields((p) => ({ ...p, content_type: e.target.value }))
                  }
                  className="bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22d3ee] transition"
                >
                  <option value="reel">Reel</option>
                  <option value="post">Post</option>
                  <option value="long-form">Long-form</option>
                </select>
              </div>

              {/* Source URL if present */}
              {selectedIdea.source_url && (
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1">
                    Source
                  </label>
                  <a
                    href={selectedIdea.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline break-all"
                  >
                    {selectedIdea.source_url}
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-[#2A2A3E] flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  setSelectedIdea(null);
                  setEditFields({});
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#0A0A0F] text-gray-400 hover:text-white border border-[#2A2A3E] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveDetailEdits}
                disabled={detailSaving}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#22d3ee] text-black hover:bg-cyan-300 transition disabled:opacity-50"
              >
                {detailSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <div className="ml-auto">
                {actionButton(selectedIdea, true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
