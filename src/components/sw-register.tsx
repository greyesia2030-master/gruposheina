'use client';
import { useEffect } from 'react';

export function SWRegister() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        // No bloquear UX si el SW falla — solo log
        console.error('[SW] registration failed:', err);
      });
  }, []);

  return null;
}
