import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Apps - Runtime',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
