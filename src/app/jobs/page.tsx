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
  new: 'bg-gray-100 text-gray-800',
  reviewing: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  applied: 'bg-purple-100 text-purple-800',
  interviewing: 'bg-yellow-100 text-yellow-800',
  offered: 'bg-emerald-100 text-emerald-800',
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

  if (loading) return <div className="p-8 text-center">Loading jobs...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Applications</h1>
          <div className="text-sm text-gray-500">
            Total: {jobs.length} jobs tracked
          </div>
        </div>

        {/* Quick Add */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <p className="text-gray-600 text-sm">
            💡 To add jobs, just tell Athena to research and add them. I'll populate the details and my assessment for your review.
          </p>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-2xl font-bold">{statusCounts[status] || 0}</p>
              <p className="text-xs text-gray-500 capitalize">{status}</p>
            </div>
          ))}
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div 
              key={job.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{job.job_title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2">{job.company_name} • {job.location}</p>
                  {job.salary_range && (
                    <p className="text-green-600 font-medium text-sm mb-2">💰 {job.salary_range}</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedJob(job)}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    View Details
                  </button>
                </div>
              </div>

              {job.my_assessment && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">My Assessment:</p>
                  <p className="text-sm text-gray-700">{job.my_assessment}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No jobs tracked yet.</p>
            <p className="text-sm text-gray-400">Tell Athena to start researching jobs for you!</p>
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedJob.job_title}</h2>
                <p className="text-gray-600">{selectedJob.company_name}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Location</p>
                  <p className="font-medium">{selectedJob.location}</p>
                </div>
                <div>
                  <p className="text-gray-500">Salary</p>
                  <p className="font-medium text-green-600">{selectedJob.salary_range || 'Not specified'}</p>
                </div>
              </div>

              {selectedJob.description && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Description:</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-40 overflow-y-auto">
                    {selectedJob.description}
                  </div>
                </div>
              )}

              {selectedJob.my_assessment && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-blue-600 font-medium text-sm mb-2">🎯 My Assessment</p>
                  <p className="text-gray-700">{selectedJob.my_assessment}</p>
                </div>
              )}

              {selectedJob.skills_to_learn && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-yellow-700 font-medium text-sm mb-2">📚 Skills to Learn</p>
                  <p className="text-gray-700">{selectedJob.skills_to_learn}</p>
                </div>
              )}

              {selectedJob.job_url && (
                <a 
                  href={selectedJob.job_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-center py-2 text-blue-600 hover:underline text-sm"
                >
                  View Original Posting →
                </a>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => handleStatusChange(selectedJob.id, 'rejected')}
                className="flex-1 py-3 px-4 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium"
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
