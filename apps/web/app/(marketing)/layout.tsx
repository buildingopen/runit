import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RunIt - Turn your Python script into a live app',
  description:
    'Built something with Cursor or ChatGPT? Make it live in 60 seconds. No servers, no Docker, no devops.',
  openGraph: {
    title: 'RunIt - You built it with AI. We make it live.',
    description:
      'Turn any Python script into a shareable app with a link. Zero infrastructure.',
    type: 'website',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
