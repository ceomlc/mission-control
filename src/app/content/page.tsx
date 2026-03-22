'use client';

import { useEffect, useState } from 'react';

interface ContentIdea {
  id: number;
  title: string;
  description: string;
  source_url: string;
  type: string;
  status: string;
  created_at: string;
}

export default function ContentPage() {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch('/api/content');
        const data = await res.json();
        setIdeas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch:', error);
        setIdeas([]);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  const filteredIdeas = filter === 'all' 
    ? ideas 
    : ideas.filter(i => i.status === filter);

  const statusColors: Record<string, string> = {
    ready: 'bg-green-900 text-green-300',
    researching: 'bg-blue-900 text-blue-300',
    filming: 'bg-yellow-900 text-yellow-300',
    editing: 'bg-purple-900 text-purple-300',
    posted: 'bg-gray-700 text-gray-300',
  };

  const ready = ideas.filter(i => i.status === 'ready');
  const researching = ideas.filter(i => i.status === 'researching');

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">📝 Content Ideas - "Real or Reel" Series</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{ready.length}</div>
          <div className="text-sm text-gray-400">Ready to Test</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{researching.length}</div>
          <div className="text-sm text-gray-400">Researching</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{ideas.length}</div>
          <div className="text-sm text-gray-400">Total Ideas</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'ready', 'researching'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filter === f 
                ? 'bg-[#22d3ee] text-black' 
                : 'bg-[#1A1A2E] text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filteredIdeas.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No content ideas found.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredIdeas.map((idea) => (
            <div
              key={idea.id}
              className="bg-[#1A1A2E] rounded-xl p-4 flex items-center justify-between hover:bg-[#252542] transition"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{idea.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[idea.status] || 'bg-gray-700 text-gray-300'}`}>
                    {idea.status}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{idea.description}</p>
                {idea.source_url && (
                  <a 
                    href={idea.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                  >
                    📎 {idea.source_url.substring(0, 60)}...
                  </a>
                )}
              </div>
              <div className="text-xs text-gray-500 ml-4">
                {idea.type}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
