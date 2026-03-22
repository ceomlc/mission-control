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
  rejected:     'bg-red-900 text-red-400',
  applied:      'bg-purple-900 text-purple-300',
  interviewing: 'bg-yellow-900 text-yellow-300',
  offered:      'bg-emerald-900 text-emerald-300',
};

const statusLabels: Record<string, string> = {
  new:          'To Review',
  reviewing:    'Reviewing',
  approved:     'Ready to Apply',
  rejected:     'Skipped',
  applied:      'Applied',
  interviewing: 'Interviewing',
  offered:      'Offer Received',
};

const FILTER_TABS = [
  { key: 'new',          label: 'To Review' },
  { key: 'approved',     label: 'Ready to Apply' },
  { key: 'applied',      label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offered',      label: 'Offers' },
  { key: 'rejected',     label: 'Skipped' },
];

export default function JobsPage() {
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeFilter, setActiveFilter] = useState('new');
  const [updating, setUpdating]       = useState<number | null>(null);

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
      // Keep modal open but refresh it
      setSelectedJob(prev => prev?.id === jobId ? { ...prev, status: newStatus } : prev);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const openAndApply = (job: Job) => {
    window.open(job.job_url, '_blank', 'noopener,noreferrer');
  };

  const filteredJobs = activeFilter === 'all'
    ? jobs
    : jobs.filter(j => j.status === activeFilter);

  const countFor = (key: string) =>
    key === 'all' ? jobs.length : jobs.filter(j => j.status === key).length;

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading jobs...</div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Jobs</h1>
            <p className="text-gray-500 text-sm mt-1">
              Athena finds them · You review · You apply · Track it here
            </p>
          </div>
          <div className="text-sm text-gray-600">{jobs.length} tracked</div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_TABS.map(tab => {
            const count = countFor(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeFilter === tab.key
                    ? 'bg-[#22d3ee] text-black'
                    : 'bg-[#1A1A2E] text-gray-400 border border-[#2A2A3E] hover:border-[#22d3ee]/40'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                    activeFilter === tab.key ? 'bg-black/20 text-black' : 'bg-[#2A2A3E] text-gray-400'
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
          {filteredJobs.map(job => (
            <div
              key={job.id}
              className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-5 hover:border-[#22d3ee]/30 transition-all"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-white text-base">{job.job_title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {statusLabels[job.status] ?? job.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
                  {job.salary_range && (
                    <p className="text-green-400 text-sm font-medium mt-1">💰 {job.salary_range}</p>
                  )}
                </div>

                {/* Card actions */}
                <div className="flex gap-2 flex-shrink-0">
                  {(job.status === 'new' || job.status === 'reviewing') && (
                    <>
                      <button
                        onClick={() => setStatus(job.id, 'rejected')}
                        disabled={updating === job.id}
                        className="px-3 py-1.5 text-sm border border-red-900 text-red-400 rounded-lg hover:bg-red-900/20 disabled:opacity-40"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-3 py-1.5 text-sm bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/30 rounded-lg hover:bg-[#22d3ee]/20"
                      >
                        Review →
                      </button>
                    </>
                  )}

                  {job.status === 'approved' && (
                    <>
                      <button
                        onClick={() => openAndApply(job)}
                        className="px-3 py-1.5 text-sm bg-[#22d3ee] text-black rounded-lg hover:bg-[#06b6d4] font-semibold"
                      >
                        Apply →
                      </button>
                      <button
                        onClick={() => setStatus(job.id, 'applied')}
                        disabled={updating === job.id}
                        className="px-3 py-1.5 text-sm bg-purple-700 text-white rounded-lg hover:bg-purple-600 disabled:opacity-40"
                      >
                        ✓ Done
                      </button>
                    </>
                  )}

                  {(job.status === 'applied' || job.status === 'interviewing' || job.status === 'offered' || job.status === 'rejected') && (
                    <button
                      onClick={() => setSelectedJob(job)}
                      className="px-3 py-1.5 text-sm bg-[#2A2A3E] text-gray-400 rounded-lg hover:bg-[#3A3A4E]"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>

              {job.my_assessment && (
                <div className="mt-3 p-3 bg-[#0A0A1F] rounded-lg border border-blue-900/30">
                  <p className="text-xs text-blue-400 font-medium mb-1">Athena's take:</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{job.my_assessment}</p>
                </div>
              )}
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              {activeFilter === 'new'
                ? <>
                    <p className="text-lg mb-2">No new jobs yet</p>
                    <p className="text-sm">Athena's sourcer runs every 4 hours and will drop new matches here automatically.</p>
                  </>
                : <p>No jobs with this status.</p>
              }
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-[#2A2A3E] shadow-2xl">
            <div className="p-6">
              {/* Modal header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">{selectedJob.job_title}</h2>
                  <p className="text-gray-400 mt-0.5">{selectedJob.company_name}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedJob.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {statusLabels[selectedJob.status] ?? selectedJob.status}
                  </span>
                </div>
                <button onClick={() => setSelectedJob(null)} className="text-gray-600 hover:text-white text-xl leading-none ml-4">✕</button>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                {selectedJob.location && (
                  <div className="bg-[#0A0A0F] rounded-lg p-3 border border-[#2A2A3E]">
                    <p className="text-gray-500 text-xs mb-0.5">Location</p>
                    <p className="text-white font-medium">{selectedJob.location}</p>
                  </div>
                )}
                {selectedJob.salary_range && (
                  <div className="bg-[#0A0A0F] rounded-lg p-3 border border-[#2A2A3E]">
                    <p className="text-gray-500 text-xs mb-0.5">Salary</p>
                    <p className="text-green-400 font-medium">{selectedJob.salary_range}</p>
                  </div>
                )}
              </div>

              {/* Assessment */}
              {selectedJob.my_assessment && (
                <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-900/40 mb-4">
                  <p className="text-blue-400 font-medium text-sm mb-2">🎯 Athena's Assessment</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedJob.my_assessment}</p>
                </div>
              )}

              {/* Description */}
              {selectedJob.description && (
                <div className="mb-4">
                  <p className="text-gray-500 text-xs font-medium mb-2">Job Description</p>
                  <div className="bg-[#0A0A0F] rounded-lg p-3 border border-[#2A2A3E] text-sm text-gray-300 max-h-36 overflow-y-auto leading-relaxed">
                    {selectedJob.description}
                  </div>
                </div>
              )}

              {/* Skills */}
              {selectedJob.skills_to_learn && (
                <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-900/40 mb-4">
                  <p className="text-yellow-400 font-medium text-sm mb-2">📚 Skills to Highlight</p>
                  <p className="text-gray-300 text-sm">{selectedJob.skills_to_learn}</p>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-[#2A2A3E] pt-5 mt-2 space-y-3">

                {/* To Review → approve or skip */}
                {(selectedJob.status === 'new' || selectedJob.status === 'reviewing') && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStatus(selectedJob.id, 'rejected'); setSelectedJob(null); }}
                      disabled={updating === selectedJob.id}
                      className="flex-1 py-3 border border-red-900 text-red-400 rounded-xl hover:bg-red-900/20 font-medium disabled:opacity-40"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => setStatus(selectedJob.id, 'approved')}
                      disabled={updating === selectedJob.id}
                      className="flex-1 py-3 bg-[#22d3ee] text-black rounded-xl hover:bg-[#06b6d4] font-bold disabled:opacity-40"
                    >
                      {updating === selectedJob.id ? 'Saving...' : '✓ I want this one'}
                    </button>
                  </div>
                )}

                {/* Approved → open URL + mark applied */}
                {selectedJob.status === 'approved' && (
                  <>
                    <a
                      href={selectedJob.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-[#22d3ee] text-black rounded-xl hover:bg-[#06b6d4] font-bold text-base"
                    >
                      Open Job & Apply →
                    </a>
                    <button
                      onClick={() => { setStatus(selectedJob.id, 'applied'); setSelectedJob(null); }}
                      disabled={updating === selectedJob.id}
                      className="w-full py-3 bg-purple-700 text-white rounded-xl hover:bg-purple-600 font-medium disabled:opacity-40"
                    >
                      {updating === selectedJob.id ? 'Saving...' : '✓ Mark as Applied'}
                    </button>
                  </>
                )}

                {/* Applied → got interview? */}
                {selectedJob.status === 'applied' && (
                  <button
                    onClick={() => { setStatus(selectedJob.id, 'interviewing'); setSelectedJob(null); }}
                    disabled={updating === selectedJob.id}
                    className="w-full py-3 bg-yellow-700 text-white rounded-xl hover:bg-yellow-600 font-bold disabled:opacity-40"
                  >
                    🎉 Got an Interview
                  </button>
                )}

                {/* Interviewing → offer or rejected */}
                {selectedJob.status === 'interviewing' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStatus(selectedJob.id, 'rejected'); setSelectedJob(null); }}
                      disabled={updating === selectedJob.id}
                      className="flex-1 py-3 border border-red-900 text-red-400 rounded-xl hover:bg-red-900/20 disabled:opacity-40"
                    >
                      Didn't Get It
                    </button>
                    <button
                      onClick={() => { setStatus(selectedJob.id, 'offered'); setSelectedJob(null); }}
                      disabled={updating === selectedJob.id}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold disabled:opacity-40"
                    >
                      🎊 Got an Offer!
                    </button>
                  </div>
                )}

                {/* Always show job link at bottom */}
                {selectedJob.job_url && selectedJob.status !== 'approved' && (
                  <a
                    href={selectedJob.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-gray-500 hover:text-[#22d3ee] transition-colors pt-1"
                  >
                    View original posting →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
