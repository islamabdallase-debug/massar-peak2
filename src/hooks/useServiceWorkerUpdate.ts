// ============================================================
//  مسار — useServiceWorkerUpdate hook  v1.0
//  Detects a waiting SW update and provides a controlled
//  activation mechanism (sends SKIP_WAITING when user is ready).
//  Works with the message-based sw.js (CACHE_NAME massar-v6+).
// ============================================================

import { useEffect, useState, useCallback } from 'react';

export interface SWUpdateState {
  /** True when a new service worker is installed and waiting */
  updateReady: boolean;
  /** Call to apply the update (reloads after activation) */
  applyUpdate: () => void;
  /** Dismiss without applying — user can apply later */
  dismiss: () => void;
}

export function useServiceWorkerUpdate(): SWUpdateState {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registration = navigator.serviceWorker.getRegistration();
    if (!registration) return;

    registration.then((reg) => {
      if (!reg) return;

      // Already waiting on mount (e.g. tab was open during SW install)
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateReady(true);
      }

      // Listen for a new SW reaching waiting state
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateReady(true);
          }
        });
      });
    });

    // When the new SW takes control, reload to load fresh assets
    const handleControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setUpdateReady(false);
  }, [waitingWorker]);

  const dismiss = useCallback(() => {
    setUpdateReady(false);
  }, []);

  return { updateReady, applyUpdate, dismiss };
}
