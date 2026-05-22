// ============================================================
//  مسار SaaS — RoleGuard & FeatureGuard
// ============================================================

import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import type { UserRole } from '@/types/saas';
import type { Subscription } from '@/types/saas';

// ─── Role Guard ──────────────────────────────────────────────
interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) return null;
  if (!roles.includes(profile.role)) {
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}

// ─── Feature Guard ───────────────────────────────────────────
interface FeatureGuardProps {
  feature: keyof Subscription['features'];
  children: React.ReactNode;
  showUpgrade?: boolean;
}

export function FeatureGuard({ feature, children, showUpgrade = true }: FeatureGuardProps) {
  const canUseFeature = useAuthStore((s) => s.canUseFeature);
  const { setScreen } = useAuthStore();

  if (canUseFeature(feature)) return <>{children}</>;

  if (!showUpgrade) return null;

  return (
    <div
      style={{
        background: 'var(--surface, #1e293b)',
        borderRadius: '14px',
        padding: '32px',
        textAlign: 'center',
        border: '1px dashed var(--border, #334155)',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
      <h3 style={{ margin: '0 0 8px', color: 'var(--text, #f1f5f9)' }}>
        هذه الميزة تتطلب ترقية الاشتراك
      </h3>
      <p style={{ margin: '0 0 20px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem' }}>
        الميزة متاحة في خطط Pro وEnterprise
      </p>
      <Button
        variant="primary"
        icon="⬆️"
        onClick={() => useAuthStore.getState().setScreen?.('settings')}
      >
        ترقية الاشتراك
      </Button>
    </div>
  );
}

// ─── Subscription Limit Banner ───────────────────────────────
export function StudentLimitBanner({ current, limit }: { current: number; limit: number }) {
  if (limit === -1) return null;

  const pct = Math.round((current / limit) * 100);
  if (pct < 70) return null;

  const isAtLimit = current >= limit;
  const color = isAtLimit ? '#ef4444' : '#f59e0b';

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}40`,
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
        fontSize: '0.88rem',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontSize: '1.3rem' }}>{isAtLimit ? '🚫' : '⚠️'}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, color }}>
          {isAtLimit
            ? `وصلت إلى الحد الأقصى للطلاب (${limit})`
            : `اقتربت من الحد الأقصى: ${current}/${limit} طالب`}
        </span>
        {isAtLimit && (
          <span style={{ color: 'var(--text-muted, #94a3b8)', marginRight: '8px' }}>
            — ترقّ للخطة Pro لإضافة المزيد
          </span>
        )}
      </div>
      <Button variant="primary" size="sm" icon="⬆️">
        ترقية
      </Button>
    </div>
  );
}
