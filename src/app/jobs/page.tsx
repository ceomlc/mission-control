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
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-700 text-gray-300',
  reviewing: 'bg-blue-900 text-blue-300',
  approved: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  applied: 'bg-purple-900 text-purple-300',
  interviewing: 'bg-yellow-900 text-yellow-300',
  offered: 'bg-emerald-900 text-emerald-300',
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId: number, newStatus: string) => {
    try {
      await fetch(`/api/jobs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, status: newStatus }),
      });
      fetchJobs();
      setSelectedJob(null);
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    jobs.forEach(j => {
      counts[j.status] = (counts[j.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) return <div className="p-8 text-center text-gray-400">Loading jobs...</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Job Applications</h1>
          <div className="text-sm text-gray-500">
            Total: {jobs.length} jobs tracked
          </div>
        </div>

        {/* Quick Add */}
        <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-4 mb-6">
          <p className="text-gray-400 text-sm">
            💡 To add jobs, just tell Athena to research and add them. I'll populate the details and my assessment for your review.
          </p>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="bg-[#1A1A2E] rounded-lg p-3 border border-[#2A2A3E]">
              <p className="text-2xl font-bold text-white">{statusCounts[status] || 0}</p>
              <p className="text-xs text-gray-500 capitalize">{status}</p>
            </div>
          ))}
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div 
              key={job.id}
              className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-5 hover:border-[#22d3ee]/50 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-white">{job.job_title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-gray-400 mb-2">{job.company_name} • {job.location}</p>
                  {job.salary_range && (
                    <p className="text-green-400 font-medium text-sm mb-2">💰 {job.salary_range}</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedJob(job)}
                    className="px-4 py-2 text-sm bg-[#2A2A3E] text-gray-300 rounded-lg hover:bg-[#3A3A4E]"
                  >
                    View Details
                  </button>
                </div>
              </div>

              {job.my_assessment && (
                <div className="mt-3 p-3 bg-blue-900/30 rounded-lg border border-blue-900/50">
                  <p className="text-xs text-blue-400 font-medium mb-1">My Assessment:</p>
                  <p className="text-sm text-gray-300">{job.my_assessment}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No jobs tracked yet.</p>
            <p className="text-sm text-gray-600">Tell Athena to start researching jobs for you!</p>
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
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Location</p>
                  <p className="font-medium text-white">{selectedJob.location}</p>
                </div>
                <div>
                  <p className="text-gray-500">Salary</p>
                  <p className="font-medium text-green-400">{selectedJob.salary_range || 'Not specified'}</p>
                </div>
              </div>

              {selectedJob.description && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Description:</p>
                  <div className="bg-[#0A0A0F] rounded-lg p-3 text-sm text-gray-300 max-h-40 overflow-y-auto border border-[#2A2A3E]">
                    {selectedJob.description}
                  </div>
                </div>
              )}

              {selectedJob.my_assessment && (
                <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-900/50">
                  <p className="text-blue-400 font-medium text-sm mb-2">🎯 My Assessment</p>
                  <p className="text-gray-300">{selectedJob.my_assessment}</p>
                </div>
              )}

              {selectedJob.skills_to_learn && (
                <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-900/50">
                  <p className="text-yellow-400 font-medium text-sm mb-2">📚 Skills to Learn</p>
                  <p className="text-gray-300">{selectedJob.skills_to_learn}</p>
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
            <div className="flex gap-3 mt-6 pt-4 border-t border-[#2A2A3E]">
              <button
                onClick={() => handleStatusChange(selectedJob.id, 'rejected')}
                className="flex-1 py-3 px-4 border border-red-800 text-red-400 rounded-lg hover:bg-red-900/30 font-medium"
              >
                ❌ Disagree (Skip)
              </button>
              <button
                onClick={() => handleStatusChange(selectedJob.id, 'approved')}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                ✅ Agree - Apply Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
