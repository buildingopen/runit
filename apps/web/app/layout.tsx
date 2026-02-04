/**
 * Root Layout - Responsive shell with collapsible sidebar
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar';
import { MainContent } from '../components/layout/MainContent';
import { AuthProvider } from '../components/providers/AuthProvider';
import { QueryProvider } from '../components/providers/QueryProvider';

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
        <QueryProvider>
          <AuthProvider>
            <Sidebar />
            <MainContent>{children}</MainContent>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
