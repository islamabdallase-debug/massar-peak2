// ============================================================
//  مسار — Toast Component
// ============================================================

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import type { Toast, ToastType } from '@/types';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useAppStore((s) => s.removeToast);
  const icon = ICONS[toast.type];
  const color = COLORS[toast.type];

  useEffect(() => {
    const timer = setTimeout(
      () => removeToast(toast.id),
      toast.duration ?? 3500
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--surface, #1e293b)',
        border: `1px solid ${color}40`,
        borderRight: `4px solid ${color}`,
        borderRadius: '10px',
        padding: '12px 16px',
        color: 'var(--text, #f1f5f9)',
        fontSize: '0.92rem',
        fontFamily: 'Cairo, sans-serif',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        minWidth: '240px',
        maxWidth: '360px',
        animation: 'toastIn 0.25s ease',
      }}
      onClick={() => removeToast(toast.id)}
    >
      <span style={{ color, fontSize: '1.1rem', fontWeight: 700 }}>{icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
      }}
      aria-label="الإشعارات"
    >
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
