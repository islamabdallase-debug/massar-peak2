// ============================================================
//  مسار — Sidebar Component (RTL, accessible, role-aware)
//  v5.0.0 · مسار React
// ============================================================

import React, { useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotifications } from '@/hooks/useNotifications';
import type { ScreenName, Lang } from '@/types';
import type { UserRole, SubscriptionPlan } from '@/types/saas';

// ── NavItem definition ───────────────────────────────────────
interface NavItem {
  id: ScreenName;
  icon: string;
  labelKey:
    | 'navDashboard' | 'navStudents' | 'navAssess' | 'navReports'
    | 'navPlan'      | 'navAI'       | 'navExport' | 'navTools'
    | 'navGuide'     | 'navAnalytics'| 'navAdmin'  | 'navPricing'
    | 'navCloud';
  /** roles allowed to see this item (empty = all roles) */
  requiredRoles?: UserRole[];
  /** subscription plans required (empty = any plan) */
  requiredPlans?: SubscriptionPlan[];
  /** visual separator above this item */
  divider?: boolean;
  /** badge text shown inline */
  badge?: string;
}

const CORE_NAV: NavItem[] = [
  { id: 'dashboard', icon: '🏠', labelKey: 'navDashboard' },
  { id: 'students',  icon: '👥', labelKey: 'navStudents' },
  { id: 'assess',    icon: '📋', labelKey: 'navAssess' },
  { id: 'reports',   icon: '📊', labelKey: 'navReports' },
  { id: 'plan',      icon: '🎯', labelKey: 'navPlan' },
  { id: 'ai',        icon: '🤖', labelKey: 'navAI' },
  { id: 'export',    icon: '📥', labelKey: 'navExport' },
  { id: 'tools',     icon: '🔧', labelKey: 'navTools' },
  { id: 'guide',     icon: '📚', labelKey: 'navGuide' },
  { id: 'cloud',     icon: '☁️', labelKey: 'navCloud', divider: true },
];

const SAAS_NAV: NavItem[] = [
  {
    id: 'analytics',
    icon: '📈',
    labelKey: 'navAnalytics',
    requiredPlans: ['pro', 'enterprise'],
    divider: true,
    badge: 'Pro',
  },
  {
    id: 'admin',
    icon: '🏛️',
    labelKey: 'navAdmin',
    requiredRoles: ['center_admin', 'super_admin'],
    divider: false,
  },
  {
    id: 'pricing',
    icon: '💳',
    labelKey: 'navPricing',
    divider: false,
  },
];

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'ar',   label: 'عربي' },
  { value: 'en',   label: 'English' },
  { value: 'both', label: 'AR/EN' },
];

// ── Badge chip ───────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontSize: '0.62rem', fontWeight: 800,
        background: color, color: '#fff',
        borderRadius: '5px', padding: '1px 6px',
        lineHeight: '1.4', letterSpacing: '0.02em',
      }}
    >
      {text}
    </span>
  );
}

// ── Divider ──────────────────────────────────────────────────
function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background: 'var(--border, #1e293b)',
        margin: '8px 12px',
      }}
      aria-hidden="true"
    />
  );
}

// ── Single nav button ─────────────────────────────────────────
interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  isLocked: boolean;
  onNavigate: (id: ScreenName) => void;
}

function NavButton({ item, isActive, isLocked, onNavigate }: NavButtonProps) {
  const { t } = useTranslation();
  const label = t(item.labelKey);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isLocked) onNavigate(item.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-current={isActive ? 'page' : undefined}
      aria-label={isLocked ? `${label} (يتطلب ترقية)` : label}
      aria-disabled={isLocked}
      onClick={() => !isLocked && onNavigate(item.id)}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '10px',
        marginBottom: '3px',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.45 : 1,
        background: isActive ? '#3b82f61a' : 'transparent',
        borderRight: `3px solid ${isActive ? 'var(--blue, #3b82f6)' : 'transparent'}`,
        color: isActive ? 'var(--blue, #3b82f6)' : 'var(--text-muted, #94a3b8)',
        fontWeight: isActive ? 700 : 400,
        fontSize: '0.88rem',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isLocked && !isActive) {
          (e.currentTarget as HTMLDivElement).style.background = '#ffffff08';
          (e.currentTarget as HTMLDivElement).style.color = 'var(--text, #f1f5f9)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isLocked && !isActive) {
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          (e.currentTarget as HTMLDivElement).style.color = 'var(--text-muted, #94a3b8)';
        }
      }}
    >
      <span style={{ fontSize: '1.05rem', minWidth: '20px', textAlign: 'center', flexShrink: 0 }}>
        {isLocked ? '🔒' : item.icon}
      </span>
      <span style={{ flex: 1, textAlign: 'right' }}>{label}</span>
      {item.badge && !isLocked && (
        <Badge text={item.badge} color="var(--blue, #3b82f6)" />
      )}
    </div>
  );
}

