'use client';

import { useEffect, useState } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  dueDate: string | null;
  project: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/notion/tasks');
        const data = await res.json();
        if (Array.isArray(data)) {
          setTasks(data);
        }
      } catch (e) {
        console.error('Failed to fetch tasks:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status.toLowerCase() === filter.toLowerCase());

  const activeTasks = tasks.filter((t) => t.status.toLowerCase() === 'in progress');
  const completedTasks = tasks.filter((t) => t.status.toLowerCase() === 'done');
  const blockedTasks = tasks.filter((t) => t.status.toLowerCase() === 'blocked');
  const criticalTasks = tasks.filter((t) => t.priority === 'High' && t.status.toLowerCase() !== 'done');

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Tasks (from Notion)</h1>

      <div className="bg-gradient-to-r from-[#141414] to-[#1A1A1A] rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">Daily Report</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#DC2626]">{activeTasks.length}</div>
            <div className="text-sm text-gray-400">Active</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{completedTasks.length}</div>
            <div className="text-sm text-gray-400">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{blockedTasks.length}</div>
            <div className="text-sm text-gray-400">Blocked</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400">{criticalTasks.length}</div>
            <div className="text-sm text-gray-400">Critical</div>
          </div>
        </div>
      </div>

      {criticalTasks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <h3 className="font-medium text-red-400 mb-2">Critical Items</h3>
          <ul className="space-y-1">
            {criticalTasks.map((task) => (
              <li key={task.id} className="text-sm text-gray-300">• {task.title}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'In progress', 'Done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filter === f
                ? 'bg-[#DC2626] text-white'
                : 'bg-[#141414] text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-[#141414] rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  task.status.toLowerCase() === 'done' ? 'bg-green-500' :
                  task.status.toLowerCase() === 'in progress' ? 'bg-[#DC2626]' :
                  'bg-gray-500'
                }`} />
                <div>
                  <div className={task.status.toLowerCase() === 'done' ? 'text-gray-500 line-through' : ''}>
                    {task.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {task.project} • {task.assignee}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {task.priority === 'High' && (
                  <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">High</span>
                )}
                <span className="text-xs text-gray-500">{task.dueDate || 'No due'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
