// ============================================================
//  مسار — Dashboard Screen
//  v5.0 — live stats, attention list, module avg
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SessionDB } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/hooks/useNotifications';
import type { AssessSession, PeakModule } from '@/types';

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(ts: number, lang: string): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const isAr = lang !== 'en';
  if (m < 1)  return isAr ? 'الآن'      : 'just now';
  if (m < 60) return isAr ? `${m} دقيقة` : `${m}m ago`;
  if (h < 24) return isAr ? `${h} ساعة`  : `${h}h ago`;
  return isAr ? `${d} يوم` : `${d}d ago`;
}

function pctColor(p: number): string {
  return p >= 70 ? '#22c55e' : p >= 40 ? '#f59e0b' : '#ef4444';
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon, color = '#3b82f6' }: {
  label: string; value: string | number; icon: string; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--surface, #1e293b)', borderRadius: '14px',
      padding: '18px 20px', borderTop: `3px solid ${color}`,
      flex: '1 1 150px', minWidth: '140px',
    }}>
      <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text, #f1f5f9)', lineHeight: 1, marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>{label}</div>
    </div>
  );
}

// ── Module avg ring (mini SVG) ────────────────────────────────
function ModuleRing({ mod, pct, color }: { mod: PeakModule; pct: number; color: string }) {
  const r = 22, c = 28, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ textAlign: 'center', minWidth: '56px' }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#ffffff12" strokeWidth="4" />
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="32" textAnchor="middle" fontSize="10" fontWeight="700" fill={color} fontFamily="Cairo,sans-serif">
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>{mod}</div>
    </div>
  );
}

const MODULE_COLORS: Record<PeakModule, string> = {
  DT: '#3b82f6', G: '#22c55e', CE: '#a855f7', TE: '#f59e0b',
};

