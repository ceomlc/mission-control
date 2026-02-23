'use client';

import { useEffect, useState } from 'react';

interface ContentItem {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  hook: string;
  type: string;
  project?: string;
}

export default function ContentPage() {
  const [tasks, setTasks] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch('/api/notion/tasks');
        const data = await res.json();
        // Filter for Content Creation project
        const content = (data as ContentItem[])
          .filter((t: ContentItem) => t.project === 'Content Creation' || t.project === 'Content')
          .map((t: ContentItem) => ({ ...t, platform: 'long-form', format: 'scripted' }));
        setTasks(content);
      } catch (e) {
        console.error('Failed to fetch:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  const filtered = filter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filter);

  const published = tasks.filter(t => t.status === 'Done' || t.status === 'Published');
  const inProgress = tasks.filter(t => t.status === 'Doing Now' || t.status === 'In Progress' || t.status === 'in-progress');
  const ideas = tasks.filter(t => t.status === 'To Do' || t.status === 'To Do This Week' || t.status === 'idea');

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Content Pipeline</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{published.length}</div>
          <div className="text-sm text-gray-400">Published</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{inProgress.length}</div>
          <div className="text-sm text-gray-400">In Progress</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{ideas.length}</div>
          <div className="text-sm text-gray-400">Ideas</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'Done', 'Doing Now', 'To Do This Week'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filter === f 
                ? 'bg-[#22d3ee] text-black' 
                : 'bg-[#1A1A2E] text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No content items found. Add tasks in Notion under "Content Creation" project.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="bg-[#1A1A2E] rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  item.status === 'Done' ? 'bg-green-500' :
                  item.status === 'Doing Now' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.project}</div>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                item.status === 'Done' ? 'bg-green-500/20 text-green-400' :
                item.status === 'Doing Now' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
