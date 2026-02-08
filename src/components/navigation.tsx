'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  SquaresFour,
  ChartBar,
  VideoCamera,
  Brain,
  ClipboardText,
  Shield,
  ArrowsClockwise,
  SignOut,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: SquaresFour },
  { name: 'Analysis', href: '/analysis', icon: ChartBar },
  { name: 'Videos', href: '/videos', icon: VideoCamera },
  { name: 'ML Categorisation', href: '/ml-categorisation', icon: Brain },
  { name: 'Review', href: '/ml-review', icon: ClipboardText },
  { name: 'Safety', href: '/safety', icon: Shield },
  { name: 'Sync', href: '/sync', icon: ArrowsClockwise },
];

export function Navigation() {
  const pathname = usePathname();

  // Don't show navigation on auth pages
  if (pathname === '/' || pathname?.startsWith('/api/auth')) {
    return null;
  }

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-3 md:px-6">
        <div className="flex h-14 items-center justify-between gap-1">
          {/* Logo/Brand */}
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="YouTube Organiser home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
              <span className="text-sm font-bold text-white">YT</span>
            </div>
            <span className="hidden text-lg font-semibold text-foreground sm:block">
              YouTube Organiser
            </span>
          </Link>

          {/* Navigation Links - horizontal scroll on mobile */}
          <div className="flex min-w-0 flex-1 overflow-x-auto scrollbar-hide md:justify-center">
            <div className="flex gap-0.5">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors min-h-[44px] min-w-[44px] justify-center md:px-3',
                      isActive
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                    <span className="hidden md:block">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right section: Theme Toggle + Sign Out */}
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              className="flex min-h-[44px] min-w-[44px] items-center gap-2 text-muted-foreground hover:text-accent-foreground md:min-h-0 md:min-w-0"
              onClick={() => signOut({ callbackUrl: '/' })}
              title="Sign Out"
              aria-label="Sign out"
            >
              <SignOut size={18} />
              <span className="hidden md:block">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
