// ============================================================
//  مسار — Confirm Dialog (accessible, focus-trapped)
// ============================================================

import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title = 'تأكيد',
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const els = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        const idx = els.indexOf(document.activeElement as HTMLButtonElement);
        els[(idx + (e.shiftKey ? -1 : 1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmColor =
    type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 8000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: '16px',
          padding: '28px 32px',
          maxWidth: '420px',
          width: '100%',
          fontFamily: 'Cairo, sans-serif',
          direction: 'rtl',
          textAlign: 'right',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          style={{
            margin: '0 0 12px',
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'var(--text, #f1f5f9)',
          }}
        >
          {title}
        </h2>
        <p
          id="confirm-msg"
          style={{
            margin: '0 0 24px',
            color: 'var(--text-muted, #94a3b8)',
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border, #334155)',
              background: 'transparent',
              color: 'var(--text, #f1f5f9)',
              cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif',
              fontSize: '0.9rem',
              minHeight: '40px',
            }}
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: confirmColor,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif',
              fontSize: '0.9rem',
              fontWeight: 600,
              minHeight: '40px',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
