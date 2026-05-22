// ============================================================
//  مسار — ErrorBoundary + Global Error System
//  Production-grade: catches render errors, async errors,
//  IndexedDB failures, network failures
// ============================================================

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

// ── Import shared utilities (avoids circular deps with database.ts) ──
import {
  errorLogs,
  logError,
  getErrorLogs,
  clearErrorLogs,
  logDBError,
  logNetworkError,
  withRetry,
  type ErrorLog,
} from '@/utils/errorUtils';

// Re-export for backward compatibility (files that import from ErrorBoundary)
export { getErrorLogs, clearErrorLogs, logDBError, logNetworkError, withRetry };
export type { ErrorLog };

// ── Install global unhandled error listeners ─────────────────
export function installGlobalErrorHandlers(): void {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : 'Unhandled rejection';
    logError('unhandled', msg, reason instanceof Error ? reason.stack : undefined);
  });

  // Synchronous errors not caught by ErrorBoundary
  window.addEventListener('error', (e) => {
    logError('unhandled', e.message ?? 'Unknown error', e.error?.stack, e.filename);
  });
}

// ── Fallback UI ──────────────────────────────────────────────
function ErrorFallback({
  error,
  reset,
  context,
}: {
  error: Error;
  reset: () => void;
  context?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: '32px 24px',
        margin: '24px auto',
        maxWidth: '520px',
        background: '#1e293b',
        border: '1px solid #ef444433',
        borderRadius: '12px',
        textAlign: 'center',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
      <h2 style={{ color: '#f87171', fontWeight: 800, marginBottom: '8px', fontSize: '1.1rem' }}>
        حدث خطأ غير متوقع
      </h2>
      {context && (
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '6px' }}>
          المنطقة: {context}
        </p>
      )}
      <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '20px', fontFamily: 'monospace', direction: 'ltr' }}>
        {error.message}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontFamily: 'Cairo, sans-serif',
          fontWeight: 700,
        }}
      >
        إعادة المحاولة
      </button>
      <p style={{ marginTop: '12px', color: '#374151', fontSize: '0.7rem' }}>
        إذا تكررت المشكلة، يمكنك تحديث الصفحة أو التواصل مع الدعم
      </p>
    </div>
  );
}

// ── ErrorBoundary class component ────────────────────────────
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError('render', error.message, error.stack, this.props.context);
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallback
          error={this.state.error}
          reset={this.reset}
          context={this.props.context}
        />
      );
    }
    return this.props.children;
  }
}

// ── Screen-level ErrorBoundary (wraps individual screens) ────
export function ScreenErrorBoundary({
  children,
  screenName,
}: {
  children: ReactNode;
  screenName: string;
}) {
  return (
    <ErrorBoundary context={screenName}>
      {children}
    </ErrorBoundary>
  );
}

// ── Offline indicator hook ───────────────────────────────────
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

// ── OfflineBanner ────────────────────────────────────────────
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#f59e0b',
        color: '#1a1a1a',
        padding: '8px 20px',
        borderRadius: '8px',
        fontFamily: 'Cairo, sans-serif',
        fontWeight: 700,
        fontSize: '0.85rem',
        zIndex: 9999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        direction: 'rtl',
      }}
    >
      📶 أنت الآن في وضع غير متصل — يعمل المنصة بالبيانات المحلية
    </div>
  );
}

// ── Diagnostics Mode ─────────────────────────────────────────
// Accessible via: window.__massar_diag in DevTools Console
// Also triggered via Tools screen → Diagnostics

export interface DiagnosticReport {
  timestamp:    string;
  version:      string;
  userAgent:    string;
  online:       boolean;
  idbAvailable: boolean;
  memoryMB:     number | null;
  errorCount:   number;
  recentErrors: ErrorLog[];
  dbStats:      Record<string, unknown>;
  cacheKeys:    string[];
}

export async function runDiagnostics(): Promise<DiagnosticReport> {
  // Memory (Chrome only)
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const memMB = mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null;

  // IDB availability
  let idbAvailable = false;
  try {
    idbAvailable = typeof indexedDB !== 'undefined' && !!indexedDB;
  } catch { /* blocked by privacy settings */ }

  // Cache keys
  let cacheKeys: string[] = [];
  try {
    if ('caches' in window) {
      cacheKeys = await caches.keys();
    }
  } catch { /* not available */ }

  // DB stats (import lazily to avoid circular deps)
  let dbStats: Record<string, unknown> = {};
  try {
    const { StudentDB, SessionDB, PlanDB } = await import('@/db/database');
    const [sc, sesc, pc] = await Promise.all([
      StudentDB.count().catch(() => -1),
      SessionDB.count ? SessionDB.count().catch(() => -1) : Promise.resolve(-1),
      PlanDB.count().catch(() => -1),
    ]);
    dbStats = { students: sc, sessions: sesc, plans: pc };
  } catch (e) {
    dbStats = { error: String(e) };
  }

  const report: DiagnosticReport = {
    timestamp:    new Date().toISOString(),
    version:      '5.1.0',
    userAgent:    navigator.userAgent,
    online:       navigator.onLine,
    idbAvailable,
    memoryMB:     memMB,
    errorCount:   errorLogs.length,
    recentErrors: errorLogs.slice(-10),
    dbStats,
    cacheKeys,
  };

  // Make accessible from DevTools
  (window as unknown as Record<string, unknown>).__massar_diag  = report;
  (window as unknown as Record<string, unknown>).__massar_errors = errorLogs;

  return report;
}

// Auto-expose on window in non-production for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__massar_run_diag = runDiagnostics;
  (window as unknown as Record<string, unknown>).__massar_errors   = errorLogs;
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            