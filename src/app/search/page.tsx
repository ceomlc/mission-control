'use client';

import { useState, useCallback } from 'react';
import { AgentBanner } from '@/components/AgentBanner';

interface MemoryResult {
  path: string;
  snippet?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    memory: MemoryResult[];
    sessions: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const debounce = <T extends (...args: Parameters<T>) => void>(
    fn: T,
    delay: number
  ) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  };

  const handleSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, limit: 10 }),
        });
        const data = await res.json();
        setResults({ memory: data, sessions: [] });
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <AgentBanner />

      <h1 className="text-xl font-semibold">Global Search</h1>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder="Search memories, sessions, files..."
          className="w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#22d3ee]"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-[#22d3ee] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {results && (
        <div className="space-y-4">
          {results.memory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No results found
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-medium text-gray-400 mb-2">
                  Memory Results
                </h2>
                <div className="space-y-2">
                  {results.memory.map((r, i) => (
                    <div
                      key={i}
                      className="bg-[#1A1A2E] rounded-xl p-4 hover:bg-[#2A2A3E] transition cursor-pointer"
                    >
                      <div className="text-xs text-[#22d3ee] mb-1">
                        {r.path}
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {r.snippet || 'No preview'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
