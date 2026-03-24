'use client';

import { useState, useEffect } from 'react';

interface CronJob {
  id: string;
  name: string;
  time: string;
  days: string[];
  status: string;
  color: string;
}

const JOB_COLORS: Record<string, string> = {
  'Scout': '#22d3ee',
  'Enrich': '#a855f7', 
  'Qualifier': '#f97316',
  'Hermes': '#10b981',
  'Check': '#eab308',
  'Content': '#8b5cf6',
};

export default function CalendarPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const today = new Date();
  const currentHour = today.getHours();
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    fetch('/api/calendar')
      .then(res => res.json())
      .then(data => {
        const mapped = (data.jobs || []).map((j: any) => ({
          id: j.id,
          name: j.name,
          time: j.time || 'N/A',
          days: j.days || [],
          status: j.status || 'scheduled',
          color: JOB_COLORS[j.name?.split(' ')[0]] || '#6b7280',
        }));
        setJobs(mapped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getJobsForDay = (day: number | null) => {
    if (day === null) return [];
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayName = daysOfWeek[date.getDay()];
    return jobs.filter(job => job.days.includes(dayName));
  };

  const isToday = (day: number | null) => {
    if (day === null) return false;
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="px-3 py-1 bg-[#1A1A2E] rounded hover:bg-[#2A2A3E]"
          >
            ←
          </button>
          <span className="text-lg font-medium min-w-[160px] text-center">{monthName}</span>
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="px-3 py-1 bg-[#1A1A2E] rounded hover:bg-[#2A2A3E]"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#1A1A2E] rounded-xl overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-[#0A0A0F]">
          {daysOfWeek.map(day => (
            <div key={day} className="p-2 text-center text-sm text-gray-400 font-medium">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const jobs = getJobsForDay(day);
            const isTodayCell = isToday(day);
            
            return (
              <div 
                key={index} 
                className={`min-h-[80px] p-2 border-t border-r border-[#2A2A3E] ${
                  isTodayCell ? 'bg-[#22d3ee]/10' : ''
                }`}
              >
                {day && (
                  <>
                    <div className={`text-sm mb-1 ${isTodayCell ? 'text-[#22d3ee] font-bold' : 'text-gray-400'}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {jobs.slice(0, 3).map(job => (
                        <div 
                          key={job.id}
                          className="text-xs px-1 py-0.5 rounded truncate"
                          style={{ backgroundColor: `${job.color}20`, color: job.color }}
                          title={job.name}
                        >
                          {job.time} {job.name}
                        </div>
                      ))}
                      {jobs.length > 3 && (
                        <div className="text-xs text-gray-500">+{jobs.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Timeline */}
      <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2A2A3E] rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">Today's Schedule</h2>
        
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#2A2A3E]" />
          
          <div className="space-y-4">
            {jobs.map(job => {
              const [hour, minute] = job.time.split(':').map(Number);
              const isPast = hour < currentHour;
              const isCurrent = hour === currentHour;
              
              return (
                <div key={job.id} className="flex items-center gap-4 relative">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10"
                    style={{ backgroundColor: isPast ? '#1A1A2E' : job.color, color: isPast ? '#666' : '#000' }}
                  >
                    {hour}
                  </div>
                  <div className={`flex-1 p-3 rounded-lg ${isCurrent ? 'bg-[#22d3ee]/20 border border-[#22d3ee]' : 'bg-[#0A0A0F]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{job.name}</span>
                      <span className="text-sm text-gray-400">{job.time}</span>
                    </div>
                    <div className="text-xs text-gray-500">{job.days.join(', ')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* All Jobs List */}
      <div className="bg-[#1A1A2E] rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">All Scheduled Jobs</h2>
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: job.color }} />
                <span className="font-medium">{job.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="font-mono">{job.time}</span>
                <span>{job.days.join(', ')}</span>
                <span className="text-green-400">{job.lastStatus}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
