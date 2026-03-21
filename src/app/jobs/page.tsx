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
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  new:          'bg-gray-700 text-gray-300',
  reviewing:    'bg-blue-900 text-blue-300',
  approved:     'bg-amber-900 text-amber-300',
  rejected:     'bg-red-900 text-red-300',
  applied:      'bg-purple-900 text-purple-300',
  interviewing: 'bg-yellow-900 text-yellow-300',
  offered:      'bg-emerald-900 text-emerald-300',
};

const FILTER_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'new',          label: 'To Review' },
  { key: 'approved',     label: 'Apply Queue' },
  { key: 'applied',      label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offered',      label: 'Offered' },
  { key: 'rejected',     label: 'Rejected' },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeFilter, setActiveFilter] = useState('new');
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [applyResult, setApplyResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId: number, newStatus: string) => {
    try {
      await fetch('/api/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, status: newStatus }),
      });
      await fetchJobs();
      setSelectedJob(null);
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const handleApproveAndQueue = async (job: Job) => {
    setApplyingId(job.id);
    setApplyResult(null);
    try {
      // 1. Mark as approved (queued for Athena to apply)
      const patchRes = await fetch('/api/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, status: 'approved' }),
      });
      if (!patchRes.ok) throw new Error('Failed to update status');

      // 2. Notify Athena's apply queue
      let athenaOk = false;
      try {
        const triggerRes = await fetch('/api/jobs/trigger-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id }),
        });
        athenaOk = triggerRes.ok;
      } catch {
        // trigger endpoint may not exist yet — that's ok
      }

      setApplyResult({
        id: job.id,
        ok: true,
        msg: athenaOk
          ? 'Queued — Athena will apply shortly'
          : 'Marked approved. Tell Athena to apply to queued jobs.',
      });
      await fetchJobs();
      setSelectedJob(null);
    } catch (err: any) {
      setApplyResult({ id: job.id, ok: false, msg: err.message });
    } finally {
      setApplyingId(null);
    }
  };

  const filteredJobs = activeFilter === 'all'
    ? jobs
    : jobs.filter(j => j.status === activeFilter);

  const countFor = (key: string) =>
    key === 'all' ? jobs.length : jobs.filter(j => j.status === key).length;

  if (loading) return <div className="p-8 text-center text-gray-400">Loading jobs...</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Job Applications</h1>
          <div className="text-sm text-gray-500">{jobs.length} total tracked</div>
        </div>

        {/* Apply result banner */}
        {applyResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex justify-between items-center ${
            applyResult.ok ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'
          }`}>
            <span>{applyResult.ok ? '✅' : '❌'} {applyResult.msg}</span>
            <button onClick={() => setApplyResult(null)} className="text-gray-500 hover:text-white ml-4">✕</button>
          </div>
        )}

        {/* Hint */}
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4 mb-5">
          <p className="text-gray-400 text-sm">
            💡 Tell Athena to research and shortlist jobs — they'll appear in <strong className="text-white">To Review</strong>. Approve to queue them for application.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                activeFilter === tab.key
                  ? 'bg-[#22d3ee] text-black'
                  : 'bg-[#1A1A2E] text-gray-400 border border-[#2A2A3E] hover:border-[#22d3ee]/50'
              }`}
            >
              {tab.label}
              {countFor(tab.key) > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeFilter === tab.key ? 'bg-black/20' : 'bg-[#2A2A3E]'
                }`}>
                  {countFor(tab.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Jobs list */}
        <div className="space-y-4">
          {filteredJobs.map(job => (
            <div
              key={job.id}
              className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-5 hover:border-[#22d3ee]/50 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-white">{job.job_title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-gray-400 mb-2">{job.company_name} • {job.location}</p>
                  {job.salary_range && (
                    <p className="text-green-400 font-medium text-sm">💰 {job.salary_range}</p>
                  )}
                </div>

                <div className="flex gap-2 ml-4 flex-shrink-0">
                  {job.status === 'new' || job.status === 'reviewing' ? (
                    <>
                      <button
                        onClick={() => handleStatusChange(job.id, 'rejected')}
                        className="px-3 py-2 text-sm border border-red-800 text-red-400 rounded-lg hover:bg-red-900/30"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-3 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-600"
                      >
                        Review
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedJob(job)}
                      className="px-4 py-2 text-sm bg-[#2A2A3E] text-gray-300 rounded-lg hover:bg-[#3A3A4E]"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>

              {job.my_assessment && (
                <div className="mt-3 p-3 bg-blue-900/30 rounded-lg border border-blue-900/50">
                  <p className="text-xs text-blue-400 font-medium mb-1">Assessment:</p>
                  <p className="text-sm text-gray-300">{job.my_assessment}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No {activeFilter === 'all' ? '' : activeFilter + ' '}jobs.</p>
            {activeFilter === 'new' && (
              <p className="text-sm text-gray-600">Tell Athena to find and shortlist jobs for you!</p>
            )}
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#1A1A2E] rounded-2xl max-w-2xl w-full p-6 my-8 border border-[#2A2A3E]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedJob.job_title}</h2>
                <p className="text-gray-400">{selectedJob.company_name}</p>
              </div>
              <button onClick={() => setSelectedJob(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Location</p>
                  <p className="font-medium text-white">{selectedJob.location || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Salary</p>
                  <p className="font-medium text-green-400">{selectedJob.salary_range || 'Not specified'}</p>
                </div>
              </div>

              {selectedJob.description && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Description</p>
                  <div className="bg-[#0A0A0F] rounded-lg p-3 text-sm text-gray-300 max-h-40 overflow-y-auto border border-[#2A2A3E]">
                    {selectedJob.description}
                  </div>
                </div>
              )}

              {selectedJob.my_assessment && (
                <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-900/50">
                  <p className="text-blue-400 font-medium text-sm mb-2">🎯 Assessment</p>
                  <p className="text-gray-300 text-sm">{selectedJob.my_assessment}</p>
                </div>
              )}

              {selectedJob.skills_to_learn && (
                <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-900/50">
                  <p className="text-yellow-400 font-medium text-sm mb-2">📚 Skills to Learn</p>
                  <p className="text-gray-300 text-sm">{selectedJob.skills_to_learn}</p>
                </div>
              )}

              {selectedJob.job_url && (
                <a
                  href={selectedJob.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2 text-[#22d3ee] hover:underline text-sm"
                >
                  View Original Posting →
                </a>
              )}
            </div>

            {/* Action Buttons */}
            {(selectedJob.status === 'new' || selectedJob.status === 'reviewing') && (
              <div className="flex gap-3 mt-6 pt-4 border-t border-[#2A2A3E]">
                <button
                  onClick={() => handleStatusChange(selectedJob.id, 'rejected')}
                  className="flex-1 py-3 px-4 border border-red-800 text-red-400 rounded-lg hover:bg-red-900/30 font-medium"
                >
                  ❌ Skip
                </button>
                <button
                  disabled={applyingId === selectedJob.id}
                  onClick={() => handleApproveAndQueue(selectedJob)}
                  className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {applyingId === selectedJob.id ? 'Queuing...' : '✅ Approve — Queue for Apply'}
                </button>
              </div>
            )}

            {selectedJob.status === 'approved' && (
              <div className="mt-6 pt-4 border-t border-[#2A2A3E]">
                <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-700/50 text-amber-300 text-sm text-center">
                  ⏳ Queued — waiting for Athena to apply
                </div>
                <button
                  onClick={() => handleStatusChange(selectedJob.id, 'applied')}
                  className="w-full mt-3 py-2 px-4 bg-purple-700 text-white rounded-lg hover:bg-purple-600 text-sm"
                >
                  Mark as Applied Manually
                </button>
              </div>
            )}

            {selectedJob.status === 'applied' && (
              <div className="mt-6 pt-4 border-t border-[#2A2A3E]">
                <button
                  onClick={() => handleStatusChange(selectedJob.id, 'interviewing')}
                  className="w-full py-3 bg-yellow-700 text-white rounded-lg hover:bg-yellow-600 font-medium"
                >
                  🎉 Got Interview
                </button>
              </div>
            )}

            {selectedJob.status === 'interviewing' && (
              <div className="flex gap-3 mt-6 pt-4 border-t border-[#2A2A3E]">
                <button
                  onClick={() => handleStatusChange(selectedJob.id, 'rejected')}
                  className="flex-1 py-3 border border-red-800 text-red-400 rounded-lg hover:bg-red-900/30"
                >
                  ❌ Rejected
                </button>
                <button
                  onClick={() => handleStatusChange(selectedJob.id, 'offered')}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  🎊 Got Offer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
