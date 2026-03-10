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
  title: 'RunIt - AI writes code. RunIt makes it real.',
  description:
    'Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.',
  metadataBase: new URL('https://runit.dev'),
  openGraph: {
    title: 'RunIt - AI writes code. RunIt makes it real.',
    description:
      'Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.',
    url: 'https://runit.dev',
    siteName: 'RunIt',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RunIt - AI writes code. RunIt makes it real.',
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
            <Sidebar />
            <MainContent>{children}</MainContent>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
