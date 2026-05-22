// ============================================================
//  مسار — Tools Screen
//  v5.2 — DB stats, storage, backup/restore, diagnostics
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { openDB, StudentDB, SessionDB, PlanDB } from '@/db/database';
import { AssessService } from '@/services/AssessService';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { BackupManager } from '@/components/ui/BackupManager';
import { DiagnosticsPanel } from '@/components/ui/DiagnosticsPanel';
import { HelpButton } from '@/components/ui/QuickTipsModal';
import { useOnboardingReset } from '@/components/ui/OnboardingWalkthrough';

interface DBStats {
  students: number;
  sessions: number;
  plans: number;
  storageUsed: string;
  storageQuota: string;
  storagePercent: number;
}

interface HealthResult {
  issues: string[];
  score: number;
}

// ── Stat card ────────────────────────────────────────────
function StatCard({ icon, value, label, color }: {
  icon: string; value: string | number; label: string; color: string;
}) {
  return (
    <div style={{
      background: 'var(--surface, #1e293b)', borderRadius: '12px',
      padding: '18px', textAlign: 'center', borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

// ── Tool action row ──────────────────────────────────────────
function ToolRow({ icon, title, desc, action, danger = false, disabled = false }: {
  icon: string; title: string; desc: string;
  action: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '16px 18px', background: 'var(--surface, #1e293b)',
      borderRadius: '12px',
    }}>
      <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>{desc}</div>
      </div>
      <Button
        variant={danger ? 'danger' : 'secondary'}
        size="sm"
        onClick={action}
        disabled={disabled}
      >
        تنفيذ
      </Button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function Tools() {
  const { addToast } = useAppStore();
  const resetOnboarding = useOnboardingReset();
  const { t } = useTranslation();
  const [stats, setStats]             = useState<DBStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showClearDB, setShowClearDB] = useState(false);
  const [showClearSessions, setShowClearSessions] = useState(false);
  const [showClearCache, setShowClearCache]       = useState(false);
  const [health, setHealth]           = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [studentCount, sessions, plans] = await Promise.all([
        StudentDB.count(),
        SessionDB.getAll(),
        (async () => {
          const all = await StudentDB.getAll();
          let total = 0;
          for (const s of all) {
            const p = await PlanDB.getByStudentId(s.id);
            total += p.length;
          }
          return total;
        })(),
      ]);

      let storageUsed = '—', storageQuota = '—', storagePercent = 0;
      if ('storage' in navigator && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const used  = est.usage  ?? 0;
        const quota = est.quota  ?? 0;
        storageUsed  = used  < 1e6 ? `${Math.round(used / 1024)} KB`  : `${(used / 1e6).toFixed(1)} MB`;
        storageQuota = quota < 1e9 ? `${Math.round(quota / 1e6)} MB`  : `${(quota / 1e9).toFixed(1)} GB`;
        storagePercent = quota > 0 ? Math.round((used / quota) * 100) : 0;
      }

      setStats({ students: studentCount, sessions: sessions.length, plans, storageUsed, storageQuota, storagePercent });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function clearAllSessions() {
    const db = await openDB();
    const store = db.transaction('sessions', 'readwrite').objectStore('sessions');
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const sessions = allReq.result as Array<Record<string, unknown>>;
      for (const s of sessions) {
        store.put({ ...s, deletedAt: Date.now(), updatedAt: Date.now() });
      }
    };
    await loadStats();
    addToast('تم مسح جميع الجلسات', 'success');
    setShowClearSessions(false);
  }

  async function clearAllDB() {
    const storeNames = ['students', 'sessions', 'plans', 'syncMeta'];
    const db = await openDB();
    for (const name of storeNames) {
      try {
        await new Promise<void>((res, rej) => {
          const req = db.transaction(name, 'readwrite').objectStore(name).clear();
          req.onsuccess = () => res();
          req.onerror   = () => rej(req.error);
        });
      } catch {/* store may not exist */}
    }
    await loadStats();
    addToast('تم مسح قاعدة البيانات بالكامل', 'success');
    setShowClearDB(false);
  }

  async function clearServiceWorkerCache() {
    if (!('caches' in window)) {
      addToast('المتصفح لا يدعم Cache API', 'warning');
      return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    addToast(`تم مسح ${keys.length} ذاكرة تخزين مؤقت`, 'success');
    setShowClearCache(false);
  }

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const result = await AssessService.healthCheck();
      setHealth(result);
    } finally {
      setHealthLoading(false);
    }
  }

  async function archiveSessions() {
    const count = await AssessService.archiveOldSessions(180);
    await loadStats();
    addToast(count > 0 ? `تم أرشفة ${count} جلسة قديمة` : 'لا توجد جلسات تستوجب الأرشفة', 'success');
  }

  async function vacuumSessions() {
    const count = await AssessService.vacuumDeletedSessions(30);
    await loadStats();
    addToast(count > 0 ? `تم حذف ${count} سجل نهائياً` : 'لا توجد سجلات تستوجب التنظيف', 'success');
  }

  async function exportDiagnostic() {
    const [students, sessions] = await Promise.all([StudentDB.getAll(), SessionDB.getAll()]);
    const report = {
      generatedAt: new Date().toISOString(), version: 'v5.2.0',
      platform: navigator.userAgent,
      storage: { used: stats?.storageUsed, quota: stats?.storageQuota },
      counts:  { students: stats?.students, sessions: stats?.sessions, plans: stats?.plans },
      students: students.map((s) => ({ id: s.id, name: s.name, createdAt: s.createdAt })),
      sessionSummary: sessions.map((s) => ({
        id: s.id, studentId: s.studentId, savedAt: s.savedAt,
        modules: s.summary?.map((m) => ({ module: m.module, pct: m.pct })),
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `massar_diagnostic_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    addToast('تم تصدير تقرير التشخيص', 'success');
  }

  return (
    <main
      id="main-content"
      role="main"
      style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text, #f1f5f9)' }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800 }}>🔧 {t('tools')}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
            إدارة قاعدة البيانات، النسخ الاحتياطي، والتشخيص
          </p>
        </div>
        <HelpButton />
      </div>

      {/* Backup */}
      <section aria-labelledby="backup-heading" style={{ marginBottom: '32px' }}>
        <h3 id="backup-heading" style={{ margin: '0 0 14px', fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
          💾 النسخ الاحتياطي والاسترجاع
        </h3>
        <BackupManager />
      </section>

      {/* DB Stats */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted, #94a3b8)' }}>
          جارٍ تحميل الإحصائيات...
        </div>
      ) : stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatCard icon="👥" value={stats.students} label="طلاب" color="#3b82f6" />
            <StatCard icon="📋" value={stats.sessions} label="جلسات" color="#22c55e" />
            <StatCard icon="🎯" value={stats.plans}    label="خطط"   color="#f59e0b" />
            <StatCard icon="💾" value={stats.storageUsed} label={`من ${stats.storageQuota}`} color="#a855f7" />
          </div>
          <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '12px', padding: '16px 18px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 700 }}>مساحة التخزين المستخدمة</span>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{stats.storagePercent}%</span>
            </div>
            <div style={{ height: '8px', background: '#ffffff12', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${Math.min(stats.storagePercent, 100)}%`,
                background: stats.storagePercent > 80 ? '#ef4444' : stats.storagePercent > 50 ? '#f59e0b' : '#22c55e',
                transition: 'width 0.5s',
              }} />
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
              {stats.storageUsed} مستخدم من {stats.storageQuota} متاح
            </div>
          </div>
        </>
      )}

      {/* DB Health Check */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
            🩺 صحة قاعدة البيانات
          </h3>
          <Button variant="secondary" size="sm" onClick={runHealthCheck} disabled={healthLoading}>
            {healthLoading ? 'جارٍ الفحص...' : 'فحص الآن'}
          </Button>
        </div>
        {health && (
          <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '12px', padding: '16px 18px' }}>
            {/* Score gauge */}
            <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'12px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                background: health.score >= 80 ? '#22c55e18' : health.score >= 50 ? '#f59e0b18' : '#ef444418',
                border: `3px solid ${health.score >= 80 ? '#22c55e' : health.score >= 50 ? '#f59e0b' : '#ef4444'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', fontWeight: 900,
                color: health.score >= 80 ? '#22c55e' : health.score >= 50 ? '#f59e0b' : '#ef4444',
              }}>
                {health.score}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {health.score >= 80 ? '✅ قاعدة البيانات بصحة جيدة' :
                   health.score >= 50 ? '⚠️ تحتاج بعض الانتباه' : '❌ تحتاج صيانة'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                  {health.issues.length === 0 ? 'لا مشاكل مكتشفة' : `${health.issues.length} مشكلة مكتشفة`}
                </div>
              </div>
            </div>
            {health.issues.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {health.issues.map((issue, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', fontSize:'0.8rem', color:'#fbbf24', background:'#f59e0b08', padding:'8px 10px', borderRadius:'8px' }}>
                    <span>⚠</span><span>{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Maintenance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
          🔧 أدوات الصيانة
        </h3>
        <ToolRow icon="🔄" title="تحديث الإحصائيات" desc="إعادة تحميل إحصائيات قاعدة البيانات والتخزين" action={loadStats} />
        <ToolRow icon="📦" title="أرشفة الجلسات القديمة" desc="نقل الجلسات الأقدم من 6 أشهر إلى الأرشيف (لا يُحذف شيء)" action={archiveSessions} />
        <ToolRow icon="🧹" title="تنظيف السجلات المحذوفة" desc="حذف نهائي للسجلات التي تجاوز حذفها 30 يوماً" action={vacuumSessions} />
        <ToolRow icon="🩺" title="تصدير تقرير التشخيص" desc="ملف JSON يحتوي على معلومات المنصة والإحصائيات" action={exportDiagnostic} />
        <ToolRow icon="🗑️" title="مسح ذاكرة التخزين المؤقت" desc="حذف ذاكرة Service Worker — سيُعاد التحميل من الخادم" action={() => setShowClearCache(true)} />
        <ToolRow icon="🎓" title="إعادة الجولة التعريفية" desc="عرض جولة الترحيب من البداية للمختصين الجدد" action={resetOnboarding} />
      </div>

      {/* Danger zone */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#ef4444', fontWeight: 700 }}>
          ⚠ منطقة الخطر
        </h3>
        <ToolRow icon="🗑️" title="مسح جميع الجلسات" desc="حذف كل جلسات التقييم — لا يمكن التراجع" action={() => setShowClearSessions(true)} danger />
        <ToolRow icon="💥" title="مسح قاعدة البيانات كاملاً" desc="حذف جميع الطلاب والجلسات والخطط — لا يمكن التراجع" action={() => setShowClearDB(true)} danger />
      </div>

      {/* Diagnostics Panel (full) */}
      <section aria-labelledby="diag-heading" style={{ marginBottom: '28px' }}>
        <h3 id="diag-heading" style={{ margin: '0 0 14px', fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
          🔬 التشخيص والمراقبة
        </h3>
        <DiagnosticsPanel />
      </section>

      {/* Version */}
      <div style={{
        padding: '14px 18px', background: 'var(--surface, #1e293b)',
        borderRadius: '12px', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
      }}>
        <span>مسار — منصة تقييم PEAK</span>
        <span>v5.2.0 · React + TypeScript + Vite</span>
        <span>قاعدة البيانات: IndexedDB v4</span>
      </div>

      {/* Dialogs */}
      <ConfirmDialog open={showClearSessions}
        message="هل أنت متأكد من مسح جميع الجلسات؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="مسح الجلسات" cancelLabel="إلغاء"
        onConfirm={clearAllSessions} onCancel={() => setShowClearSessions(false)} />
      <ConfirmDialog open={showClearDB}
        message="سيتم حذف جميع البيانات (الطلاب والجلسات والخطط). هذا الإجراء لا يمكن التراجع عنه."
        confirmLabel="مسح الكل" cancelLabel="إلغاء"
        onConfirm={clearAllDB} onCancel={() => setShowClearDB(false)} />
      <ConfirmDialog open={showClearCache}
        message="سيتم مسح ذاكرة التخزين المؤقت للـ Service Worker. يُنصح بإعادة تحميل الصفحة بعد ذلك."
        confirmLabel="مسح الذاكرة" cancelLabel="إلغاء"
        onConfirm={clearServiceWorkerCache} onCancel={() => setShowClearCache(false)} />
    </main>
  );
}
