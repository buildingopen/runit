/**
 * Root Layout - Responsive shell with collapsible sidebar
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar';
import { MainContent } from '../components/layout/MainContent';
import { AuthProvider } from '../components/providers/AuthProvider';
import { QueryProvider } from '../components/providers/QueryProvider';
import { PostHogProvider } from '../components/providers/PostHogProvider';

export const metadata: Metadata = {
  title: 'Runtime',
  description: 'Turn your Python script into a live app',
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
            <PostHogProvider>
              <Sidebar />
              <MainContent>{children}</MainContent>
            </PostHogProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
