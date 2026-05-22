// ============================================================
//  مسار SaaS — Analytics Screen  v2.0
//  v2.0: avg session duration · sessions/day · storage health
//        failed-save counter · operational metrics panel
// ============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SessionDB } from '@/db/database';
import { AssessService } from '@/services/AssessService';
import { FeatureGuard } from '@/components/ui/RoleGuard';
import { Button } from '@/components/ui/Button';
import type { AssessSession } from '@/types';
import type { PeakModule } from '@/types';

// ─── Mini SVG Bar Chart ──────────────────────────────────────
function BarChart({
  data,
  color = '#3b82f6',
  height = 120,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.floor(100 / data.length);
  return (
    <svg
      width="100%"
      height={height + 24}
      viewBox={`0 0 100 ${height + 24}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="رسم بياني"
    >
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * height, 2);
        const x = i * barWidth + barWidth * 0.15;
        const w = barWidth * 0.7;
        const y = height - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={barH} fill={color} rx="1" opacity="0.85" />
            <text
              x={x + w / 2}
              y={height + 14}
              textAnchor="middle"
              fontSize="5"
              fill="var(--text-muted, #94a3b8)"
              fontFamily="Cairo, sans-serif"
            >
              {d.label}
            </text>
            <title>{`${d.label}: ${d.value}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Line Sparkline ──────────────────────────────────────────
function Sparkline({
  values,
  color = '#22c55e',
  height = 60,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ');
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="مؤشر التقدم"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${points} ${w},${height}`}
        fill={`${color}20`}
        stroke="none"
      />
    </svg>
  );
}

// ─── Stats Card ──────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  color = '#3b82f6',
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color?: string;
  trend?: number[];
}) {
  return (
    <div
      style={{
        background: 'var(--surface, #1e293b)',
        borderRadius: '14px',
        padding: '18px 20px',
        borderTop: `3px solid ${color}`,
        flex: '1 1 160px',
        minWidth: '150px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        {trend && trend.length > 1 && (
          <div style={{ width: '60px', height: '30px' }}>
            <Sparkline values={trend} color={color} height={30} />
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: '1.9rem',
          fontWeight: 900,
          color: 'var(--text, #f1f5f9)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.82rem',
          color: 'var(--text-muted, #94a3b8)',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: '0.72rem',
            color,
            marginTop: '2px',
            fontWeight: 600,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Module Performance Bar ───────────────────────────────────
const MODULE_COLORS: Record<PeakModule, string> = {
  DT: '#3b82f6',
  G: '#8b5cf6',
  CE: '#22c55e',
  TE: '#f59e0b',
};
const MODULE_NAMES: Record<PeakModule, string> = {
  DT: 'DT — التمييز',
  G: 'G — التعميم',
  CE: 'CE — التكافؤ',
  TE: 'TE — التحويل',
};

function ModuleBar({ module, pct }: { module: PeakModule; pct: number }) {
  const color = MODULE_COLORS[module];
  return (
    <div style={{ marginBottom: '14px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '5px',
          fontSize: '0.83rem',
        }}
      >
        <span style={{ color: 'var(--text, #f1f5f9)', fontWeight: 600 }}>
          {MODULE_NAMES[module]}
        </span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${MODULE_NAMES[module]}: ${pct}%`}
        style={{
          height: '8px',
          borderRadius: '4px',
          background: 'var(--border, #334155)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: '4px',
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  );
}

// ─── Storage Gauge ────────────────────────────────────────────
function StorageGauge({ usedPct }: { usedPct: number }) {
  const color =
    usedPct >= 80 ? '#ef4444' : usedPct >= 60 ? '#f59e0b' : '#22c55e';
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - usedPct / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <svg width="90" height="90" viewBox="0 0 90 90" role="img" aria-label={`استخدام التخزين: ${usedPct}%`}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--border,#334155)" strokeWidth="8" />
        <circle
          cx="45"
          cy="45"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text
          x="45"
          y="50"
          textAnchor="middle"
          fontSize="14"
          fontWeight="900"
          fill={color}
          fontFamily="Cairo, sans-serif"
        >
          {usedPct}%
        </text>
      </svg>
      <div>
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text,#f1f5f9)',
            marginBottom: '4px',
          }}
        >
          استخدام التخزين
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color:
              usedPct >= 80
                ? '#ef4444'
                : usedPct >= 60
                ? '#f59e0b'
                : 'var(--text-muted,#94a3b8)',
          }}
        >
          {usedPct >= 80
            ? '⚠️ يُنصح بتصدير نسخة احتياطية'
            : usedPct >= 60
            ? 'متوسط — راقب الحجم'
            : '✅ جيد'}
        </div>
      </div>
    </div>
  );
}