// ── Main Sidebar ─────────────────────────────────────────────
export function Sidebar() {
  const { screen, setScreen, isSidebarOpen, setSidebarOpen, lang, setLang } = useAppStore();
  const { profile, subscription } = useAuthStore();

  const { count: notifCount, highCount: notifHigh } = useNotifications();

  const navigate = useCallback(
    (id: ScreenName) => {
      setScreen(id);
      if (window.innerWidth < 768) setSidebarOpen(false);
    },
    [setScreen, setSidebarOpen]
  );

  // Determine if a SaaS nav item should be shown & locked state
  function getItemState(item: NavItem): { show: boolean; locked: boolean } {
    // role check — hide entirely if wrong role
    if (item.requiredRoles && item.requiredRoles.length > 0) {
      const userRole = profile?.role;
      if (!userRole || !item.requiredRoles.includes(userRole)) {
        return { show: false, locked: false };
      }
    }

    // plan check — show but lock if plan doesn't match
    if (item.requiredPlans && item.requiredPlans.length > 0) {
      const userPlan = subscription?.plan ?? 'free';
      const hasAccess = item.requiredPlans.includes(userPlan);
      return { show: true, locked: !hasAccess };
    }

    return { show: true, locked: false };
  }

  const planLabel = subscription?.plan ?? 'free';
  const planColor: Record<string, string> = {
    free:       '#64748b',
    pro:        '#3b82f6',
    enterprise: '#f9a825',
  };

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          style={{
            display: 'none',
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 199,
          }}
          className="sidebar-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        role="navigation"
        aria-label="القائمة الرئيسية"
        aria-expanded={isSidebarOpen}
        dir="rtl"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '220px',
          height: '100vh',
          background: 'var(--sidebar-bg, #0f172a)',
          borderLeft: '1px solid var(--border, #1e293b)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(220px)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          direction: 'rtl',
          fontFamily: 'Cairo, sans-serif',
          overflowY: 'hidden',
        }}
      >
        {/* ── Logo + Plan badge ─────────────────────────── */}
        <div
          style={{
            padding: '18px 16px 14px',
            borderBottom: '1px solid var(--border, #1e293b)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: 'var(--gold, #f9a825)',
                letterSpacing: '-0.5px',
              }}
            >
              مسار
            </div>
            {/* Plan chip — click to upgrade if free */}
            <span
              style={{
                fontSize: '0.6rem',
                fontWeight: 800,
                background: planColor[planLabel] + '22',
                color: planColor[planLabel],
                border: `1px solid ${planColor[planLabel]}44`,
                borderRadius: '6px',
                padding: '2px 7px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: planLabel === 'free' ? 'pointer' : 'default',
              }}
              onClick={() => planLabel === 'free' && navigate('pricing')}
              title={planLabel === 'free' ? 'انقر للترقية' : ''}
            >
              {planLabel}
            </span>
          </div>
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted, #64748b)',
              marginTop: '3px',
            }}
          >
            منصة تقييم RFT
          </div>
        </div>

        {/* ── Core Nav ─────────────────────────────────── */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 4px' }}
          role="list"
        >
          {CORE_NAV.map((item) => {
            const dynItem = (item.id === 'dashboard' && notifCount > 0)
              ? { ...item, badge: notifHigh > 0 ? String(notifHigh) : String(notifCount) }
              : item;
            return (
              <div key={item.id} role="listitem">
                <NavButton
                  item={dynItem}
                  isActive={screen === item.id}
                  isLocked={false}
                  onNavigate={navigate}
                />
              </div>
            );
          })}

          {/* ── SaaS Nav ─────────────────────────────── */}
          {SAAS_NAV.map((item) => {
            const { show, locked } = getItemState(item);
            if (!show) return null;
            return (
              <React.Fragment key={item.id}>
                {item.divider && <Divider />}
                <div role="listitem">
                  <NavButton
                    item={item}
                    isActive={screen === item.id}
                    isLocked={locked}
                    onNavigate={navigate}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Language switcher ─────────────────────── */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border, #1e293b)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted, #64748b)',
              marginBottom: '6px',
            }}
          >
            اللغة
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLang(opt.value)}
                aria-pressed={lang === opt.value}
                style={{
                  flex: 1,
                  padding: '5px 2px',
                  borderRadius: '7px',
                  border: '1px solid var(--border, #334155)',
                  background: lang === opt.value ? 'var(--blue, #3b82f6)' : 'transparent',
                  color: lang === opt.value ? '#fff' : 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: '0.7rem',
                  fontWeight: lang === opt.value ? 700 : 400,
                  minHeight: '28px',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Version footer ────────────────────────── */}
        <div
          style={{
            padding: '6px 16px 12px',
            fontSize: '0.63rem',
            color: 'var(--text-muted, #374151)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          v5.0.0 · مسار React
        </div>
      </nav>
    </>
  );
}
