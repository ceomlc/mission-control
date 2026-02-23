'use client';

import { useState } from 'react';

interface Audit {
  id: string;
  type: 'daily' | 'weekly' | 'quarterly';
  name: string;
  lastRun: string;
  status: 'passed' | 'warning' | 'failed';
  details: string;
}

const audits: Audit[] = [
  { id: '1', type: 'daily', name: 'Gateway Security Check', lastRun: '2026-02-22 08:00', status: 'passed', details: 'All ports secure, no unauthorized access' },
  { id: '2', type: 'daily', name: 'API Key Rotation', lastRun: '2026-02-22 08:00', status: 'passed', details: 'All keys valid and rotated within 90 days' },
  { id: '3', type: 'daily', name: 'Session Timeout Check', lastRun: '2026-02-22 08:00', status: 'passed', details: 'All sessions properly timeout' },
  { id: '4', type: 'weekly', name: 'Firewall Rules Review', lastRun: '2026-02-20 09:00', status: 'passed', details: 'All firewall rules up to date' },
  { id: '5', type: 'weekly', name: 'Access Control Audit', lastRun: '2026-02-20 09:00', status: 'warning', details: '2 inactive accounts found' },
  { id: '6', type: 'weekly', name: 'Backup Verification', lastRun: '2026-02-20 09:00', status: 'passed', details: 'All backups completed successfully' },
  { id: '7', type: 'quarterly', name: 'Penetration Testing', lastRun: '2026-01-15 10:00', status: 'passed', details: 'No critical vulnerabilities found' },
  { id: '8', type: 'quarterly', name: 'Compliance Review', lastRun: '2026-01-15 10:00', status: 'passed', details: 'All compliance requirements met' },
];

export default function SecurityPage() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'daily' | 'weekly' | 'quarterly'>('all');

  const filtered = typeFilter === 'all' 
    ? audits 
    : audits.filter(a => a.type === typeFilter);

  const passed = audits.filter(a => a.status === 'passed').length;
  const warnings = audits.filter(a => a.status === 'warning').length;
  const failed = audits.filter(a => a.status === 'failed').length;

  const nextDaily = 'Tomorrow 08:00';
  const nextWeekly = 'Sunday 09:00';
  const nextQuarterly = 'April 15, 2026';

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">🔒 Security Audit</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{passed}</div>
          <div className="text-xs text-gray-400">Passed</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{warnings}</div>
          <div className="text-xs text-gray-400">Warnings</div>
        </div>
        <div className="bg-[#1A1A2E] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{failed}</div>
          <div className="text-xs text-gray-400">Failed</div>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-[#1A1A2E] rounded-xl p-4">
        <h2 className="font-medium mb-3">📅 Audit Schedule</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Daily</span>
            <div className="text-[#22d3ee]">{nextDaily}</div>
          </div>
          <div>
            <span className="text-gray-400">Weekly</span>
            <div className="text-[#22d3ee]">{nextWeekly}</div>
          </div>
          <div>
            <span className="text-gray-400">Quarterly</span>
            <div className="text-[#22d3ee]">{nextQuarterly}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'daily', 'weekly', 'quarterly'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              typeFilter === t 
                ? 'bg-[#22d3ee] text-black' 
                : 'bg-[#1A1A2E] text-gray-400 hover:text-white'
            }`}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {/* Audit List */}
      <div className="space-y-2">
        {filtered.map((audit) => (
          <div key={audit.id} className="bg-[#1A1A2E] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  audit.status === 'passed' ? 'bg-green-500' :
                  audit.status === 'warning' ? 'bg-orange-500' :
                  'bg-red-500'
                }`} />
                <span className="font-medium">{audit.name}</span>
              </div>
              <span className="text-xs px-2 py-0.5 bg-[#2A2A3E] rounded">
                {audit.type}
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-1">{audit.details}</div>
            <div className="text-xs text-gray-500">Last run: {audit.lastRun}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
