'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useAuth } from './AuthProvider';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialized) return;
    if (!POSTHOG_KEY) return; // Skip in dev when key is not configured

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
    });
    initialized = true;
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (user) {
      posthog.identify(user.id, { email: user.email });
    } else {
      posthog.reset();
    }
  }, [user]);

  return <>{children}</>;
}
