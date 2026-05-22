// ============================================================
//  مسار — DiagnosticsPanel  v5.1
//  Runtime health monitor, error log viewer, DB integrity
//  Live DB stats, storage gauge, export diagnostics
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  runDiagnostics,
  getErrorLogs,
  clearErrorLogs,
  type DiagnosticReport,
} from '@/components/ui/ErrorBoundary';
import { DBRecovery } from '@/db/database';
import { Button } from './Button';

// ─── Types ──────────────────────────────────────────────────
interface ErrorEntry {
  id: string;
  ts: number;
  type: string;
  message: string;
  stack?: string;
  context?: string;
}

type HealthStatus = 'ok' | 'warn' | 'error' | 'unknown';

interface HealthItem {
  label:   string;
  value:   string;
  status:  HealthStatus;
}

// ─── Helpers ─────────────────────────────────────────────────
function statusColor(s: HealthStatus): string {
  return s === 'ok' ? '#22c55e' : s === 'warn' ? '#f59e0b' : s === 'error' ? '#ef4444' : '#94a3b8';
}
function statusDot(s: HealthStatus): string {
  return s === 'ok' ? '🟢' : s === 'warn' ? '🟡' : s === 'error' ? '🔴' : '⚪';
}
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ar-SA', { hour12: false });
}
function typeLabel(t: string): string {
  const map: Record<string, string> = {
    render: 'واجهة', async: 'غير متزامن', unhandled: 'غير معالج',
    db: 'قاعدة البيانات', network: 'شبكة',
  };
  return map[t] ?? t;
}
function typeBg(t: string): string {
  const map: Record<string, string> = {
    render: '#3b82f620', async: '#8b5cf620', unhandled: '#ef444420',
    db: '#f59e0b20', network: '#06b6d420',
  };
  return map[t] ?? '#ffffff10';
}
function typeText(t: string): string {
  const map: Record<string, string> = {
    render: '#3b82f6', async: '#8b5cf6', unhandled: '#ef4444',
    db: '#f59e0b', network: '#06b6d4',
  };
  return map[t] ?? '#94a3b8';
}

// ─── Sub-components ──────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700,
      color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {children}
    </h4>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface, #1e293b)',
      borderRadius: '12px',
      padding: '16px 18px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Health row ──────────────────────────────────────────────
function HealthRow({ item }: { item: HealthItem }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 10px', background: '#ffffff06', borderRadius: '6px',
      fontSize: '0.82rem',
    }}>
      <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{statusDot(item.status)} {item.label}</span>
      <span style={{ fontWeight: 700, color: statusColor(item.status) }}>{item.value}</span>
    </div>
  );
}

