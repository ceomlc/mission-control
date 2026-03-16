'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/vending', label: 'Overview', icon: '📋' },
  { href: '/vending/leads', label: 'Leads', icon: '🎯' },
  { href: '/vending/outreach', label: 'Outreach', icon: '📬', badge: true },
  { href: '/vending/placements', label: 'Placements', icon: '🏆' },
];

export default function VendingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Sub-nav */}
      <div className="border-b border-[#2A2A3E] bg-[#0D0D14]">
        <nav className="flex gap-1 px-4 py-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/vending' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-[#1A1A2E] text-[#22d3ee]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    0
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* Page content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