// ─── Duration Formatter ───────────────────────────────────────
function fmtDuration(secs: number): string {
  if (secs <= 0) return '—';
  if (secs < 60) return `${secs}ث`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}د ${s}ث` : `${m} دقيقة`;
}

// ─── Analytics Screen ─────────────────────────────────────────
export function Analytics() {
  const { students } = useAppStore();
  const { profile } = useAuthStore();
  const { t } = useTranslation();

  const [sessions, setSessions] = useState<AssessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [storageUsedPct, setStorageUsedPct] = useState(0);
  const [failedSaves, setFailedSaves] = useState(0);

  useEffect(() => {
    Promise.all([SessionDB.getAll()]).then(([s]) => {
      setSessions(s);
      setLoading(false);
    });

    // Storage estimate
    if ('storage' in navigator && navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        const pct = est.quota
          ? Math.round(((est.usage ?? 0) / est.quota) * 100)
          : 0;
        setStorageUsedPct(pct);
      });
    }

    // Failed saves counter
    setFailedSaves(AssessService.getFailedSaves());
  }, []);

  // ── Computed stats ──────────────────────────────────────────
  const {
    filtered,
    moduleStats,
    weeklyTrend,
    topStudents,
    avgDurationSecs,
    sessionsPerDay,
    dailySessionCounts,
  } = useMemo(() => {
    const now = Date.now();
    const periodDays =
      period === 'week' ? 7 : period === 'month' ? 30 : null;
    const cutoff = periodDays ? now - periodDays * 86400000 : 0;

    const filtered = sessions.filter((s) => s.savedAt >= cutoff);

    // Module avg pct
    const moduleStats: Record<PeakModule, number[]> = {
      DT: [],
      G: [],
      CE: [],
      TE: [],
    };
    filtered.forEach((s) => {
      s.summary?.forEach((sm) => {
        moduleStats[sm.module]?.push(sm.pct);
      });
    });

    // Weekly trend (last 7 days, avg pct per day)
    const weeklyTrend: number[] = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * 86400000;
      const dayEnd = dayStart + 86400000;
      const daySessions = sessions.filter(
        (s) => s.savedAt >= dayStart && s.savedAt < dayEnd
      );
      if (!daySessions.length) return 0;
      const avg =
        daySessions.reduce((acc, s) => {
          const sp = s.summary?.reduce((a, b) => a + b.pct, 0) ?? 0;
          return acc + sp / (s.summary?.length || 1);
        }, 0) / daySessions.length;
      return Math.round(avg);
    });

    // Daily session counts for bar chart (7 days)
    const dailySessionCounts = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * 86400000;
      const dayEnd = dayStart + 86400000;
      const count = sessions.filter(
        (s) => s.savedAt >= dayStart && s.savedAt < dayEnd
      ).length;
      const d = new Date(dayStart);
      return {
        label: d.toLocaleDateString('ar-SA', { weekday: 'short' }),
        value: count,
      };
    });

    // Top performing students
    const studentMap: Record<
      string,
      { name: string; sessions: number; avgPct: number }
    > = {};
    filtered.forEach((s) => {
      const stu = students.find((st) => st.id === s.studentId);
      if (!stu) return;
      const avgPct = s.summary?.length
        ? Math.round(
            s.summary.reduce((a, b) => a + b.pct, 0) / s.summary.length
          )
        : 0;
      if (!studentMap[s.studentId]) {
        studentMap[s.studentId] = { name: stu.name, sessions: 0, avgPct: 0 };
      }
      studentMap[s.studentId].sessions++;
      studentMap[s.studentId].avgPct = Math.round(
        (studentMap[s.studentId].avgPct *
          (studentMap[s.studentId].sessions - 1) +
          avgPct) /
          studentMap[s.studentId].sessions
      );
    });
    const topStudents = Object.values(studentMap)
      .sort((a, b) => b.avgPct - a.avgPct)
      .slice(0, 5);

    // ── متوسط مدة الجلسة (بالثواني) ──────────────────────
    const withDuration = filtered.filter(
      (s) => typeof s.duration === 'number' && s.duration > 0
    );
    const avgDurationSecs =
      withDuration.length > 0
        ? Math.round(
            withDuration.reduce((a, s) => a + (s.duration ?? 0), 0) /
              withDuration.length
          )
        : 0;

    // ── معدل الجلسات يومياً ────────────────────────────────
    const days = periodDays ?? 1;
    const sessionsPerDay =
      filtered.length > 0 ? +(filtered.length / days).toFixed(1) : 0;

    return {
      filtered,
      moduleStats,
      weeklyTrend,
      topStudents,
      avgDurationSecs,
      sessionsPerDay,
      dailySessionCounts,
    };
  }, [sessions, students, period]);

  const avgOverall = filtered.length
    ? Math.round(
        filtered.reduce((acc, s) => {
          const sp = s.summary?.reduce((a, b) => a + b.pct, 0) ?? 0;
          return acc + sp / (s.summary?.length || 1);
        }, 0) / filtered.length
      )
    : 0;

  const moduleAvg = (mod: PeakModule) => {
    const arr = moduleStats[mod];
    return arr.length ? Math.round(arr.reduce((a, b) => a + b) / arr.length) : 0;
  };

  const bestModule = (['DT', 'G', 'CE', 'TE'] as PeakModule[]).reduce(
    (best, mod) => (moduleAvg(mod) > moduleAvg(best) ? mod : best),
    'DT' as PeakModule
  );

  return (
    <main
      id="main-content"
      role="main"
      aria-label="لوحة التحليلات"
      style={{
        padding: '24px',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
        color: 'var(--text, #f1f5f9)',
      }}
    >
      <FeatureGuard feature="analytics">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800 }}>
              📊 لوحة التحليلات
            </h2>
            <p
              style={{
                margin: 0,
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.85rem',
              }}
            >
              {profile?.fullName ?? 'المركز'} — إجمالي {filtered.length} جلسة
            </p>
          </div>
          {/* Period selector */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: 'var(--surface, #1e293b)',
              padding: '4px',
              borderRadius: '10px',
            }}
          >
            {(['week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    period === p ? 'var(--blue, #3b82f6)' : 'transparent',
                  color:
                    period === p ? '#fff' : 'var(--text-muted, #94a3b8)',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: '0.82rem',
                  fontWeight: period === p ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {p === 'week' ? 'أسبوع' : p === 'month' ? 'شهر' : 'الكل'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            ⟳ {t('loading')}
          </div>
        ) : (
          <>
            {/* ── Top stats row ────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                marginBottom: '24px',
              }}
              role="region"
              aria-label="الإحصائيات العامة"
            >
              <StatCard
                label="إجمالي الطلاب"
                value={students.length}
                icon="👥"
                color="#3b82f6"
              />
              <StatCard
                label="الجلسات"
                value={filtered.length}
                icon="📋"
                color="#8b5cf6"
                trend={weeklyTrend}
              />
              <StatCard
                label="متوسط النجاح"
                value={`${avgOverall}%`}
                icon="📈"
                color={
                  avgOverall >= 70
                    ? '#22c55e'
                    : avgOverall >= 50
                    ? '#f59e0b'
                    : '#ef4444'
                }
                trend={weeklyTrend}
              />
              <StatCard
                label="أعلى وحدة أداءً"
                value={bestModule}
                icon="🏆"
                color="#f9a825"
              />
            </div>

            {/* ── Operational metrics row ──────────────────────── */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                marginBottom: '24px',
              }}
              role="region"
              aria-label="المقاييس التشغيلية"
            >
              {/* متوسط مدة الجلسة */}
              <StatCard
                label="متوسط مدة الجلسة"
                value={avgDurationSecs > 0 ? fmtDuration(avgDurationSecs) : '—'}
                sub={avgDurationSecs > 0 ? `${avgDurationSecs} ثانية` : 'لا توجد بيانات بعد'}
                icon="⏱"
                color="#06b6d4"
              />
              {/* معدل الجلسات */}
              <StatCard
                label="معدل الجلسات / يوم"
                value={sessionsPerDay}
                sub={
                  period === 'week'
                    ? 'خلال الأسبوع'
                    : period === 'month'
                    ? 'خلال الشهر'
                    : 'الكل'
                }
                icon="📅"
                color="#a855f7"
              />
              {/* محاولات الحفظ الفاشلة */}
              <StatCard
                label="أخطاء الحفظ"
                value={failedSaves}
                sub={
                  failedSaves === 0
                    ? '✅ لا توجد أخطاء'
                    : failedSaves < 3
                    ? '⚠️ مراقبة مطلوبة'
                    : '🔴 تحقق من التخزين'
                }
                icon="💾"
                color={
                  failedSaves === 0
                    ? '#22c55e'
                    : failedSaves < 3
                    ? '#f59e0b'
                    : '#ef4444'
                }
              />
              {/* إنتاجية المركز */}
              <StatCard
                label="إنتاجية المركز"
                value={
                  filtered.length === 0
                    ? '—'
                    : filtered.length >= 20
                    ? 'مرتفعة'
                    : filtered.length >= 8
                    ? 'متوسطة'
                    : 'منخفضة'
                }
                sub={
                  filtered.length >= 20
                    ? `${filtered.length} جلسة في الفترة`
                    : undefined
                }
                icon="⚡"
                color={
                  filtered.length >= 20
                    ? '#22c55e'
                    : filtered.length >= 8
                    ? '#f59e0b'
                    : '#94a3b8'
                }
              />
            </div>

            {/* ── 2-col grid ───────────────────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              {/* Module performance */}
              <section
                aria-label="أداء الوحدات"
                style={{
                  background: 'var(--surface, #1e293b)',
                  borderRadius: '14px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 16px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  🎯 أداء الوحدات
                </h3>
                {(['DT', 'G', 'CE', 'TE'] as PeakModule[]).map((mod) => (
                  <ModuleBar key={mod} module={mod} pct={moduleAvg(mod)} />
                ))}
              </section>

              {/* Daily sessions bar chart */}
              <section
                aria-label="الجلسات اليومية"
                style={{
                  background: 'var(--surface, #1e293b)',
                  borderRadius: '14px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  📅 الجلسات اليومية (7 أيام)
                </h3>
                <p
                  style={{
                    margin: '0 0 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  إجمالي:{' '}
                  {dailySessionCounts.reduce((a, d) => a + d.value, 0)} جلسة
                </p>
                <BarChart
                  data={dailySessionCounts}
                  color="#3b82f6"
                  height={100}
                />
              </section>

              {/* Top students */}
              <section
                aria-label="أفضل الطلاب أداءً"
                style={{
                  background: 'var(--surface, #1e293b)',
                  borderRadius: '14px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 16px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  🌟 أفضل الطلاب أداءً
                </h3>
                {topStudents.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--text-muted, #94a3b8)',
                      fontSize: '0.85rem',
                    }}
                  >
                    لا توجد بيانات كافية
                  </p>
                ) : (
                  topStudents.map((s, i) => (
                    <div
                      key={s.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background:
                            i === 0
                              ? '#f9a825'
                              : i === 1
                              ? '#94a3b8'
                              : '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#000',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        {s.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: s.avgPct >= 70 ? '#22c55e' : '#f59e0b',
                          fontWeight: 700,
                        }}
                      >
                        {s.avgPct}%
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {s.sessions} جلسة
                      </span>
                    </div>
                  ))
                )}
              </section>

              {/* Weekly performance trend */}
              <section
                aria-label="مؤشر الأداء الأسبوعي"
                style={{
                  background: 'var(--surface, #1e293b)',
                  borderRadius: '14px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  📈 مؤشر الأداء الأسبوعي
                </h3>
                <p
                  style={{
                    margin: '0 0 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  متوسط نسبة النجاح اليومية
                </p>
                <Sparkline values={weeklyTrend} color="#22c55e" height={80} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  <span>7 أيام مضت</span>
                  <span>اليوم</span>
                </div>
              </section>

              {/* Storage health */}
              <section
                aria-label="صحة التخزين"
                style={{
                  background: 'var(--surface, #1e293b)',
                  borderRadius: '14px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 16px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  🗄️ صحة التخزين
                </h3>
                <StorageGauge usedPct={storageUsedPct} />
                <div
                  style={{
                    marginTop: '16px',
                    padding: '10px 14px',
                    background: 'var(--bg, #0f172a)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted,#94a3b8)',
                  }}
                >
                  <div>
                    💾 أخطاء الحفظ المتراكمة:{' '}
                    <strong
                      style={{
                        color:
                          failedSaves === 0
                            ? '#22c55e'
                            : failedSaves < 3
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    >
                      {failedSaves}
                    </strong>
                  </div>
                  {failedSaves > 0 && (
                    <button
                      onClick={() => {
                        AssessService.resetFailedSaves();
                        setFailedSaves(0);
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '3px 10px',
                        borderRadius: '5px',
                        border: '1px solid var(--border,#334155)',
                        background: 'transparent',
                        color: 'var(--text-muted,#94a3b8)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        fontFamily: 'Cairo,sans-serif',
                      }}
                    >
                      إعادة تعيين العداد
                    </button>
                  )}
                </div>
              </section>

              {/* Session duration distribution */}
              {avgDurationSecs > 0 && (
                <section
                  aria-label="توزيع مدد الجلسات"
                  style={{
                    background: 'var(--surface, #1e293b)',
                    borderRadius: '14px',
                    padding: '20px',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 16px',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                    }}
                  >
                    ⏱ توزيع مدد الجلسات
                  </h3>
                  {[
                    { label: '< 15 دقيقة', min: 0, max: 900, color: '#06b6d4' },
                    { label: '15–30 دقيقة', min: 900, max: 1800, color: '#22c55e' },
                    { label: '30–60 دقيقة', min: 1800, max: 3600, color: '#f59e0b' },
                    { label: '> 60 دقيقة', min: 3600, max: Infinity, color: '#ef4444' },
                  ].map((band) => {
                    const count = sessions.filter(
                      (s) =>
                        typeof s.duration === 'number' &&
                        s.duration >= band.min &&
                        s.duration < band.max
                    ).length;
                    const total = sessions.filter(
                      (s) => typeof s.duration === 'number' && s.duration > 0
                    ).length;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={band.label} style={{ marginBottom: '10px' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem',
                            marginBottom: '3px',
                          }}
                        >
                          <span style={{ color: 'var(--text,#f1f5f9)' }}>
                            {band.label}
                          </span>
                          <span style={{ color: band.color, fontWeight: 700 }}>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '6px',
                            borderRadius: '3px',
                            background: 'var(--border,#334155)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: band.color,
                              borderRadius: '3px',
                              transition: 'width 0.6s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted,#94a3b8)',
                      borderTop: '1px solid var(--border,#334155)',
                      paddingTop: '10px',
                    }}
                  >
                    متوسط المدة الكلي:{' '}
                    <strong style={{ color: '#06b6d4' }}>
                      {fmtDuration(avgDurationSecs)}
                    </strong>
                  </div>
                </section>
              )}
            </div>

            {/* Export analytics */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                size="sm"
                icon="📥"
                onClick={() => {
                  const data = {
                    period,
                    generated: new Date().toISOString(),
                    stats: {
                      students: students.length,
                      sessions: filtered.length,
                      avgPct: avgOverall,
                      avgDurationSecs,
                      sessionsPerDay,
                      failedSaves,
                      storageUsedPct,
                      moduleAvg: {
                        DT: moduleAvg('DT'),
                        G: moduleAvg('G'),
                        CE: moduleAvg('CE'),
                        TE: moduleAvg('TE'),
                      },
                    },
                  };
                  const blob = new Blob(
                    [JSON.stringify(data, null, 2)],
                    { type: 'application/json' }
                  );
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `massar_analytics_${Date.now()}.json`;
                  a.click();
                }}
              >
                تصدير التقرير
              </Button>
            </div>
          </>
        )}
      </FeatureGuard>
    </main>
  );
}
