'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../providers/AuthProvider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Apps',
    href: '/dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
];

type ApiStatus = 'checking' | 'connected' | 'disconnected';

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/reset-password');
  const isMarketingPage = pathname === '/' || pathname === '/pricing';

  // Check API health on mount and periodically
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    let initialCheck = true;

    const checkHealth = async () => {
      try {
        await apiClient.health();
        setApiStatus('connected');
        retryCount = 0;
        initialCheck = false;
      } catch {
        if (initialCheck && retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkHealth, 1000);
          return;
        }
        initialCheck = false;
        setApiStatus('disconnected');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (isAuthPage || isMarketingPage) return null;

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-12 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between px-4 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--accent)] rounded-md flex items-center justify-center shadow-sm">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-[13px]">Execution Layer</span>
        </Link>
        <div className="w-9" /> {/* Spacer for centering */}
      </header>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-[220px] h-screen bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex flex-col fixed left-0 top-0 z-50
          transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="h-12 px-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-[var(--accent)] rounded-md flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-[var(--text-primary)] text-[13px] tracking-tight">Execution Layer</span>
          </Link>
          {/* Close button (mobile only) */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2" role="navigation" aria-label="Main navigation">
          <div className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 mb-2">
            Workspace
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]
                  ${
                    isActive
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[var(--accent)] rounded-r-full" />
                )}
                <span className={isActive ? 'text-[var(--text-primary)]' : ''}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* New App Button */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <Link
            href="/new"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.98] text-white text-[13px] font-medium rounded-md shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New App
          </Link>
        </div>

        {/* User Section */}
        {user && (
          <div className="px-3 py-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <span className="flex-1 text-[11px] text-[var(--text-secondary)] truncate" title={user.email}>
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}

        {/* Status */}
        <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                apiStatus === 'connected'
                  ? 'bg-[var(--success)] shadow-[0_0_6px_var(--success)]'
                  : apiStatus === 'disconnected'
                  ? 'bg-[var(--error)]'
                  : 'bg-[var(--text-tertiary)] animate-pulse'
              }`}
            />
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {apiStatus === 'connected'
                ? 'API Connected'
                : apiStatus === 'disconnected'
                ? 'API Disconnected'
                : 'Connecting...'}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile spacer to push content below header */}
      <div className="lg:hidden h-12" />
    </>
  );
}
