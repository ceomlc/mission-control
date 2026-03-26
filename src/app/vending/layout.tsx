'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/vending', label: 'Overview', icon: '📋' },
  { href: '/vending/leads', label: 'Leads', icon: '🎯' },
  { href: '/vending/outreach', label: 'Outreach', icon: '📬', badge: 'email' },
  { href: '/vending/phone', label: 'Phone', icon: '📞', badge: 'phone' },
  { href: '/vending/placements', label: 'Placements', icon: '🏆' },
];

export default function VendingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [emailCount, setEmailCount] = useState(0);
  const [phoneCount, setPhoneCount] = useState(0);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [emailRes, phoneRes] = await Promise.all([
          fetch('/api/vending/outreach?status=draft,pending_approval'),
          fetch('/api/vending/phone-leads'),
        ]);
        const emailData = await emailRes.json();
        const phoneData = await phoneRes.json();
        setEmailCount(emailData.outreach?.length || 0);
        setPhoneCount(phoneData.leads?.length || 0);
      } catch (e) {
        console.error('Failed to fetch counts:', e);
      }
    }
    fetchCounts();

    // Re-fetch whenever the outreach page sends or discards an item
    window.addEventListener('vending-outreach-updated', fetchCounts);
    return () => window.removeEventListener('vending-outreach-updated', fetchCounts);
  }, []);

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
                {item.badge === 'email' && emailCount > 0 && (
                  <span className="bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {emailCount}
                  </span>
                )}
                {item.badge === 'phone' && phoneCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {phoneCount}
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
