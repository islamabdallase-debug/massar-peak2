// ============================================================
//  مسار — Button Component
// ============================================================

import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--blue, #3b82f6)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text, #f1f5f9)',
    border: '1px solid var(--border, #334155)',
  },
  danger: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted, #94a3b8)',
    border: 'none',
  },
  success: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
  },
};

const SIZES: Record<Size, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: '0.82rem', minHeight: '32px' },
  md: { padding: '10px 20px', fontSize: '0.9rem', minHeight: '40px' },
  lg: { padding: '14px 28px', fontSize: '1rem', minHeight: '48px' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: '8px',
        fontFamily: 'Cairo, sans-serif',
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.15s',
        width: fullWidth ? '100%' : undefined,
        ...VARIANTS[variant],
        ...SIZES[size],
        ...style,
      }}
      {...rest}
    >
      {loading ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span> : icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
