'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: number;
  job_title: string;
  company_name: string;
  location: string;
  salary_range: string;
  description: string;
  job_url: string;
  my_assessment: string;
  skills_to_learn: string;
  status: string;
  platform?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

const FILTER_TABS = [
  { key: 'review',  label: 'To Review' },
  { key: 'applied', label: 'Applied' },
  { key: 'skipped', label: 'Skipped' },
];

export default function JobsPage() {
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('review');
  const [updating, setUpdating]       = useState<number | null>(null);
  const [expanded, setExpanded]       = useState<Set<number>>(new Set());

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const res  = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (jobId: number, newStatus: string) => {
    setUpdating(jobId);
    try {
      await fetch('/api/jobs', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: jobId, status: newStatus }),
      });
      await fetchJobs();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const handleApply = async (job: Job) => {
    window.open(job.job_url, '_blank', 'noopener,noreferrer');
    await setStatus(job.id, 'applied');
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const reviewJobs  = jobs.filter(j => j.status === 'new' || j.status === 'approved' || j.status === 'reviewing');
  const appliedJobs = jobs.filter(j => j.status === 'applied' || j.status === 'interviewing' || j.status === 'offered');
  const skippedJobs = jobs.filter(j => j.status === 'rejected');

  const tabJobs = activeTab === 'review'
    ? reviewJobs
    : activeTab === 'applied'
    ? appliedJobs
    : skippedJobs;

  const countFor = (tab: string) => {
    if (tab === 'review')  return reviewJobs.length;
    if (tab === 'applied') return appliedJobs.length;
    if (tab === 'skipped') return skippedJobs.length;
    return 0;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading jobs...</div>
  );

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">{jobs.length} jobs tracked</p>
        </div>

        {/* Info banner */}
        <div className="mb-6 bg-[#141414] border border-[#252525] rounded-xl px-4 py-3 text-sm text-gray-400">
          Athena sources new jobs every 4 hours. Review and apply at your own pace.
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {FILTER_TABS.map(tab => {
            const count = countFor(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#141414] text-gray-400 border border-[#252525] hover:border-[#DC2626]/40'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#252525] text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Job cards */}
        <div className="space-y-3">
          {tabJobs.map(job => (
            <div
              key={job.id}
              className={`bg-[#141414] rounded-xl border p-5 transition-all ${
                activeTab === 'skipped'
                  ? 'border-[#252525] opacity-60'
                  : 'border-[#252525] hover:border-[#DC2626]/30'
              }`}
            >
              {/* Card header */}
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="font-bold text-white text-base">{job.job_title}</h3>
                    {activeTab === 'skipped' && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400">Skipped</span>
                    )}
                    {activeTab === 'applied' && (
                      <span className="text-green-400 text-base">✓</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm font-medium">{job.company_name}</p>
                  {job.salary_range && (
                    <p className="text-green-400 text-sm mt-1">💰 {job.salary_range}</p>
                  )}
                  {(job.platform || job.source) && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-[#0A0A1F] border border-blue-900/40 text-blue-400 text-xs rounded-full">
                      {job.platform || job.source}
                    </span>
                  )}
                  {activeTab === 'applied' && job.updated_at && (
                    <p className="text-gray-500 text-xs mt-1">Applied {formatDate(job.updated_at)}</p>
                  )}
                </div>

                {/* Actions */}
                {activeTab === 'review' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setStatus(job.id, 'rejected')}
                      disabled={updating === job.id}
                      className="px-3 py-1.5 text-sm border border-red-900 text-red-400 rounded-lg hover:bg-red-900/20 disabled:opacity-40"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleApply(job)}
                      disabled={updating === job.id}
                      className="px-3 py-1.5 text-sm bg-[#DC2626] text-white rounded-lg hover:bg-[#b91c1c] font-bold disabled:opacity-40"
                    >
                      {updating === job.id ? 'Opening...' : 'Apply →'}
                    </button>
                  </div>
                )}
              </div>

              {/* Claude's assessment — collapsible */}
              {job.my_assessment && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleExpand(job.id)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <span>{expanded.has(job.id) ? '▾' : '▸'}</span>
                    Claude's assessment
                  </button>
                  {expanded.has(job.id) && (
                    <div className="mt-2 p-3 bg-[#0A0A1F] rounded-lg border border-blue-900/30">
                      <p className="text-sm text-gray-300 leading-relaxed">{job.my_assessment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {tabJobs.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              {activeTab === 'review' ? (
                <>
                  <p className="text-lg mb-2">No jobs to review</p>
                  <p className="text-sm">Athena's sourcer runs every 4 hours and will drop new matches here.</p>
                </>
              ) : activeTab === 'applied' ? (
                <p>No applications yet. Start reviewing jobs above.</p>
              ) : (
                <p>No skipped jobs.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
