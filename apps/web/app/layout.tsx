/**
 * Root Layout - Responsive shell with collapsible sidebar
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'Execution Layer',
  description: 'Run FastAPI projects in ephemeral sandboxes',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Sidebar />
        {/* Sidebar margin: 220px on lg+, 0 on mobile (sidebar hidden) */}
        <main className="lg:ml-[220px] min-h-screen transition-[margin] duration-200">
          {children}
        </main>
      </body>
    </html>
  );
}
