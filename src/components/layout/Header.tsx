// ============================================================
//  مسار — Header Component
// ============================================================

import React from 'react';
import { useAppStore, selectSelectedStudent } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';

const SCREEN_TITLES: Record<string, string> = {
  dashboard: 'الرئيسية',
  students: 'الطلاب',
  assess: 'التقييم',
  reports: 'التقارير',
  plan: 'خطة التدخل',
  ai: 'تحليل AI',
  export: 'التصدير',
  tools: 'الأدوات',
  settings: 'الإعدادات',
  'report-detail': 'تفاصيل التقرير',
};

export function Header() {
  const { screen, toggleSidebar, isSidebarOpen, syncStatus, theme, toggleTheme } = useAppStore();
  const selectedStudent = useAppStore(selectSelectedStudent);
  const { t } = useTranslation();

  const title = SCREEN_TITLES[screen] ?? screen;
  const syncIcon =
    syncStatus.state === 'syncing'
      ? '🔄'
      : syncStatus.state === 'error'
      ? '⚠️'
      : syncStatus.state === 'offline'
      ? '📴'
      : syncStatus.state === 'success'
      ? '✅'
      : '☁️';

  const syncLabel =
    syncStatus.state === 'syncing'
      ? t('syncing')
      : syncStatus.state === 'error'
      ? t('syncError')
      : syncStatus.state === 'offline'
      ? t('offline')
      : syncStatus.state === 'success'
      ? t('syncSuccess')
      : t('cloudSync');

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        right: isSidebarOpen ? '220px' : '0',
        left: 0,
        height: '56px',
        background: 'var(--bg, #0a0f1a)',
        borderBottom: '1px solid var(--border, #1e293b)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '12px',
        zIndex: 100,
        transition: 'right 0.28s cubic-bezier(0.4,0,0.2,1)',
        direction: 'rtl',
        fontFamily: 'Cairo, sans-serif',
      }}
    >
      {/* Skip link (accessibility) */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: '-100px',
          right: '16px',
          background: 'var(--blue, #3b82f6)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '4px',
          fontFamily: 'Cairo, sans-serif',
          zIndex: 9999,
          textDecoration: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.top = '8px')}
        onBlur={(e) => (e.currentTarget.style.top = '-100px')}
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label={isSidebarOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-expanded={isSidebarOpen}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted, #94a3b8)',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '8px',
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          minHeight: '40px',
          minWidth: '40px',
          justifyContent: 'center',
        }}
      >
        ☰
      </button>

      {/* Page title */}
      <h1
        style={{
          flex: 1,
          margin: 0,
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text, #f1f5f9)',
        }}
      >
        {title}
        {selectedStudent && screen === 'assess' && (
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted, #94a3b8)',
              fontWeight: 400,
              marginRight: '10px',
            }}
          >
            — {selectedStudent.name}
          </span>
        )}
      </h1>

      {/* Sync indicator */}
      {syncStatus.pendingOps > 0 && (
        <span
          style={{
            background: '#f59e0b',
            color: '#000',
            borderRadius: '10px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
          aria-label={`${syncStatus.pendingOps} عملية معلقة`}
        >
          {syncStatus.pendingOps}
        </span>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.15rem',
          padding: '8px',
          borderRadius: '8px',
          minHeight: '40px',
          minWidth: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted, #94a3b8)',
          transition: 'color 0.2s',
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <button
        aria-label={syncLabel}
        title={syncLabel}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.2rem',
          padding: '8px',
          borderRadius: '8px',
          animation:
            syncStatus.state === 'syncing' ? 'spin 0.8s linear infinite' : undefined,
          minHeight: '40px',
          minWidth: '40px',
        }}
      >
        {syncIcon}
      </button>
    </header>
  );
}
