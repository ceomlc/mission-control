'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/kpi',         label: 'Leads',   icon: '📱' },
  { href: '/kpi/vending', label: 'Vending', icon: '🏧' },
  { href: '/kpi/jobs',    label: 'Jobs',    icon: '💼' },
];

export default function KpiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="border-b border-[#2A2A3E] bg-[#0D0D14] -mx-4 px-4 mb-6">
        <nav className="flex gap-1 py-2 max-w-7xl">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/kpi'
                ? pathname === '/kpi'
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1A1A2E] text-[#DC143C]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
