'use client';

import { useEffect, useState } from 'react';

interface Activity {
  type: 'lead' | 'job' | 'content' | string;
  description: string;
  timestamp: string;
  meta: string;
}

export default function FeedPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity');
        const data = await res.json();
        setActivities(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch activity:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'lead':    return '📱';
      case 'job':     return '💼';
      case 'content': return '🎬';
      default:        return '📡';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'lead':    return 'border-[#DC2626]/40 text-[#DC2626]';
      case 'job':     return 'border-blue-500/40 text-blue-300';
      case 'content': return 'border-purple-500/40 text-purple-300';
      default:        return 'border-gray-500/30 text-gray-400';
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'lead':    return 'border-l-[#DC2626]/60';
      case 'job':     return 'border-l-blue-500/60';
      case 'content': return 'border-l-purple-500/60';
      default:        return 'border-l-gray-500/40';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Activity Feed</h1>
        <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No recent activity</div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity, index) => (
            <div
              key={index}
              className={`bg-[#141414] rounded-lg p-4 border-l-4 ${getBorderColor(activity.type)}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getIcon(activity.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${getColor(activity.type).split(' ')[1]}`}>
                    {activity.description}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatRelativeTime(activity.timestamp)}
                  </div>
                </div>
                {activity.meta && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#0D0D0D] text-gray-500 border border-[#252525] flex-shrink-0">
                    {activity.meta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
