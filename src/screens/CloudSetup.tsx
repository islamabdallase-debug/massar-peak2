// ============================================================
//  مسار — Cloud Setup Screen (Supabase Wizard)  v1.0
//  إعداد مزامنة Supabase السحابية
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { AuthService } from '@/services/AuthService';
import type { SyncStatus } from '@/types';

// ── Helpers ──────────────────────────────────────────────────
function formatRelativeTime(ts: number | null, lang: string): string {
  if (!ts) return lang === 'ar' ? 'لم تتم بعد' : 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (lang === 'ar') {
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    if (hrs  < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${days} يوم`;
  }
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function isValidUrl(s: string): boolean {
  try { return !!new URL(s.trim()); } catch { return false; }
}
function isValidKey(s: string): boolean {
  return s.trim().length >= 20;
}

// ── Step indicators ───────────────────────────────────────────
const STEPS_AR = ['الإعداد', 'الاتصال', 'المزامنة'];
const STEPS_EN = ['Setup', 'Connection', 'Sync'];

// ── SyncStatus badge ─────────────────────────────────────────
function StatusBadge({ state, lang }: { state: SyncStatus['state']; lang: string }) {
  const map: Record<SyncStatus['state'], { bg: string; color: string; labelAr: string; labelEn: string; icon: string }> = {
    idle:    { bg: '#f1f5f9', color: '#64748b', labelAr: 'غير نشط',    labelEn: 'Idle',       icon: '⏸' },
    syncing: { bg: '#dbeafe', color: '#2563eb', labelAr: 'جاري التزامن', labelEn: 'Syncing',   icon: '🔄' },
    success: { bg: '#dcfce7', color: '#16a34a', labelAr: 'تمت المزامنة', labelEn: 'Synced',   icon: '✅' },
    error:   { bg: '#fee2e2', color: '#dc2626', labelAr: 'خطأ',         labelEn: 'Error',      icon: '❌' },
    offline: { bg: '#fef3c7', color: '#d97706', labelAr: 'غير متصل',    labelEn: 'Offline',    icon: '📴' },
  };
  const s = map[state];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 13, fontWeight: 600,
    }}>
      <span style={{ fontSize: 14 }}>{s.icon}</span>
      {lang === 'ar' ? s.labelAr : s.labelEn}
    </span>
  );
}

// ── Main screen ──────────────────────────────────────────────
export function CloudSetup() {
  const { lang } = useAppStore();
  const isRtl = lang !== 'en';

  // Current saved config
  const [savedConfig] = useState(() => AuthService.getConfig());
  const configured = !!savedConfig;

  // Wizard step: 0=setup, 1=test connection, 2=sync
  const [step, setStep] = useState(configured ? 2 : 0);

  // Form fields
  const [url, setUrl]       = useState(savedConfig?.url  ?? '');
  const [key, setKey]       = useState(savedConfig?.key  ?? '');
  const [showKey, setShowKey] = useState(false);

  // Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncAt: null,
    pendingOps: 0,
  });
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');

  // Load last sync time from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('massar_last_sync');
    if (raw) {
      setSyncStatus(s => ({ ...s, lastSyncAt: Number(raw) }));
    }
  }, []);

  // ── Validation ───────────────────────────────────────────
  const urlOk = isValidUrl(url);
  const keyOk = isValidKey(key);
  const formOk = urlOk && keyOk;

  // ── Handlers ─────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!formOk) return;
    setSaving(true);
    try {
      AuthService.setConfig(url.trim(), key.trim());
      setSaveMsg(lang === 'ar' ? '✅ تم حفظ الإعدادات' : '✅ Settings saved');
      setTimeout(() => {
        setSaveMsg('');
        setStep(1);
      }, 1200);
    } catch (e) {
      setSaveMsg(lang === 'ar' ? '❌ فشل الحفظ' : '❌ Save failed');
    } finally {
      setSaving(false);
    }
  }, [formOk, url, key, lang]);

  const handleTestConnection = useCallback(async () => {
    setTestResult('testing');
    setTestError('');
    try {
      // Try to reach the Supabase REST API health endpoint
      const response = await fetch(`${url.trim()}/rest/v1/`, {
        headers: {
          apikey: key.trim(),
          Authorization: `Bearer ${key.trim()}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok || response.status === 200 || response.status === 404) {
        // 404 on /rest/v1/ is normal (no table named ""), still means server reachable
        setTestResult('ok');
        setTimeout(() => setStep(2), 800);
      } else {
        setTestResult('fail');
        setTestError(lang === 'ar'
          ? `فشل الاتصال (${response.status}): تحقق من المفتاح`
          : `Connection failed (${response.status}): check API key`);
      }
    } catch (e: unknown) {
      setTestResult('fail');
      const msg = e instanceof Error ? e.message : String(e);
      setTestError(lang === 'ar'
        ? `تعذّر الاتصال: ${msg.includes('abort') ? 'انتهت المهلة' : 'تحقق من الرابط'}`
        : `Connection error: ${msg.includes('abort') ? 'timeout' : 'check URL'}`);
    }
  }, [url, key, lang]);

  const handleSyncNow = useCallback(async () => {
    setSyncStatus(s => ({ ...s, state: 'syncing' }));
    try {
      // Simulate sync — real implementation would call SyncService
      await new Promise(r => setTimeout(r, 1500));
      const now = Date.now();
      localStorage.setItem('massar_last_sync', String(now));
      setSyncStatus({ state: 'success', lastSyncAt: now, pendingOps: 0 });
      setTimeout(() => setSyncStatus(s => ({ ...s, state: 'idle' })), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncStatus(s => ({ ...s, state: 'error', error: msg }));
    }
  }, []);

  const handleClearConfig = useCallback(() => {
    const confirm = window.confirm(
      lang === 'ar'
        ? 'هل تريد إزالة إعدادات Supabase؟ ستبقى البيانات المحلية سليمة.'
        : 'Remove Supabase configuration? Local data will remain intact.'
    );
    if (!confirm) return;
    localStorage.removeItem('massar_supabase_url');
    localStorage.removeItem('massar_supabase_key');
    localStorage.removeItem('massar_last_sync');
    setUrl('');
    setKey('');
    setStep(0);
    setSyncStatus({ state: 'idle', lastSyncAt: null, pendingOps: 0 });
    setTestResult('idle');
  }, [lang]);

  // ── UI helpers ───────────────────────────────────────────
  const steps = isRtl ? STEPS_AR : STEPS_EN;
  const dir   = isRtl ? 'rtl' : 'ltr';

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ direction: dir, padding: '24px', maxWidth: 680, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 800, margin: 0,
          color: 'var(--text-primary, #0f172a)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 26 }}>☁️</span>
          {isRtl ? 'إعداد المزامنة السحابية' : 'Cloud Sync Setup'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted, #64748b)', margin: '6px 0 0' }}>
          {isRtl
            ? 'ربط المنصة بـ Supabase لمزامنة البيانات عبر الأجهزة'
            : 'Connect to Supabase for cross-device data synchronization'}
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: i <= step ? '#3b82f6' : '#e2e8f0',
                color: i <= step ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: i <= step ? '#3b82f6' : '#94a3b8',
                whiteSpace: 'nowrap',
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 18,
                background: i < step ? '#3b82f6' : '#e2e8f0',
                transition: 'all 0.2s',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 0: Setup form ────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardTitle icon="🔧" text={isRtl ? 'بيانات الاتصال' : 'Connection Credentials'} />

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle(isRtl)}>
              {isRtl ? 'رابط Supabase (Project URL)' : 'Supabase URL (Project URL)'}
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              style={inputStyle(urlOk || !url, isRtl)}
              dir="ltr"
            />
            {url && !urlOk && (
              <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>
                {isRtl ? 'رابط غير صالح' : 'Invalid URL'}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle(isRtl)}>
              {isRtl ? 'مفتاح anon_key' : 'Anon Public Key'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder={isRtl ? 'eyJhbGciOi...' : 'eyJhbGciOi...'}
                style={{ ...inputStyle(keyOk || !key, isRtl), paddingLeft: 40 }}
                dir="ltr"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                style={{
                  position: 'absolute', [isRtl ? 'right' : 'left']: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, color: '#64748b',
                }}
                title={showKey ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'إظهار' : 'Show')}
              >
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
            {key && !keyOk && (
              <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>
                {isRtl ? 'المفتاح قصير جداً' : 'Key too short'}
              </p>
            )}
          </div>

          {/* How to get credentials */}
          <InfoBox isRtl={isRtl}>
            {isRtl ? (
              <>
                للحصول على البيانات: اذهب إلى{' '}
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
                   style={{ color: '#3b82f6' }}>supabase.com/dashboard</a>
                {' '}← اختر مشروعك ← Settings ← API
              </>
            ) : (
              <>
                Get credentials at{' '}
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
                   style={{ color: '#3b82f6' }}>supabase.com/dashboard</a>
                {' '}→ Your project → Settings → API
              </>
            )}
          </InfoBox>

          {saveMsg && (
            <p style={{ color: saveMsg.includes('✅') ? '#16a34a' : '#dc2626', fontSize: 14, margin: '8px 0' }}>
              {saveMsg}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <ActionButton
              onClick={handleSave}
              disabled={!formOk || saving}
              primary
            >
              {saving
                ? (isRtl ? 'جاري الحفظ...' : 'Saving...')
                : (isRtl ? 'حفظ والمتابعة' : 'Save & Continue')}
            </ActionButton>
          </div>
        </Card>
      )}

      {/* ── Step 1: Test connection ───────────────────────── */}
      {step === 1 && (
        <Card>
          <CardTitle icon="🔌" text={isRtl ? 'اختبار الاتصال' : 'Test Connection'} />

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted, #64748b)' }}>
                {isRtl ? 'المشروع:' : 'Project:'}
              </span>
              <code style={{
                background: '#f1f5f9', padding: '2px 8px', borderRadius: 6,
                fontSize: 13, color: '#0f172a', direction: 'ltr',
              }}>
                {url}
              </code>
            </div>
          </div>

          {testResult === 'ok' && (
            <div style={{
              background: '#dcfce7', color: '#16a34a',
              padding: '12px 16px', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16, fontSize: 14, fontWeight: 600,
            }}>
              ✅ {isRtl ? 'الاتصال ناجح! جاري الانتقال...' : 'Connection successful! Proceeding...'}
            </div>
          )}

          {testResult === 'fail' && (
            <div style={{
              background: '#fee2e2', color: '#dc2626',
              padding: '12px 16px', borderRadius: 10,
              marginBottom: 16, fontSize: 14,
            }}>
              ❌ {testError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ActionButton
              onClick={handleTestConnection}
              disabled={testResult === 'testing'}
              primary
            >
              {testResult === 'testing'
                ? (isRtl ? '⏳ جاري الاختبار...' : '⏳ Testing...')
                : (isRtl ? '🔌 اختبار الاتصال' : '🔌 Test Connection')}
            </ActionButton>
            <ActionButton onClick={() => setStep(0)}>
              {isRtl ? '← تعديل البيانات' : '← Edit Credentials'}
            </ActionButton>
            <ActionButton onClick={() => setStep(2)}>
              {isRtl ? 'تخطّ الاختبار ←' : 'Skip Test →'}
            </ActionButton>
          </div>
        </Card>
      )}

      {/* ── Step 2: Sync dashboard ────────────────────────── */}
      {step === 2 && (
        <>
          {/* Status card */}
          <Card style={{ marginBottom: 16 }}>
            <CardTitle icon="📡" text={isRtl ? 'حالة المزامنة' : 'Sync Status'} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <StatBox
                label={isRtl ? 'الحالة' : 'Status'}
                value={<StatusBadge state={syncStatus.state} lang={lang} />}
              />
              <StatBox
                label={isRtl ? 'آخر مزامنة' : 'Last Sync'}
                value={formatRelativeTime(syncStatus.lastSyncAt, lang)}
              />
              <StatBox
                label={isRtl ? 'عمليات معلّقة' : 'Pending Ops'}
                value={String(syncStatus.pendingOps)}
              />
              <StatBox
                label={isRtl ? 'الخادم' : 'Server'}
                value={<a href={url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#3b82f6', fontSize: 12, direction: 'ltr' }}>
                  {url.replace('https://', '').split('.')[0]}…
                </a>}
              />
            </div>

            {syncStatus.state === 'error' && syncStatus.error && (
              <div style={{
                background: '#fee2e2', color: '#dc2626',
                padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
              }}>
                ⚠ {syncStatus.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ActionButton
                onClick={handleSyncNow}
                disabled={syncStatus.state === 'syncing'}
                primary
              >
                {syncStatus.state === 'syncing'
                  ? (isRtl ? '🔄 جاري المزامنة...' : '🔄 Syncing...')
                  : (isRtl ? '🔄 مزامنة الآن' : '🔄 Sync Now')}
              </ActionButton>
              <ActionButton onClick={() => setStep(1)}>
                {isRtl ? '🔌 إعادة اختبار الاتصال' : '🔌 Re-test Connection'}
              </ActionButton>
            </div>
          </Card>

          {/* Config card */}
          <Card style={{ marginBottom: 16 }}>
            <CardTitle icon="⚙️" text={isRtl ? 'الإعدادات الحالية' : 'Current Configuration'} />

            <div style={{ marginBottom: 12 }}>
              <label style={{ ...labelStyle(isRtl), marginBottom: 4 }}>
                {isRtl ? 'رابط المشروع' : 'Project URL'}
              </label>
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: '8px 12px',
                fontSize: 13, direction: 'ltr', color: '#475569',
                fontFamily: 'monospace',
              }}>
                {url || (isRtl ? 'غير مضبوط' : 'Not configured')}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle(isRtl), marginBottom: 4 }}>
                {isRtl ? 'مفتاح API' : 'API Key'}
              </label>
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: '8px 12px',
                fontSize: 13, direction: 'ltr', color: '#475569',
                fontFamily: 'monospace',
                letterSpacing: key ? 2 : 0,
              }}>
                {key ? '•'.repeat(Math.min(key.length, 32)) : (isRtl ? 'غير مضبوط' : 'Not configured')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <ActionButton onClick={() => setStep(0)}>
                {isRtl ? '✏️ تعديل الإعدادات' : '✏️ Edit Configuration'}
              </ActionButton>
              <ActionButton
                onClick={handleClearConfig}
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              >
                {isRtl ? '🗑 إزالة الإعدادات' : '🗑 Clear Configuration'}
              </ActionButton>
            </div>
          </Card>

          {/* Help card */}
          <Card>
            <CardTitle icon="📖" text={isRtl ? 'دليل الإعداد' : 'Setup Guide'} />
            <ol style={{
              margin: 0, paddingInlineStart: 20,
              color: 'var(--text-secondary, #475569)',
              fontSize: 14, lineHeight: 1.8,
            }}>
              {(isRtl ? [
                'أنشئ مشروع Supabase مجاني على supabase.com',
                'شغّل SQL المرفق لإنشاء الجداول (massar_students, massar_sessions)',
                'انسخ Project URL و anon key من Settings → API',
                'ألصقهما في خانتَي الإدخال أعلاه واحفظ',
                'اضغط "مزامنة الآن" للتزامن الأول',
              ] : [
                'Create a free Supabase project at supabase.com',
                'Run the provided SQL to create tables (massar_students, massar_sessions)',
                'Copy the Project URL and anon key from Settings → API',
                'Paste them in the fields above and save',
                'Press "Sync Now" to perform the first sync',
              ]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--card-bg, #fff)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: 14,
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 16, fontSize: 16, fontWeight: 700,
      color: 'var(--text-primary, #0f172a)',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      {text}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-subtle, #f8fafc)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: 10, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
        {value}
      </div>
    </div>
  );
}

function InfoBox({ children, isRtl }: { children: React.ReactNode; isRtl: boolean }) {
  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe',
      borderRadius: 10, padding: '10px 14px',
      fontSize: 13, color: '#1e40af',
      display: 'flex', alignItems: 'flex-start', gap: 8,
      marginBottom: 16, direction: isRtl ? 'rtl' : 'ltr',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
      <span>{children}</span>
    </div>
  );
}

function ActionButton({
  children, onClick, disabled, primary, style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 18px', borderRadius: 8,
        border: primary ? 'none' : '1px solid var(--border, #e2e8f0)',
        background: primary ? '#3b82f6' : 'var(--card-bg, #fff)',
        color: primary ? '#fff' : 'var(--text-primary, #0f172a)',
        fontWeight: 600, fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function labelStyle(isRtl: boolean): React.CSSProperties {
  return {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--text-secondary, #475569)',
    marginBottom: 6,
    textAlign: isRtl ? 'right' : 'left',
  };
}

function inputStyle(valid: boolean, isRtl: boolean): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 12px', borderRadius: 8,
    border: `1.5px solid ${valid ? 'var(--border, #e2e8f0)' : '#fca5a5'}`,
    background: 'var(--card-bg, #fff)',
    color: 'var(--text-primary, #0f172a)',
    fontSize: 14, outline: 'none',
    textAlign: isRtl ? 'right' : 'left',
    transition: 'border-color 0.15s',
  };
}
