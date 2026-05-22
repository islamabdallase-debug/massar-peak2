// ============================================================
//  مسار — OfflineIndicator  v5.1
//  Real-time online/offline status banner
// ============================================================

import React, { useState, useEffect } from 'react';

export function OfflineIndicator() {
  const [online,       setOnline]       = useState(navigator.onLine);
  const [showReconnect, setShowReconnect] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShowReconnect(true);
      const t = setTimeout(() => setShowReconnect(false), 3000);
      return () => clearTimeout(t);
    };
    const handleOffline = () => { setOnline(false); setShowReconnect(false); };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Nothing to show if online and no reconnect flash
  if (online && !showReconnect) return null;

  return (
    <div
      className={`offline-banner${showReconnect ? ' reconnected' : ''}`}
      role="status"
      aria-live="polite"
    >
      {showReconnect ? (
        <>
          <span>✅</span>
          <span>تم استعادة الاتصال — بياناتك آمنة</span>
        </>
      ) : (
        <>
          <span>📡</span>
          <span>أنت غير متصل بالإنترنت — التطبيق يعمل بشكل طبيعي، بياناتك محفوظة محلياً</span>
        </>
      )}
    </div>
  );
}
