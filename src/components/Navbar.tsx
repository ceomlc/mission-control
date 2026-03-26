'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Rocket,
  LayoutDashboard,
  Phone,
  TrendingUp,
  Briefcase,
  FileText,
  Tag,
  Users,
  Shield,
  BarChart2,
  Calendar,
  Search,
} from 'lucide-react';

const navItems = [
  { href: '/feed',     label: 'Feed',     Icon: Rocket },
  { href: '/tasks',    label: 'Tasks',    Icon: LayoutDashboard },
  { href: '/leads',    label: 'Leads',    Icon: Phone },
  { href: '/kpi',      label: 'KPIs',     Icon: TrendingUp },
  { href: '/jobs',     label: 'Jobs',     Icon: Briefcase },
  { href: '/content',  label: 'Content',  Icon: FileText },
  { href: '/vending',  label: 'Vending',  Icon: Tag },
  { href: '/agents',   label: 'Council',  Icon: Users },
  { href: '/security', label: 'Security', Icon: Shield },
  { href: '/metrics',  label: 'Metrics',  Icon: BarChart2 },
  { href: '/calendar', label: 'Calendar', Icon: Calendar },
  { href: '/search',   label: 'Search',   Icon: Search },
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
    <nav className="fixed left-0 top-0 h-screen w-[72px] flex flex-col bg-[#0D0D0D] border-r border-[#252525] z-50">
      {/* Logo */}
      <Link
        href="/feed"
        className="h-14 flex items-center justify-center border-b border-[#252525] hover:bg-[#141414] transition"
        title="Mission Control"
      >
        <span className="text-[#DC2626] font-black text-sm tracking-widest">MC</span>
      </Link>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-0.5 py-2 overflow-y-auto">
        {navItems.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <div key={href} className="relative group px-2">
              <Link
                href={href}
                className={`flex items-center justify-center w-full h-11 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[#DC2626]/10 text-[#DC2626] border-l-2 border-[#DC2626] rounded-l-none'
                    : 'text-[#555555] hover:text-white hover:bg-[#141414]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              </Link>
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-[60px] top-1/2 -translate-y-1/2 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-[#1A1A1A] border border-[#252525] text-white text-[11px] font-medium tracking-wider px-2.5 py-1.5 rounded whitespace-nowrap shadow-lg">
                  {label.toUpperCase()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gateway status */}
      <div className="h-14 flex items-center justify-center border-t border-[#252525]">
        <div
          className={`w-2 h-2 rounded-full ${
            gatewayStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
          title={`Gateway: ${gatewayStatus}`}
        />
      </div>
    </nav>
  );
}
