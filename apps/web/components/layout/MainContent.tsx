'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/reset-password');
  const isMarketingPage = pathname === '/' || pathname === '/pricing';
  const isFullWidth = isAuthPage || isMarketingPage;

  return (
    <main className={`${isFullWidth ? '' : 'lg:ml-[220px]'} min-h-screen transition-[margin] duration-200`}>
      {children}
    </main>
  );
}
