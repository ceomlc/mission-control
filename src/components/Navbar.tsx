'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/feed', label: 'Feed', icon: '📡' },
  { href: '/tasks', label: 'Tasks', icon: '✅' },
  { href: '/leads', label: 'Leads', icon: '📱' },
  { href: '/kpi', label: 'KPIs', icon: '📊' },
  { href: '/jobs', label: 'Jobs', icon: '💼' },
  { href: '/content', label: 'Content', icon: '📝' },
  { href: '/vending', label: 'Vending', icon: '🏧' },
  { href: '/agents', label: 'Council', icon: '🤖' },
  { href: '/security', label: 'Security', icon: '🔒' },
  { href: '/metrics', label: 'Metrics', icon: '📊' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/search', label: 'Search', icon: '🔍' },
];

export function Navbar() {
  const pathname = usePathname();
  const [gatewayStatus, setGatewayStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setGatewayStatus(res.ok ? 'online' : 'offline');
      } catch {
        setGatewayStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#2A2A3E] bg-[#0A0A0F]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/feed" className="flex items-center gap-2 text-xl font-bold hover:opacity-80 transition">
            <span className="text-2xl">🦀</span>
            <span className="hidden sm:inline">Mission Control</span>
          </Link>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2 py-1.5 rounded-lg text-xs sm:text-sm transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1A1A2E] text-[#DC143C]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              gatewayStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
            title={`Gateway: ${gatewayStatus}`}
          />
        </div>
      </div>
    </nav>
  );
}
