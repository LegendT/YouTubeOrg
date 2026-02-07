'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Video, Brain, ClipboardCheck, Shield, RefreshCw, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Analysis', href: '/analysis', icon: BarChart3 },
  { name: 'Videos', href: '/videos', icon: Video },
  { name: 'ML Categorisation', href: '/ml-categorization', icon: Brain },
  { name: 'Review', href: '/ml-review', icon: ClipboardCheck },
  { name: 'Safety', href: '/safety', icon: Shield },
  { name: 'Sync', href: '/sync', icon: RefreshCw },
];

export function Navigation() {
  const pathname = usePathname();

  // Don't show navigation on auth pages
  if (pathname === '/' || pathname?.startsWith('/api/auth')) {
    return null;
  }

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">YT</span>
              </div>
              <span className="font-semibold text-lg hidden sm:block">
                YouTube Organiser
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="flex space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:block">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sign Out */}
          <a
            href="/api/auth/signout"
            className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:block">Sign Out</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
