'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/reset-password');

  return (
    <main className={`${isAuthPage ? '' : 'lg:ml-[220px]'} min-h-screen transition-[margin] duration-200`}>
      {children}
    </main>
  );
}