// ─── Error entry row ─────────────────────────────────────────
function ErrorRow({ entry, onExpand, expanded }: {
  entry: ErrorEntry;
  onExpand: () => void;
  expanded: boolean;
}) {
  return (
    <div
      style={{
        background: typeBg(entry.type), borderRadius: '8px',
        padding: '10px 12px', cursor: 'pointer', fontSize: '0.8rem',
        borderRight: `3px solid ${typeText(entry.type)}`,
      }}
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onExpand()}
      aria-expanded={expanded}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: expanded ? '6px' : 0 }}>
        <span style={{
          fontWeight: 700, color: typeText(entry.type),
          fontSize: '0.72rem', background: typeBg(entry.type),
          padding: '1px 6px', borderRadius: '4px',
        }}>
          {typeLabel(entry.type)}
        </span>
        <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.72rem' }}>
          {fmtTime(entry.ts)}
          {entry.context && ` · ${entry.context}`}
        </span>
      </div>
      <div style={{ color: 'var(--text, #f1f5f9)', fontWeight: 600, lineHeight: 1.4 }}>
        {entry.message}
      </div>
      {expanded && entry.stack && (
        <pre style={{
          marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          background: '#00000030', padding: '8px', borderRadius: '6px',
          maxHeight: '120px', overflow: 'auto',
        }}>
          {entry.stack}
        </pre>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export function DiagnosticsPanel() {
  const [report,     setReport]    = useState<DiagnosticReport | null>(null);
  const [running,    setRunning]   = useState(false);
  const [errors,     setErrors]    = useState<ErrorEntry[]>([]);
  const [expanded,   setExpanded]  = useState<string | null>(null);
  const [auditIssues, setAuditIssues] = useState<string[] | null>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [autoRefresh, setAutoRefresh]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load error logs on mount
  useEffect(() => {
    setErrors(getErrorLogs() as ErrorEntry[]);
  }, []);

  // Auto-refresh toggle
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        runDiag(true);
      }, 10_000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh]);

  const runDiag = useCallback(async (silent = false) => {
    if (!silent) setRunning(true);
    try {
      const r = await runDiagnostics();
      setReport(r);
      setErrors(getErrorLogs() as ErrorEntry[]);
    } finally {
      if (!silent) setRunning(false);
    }
  }, []);

  const runAudit = useCallback(async () => {
    setAuditRunning(true);
    try {
      const issues = await DBRecovery.audit();
      setAuditIssues(issues);
    } finally {
      setAuditRunning(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    clearErrorLogs();
    setErrors([]);
    setExpanded(null);
  }, []);

  const exportReport = useCallback(() => {
    if (!report) return;
    const full = { ...report, errorLog: errors };
    const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `massar_diag_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, errors]);

  // ── Build health items from report ───────────────────────
  function buildHealth(r: DiagnosticReport): HealthItem[] {
    const items: HealthItem[] = [];

    items.push({
      label: 'الاتصال بالإنترنت',
      value: r.online ? 'متصل' : 'غير متصل',
      status: r.online ? 'ok' : 'warn',
    });

    items.push({
      label: 'IndexedDB',
      value: r.idbAvailable ? 'متاح' : 'غير متاح',
      status: r.idbAvailable ? 'ok' : 'error',
    });

    const errs = r.errorCount;
    items.push({
      label: 'الأخطاء المسجّلة',
      value: errs === 0 ? 'لا أخطاء' : `${errs} خطأ`,
      status: errs === 0 ? 'ok' : errs < 5 ? 'warn' : 'error',
    });

    if (r.memoryMB !== null) {
      items.push({
        label: 'ذاكرة JS المستخدمة',
        value: `${r.memoryMB} MB`,
        status: r.memoryMB > 200 ? 'warn' : 'ok',
      });
    }

    const swCount = r.cacheKeys.length;
    items.push({
      label: 'ذاكرة Service Worker',
      value: swCount > 0 ? `${swCount} ذاكرة تخزين` : 'لا يوجد',
      status: swCount > 0 ? 'ok' : 'warn',
    });

    const db = r.dbStats as { students?: number; sessions?: number; plans?: number; error?: string };
    if (db.error) {
      items.push({ label: 'قاعدة البيانات', value: 'خطأ في القراءة', status: 'error' });
    } else {
      items.push({ label: 'الطلاب في DB', value: String(db.students ?? '—'), status: 'ok' });
      items.push({ label: 'الجلسات في DB', value: String(db.sessions ?? '—'), status: 'ok' });
      items.push({ label: 'الخطط في DB',  value: String(db.plans ?? '—'),    status: 'ok' });
    }

    return items;
  }

  const overallStatus: HealthStatus = !report
    ? 'unknown'
    : report.errorCount > 5 || !report.idbAvailable
    ? 'error'
    : report.errorCount > 0 || !report.online
    ? 'warn'
    : 'ok';

  const overallLabel = { ok: 'سليم ✅', warn: 'تحذيرات ⚠️', error: 'مشاكل 🔴', unknown: 'لم يُفحص' }[overallStatus];

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        flexWrap: 'wrap',
      }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => runDiag()}
          disabled={running}
          aria-label="تشغيل التشخيص"
        >
          {running ? 'جارٍ...' : '🔍 فحص الآن'}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={runAudit}
          disabled={auditRunning}
          aria-label="فحص سلامة قاعدة البيانات"
        >
          {auditRunning ? 'جارٍ...' : '🩺 سلامة DB'}
        </Button>

        {report && (
          <Button variant="secondary" size="sm" onClick={exportReport} aria-label="تصدير التقرير">
            📥 تصدير
          </Button>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer',
          marginRight: 'auto',
        }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ accentColor: '#3b82f6' }}
          />
          تحديث تلقائي كل 10 ثوانٍ
        </label>

        {report && (
          <span style={{
            fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginRight: 'auto',
          }}>
            آخر فحص: {new Date(report.timestamp).toLocaleTimeString('ar-SA')}
          </span>
        )}
      </div>

      {/* ── Overall status pill ──────────────────────────── */}
      <Card style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        borderRight: `4px solid ${statusColor(overallStatus)}`,
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
          background: `${statusColor(overallStatus)}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem',
        }}>
          {overallStatus === 'ok' ? '✅' : overallStatus === 'warn' ? '⚠️' : overallStatus === 'error' ? '🔴' : '❓'}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: statusColor(overallStatus) }}>
            الحالة العامة: {overallLabel}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
            {!report
              ? 'اضغط "فحص الآن" للحصول على تقرير صحة المنصة'
              : `الإصدار ${report.version} · ${navigator.userAgent.split(' ').slice(-2).join(' ')}` }
          </div>
        </div>
      </Card>

      {/* ── Health items ─────────────────────────────────── */}
      {report && (
        <Card>
          <SectionTitle>مؤشرات الصحة</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {buildHealth(report).map((item) => (
              <HealthRow key={item.label} item={item} />
            ))}
          </div>
        </Card>
      )}

      {/* ── DB Audit ─────────────────────────────────────── */}
      {auditIssues !== null && (
        <Card style={{ borderRight: `4px solid ${auditIssues.length === 0 ? '#22c55e' : '#ef4444'}` }}>
          <SectionTitle>🩺 نتائج فحص سلامة البيانات</SectionTitle>
          {auditIssues.length === 0 ? (
            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>
              ✅ لا توجد مشاكل — البيانات سليمة
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {auditIssues.map((issue, i) => (
                <div key={i} style={{
                  padding: '8px 10px', background: '#ef444420',
                  borderRadius: '6px', fontSize: '0.82rem', color: '#ef4444', fontWeight: 600,
                }}>
                  ⚠ {issue}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Error Log ────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <SectionTitle>
            سجل الأخطاء {errors.length > 0 && (
              <span style={{
                background: errors.length > 5 ? '#ef444430' : '#f59e0b30',
                color:       errors.length > 5 ? '#ef4444'   : '#f59e0b',
                padding: '1px 7px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                marginRight: '6px',
              }}>
                {errors.length}
              </span>
            )}
          </SectionTitle>
          {errors.length > 0 && (
            <button
              onClick={clearLogs}
              style={{
                background: 'none', border: 'none', color: '#ef4444',
                fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
                fontWeight: 600,
              }}
              aria-label="مسح سجل الأخطاء"
            >
              مسح الكل
            </button>
          )}
        </div>

        {errors.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px',
            color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem',
          }}>
            🎉 سجل الأخطاء فارغ — لا مشاكل مسجّلة
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
            {[...errors].reverse().map((entry) => (
              <ErrorRow
                key={entry.id}
                entry={entry}
                expanded={expanded === entry.id}
                onExpand={() => setExpanded(expanded === entry.id ? null : entry.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── DevTools tip ─────────────────────────────────── */}
      <div style={{
        padding: '10px 14px', background: '#3b82f610', borderRadius: '8px',
        fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)',
        borderRight: '3px solid #3b82f640',
      }}>
        💡 في Console يمكن تنفيذ: <code style={{ color: '#3b82f6' }}>window.__massar_run_diag()</code>
        {'  و  '}<code style={{ color: '#3b82f6' }}>window.__massar_errors</code>
      </div>
    </div>
  );
}
