import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Apps - RunIt',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
