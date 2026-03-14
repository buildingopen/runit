// ABOUTME: Client-side Toaster wrapper for sonner
// ABOUTME: Imported by root layout to avoid importing client component in Server Component

'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      toastOptions={{
        style: {
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        },
      }}
    />
  );
}
