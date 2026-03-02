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
  title: 'Runtime AI - Deploy Python APIs in 30 seconds',
  description:
    'Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.',
  metadataBase: new URL('https://runtime.dev'),
  openGraph: {
    title: 'Runtime AI - Deploy Python APIs in 30 seconds',
    description:
      'Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.',
    url: 'https://runtime.dev',
    siteName: 'Runtime AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Runtime AI - Deploy Python APIs in 30 seconds',
    description:
      'Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.',
  },
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
