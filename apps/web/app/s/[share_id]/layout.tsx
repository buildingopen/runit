import type { Metadata } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ShareData {
  share_id: string;
  project: {
    project_id: string;
    name: string;
  };
  target_type: string;
  target_ref: string;
}

async function fetchShareData(shareId: string): Promise<ShareData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/share/${shareId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ share_id: string }>;
}): Promise<Metadata> {
  const { share_id } = await params;
  const data = await fetchShareData(share_id);

  const appName = data?.project?.name || 'Shared App';
  const title = `${appName} - Try it on RunIt`;
  const description = `Try ${appName} on RunIt. No sign-up needed.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'RunIt',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
