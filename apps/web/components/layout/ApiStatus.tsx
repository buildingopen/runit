'use client';

/**
 * API Status Indicator Component
 */

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api/client';

type Status = 'online' | 'offline' | 'checking';

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      await apiClient.health();
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }

  const statusConfig = {
    online: { color: 'bg-[var(--success)]', text: 'API Online' },
    offline: { color: 'bg-[var(--error)]', text: 'API Offline' },
    checking: { color: 'bg-[var(--warning)]', text: 'Checking...' },
  };

  const { color, text } = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-sm text-[var(--text-secondary)]">{text}</span>
    </div>
  );
}
