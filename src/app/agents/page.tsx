'use client';

import { useState, useEffect } from 'react';
import VirtualOffice from '@/components/VirtualOffice';

interface Agent {
  id: number;
  name: string;
  role: string;
  task: string;
  status: 'active' | 'chatting' | 'idle';
  activity: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([
    { id: 1, name: 'Athena', role: 'Manager', task: 'Overseeing ops', status: 'active', activity: 'Managing' },
    { id: 2, name: 'Builder', role: 'Developer', task: 'Building websites', status: 'active', activity: 'Coding' },
    { id: 3, name: 'Writer', role: 'Content', task: 'Drafting copy', status: 'active', activity: 'Writing' },
    { id: 4, name: 'Researcher', role: 'Analyst', task: 'Gathering data', status: 'active', activity: 'Researching' },
    { id: 5, name: 'Strategist', role: 'Planner', task: 'Planning campaigns', status: 'chatting', activity: 'Planning' },
    { id: 6, name: 'Security', role: 'Guard', task: 'On break', status: 'idle', activity: 'On break' },
  ]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22D3EE';
      case 'chatting': return '#A855F7';
      default: return '#9CA3AF';
    }
  };

  const activeCount = agents.filter(a => a.status === 'active').length;
  const chatCount = agents.filter(a => a.status === 'chatting').length;
  const idleCount = agents.filter(a => a.status === 'idle').length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Virtual Office</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Virtual Office Component */}
      <div className="h-[500px] w-full">
        <VirtualOffice agents={agents} />
      </div>

      {/* Selected Agent Panel */}
      {selectedAgent && (
        <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2A2A3E] rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: getStatusColor(selectedAgent.status) }}
            >
              {selectedAgent.name[0]}
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{selectedAgent.name}</h3>
              <p className="text-sm text-gray-400">{selectedAgent.role}</p>
            </div>
            <button onClick={() => setSelectedAgent(null)} className="text-gray-500 hover:text-white">
              ✕
            </button>
          </div>
          <div className="mt-3 p-3 bg-[#0A0A0F] rounded-lg">
            <div className="text-xs text-gray-500">Current Task</div>
            <div>{selectedAgent.task}</div>
          </div>
        </div>
      )}

      {/* Agent List */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {agents.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={`p-2 rounded-lg text-left transition ${
              selectedAgent?.id === agent.id 
                ? 'bg-[#22D3EE]/20 ring-1 ring-[#22D3EE]' 
                : 'bg-[#1A1A2E] hover:bg-[#2A2A3E]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: getStatusColor(agent.status) }} 
              />
              <span className="text-sm font-medium truncate">{agent.name}</span>
            </div>
            <div className="text-xs text-gray-500 truncate">{agent.role}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
