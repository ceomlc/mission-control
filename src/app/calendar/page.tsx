'use client';

import { useState, useEffect } from 'react';

interface CronJob {
  id: number;
  name: string;
  schedule: string;
  source: string;
  description: string;
  color: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SOURCE_LABELS: Record<string, string> = { vercel: 'Vercel', athena: 'Athena', thoth: 'Thoth' };
const SOURCE_COLORS: Record<string, string> = { vercel: 'text-[#DC2626]', athena: 'text-purple-400', thoth: 'text-orange-400' };

function parseCron(expr: string): { displayTime: string; displayDays: string; runDays: number[]; hours: number[] } {
  const parts = expr.split(' ');
  const [min, hour, , , dow = '*'] = parts.length >= 5 ? parts : [...parts, '*', '*', '*', '*', '*'];
  let runDays: number[] = [0,1,2,3,4,5,6];
  let displayDays = 'Every day';
  if (dow !== '*') {
    if (dow === '1-5') { runDays = [1,2,3,4,5]; displayDays = 'Mon–Fri'; }
    else if (dow === '0,6' || dow === '6,0') { runDays = [0,6]; displayDays = 'Weekends'; }
    else { runDays = dow.split(',').map(Number); displayDays = runDays.map(d => DOW[d]).join(', '); }
  }
  let hours: number[] = [];
  let displayTime = '';
  if (min.startsWith('*/')) {
    displayTime = `Every ${min.slice(2)}m`;
    hours = Array.from({length:24},(_,i)=>i);
  } else if (hour.startsWith('*/')) {
    const interval = parseInt(hour.slice(2));
    hours = Array.from({length:Math.floor(24/interval)},(_,i)=>i*interval);
    displayTime = `Every ${interval}h`;
  } else if (hour !== '*') {
    hours = [parseInt(hour)];
    const h = parseInt(hour);
    displayTime = `${h===0?12:h>12?h-12:h}:${min.padStart(2,'0')} ${h>=12?'PM':'AM'}`;
  } else {
    displayTime = 'Continuous';
    hours = Array.from({length:24},(_,i)=>i);
  }
  return { displayTime, displayDays, runDays, hours };
}

function getNextRun(schedule: string): string {
  const now = new Date();
  const { hours, runDays } = parseCron(schedule);
  if (!hours.length) return 'Unknown';
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const dow = d.getDay();
    if (!runDays.includes(dow)) continue;
    for (const h of hours) {
      const candidate = new Date(d);
      candidate.setHours(h, 0, 0, 0);
      if (candidate > now) candidates.push(candidate);
    }
  }
  if (!candidates.length) return 'Unknown';
  const next = candidates[0];
  const isToday = next.toDateString() === now.toDateString();
  const isTomorrow = next.toDateString() === new Date(now.getTime()+86400000).toDateString();
  const timeStr = next.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${DOW[next.getDay()]} ${timeStr}`;
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function CalendarPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const today = new Date();

  useEffect(() => {
    fetch('/api/cron-jobs').then(r=>r.json()).then(d=>{setJobs(d.jobs||[]);setLoading(false);}).catch(()=>setLoading(false));
  }, []);

  const getDaysInMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const lastDay = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
    const days: (number|null)[] = Array(firstDay).fill(null);
    for (let i=1;i<=lastDay;i++) days.push(i);
    return days;
  };

  const getJobsForDay = (day: number|null) => {
    if (!day) return [];
    const dow = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay();
    return jobs.filter(job => parseCron(job.schedule).runDays.includes(dow));
  };

  const isToday = (day: number|null) =>
    day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default',{month:'long',year:'numeric'});

  const todayDow = today.getDay();
  const todayJobs = jobs
    .filter(j => parseCron(j.schedule).runDays.includes(todayDow))
    .sort((a,b) => (parseCron(a.schedule).hours[0]??99) - (parseCron(b.schedule).hours[0]??99));

  const grouped = {
    vercel: jobs.filter(j=>j.source==='vercel'),
    athena: jobs.filter(j=>j.source==='athena'),
    thoth: jobs.filter(j=>j.source==='thoth'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Schedule</h1>
          <p className="text-gray-500 text-xs mt-0.5">{jobs.length} active cron jobs across Vercel, Athena &amp; Thoth</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()-1))} className="px-3 py-1.5 bg-[#141414] rounded-lg hover:bg-[#252525] text-sm">←</button>
          <span className="text-sm font-medium min-w-[150px] text-center">{monthName}</span>
          <button onClick={()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()+1))} className="px-3 py-1.5 bg-[#141414] rounded-lg hover:bg-[#252525] text-sm">→</button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-[#141414] animate-pulse" />
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-[#141414] rounded-xl border border-[#252525] overflow-hidden">
            <div className="grid grid-cols-7 bg-[#0D0D0D] border-b border-[#252525]">
              {DOW.map(d=><div key={d} className="py-2 text-center text-xs text-gray-500 font-medium">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day,i)=>{
                const dayJobs = getJobsForDay(day);
                const todayCell = isToday(day);
                return (
                  <div key={i} className={`min-h-[72px] p-1.5 border-t border-r border-[#252525] ${todayCell?'bg-[#DC2626]/5':''}`}>
                    {day && (<>
                      <div className={`text-xs mb-1 w-5 h-5 flex items-center justify-center rounded-full ${todayCell?'bg-[#DC2626] text-white font-bold':'text-gray-500'}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayJobs.slice(0,3).map(job=>(
                          <div key={job.id} onClick={()=>setSelectedJob(job)}
                            className="text-[9px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                            style={{backgroundColor:`${job.color}20`,color:job.color}} title={job.name}>
                            {job.name}
                          </div>
                        ))}
                        {dayJobs.length>3 && <div className="text-[9px] text-gray-600">+{dayJobs.length-3}</div>}
                      </div>
                    </>)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected job detail */}
          {selectedJob && (
            <div className="bg-[#141414] rounded-xl border p-4" style={{borderColor:selectedJob.color+'40'}}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:selectedJob.color}} />
                  <div>
                    <div className="text-white font-semibold">{selectedJob.name}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{selectedJob.description}</div>
                  </div>
                </div>
                <button onClick={()=>setSelectedJob(null)} className="text-gray-600 hover:text-white text-sm">✕</button>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-4 text-xs">
                <div><div className="text-gray-500">Schedule</div><div className="text-white font-mono mt-0.5">{selectedJob.schedule}</div></div>
                <div><div className="text-gray-500">Runs</div><div className="text-white mt-0.5">{parseCron(selectedJob.schedule).displayTime} · {parseCron(selectedJob.schedule).displayDays}</div></div>
                <div><div className="text-gray-500">Next Run</div><div className="text-green-400 mt-0.5">{getNextRun(selectedJob.schedule)}</div></div>
                <div><div className="text-gray-500">Last Run</div><div className="text-gray-300 mt-0.5">{timeAgo(selectedJob.last_run_at)} <span className={selectedJob.last_status==='ok'?'text-green-400':'text-red-400'}>({selectedJob.last_status})</span></div></div>
              </div>
            </div>
          )}

          {/* Today's Timeline */}
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Today — {today.toLocaleDateString('default',{weekday:'long',month:'long',day:'numeric'})}</h2>
            {todayJobs.length===0 ? (
              <div className="text-gray-500 text-sm text-center py-4">No jobs scheduled today</div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-[#252525]" />
                <div className="space-y-3">
                  {todayJobs.map(job=>{
                    const {displayTime,hours} = parseCron(job.schedule);
                    const firstHour = hours[0]??0;
                    const isPast = firstHour < today.getHours();
                    const isCurrent = firstHour === today.getHours();
                    return (
                      <div key={job.id} className="flex items-center gap-4 relative">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold z-10 flex-shrink-0"
                          style={{backgroundColor:isPast?'#0D0D0D':`${job.color}20`,color:isPast?'#444':job.color,border:`1px solid ${isPast?'#252525':job.color}`}}>
                          {hours.length>1?'∞':firstHour}
                        </div>
                        <div className={`flex-1 px-3 py-2 rounded-lg text-sm cursor-pointer ${isCurrent?'border':'bg-[#0D0D0D]'}`}
                          style={isCurrent?{borderColor:job.color,backgroundColor:`${job.color}10`}:{}}
                          onClick={()=>setSelectedJob(job)}>
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${isPast?'text-gray-500':'text-white'}`}>{job.name}</span>
                            <span className="text-gray-500 text-xs">{displayTime}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] ${SOURCE_COLORS[job.source]||'text-gray-400'}`}>{SOURCE_LABELS[job.source]||job.source}</span>
                            <span className="text-gray-600 text-[10px]">· Last: {timeAgo(job.last_run_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* All Jobs by source */}
          <div className="bg-[#141414] rounded-xl border border-[#252525] p-5">
            <h2 className="text-sm font-semibold text-white mb-4">All Scheduled Jobs</h2>
            <div className="space-y-6">
              {(Object.entries(grouped) as [string, CronJob[]][]).filter(([,g])=>g.length>0).map(([source,sourceJobs])=>(
                <div key={source}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${SOURCE_COLORS[source]||'text-gray-400'}`}>{SOURCE_LABELS[source]||source}</div>
                  <div className="space-y-2">
                    {sourceJobs.map(job=>{
                      const {displayTime,displayDays} = parseCron(job.schedule);
                      return (
                        <div key={job.id} onClick={()=>setSelectedJob(job)}
                          className="flex items-center justify-between px-3 py-2.5 bg-[#0D0D0D] rounded-lg cursor-pointer hover:bg-[#252525]/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:job.color}} />
                            <div>
                              <div className="text-white text-sm font-medium">{job.name}</div>
                              <div className="text-gray-600 text-xs mt-0.5">{job.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs flex-shrink-0">
                            <div className="text-right">
                              <div className="text-gray-300">{displayTime}</div>
                              <div className="text-gray-600">{displayDays}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-green-400">Next: {getNextRun(job.schedule)}</div>
                              <div className="text-gray-600">Last: {timeAgo(job.last_run_at)}</div>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${job.last_status==='ok'?'bg-green-900/40 text-green-400':job.last_status==='error'?'bg-red-900/40 text-red-400':'bg-gray-800 text-gray-400'}`}>
                              {job.last_status}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
