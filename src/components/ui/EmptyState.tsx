// ============================================================
//  مسار — EmptyState  v5.1
//  Reusable empty state for lists, screens, search results
// ============================================================

import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  size = 'md',
}: EmptyStateProps) {
  const padding = size === 'sm' ? '24px 16px' : size === 'lg' ? '64px 32px' : '48px 24px';
  const iconSize = size === 'sm' ? '2rem' : size === 'lg' ? '4.5rem' : '3.5rem';

  return (
    <div className="empty-state" style={{ padding }}>
      <div className="empty-state__icon" style={{ fontSize: iconSize }}>{icon}</div>
      <div className="empty-state__title">{title}</div>
      {description && (
        <div className="empty-state__desc">{description}</div>
      )}
      {actionLabel && onAction && (
        <div className="empty-state__action">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader helpers ───────────────────────────────────
export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 0' }}>
          <div className="skeleton skeleton-avatar" />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
