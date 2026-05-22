// ============================================================
//  مسار — Root App Component  v5.2
// ============================================================

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useStudents } from '@/hooks/useStudents';
import { useAuth } from '@/hooks/useAuth';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ToastContainer } from '@/components/ui/Toast';
import { ScreenErrorBoundary, OfflineBanner } from '@/components/ui/ErrorBoundary';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { BackupReminderBanner } from '@/components/ui/BackupManager';
import { OnboardingWalkthrough } from '@/components/ui/OnboardingWalkthrough';
import { AuthGate } from '@/screens/auth/LoginScreen';

// Screens
import { Dashboard }  from '@/screens/Dashboard';
import { Students }   from '@/screens/Students';
import { Assess }     from '@/screens/Assess';
import { Reports }    from '@/screens/Reports';
import { Plan }       from '@/screens/Plan';
import { AI }         from '@/screens/AI';
import { Export }     from '@/screens/Export';
import { Tools }      from '@/screens/Tools';
import { Analytics }  from '@/screens/Analytics';
import { AdminPanel } from '@/screens/AdminPanel';
import { Pricing }    from '@/screens/Pricing';
import { Guide }       from '@/screens/Guide';
import { CloudSetup } from '@/screens/CloudSetup';

// ── Screen router with per-screen error isolation ────────────
function ScreenRouter({ screen }: { screen: string }) {
  const screens: Record<string, React.ReactElement> = {
    dashboard:       <Dashboard />,
    students:        <Students />,
    assess:          <Assess />,
    reports:         <Reports />,
    'report-detail': <Reports />,
    plan:            <Plan />,
    ai:              <AI />,
    export:          <Export />,
    tools:           <Tools />,
    analytics:       <Analytics />,
    admin:           <AdminPanel />,
    pricing:         <Pricing />,
    guide:           <Guide />,
    cloud:           <CloudSetup />,
  };
  const el = screens[screen] ?? <Dashboard />;
  return (
    <ScreenErrorBoundary screenName={screen}>
      {el}
    </ScreenErrorBoundary>
  );
}

// ── SW Update Banner ─────────────────────────────────────────
function SWUpdateBanner() {
  const { updateReady, applyUpdate, dismiss } = useServiceWorkerUpdate();
  if (!updateReady) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg,#1e40af,#1d4ed8)',
      color: '#fff',
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 20px',
      fontFamily: 'Cairo,sans-serif',
      fontSize: '0.82rem',
      direction: 'rtl',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontSize: '1.1rem' }}>🔄</span>
      <span style={{ flex: 1, fontWeight: 600 }}>
        يتوفر تحديث جديد لمنصة مسار — حدّث الآن لتجنب أي مشاكل
      </span>
      <button
        onClick={applyUpdate}
        style={{
          background: '#fff', color: '#1d4ed8',
          border: 'none', borderRadius: '8px',
          padding: '5px 16px', fontWeight: 800,
          fontSize: '0.78rem', cursor: 'pointer',
          fontFamily: 'Cairo,sans-serif',
        }}
      >
        تحديث الآن
      </button>
      <button
        onClick={dismiss}
        aria-label="تجاهل التحديث"
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontSize: '1rem', padding: '0 4px',
        }}
      >✕</button>
    </div>
  );
}

// ── App shell ────────────────────────────────────────────────
function AppShell() {
  const { screen, isSidebarOpen, lang, setScreen } = useAppStore();
  const isRTL = lang !== 'en';
  const sidebarWidth = '220px';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #0a0f1a)',
        color: 'var(--text, #f1f5f9)',
        fontFamily: 'Cairo, sans-serif',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {/* SW update notification banner */}
      <SWUpdateBanner />

      {/* First-use onboarding walkthrough */}
      <OnboardingWalkthrough />

      {/* Offline / reconnect indicator — overlaid top banner */}
      <OfflineIndicator />

      {/* Backup reminder — shown when last backup > 7 days */}
      <BackupReminderBanner onGoToBackup={() => setScreen('tools')} />

      {/* Legacy OfflineBanner from ErrorBoundary (fallback) */}
      <OfflineBanner />

      <Sidebar />
      <Header />
      <main
        id="main-content"
        role="main"
        aria-label={isRTL ? 'المحتوى الرئيسي' : 'Main content'}
        style={{
          marginRight: isRTL && isSidebarOpen ? sidebarWidth : undefined,
          marginLeft:  !isRTL && isSidebarOpen ? sidebarWidth : undefined,
          marginTop: '56px',
          minHeight: 'calc(100vh - 56px)',
          transition: 'margin 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <ScreenRouter screen={screen} />
      </main>
      <ToastContainer />
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────
export function App() {
  const { lang } = useAppStore();

  useStudents();
  useAuth();

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
    document.documentElement.dir  = lang === 'en' ? 'ltr' : 'rtl';
  }, [lang]);

  // Local-only mode vs cloud mode (Supabase)
  const supabaseConfigured = !!(
    typeof window !== 'undefined' &&
    (localStorage.getItem('massar_supabase_url') ||
     sessionStorage.getItem('massar_supabase_url'))
  );

  // AuthGate only shown when Supabase is configured
  if (supabaseConfigured) {
    return <AuthGate><AppShell /></AuthGate>;
  }

  return <AppShell />;
}
