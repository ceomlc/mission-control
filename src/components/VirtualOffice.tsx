'use client';

import { useMemo } from 'react';

interface Agent {
  id: number;
  name: string;
  role: string;
  task: string;
  status: 'active' | 'chatting' | 'idle' | 'coffee';
  activity: string;
}

interface Station {
  x: number;
  y: number;
  label: string;
  type: 'desk' | 'beanbag' | 'coffee' | 'plant';
  rotation?: number;
}

interface VirtualOfficeProps {
  agents?: Agent[];
}

// Isometric tile dimensions
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

// Convert grid coordinates to isometric screen position
const toIsometric = (x: number, y: number) => {
  const isoX = (x - y) * (TILE_WIDTH / 2);
  const isoY = (x + y) * (TILE_HEIGHT / 2);
  return { x: isoX, y: isoY };
};

const VirtualOffice = ({ agents = [] }: VirtualOfficeProps) => {

  // Room grid layout (12x10 tiles)
  // Station positions in grid coordinates
  const stations: Station[] = useMemo(() => [
    // Back wall desks (row 2)
    { x: 3, y: 2, label: 'Desk 1', type: 'desk', rotation: 0 },
    { x: 6, y: 2, label: 'Desk 2', type: 'desk', rotation: 0 },
    { x: 9, y: 2, label: 'Desk 3', type: 'desk', rotation: 0 },
    // Bean bags - lounge area (left side)
    { x: 1, y: 6, label: 'Bean Bag 1', type: 'beanbag', rotation: -15 },
    { x: 3, y: 7, label: 'Bean Bag 2', type: 'beanbag', rotation: 10 },
    // Coffee station (right corner)
    { x: 10, y: 7, label: 'Coffee Station', type: 'coffee', rotation: 0 },
  ], []);

  // Decorative plants
  const plantPositions = useMemo(() => [
    { x: 0.5, y: 4 },
    { x: 11, y: 3 },
    { x: 2, y: 9 },
    { x: 10, y: 9 },
  ], []);

  // Assign agents to stations based on status
  const getStationForAgent = (agent: Agent, index: number): Station => {
    const activeDesks = stations.filter(s => s.type === 'desk');
    const beanBags = stations.filter(s => s.type === 'beanbag');
    const coffeeStation = stations.find(s => s.type === 'coffee');

    switch (agent.status) {
      case 'active':
        return activeDesks[index % activeDesks.length];
      case 'chatting':
        return beanBags[index % beanBags.length];
      case 'idle':
        return beanBags[index % beanBags.length];
      case 'coffee':
        return coffeeStation || stations[5];
      default:
        return activeDesks[index % activeDesks.length];
    }
  };

  const assignedStations = useMemo(() => {
    const assignments: Record<number, Station> = {};
    agents.forEach((agent, idx) => {
      const sameStatusAgents = agents
        .filter((a, i) => a.status === agent.status && i < idx)
        .length;
      assignments[agent.id] = getStationForAgent(agent, sameStatusAgents);
    });
    return assignments;
  }, [agents, stations]);

  // Status colors with glow
  const statusColors: Record<string, { bg: string; glow: string; text: string }> = {
    active: { bg: '#10B981', glow: '#10B981', text: '#fff' },
    chatting: { bg: '#8B5CF6', glow: '#8B5CF6', text: '#fff' },
    idle: { bg: '#6B7280', glow: '#6B7280', text: '#fff' },
    coffee: { bg: '#F59E0B', glow: '#F59E0B', text: '#1F2937' },
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Working';
      case 'chatting': return 'Chatting';
      case 'idle': return 'Idle';
      case 'coffee': return 'On Break';
      default: return status;
    }
  };

  return (
    <div className="w-full h-[500px] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient background glow */}
      <div className="absolute inset-0">
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            top: '20%',
            left: '30%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
            top: '60%',
            right: '20%',
          }}
        />
      </div>

      {/* Main isometric room container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div 
          className="relative w-full h-full max-w-[900px] max-h-[600px]"
          style={{
            transform: 'scale(0.95)',
          }}
        >
          {/* === FLOOR === */}
          <svg 
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 900 600"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Wood floor pattern */}
              <pattern id="woodFloor" width="64" height="32" patternUnits="userSpaceOnUse">
                <rect width="64" height="32" fill="#8B6914" />
                <path d="M0 16 L64 16" stroke="#7A5C12" strokeWidth="1" opacity="0.5" />
                <path d="M32 0 L32 16" stroke="#7A5C12" strokeWidth="0.5" opacity="0.3" />
                <path d="M0 0 L64 0" stroke="#9A7822" strokeWidth="0.5" opacity="0.3" />
              </pattern>
              
              {/* Floor gradient */}
              <linearGradient id="floorShadow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A07D1A" />
                <stop offset="50%" stopColor="#8B6914" />
                <stop offset="100%" stopColor="#6B4D0A" />
              </linearGradient>

              {/* Wall gradients */}
              <linearGradient id="leftWall" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5E6D3" />
                <stop offset="100%" stopColor="#E8D5C4" />
              </linearGradient>
              
              <linearGradient id="backWall" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EDE0D0" />
                <stop offset="100%" stopColor="#DDD0BE" />
              </linearGradient>

              {/* Light glow filter */}
              <filter id="lightGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Shadow filter */}
              <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Floor tiles - isometric grid */}
            <g transform="translate(450, 380)">
              {/* Floor base */}
              <path 
                d="M-450 0 L0 -160 L450 0 L0 160 Z"
                fill="url(#floorShadow)"
              />
              
              {/* Floor planks overlay */}
              {Array.from({ length: 14 }).map((_, row) => (
                <path
                  key={`floor-row-${row}`}
                  d={`M-${450 + row * 65} ${-160 + row * 23} L${450 - row * 65} ${-160 + row * 23} L${450 - row * 65 - 65} ${-160 + row * 23 + 23} L-${450 + row * 65 + 65} ${-160 + row * 23 + 23} Z`}
                  fill="none"
                  stroke="#5A4010"
                  strokeWidth="0.5"
                  opacity="0.4"
                />
              ))}
            </g>

            {/* Left Wall */}
            <g>
              <path
                d="M-10 380 L-10 150 L430 30 L430 180 Z"
                fill="url(#leftWall)"
              />
              {/* Wall texture lines */}
              <path d="M-10 150 L430 30" stroke="#D4C4B0" strokeWidth="1" opacity="0.5" />
              <path d="M-10 200 L430 100" stroke="#D4C4B0" strokeWidth="0.5" opacity="0.3" />
              <path d="M-10 260 L430 170" stroke="#D4C4B0" strokeWidth="0.5" opacity="0.3" />
              {/* Left wall baseboard */}
              <path
                d="M-5 375 L-5 360 L425 165 L425 180 Z"
                fill="#A68B5B"
              />
            </g>

            {/* Back Wall */}
            <g>
              <path
                d="M430 180 L440 50 L880 50 L870 180 Z"
                fill="url(#backWall)"
              />
              {/* Wall texture */}
              <path d="M440 50 L880 50" stroke="#CCC4B4" strokeWidth="1" opacity="0.5" />
              <path d="M445 90 L875 90" stroke="#CCC4B4" strokeWidth="0.5" opacity="0.3" />
              <path d="M450 130 L870 130" stroke="#CCC4B4" strokeWidth="0.5" opacity="0.3" />
              {/* Back wall baseboard */}
              <path
                d="M425 180 L870 180 L860 195 L435 195 Z"
                fill="#A68B5B"
              />
            </g>

            {/* === STRING LIGHTS === */}
            <g filter="url(#lightGlow)">
              {/* Wire across back wall */}
              <path
                d="M450 80 Q665 60 880 80"
                stroke="#1a1a1a"
                strokeWidth="1.5"
                fill="none"
              />
              {/* Wire down left wall */}
              <path
                d="M50 80 Q30 150 50 220"
                stroke="#1a1a1a"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Light bulbs - back wall */}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const x = 470 + i * 60;
                const y = 70 + Math.sin(i * 0.8) * 8;
                return (
                  <g key={`bulb-back-${i}`}>
                    <ellipse cx={x} cy={y + 8} rx="8" ry="10" fill="#FFF5E0" />
                    <ellipse cx={x} cy={y + 8} rx="14" ry="16" fill="#FFE4A0" opacity="0.3" />
                    <rect x={x - 3} y={y - 5} width="6" height="5" fill="#2d2d2d" rx="1" />
                  </g>
                );
              })}

              {/* Light bulbs - left wall */}
              {[0, 1, 2, 3].map((i) => {
                const x = 50 - i * 5;
                const y = 90 + i * 40;
                return (
                  <g key={`bulb-left-${i}`}>
                    <ellipse cx={x} cy={y + 8} rx="8" ry="10" fill="#FFF5E0" />
                    <ellipse cx={x} cy={y + 8} rx="14" ry="16" fill="#FFE4A0" opacity="0.3" />
                    <rect x={x - 3} y={y - 5} width="6" height="5" fill="#2d2d2d" rx="1" />
                  </g>
                );
              })}
            </g>

            {/* === DECORATIONS === */}
            {/* Wall Clock */}
            <g transform="translate(650, 100)">
              <circle cx="0" cy="0" r="22" fill="#FFFEF8" stroke="#8B7355" strokeWidth="4" filter="url(#dropShadow)" />
              <circle cx="0" cy="0" r="18" fill="none" stroke="#DDD" strokeWidth="1" />
              {/* Clock hands */}
              <line x1="0" y1="0" x2="8" y2="-5" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="-6" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="0" cy="0" r="2" fill="#374151" />
            </g>

            {/* Art Poster 1 - Colorful abstract */}
            <g transform="translate(500, 85)" filter="url(#dropShadow)">
              <rect x="0" y="0" width="50" height="40" fill="#1F2937" rx="2" />
              <rect x="4" y="4" width="20" height="15" fill="#F59E0B" rx="1" />
              <rect x="26" y="4" width="20" height="15" fill="#10B981" rx="1" />
              <rect x="4" y="21" width="42" height="15" fill="#8B5CF6" rx="1" />
              <rect x="0" y="0" width="50" height="40" fill="none" stroke="#4B5563" strokeWidth="2" rx="2" />
            </g>

            {/* Art Poster 2 - Landscape */}
            <g transform="translate(780, 85)" filter="url(#dropShadow)">
              <rect x="0" y="0" width="40" height="50" fill="#1F2937" rx="2" />
              {/* Mountains */}
              <path d="M0 50 L15 25 L30 40 L40 20 L40 50 Z" fill="#6B7280" />
              <path d="M0 50 L10 35 L25 45 L40 30 L40 50 Z" fill="#9CA3AF" />
              {/* Sun */}
              <circle cx="28" cy="15" r="5" fill="#FBBF24" />
              {/* Frame */}
              <rect x="0" y="0" width="40" height="50" fill="none" stroke="#4B5563" strokeWidth="2" rx="2" />
            </g>

            {/* === FURNITURE === */}
            {/* Plants */}
            {plantPositions.map((pos, idx) => {
              const iso = toIsometric(pos.x, pos.y);
              const screenX = 450 + iso.x;
              const screenY = 380 + iso.y;
              return (
                <g key={`plant-${idx}`} transform={`translate(${screenX}, ${screenY})`}>
                  <image
                    href="/isometric_plant_sprite.png"
                    width="60"
                    height="80"
                    x="-30"
                    y="-70"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#dropShadow)"
                  />
                </g>
              );
            })}

            {/* Desks */}
            {stations.filter(s => s.type === 'desk').map((station, idx) => {
              const iso = toIsometric(station.x, station.y);
              const screenX = 450 + iso.x;
              const screenY = 380 + iso.y;
              return (
                <g key={`desk-${idx}`} transform={`translate(${screenX}, ${screenY})`}>
                  <image
                    href="/isometric_desk_sprite.png"
                    width="120"
                    height="90"
                    x="-60"
                    y="-60"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#dropShadow)"
                  />
                </g>
              );
            })}

            {/* Bean Bags */}
            {stations.filter(s => s.type === 'beanbag').map((station, idx) => {
              const iso = toIsometric(station.x, station.y);
              const screenX = 450 + iso.x;
              const screenY = 380 + iso.y;
              const src = idx === 0 ? '/isometric_beanbag_blue.png' : '/isometric_beanbag_purple.png';
              return (
                <g 
                  key={`beanbag-${idx}`} 
                  transform={`translate(${screenX}, ${screenY})`}
                >
                  <image
                    href={src}
                    width="80"
                    height="70"
                    x="-40"
                    y="-55"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#dropShadow)"
                  />
                </g>
              );
            })}

            {/* Coffee Station */}
            {stations.filter(s => s.type === 'coffee').map((station) => {
              const iso = toIsometric(station.x, station.y);
              const screenX = 450 + iso.x;
              const screenY = 380 + iso.y;
              return (
                <g key="coffee" transform={`translate(${screenX}, ${screenY})`}>
                  <image
                    href="/isometric_coffee_machine.png"
                    width="90"
                    height="80"
                    x="-45"
                    y="-65"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#dropShadow)"
                  />
                </g>
              );
            })}
          </svg>

          {/* === AGENTS LAYER === */}
          <div className="absolute inset-0 pointer-events-none">
            {agents.map((agent) => {
              const station = assignedStations[agent.id];
              if (!station) return null;
              
              const iso = toIsometric(station.x, station.y);
              const screenX = 450 + iso.x;
              const screenY = 380 + iso.y - 30; // Offset to stand above furniture
              const colors = statusColors[agent.status] || statusColors.idle;
              const isActive = agent.status === 'active';

              return (
                <div
                  key={agent.id}
                  className="absolute flex flex-col items-center transition-all duration-500 ease-out"
                  style={{
                    left: screenX,
                    top: screenY,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  {/* Activity bubble */}
                  {agent.activity && (
                    <div 
                      className="mb-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shadow-lg animate-fade-in"
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        color: '#1F2937',
                        border: '1px solid rgba(255,255,255,0.5)',
                      }}
                    >
                      {agent.activity}
                    </div>
                  )}
                  
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white"
                    style={{ 
                      backgroundColor: colors.bg,
                      boxShadow: isActive 
                        ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}60` 
                        : '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                  >
                    {agent.name?.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Name tag */}
                  <div 
                    className="mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-md"
                    style={{ 
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {agent.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === STATUS LEGEND === */}
      <div 
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-3 rounded-2xl"
        style={{ 
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {Object.entries(statusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${status === 'active' ? 'animate-pulse' : ''}`}
              style={{ 
                backgroundColor: colors.bg,
                boxShadow: `0 0 8px ${colors.glow}`,
              }} 
            />
            <span className="text-white text-sm font-medium">
              {agents.filter((a) => a.status === status).length} {getStatusLabel(status)}
            </span>
          </div>
        ))}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default VirtualOffice;
