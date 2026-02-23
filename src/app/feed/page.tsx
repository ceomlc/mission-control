'use client';

import { useEffect, useState } from 'react';

interface Activity {
  id: string;
  type: 'cron' | 'session' | 'build' | 'message';
  message: string;
  timestamp: number;
  status: string;
}

export default function FeedPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity');
        const data = await res.json();
        setActivities(data);
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

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
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
      case 'cron': return '⏰';
      case 'session': return '💬';
      case 'build': return '🔨';
      case 'message': return '📬';
      default: return '📌';
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case 'success': return 'border-green-500/30';
      case 'error': return 'border-red-500/30';
      default: return 'border-gray-500/30';
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
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className={`bg-[#1A1A2E] rounded-lg p-4 border-l-4 ${getColor(activity.status)}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getIcon(activity.type)}</span>
                <div className="flex-1">
                  <div className="text-sm">{activity.message}</div>
                  <div className="text-xs text-gray-500">{formatTime(activity.timestamp)}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  activity.status === 'success' ? 'bg-green-500/20 text-green-400' :
                  activity.status === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {activity.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