// ── Main ──────────────────────────────────────────────────────
export function Dashboard() {
  const { students, setScreen, selectStudent, selectSession, lang } = useAppStore();
  const { t } = useTranslation();
  const { notifications, count: notifCount } = useNotifications();

  const [allSessions, setAllSessions]     = useState<AssessSession[]>([]);
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessions = await SessionDB.getAll();
      setAllSessions(sessions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ────────────────────────────────────────
  const recentSessions = allSessions.slice(0, 5);
  const totalSessions  = allSessions.length;

  // Overall avg across all sessions
  const overallAvg = totalSessions === 0 ? 0 : Math.round(
    allSessions.reduce((acc, s) => {
      const modAvg = s.summary?.length
        ? s.summary.reduce((a, b) => a + b.pct, 0) / s.summary.length
        : 0;
      return acc + modAvg;
    }, 0) / totalSessions
  );

  // Per-module averages (across all sessions)
  const moduleAvgs: Record<PeakModule, { sum: number; count: number }> = {
    DT: { sum: 0, count: 0 }, G: { sum: 0, count: 0 },
    CE: { sum: 0, count: 0 }, TE: { sum: 0, count: 0 },
  };
  allSessions.forEach((s) => {
    s.summary?.forEach((m) => {
      if (m.module in moduleAvgs) {
        moduleAvgs[m.module as PeakModule].sum += m.pct;
        moduleAvgs[m.module as PeakModule].count++;
      }
    });
  });

  // Students who need attention (latest session avg < 60%)
  const needsAttention = students
    .map((student) => {
      const sessions = allSessions.filter((s) => s.studentId === student.id);
      if (!sessions.length) return null;
      const latest = sessions[0];
      const avg = latest.summary?.length
        ? Math.round(latest.summary.reduce((a, b) => a + b.pct, 0) / latest.summary.length)
        : 0;
      return avg < 60 ? { student, avg, sessionId: latest.id } : null;
    })
    .filter(Boolean) as { student: (typeof students)[0]; avg: number; sessionId: string }[];

  // Weekly trend comparison
  const today = new Date();
  const startOfThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).getTime();
  const startOfLastWeek  = startOfThisWeek - 7 * 86400000;
  const thisWeekSessions = allSessions.filter((s) => s.savedAt >= startOfThisWeek);
  const lastWeekSessions = allSessions.filter((s) => s.savedAt >= startOfLastWeek && s.savedAt < startOfThisWeek);
  const weekTrend = thisWeekSessions.length - lastWeekSessions.length;

  const lastSession = recentSessions[0];

  return (
    <main
      id="main-content"
      role="main"
      className="screen-enter"
      style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text, #f1f5f9)' }}
    >
      {/* Welcome */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.35rem', fontWeight: 800 }}>
          {t('welcomeBack')} 👋
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem' }}>
          {t('tagline')}
        </p>
      </div>

      {/* First-time onboarding card */}
      {!loading && students.length === 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
          border: '1px solid #3b82f620',
          borderRadius: '18px',
          padding: '32px 28px',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '12px', lineHeight: 1 }}>🚀</div>
          <div style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--text,#f1f5f9)', marginBottom: '8px' }}>
            مرحباً بك في منصة مسار!
          </div>
          <p style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.9rem', margin: '0 0 24px', lineHeight: 1.8, maxWidth: '340px', marginInline: 'auto' }}>
            ابدأ بإضافة أول طالب لك، ثم أجرِ جلسة تقييم — وستظهر التقارير والتحليلات هنا تلقائياً.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" icon="👥" onClick={() => setScreen('students')}>
              إضافة أول طالب
            </Button>
            <Button variant="secondary" icon="📋" onClick={() => setScreen('assess')}>
              {t('startAssessment')}
            </Button>
          </div>
        </div>
      )}

      {/* Stats row */}
      {!loading && students.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }} role="region" aria-label={t('quickStats')}>
            <StatCard label={t('totalStudents')} value={students.length} icon="👥" color="#3b82f6" />
            <StatCard label={t('totalSessions')} value={totalSessions}   icon="📋" color="#f9a825" />
            <StatCard
              label={t('lastSession')}
              value={lastSession ? timeAgo(lastSession.savedAt, lang) : '—'}
              icon="🕐"
              color="#22c55e"
            />
            <StatCard
              label="متوسط النتائج"
              value={totalSessions > 0 ? `${overallAvg}%` : '—'}
              icon="📈"
              color="#a855f7"
            />
          </div>
          {/* Weekly trend bar */}
          {totalSessions > 0 && (
            <div style={{
              background: 'var(--surface, #1e293b)', borderRadius: '12px',
              padding: '10px 18px', marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, flexShrink: 0 }}>
                📅 الأسبوع الحالي
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text, #f1f5f9)', lineHeight: 1 }}>
                  {thisWeekSessions.length}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>جلسة</span>
              </div>
              <div style={{
                color: weekTrend > 0 ? '#22c55e' : weekTrend < 0 ? '#ef4444' : '#94a3b8',
                fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {weekTrend > 0 ? `↑ +${weekTrend}` : weekTrend < 0 ? `↓ ${weekTrend}` : '= '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted, #94a3b8)' }}>
                  مقارنة بالأسبوع الماضي ({lastWeekSessions.length})
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Module averages (only if data exists) */}
      {totalSessions > 0 && (
        <div style={{
          background: 'var(--surface, #1e293b)', borderRadius: '14px',
          padding: '16px 20px', marginBottom: '24px',
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, marginBottom: '14px' }}>
            متوسط أداء الوحدات (جميع الجلسات)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '8px' }}>
            {(['DT', 'G', 'CE', 'TE'] as PeakModule[]).map((mod) => {
              const d = moduleAvgs[mod];
              const avg = d.count > 0 ? Math.round(d.sum / d.count) : 0;
              return <ModuleRing key={mod} mod={mod} pct={avg} color={MODULE_COLORS[mod]} />;
            })}
          </div>
        </div>
      )}

      {/* ── Smart Notifications Panel ─────────────────────── */}
      {notifCount > 0 && (
        <section style={{ marginBottom: '24px' }} aria-label="التنبيهات الذكية">
          <h3 style={{
            margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '8px',
            color: 'var(--text, #f1f5f9)',
          }}>
            🔔 التنبيهات الذكية
            <span style={{
              background: notifications.some(n => n.severity === 'high') ? '#ef444422' : '#f59e0b22',
              color: notifications.some(n => n.severity === 'high') ? '#ef4444' : '#f59e0b',
              borderRadius: '6px', padding: '1px 8px', fontSize: '0.78rem', fontWeight: 800,
            }}>
              {notifCount}
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {notifications.slice(0, 6).map((notif: AppNotification) => {
              const sevColor = notif.severity === 'high' ? '#ef4444'
                : notif.severity === 'medium' ? '#f59e0b' : '#3b82f6';
              const sevBg = notif.severity === 'high' ? '#ef444412'
                : notif.severity === 'medium' ? '#f59e0b12' : '#3b82f612';
              const sevIcon = notif.severity === 'high' ? '🔴' : notif.severity === 'medium' ? '🟡' : '🔵';
              return (
                <div key={notif.id} style={{
                  background: sevBg,
                  border: `1px solid ${sevColor}33`,
                  borderRight: `3px solid ${sevColor}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{sevIcon}</span>
                  <span style={{ flex: 1, fontSize: '0.84rem', color: 'var(--text, #f1f5f9)', lineHeight: 1.5 }}>
                    {notif.message}
                  </span>
                  <button
                    onClick={() => {
                      if (notif.studentId) selectStudent(notif.studentId);
                      setScreen(notif.actionScreen as any);
                    }}
                    style={{
                      background: sevColor + '22',
                      color: sevColor,
                      border: `1px solid ${sevColor}44`,
                      borderRadius: '7px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {notif.actionScreen === 'assess' ? '📋 تقييم' : notif.actionScreen === 'plan' ? '🎯 خطة' : '📊 تقارير'}
                  </button>
                </div>
              );
            })}
            {notifCount > 6 && (
              <div style={{
                textAlign: 'center', fontSize: '0.78rem',
                color: 'var(--text-muted, #94a3b8)', padding: '4px',
              }}>
                و {notifCount - 6} تنبيه آخر…
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Button variant="primary"    icon="📋" onClick={() => setScreen('assess')}>   {t('startAssessment')}</Button>
        <Button variant="secondary"  icon="👥" onClick={() => setScreen('students')}> {t('addStudent')}</Button>
        <Button variant="secondary"  icon="📊" onClick={() => setScreen('reports')}>  {t('reports')}</Button>
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠ طلاب يحتاجون اهتماماً ({needsAttention.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {needsAttention.slice(0, 4).map(({ student, avg }) => (
              <div key={student.id} style={{
                background: 'var(--surface, #1e293b)', borderRadius: '10px',
                padding: '12px 16px', display: 'flex', alignItems: 'center',
                gap: '12px', borderRight: '3px solid #f59e0b',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: '#f59e0b22', color: '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, flexShrink: 0,
                }}>
                  {student.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{student.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>متوسط: {avg}%</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { selectStudent(student.id); setScreen('plans'); }}
                  title="عرض خطة الطالب"
                >
                  🎯
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { selectStudent(student.id); setScreen('assess'); }}
                >
                  تقييم
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent sessions */}
      <section aria-label={t('recentSessions')}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>
          📊 {t('recentSessions')}
        </h3>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                background: 'var(--surface, #1e293b)', borderRadius: '12px',
                padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <div className="skeleton" style={{ height: '14px', width: `${50 + i * 12}%`, borderRadius: '5px' }} />
                  <div className="skeleton" style={{ height: '11px', width: `${30 + i * 8}%`, borderRadius: '5px' }} />
                </div>
                <div className="skeleton" style={{ width: '48px', height: '24px', borderRadius: '6px', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px',
            background: 'var(--surface, #1e293b)', borderRadius: '14px',
            color: 'var(--text-muted, #94a3b8)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
            <p style={{ margin: '0 0 14px' }}>{t('noReports')}</p>
            <Button variant="primary" size="sm" onClick={() => setScreen('assess')}>
              {t('startAssessment')}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentSessions.map((session) => {
              const student = students.find((s) => s.id === session.studentId);
              const avgPct  = session.summary?.length
                ? Math.round(session.summary.reduce((a, b) => a + b.pct, 0) / session.summary.length)
                : 0;
              const color = pctColor(avgPct);

              return (
                <div
                  key={session.id}
                  style={{
                    background: 'var(--surface, #1e293b)', borderRadius: '12px',
                    padding: '13px 16px', display: 'flex', alignItems: 'center',
                    gap: '12px', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onClick={() => {
                    if (student) { selectStudent(student.id); selectSession(session.id); setScreen('report-detail'); }
                  }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && student) {
                      e.preventDefault();
                      selectStudent(student.id); selectSession(session.id); setScreen('report-detail');
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2, #263247)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface, #1e293b)')}
                  aria-label={`جلسة ${student?.name ?? 'طالب'} — ${timeAgo(session.savedAt, lang)}`}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: color + '22', color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.95rem', fontWeight: 800, flexShrink: 0,
                  }}>
                    {student?.name?.charAt(0) ?? '?'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {student?.name ?? 'طالب غير معروف'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                      {timeAgo(session.savedAt, lang)}
                      {session.summary && ` · ${session.summary.reduce((a, b) => a + b.total, 0)} بند`}
                    </div>
                  </div>

                  {/* Module dots */}
                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                    {(['DT','G','CE','TE'] as PeakModule[]).map((mod) => {
                      const s = session.summary?.find((x) => x.module === mod);
                      const p = s?.pct ?? 0;
                      return (
                        <div key={mod} title={`${mod}: ${p}%`} style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: pctColor(p), opacity: s ? 1 : 0.2,
                        }} />
                      );
                    })}
                  </div>

                  {/* Score badge */}
                  <div style={{
                    background: color + '22', color,
                    borderRadius: '8px', padding: '3px 10px',
                    fontSize: '0.83rem', fontWeight: 700, flexShrink: 0,
                  }}>
                    {avgPct}%
                  </div>

                  {/* Quick-access buttons */}
                  {student && (
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                      {/* View Report */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectStudent(student.id); selectSession(session.id); setScreen('report-detail');
                        }}
                        title="عرض التقرير"
                        style={{
                          background: 'transparent', border: '1px solid var(--border, #334155)',
                          borderRadius: '6px', padding: '4px 9px', cursor: 'pointer',
                          color: 'var(--text-muted, #94a3b8)', fontSize: '0.72rem',
                          fontFamily: 'Cairo, sans-serif', minHeight: '28px', flexShrink: 0,
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.color = '#a855f7'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #334155)'; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
                      >
                        📄 تقرير
                      </button>
                      {/* New Assessment */}
                      <button
                        onClick={(e) => { e.stopPropagation(); selectStudent(student.id); setScreen('assess'); }}
                        title={`تقييم جديد لـ ${student.name}`}
                        style={{
                          background: 'transparent', border: '1px solid var(--border, #334155)',
                          borderRadius: '6px', padding: '4px 9px', cursor: 'pointer',
                          color: 'var(--text-muted, #94a3b8)', fontSize: '0.72rem',
                          fontFamily: 'Cairo, sans-serif', minHeight: '28px', flexShrink: 0,
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#22c55e'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #334155)'; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
                      >
                        ✦ تقييم
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {allSessions.length > 5 && (
              <button
                onClick={() => setScreen('reports')}
                style={{
                  background: 'transparent', border: '1px dashed var(--border, #334155)',
                  borderRadius: '10px', padding: '10px', color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '0.82rem',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '6px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #334155)'; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
              >
                <span>عرض جميع الجلسات</span>
                <span style={{ background: 'var(--surface-2,#263247)', borderRadius: '6px', padding: '1px 7px', fontSize: '0.78rem' }}>
                  {allSessions.length}
                </span>
                <span>←</span>
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
