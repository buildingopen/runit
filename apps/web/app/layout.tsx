/**
 * Root Layout - Responsive shell with collapsible sidebar
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar';
import { MainContent } from '../components/layout/MainContent';
import { AuthProvider } from '../components/providers/AuthProvider';
import { QueryProvider } from '../components/providers/QueryProvider';
import { ToastProvider } from '../components/providers/ToastProvider';

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
    images: [
      {
        url: '/og/runit-social-preview.svg',
        width: 1200,
        height: 630,
        alt: 'RunIt social preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RunIt - AI writes code. RunIt makes it real.',
    description:
      'Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.',
    images: ['/og/runit-social-preview.svg'],
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
            <ToastProvider />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
