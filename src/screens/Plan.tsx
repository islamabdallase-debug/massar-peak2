// ============================================================
//  مسار — Plan Screen  v6.0
//  SMART Goals · Program Code Selector · Mastery Criterion
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore, selectSelectedStudent } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SessionDB, PlanDB } from '@/db/database';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { PEAK_MODULES } from '@/data/peakItems';
import type { PlanItem, PeakModule, SessionSummary } from '@/types';

// ── Constants ────────────────────────────────────────────────
const MODULES: PeakModule[] = ['DT', 'G', 'CE', 'TE'];

const MODULE_META: Record<PeakModule, { ar: string; color: string; icon: string; strategy: string }> = {
  DT: {
    ar: 'تدريب متمايز',
    color: '#3b82f6',
    icon: '🔵',
    strategy: 'تدريب متمايز (DTT) — تعزيز الاستجابات الصحيحة ضمن سياق منظّم ومتكرر مع تشكيل تدريجي للمهارة',
  },
  G: {
    ar: 'تعميم',
    color: '#22c55e',
    icon: '🟢',
    strategy: 'تعميم المهارات عبر بيئات وأشخاص ومواد متنوعة لضمان النقل الوظيفي',
  },
  CE: {
    ar: 'تكافؤ سياقي',
    color: '#a855f7',
    icon: '🟣',
    strategy: 'تدريب التكافؤ السياقي — ربط المثيرات بسياقات متباينة وتوسيع شبكة العلاقات بين المفاهيم',
  },
  TE: {
    ar: 'تحويل الوظائف',
    color: '#f59e0b',
    icon: '🟡',
    strategy: 'تمارين تحويل وظائف المثير — التدريب على تغيير المعنى الوظيفي للمثيرات عبر إطار العلاقة',
  },
};

const STATUS_OPTIONS = ['active', 'mastered', 'paused'] as const;
const STATUS_LABELS: Record<string, { ar: string; color: string }> = {
  active:   { ar: 'نشط',   color: '#3b82f6' },
  mastered: { ar: 'أُتقن', color: '#22c55e' },
  paused:   { ar: 'موقوف', color: '#f59e0b' },
};

// ── SMART Goal Generator ─────────────────────────────────────
function buildSmartGoal(
  studentName: string,
  module: PeakModule,
  itemId: string,
  strategy: string,
): string {
  const items = PEAK_MODULES[module]?.items ?? [];
  const item = items.find((i) => i.id === itemId);
  if (!item) return '';
  const behavior = item.correctAr || item.ar;
  const factor   = item.factorNameAr || '';
  const modAr    = MODULE_META[module].ar;
  return (
    `عند تقديم تعليمة وحدة ${modAr} — عامل ${factor} (برنامج ${itemId}):\n` +
    `"${item.ar}"\n\n` +
    `سيُنفّذ ${studentName} الاستجابة الصحيحة:\n` +
    `"${behavior}"\n\n` +
    `✅ معيار الإتقان: 90% أو أعلى (9 من 10 محاولات صحيحة) في 3 جلسات تدريبية متتالية.\n` +
    `📍 التعميم: يُنفَّذ الهدف مع مدربين متعددين وفي بيئات مختلفة (المنزل، المدرسة، العيادة).\n` +
    `🔧 الاستراتيجية: ${strategy}`
  );
}

// ── Score mini-bar ───────────────────────────────────────────
function ScoreBar({ mod, pct }: { mod: PeakModule; pct: number }) {
  const meta  = MODULE_META[mod];
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
      <span style={{ width: '30px', fontWeight: 700, color: meta.color }}>{mod}</span>
      <div style={{ flex: 1, height: '6px', background: '#ffffff12', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s' }} />
      </div>
      <span style={{ width: '38px', textAlign: 'left', color, fontWeight: 700 }}>{pct}%</span>
      {pct < 30  && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>🔴 عاجل</span>}
      {pct >= 30 && pct < 60 && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>⚠ يحتاج خطة</span>}
      {pct >= 60 && pct < 80 && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>📌 للتحسين</span>}
    </div>
  );
}

// ── Priority ─────────────────────────────────────────────────
type Priority = 'urgent' | 'medium' | 'low';
const PRIORITY_META: Record<Priority, { ar: string; color: string; bg: string; icon: string }> = {
  urgent: { ar: 'عاجل',    color: '#ef4444', bg: '#ef444411', icon: '🔴' },
  medium: { ar: 'متوسط',   color: '#f59e0b', bg: '#f59e0b11', icon: '🟡' },
  low:    { ar: 'منخفض',   color: '#22c55e', bg: '#22c55e11', icon: '🟢' },
};

// ── Plan Card ────────────────────────────────────────────────
type PlanItemExt = PlanItem & { goalText?: string; priority?: Priority };

function PlanCard({
  plan,
  onStatusChange,
  onDelete,
}: {
  plan: PlanItemExt;
  onStatusChange: (plan: PlanItemExt, s: PlanItem['status']) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sl   = STATUS_LABELS[plan.status];
  const meta = MODULE_META[plan.module];
  const isOverdue =
    plan.targetDate &&
    plan.status === 'active' &&
    new Date(plan.targetDate) < new Date();

  return (
    <div style={{
      background: 'var(--surface, #1e293b)',
      borderRadius: '12px',
      padding: '14px 16px',
      borderRight: `3px solid ${sl.color}`,
      opacity: plan.status === 'mastered' ? 0.75 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{
          background: `${meta.color}22`, color: meta.color,
          borderRadius: '6px', padding: '2px 10px',
          fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {meta.icon} {plan.module} · L{plan.level}
          {plan.targetItemId ? ` · ${plan.targetItemId}` : ''}
        </span>
        {plan.priority && (
          <span style={{
            background: PRIORITY_META[plan.priority].bg,
            color: PRIORITY_META[plan.priority].color,
            borderRadius: '6px', padding: '2px 8px',
            fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {PRIORITY_META[plan.priority].icon} {PRIORITY_META[plan.priority].ar}
          </span>
        )}
        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.4 }}>
          {plan.strategy}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {plan.targetDate && (
            <span style={{ fontSize: '0.72rem', color: isOverdue ? '#ef4444' : 'var(--text-muted, #94a3b8)' }}>
              {isOverdue ? '⚠ ' : '📅 '}{plan.targetDate}
            </span>
          )}
          {plan.goalText && (
            <button
              onClick={() => setExpanded((x) => !x)}
              style={{
                padding: '2px 8px', borderRadius: '5px', border: 'none',
                background: expanded ? '#ffffff12' : 'transparent',
                color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', fontSize: '0.75rem',
              }}
            >
              {expanded ? '▲' : '▼ هدف SMART'}
            </button>
          )}
          <button
            onClick={() => onDelete(plan.id)}
            style={{
              padding: '2px 6px', borderRadius: '5px', border: 'none',
              background: 'transparent', color: '#ef444466', cursor: 'pointer', fontSize: '0.8rem',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#ef4444')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#ef444466')}
          >✕</button>
        </div>
      </div>

      {/* SMART Goal expanded */}
      {expanded && plan.goalText && (
        <div style={{
          background: '#ffffff06', borderRadius: '8px', padding: '12px 14px',
          marginBottom: '10px', fontSize: '0.8rem', lineHeight: 1.8,
          color: 'var(--text-muted, #94a3b8)', whiteSpace: 'pre-wrap',
          borderRight: '2px solid #3b82f644',
        }}>
          {plan.goalText}
        </div>
      )}

      {/* Status + mastery badge */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Last updated badge */}
        {(() => {
          const daysSince = Math.floor((Date.now() - plan.updatedAt) / 86_400_000);
          const isStale = plan.status === 'active' && daysSince >= 7;
          return (
            <span style={{
              fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px',
              background: isStale ? '#ef444411' : '#ffffff08',
              color: isStale ? '#ef4444' : 'var(--text-muted,#94a3b8)',
              fontWeight: isStale ? 700 : 400,
            }}>
              {isStale ? '⚠ ' : '🕒 '}
              {daysSince === 0 ? 'اليوم' : daysSince === 1 ? 'أمس' : `${daysSince} يوم`}
            </span>
          );
        })()}
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(plan, s)}
            aria-pressed={plan.status === s}
            style={{
              padding: '3px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: plan.status === s ? `${STATUS_LABELS[s].color}22` : 'transparent',
              color: plan.status === s ? STATUS_LABELS[s].color : 'var(--text-muted, #94a3b8)',
              fontFamily: 'Cairo, sans-serif', fontSize: '0.72rem',
              fontWeight: plan.status === s ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {STATUS_LABELS[s].ar}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function Plan() {
  const selectedStudent = useAppStore(selectSelectedStudent);
  const { setScreen, addToast } = useAppStore();
  const { t } = useTranslation();

  const [plans, setPlans]               = useState<PlanItemExt[]>([]);
  const [statusFilter, setStatusFilter]   = useState<'all' | PlanItem['status']>('all');
  const [latestSummary, setLatestSummary] = useState<SessionSummary[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [previewGoal, setPreviewGoal]   = useState('');

  const [form, setForm] = useState({
    module:       'DT' as PeakModule,
    level:        1,
    targetItemId: '',
    strategy:     MODULE_META['DT'].strategy,
    targetDate:   '',
    status:       'active' as PlanItem['status'],
  });

  // Items filtered by module + level
  const moduleItems = PEAK_MODULES[form.module]?.items ?? [];
  const maxLevel    = moduleItems.length > 0 ? Math.max(...moduleItems.map((i) => i.level)) : 10;
  const levelItems  = moduleItems.filter((i) => i.level === form.level);

  // Update SMART goal preview when form changes
  useEffect(() => {
    if (!selectedStudent || !form.targetItemId) { setPreviewGoal(''); return; }
    setPreviewGoal(buildSmartGoal(selectedStudent.name, form.module, form.targetItemId, form.strategy));
  }, [form.module, form.targetItemId, form.strategy, selectedStudent?.name]);

  const load = useCallback(async () => {
    if (!selectedStudent) return;
    const [sessionList, planList] = await Promise.all([
      SessionDB.getByStudentId(selectedStudent.id),
      PlanDB.getByStudentId(selectedStudent.id),
    ]);
    if (sessionList.length > 0) setLatestSummary(sessionList[0].summary ?? []);
    setPlans(planList.sort((a, b) => b.createdAt - a.createdAt) as PlanItemExt[]);
  }, [selectedStudent?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-generate (v2 — multi-level, priority, dedup) ────
  async function autoGenerate() {
    if (!selectedStudent || latestSummary.length === 0) {
      addToast?.({ type: 'warning', message: 'لا توجد جلسة تقييم للطالب بعد' });
      return;
    }
    setGenerating(true);
    try {
      const now        = Date.now();
      const fourWeeks  = new Date(now + 28 * 864e5).toISOString().slice(0, 10);
      const eightWeeks = new Date(now + 56 * 864e5).toISOString().slice(0, 10);

      // Build duplicate-check set from existing plans
      const existingKeys = new Set(
        plans.map((p) => `${p.module}_${p.level}_${p.targetItemId}`)
      );

      const generated: PlanItemExt[] = [];

      // Sort modules: weakest first
      const sorted = [...latestSummary].sort((a, b) => a.pct - b.pct);

      for (const s of sorted) {
        if (generated.length >= 8) break; // hard cap — avoid overwhelming

        // Collect weak levels within this module (pct < 80), sorted weakest first
        const weakLevels = (s.levels ?? [])
          .filter((l) => l.pct < 80)
          .sort((a, b) => a.pct - b.pct);

        // If no level breakdown and module is weak, treat level 1 as target
        if (weakLevels.length === 0 && s.pct < 60) {
          weakLevels.push({ level: 1, label: 'المستوى 1', total: 0, passed: 0, pct: s.pct });
        }

        // Generate goal for top 2 weakest levels per module
        for (const wl of weakLevels.slice(0, 2)) {
          if (generated.length >= 8) break;

          const firstItem = PEAK_MODULES[s.module]?.items.find((i) => i.level === wl.level);
          if (!firstItem) continue;

          const key = `${s.module}_${wl.level}_${firstItem.id}`;
          if (existingKeys.has(key)) continue; // skip duplicate

          const effectivePct = wl.pct > 0 ? wl.pct : s.pct;
          const priority: Priority =
            effectivePct < 30 ? 'urgent' : effectivePct < 60 ? 'medium' : 'low';
          const targetDate = priority === 'urgent' ? fourWeeks : eightWeeks;

          const strat   = MODULE_META[s.module].strategy;
          const goalTxt = buildSmartGoal(selectedStudent.name, s.module, firstItem.id, strat);

          const p: PlanItemExt = {
            id:           `plan_auto_${s.module}_${wl.level}_${now}_${generated.length}`,
            studentId:    selectedStudent.id,
            module:       s.module,
            level:        wl.level,
            targetItemId: firstItem.id,
            strategy:     strat,
            targetDate,
            status:       'active',
            createdAt:    now,
            updatedAt:    now,
            goalText:     goalTxt,
            priority,
          };
          generated.push(p);
          existingKeys.add(key);
        }
      }

      if (generated.length === 0) {
        addToast?.({ type: 'info', message: 'لا توجد وحدات جديدة تحتاج خطة — جميعها مُغطّى أو ممتاز' });
        return;
      }

      for (const p of generated) await PlanDB.save(p);
      await load();

      const urgentCount = generated.filter((p) => p.priority === 'urgent').length;
      const mediumCount = generated.filter((p) => p.priority === 'medium').length;
      let msg = `تم توليد ${generated.length} هدف تدخل`;
      if (urgentCount) msg += ` · ${urgentCount} عاجل`;
      if (mediumCount) msg += ` · ${mediumCount} متوسط`;
      addToast?.({ type: 'success', message: msg });
    } finally {
      setGenerating(false);
    }
  }

  // ── Save manual plan ─────────────────────────────────────
  async function savePlan() {
    if (!form.strategy.trim() || !selectedStudent) return;
    const goalTxt = buildSmartGoal(selectedStudent.name, form.module, form.targetItemId, form.strategy);
    const p: PlanItemExt = {
      id:           `plan_${Date.now()}`,
      studentId:    selectedStudent.id,
      module:       form.module,
      level:        form.level,
      targetItemId: form.targetItemId,
      strategy:     form.strategy,
      targetDate:   form.targetDate,
      status:       form.status,
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
      goalText:     goalTxt,
    };
    await PlanDB.save(p);
    setPlans((prev) => [p, ...prev]);
    setShowForm(false);
    setPreviewGoal('');
    setForm({ module: 'DT', level: 1, targetItemId: '', strategy: MODULE_META['DT'].strategy, targetDate: '', status: 'active' });
    addToast?.({ type: 'success', message: 'تم حفظ الهدف' });
  }

  async function updateStatus(plan: PlanItemExt, status: PlanItem['status']) {
    const updated = { ...plan, status, updatedAt: Date.now() };
    await PlanDB.save(updated);
    setPlans((ps) => ps.map((p) => (p.id === plan.id ? updated : p)));
  }

  async function deletePlan(id: string) {
    await PlanDB.delete(id);
    setPlans((ps) => ps.filter((p) => p.id !== id));
    setDeleteId(null);
    addToast?.({ type: 'info', message: 'تم حذف الهدف' });
  }

  if (!selectedStudent) {
    return (
      <main id="main-content" role="main" style={centeredStyle}>
        <div style={{ fontSize: '3rem' }}>🎯</div>
        <p style={{ color: 'var(--text-muted, #94a3b8)' }}>{t('selectStudentFirst')}</p>
        <Button variant="primary" onClick={() => setScreen('students')}>{t('students')}</Button>
      </main>
    );
  }

  const activeCount   = plans.filter((p) => p.status === 'active').length;
  const masteredCount = plans.filter((p) => p.status === 'mastered').length;
  const urgentCount   = plans.filter((p) => p.status === 'active' && (p as PlanItemExt).priority === 'urgent').length;

  // Status filter
  const filteredByStatus = statusFilter === 'all' ? plans : plans.filter(p => p.status === statusFilter);

  // Sort: urgent first, then by createdAt desc
  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, medium: 1, low: 2 };
  const sortedPlans = [...filteredByStatus].sort((a, b) => {
    const pa = (a as PlanItemExt).priority ?? 'low';
    const pb = (b as PlanItemExt).priority ?? 'low';
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    if (a.status === 'active' && b.status === 'active') {
      const diff = (PRIORITY_ORDER[pa] ?? 2) - (PRIORITY_ORDER[pb] ?? 2);
      if (diff !== 0) return diff;
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <main id="main-content" role="main"
      style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text, #f1f5f9)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800 }}>🎯 {t('interventionPlan')}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
            {selectedStudent.name}
            {activeCount > 0 && ` · ${activeCount} هدف نشط`}
            {urgentCount > 0 && <span style={{ color: '#ef4444', marginRight: '4px' }}> · {urgentCount} عاجل 🔴</span>}
            {masteredCount > 0 && ` · ${masteredCount} أُتقن`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="ghost" icon="📋" onClick={() => setScreen('assess')}>
            تقييم جديد
          </Button>
          <Button variant="secondary" icon="✨" onClick={autoGenerate}
            disabled={generating || latestSummary.length === 0}>
            {generating ? 'جاري التوليد...' : 'توليد تلقائي'}
          </Button>
          <Button variant="primary" icon="+" onClick={() => setShowForm(true)}>{t('addGoal')}</Button>
        </div>
      </div>

      {/* ── Goals progress bar ──────────────────────────────── */}
      {plans.length > 0 && (
        <div style={{
          background: 'var(--surface, #1e293b)', borderRadius: '12px',
          padding: '14px 18px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        }}>
          {/* Segmented bar */}
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ display: 'flex', gap: '3px', height: '8px', borderRadius: '6px', overflow: 'hidden', marginBottom: '6px' }}>
              {masteredCount > 0 && (
                <div style={{ flex: masteredCount, background: '#22c55e', borderRadius: '4px 0 0 4px', transition: 'flex 0.4s' }} />
              )}
              {activeCount > 0 && (
                <div style={{ flex: activeCount, background: '#3b82f6', transition: 'flex 0.4s' }} />
              )}
              {plans.filter((p) => p.status === 'paused').length > 0 && (
                <div style={{ flex: plans.filter((p) => p.status === 'paused').length, background: '#f59e0b', borderRadius: '0 4px 4px 0', transition: 'flex 0.4s' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem' }}>
              {masteredCount > 0 && (
                <span style={{ color: '#22c55e' }}>✅ {masteredCount} أُتقن</span>
              )}
              {activeCount > 0 && (
                <span style={{ color: '#3b82f6' }}>▶ {activeCount} نشط</span>
              )}
              {plans.filter((p) => p.status === 'paused').length > 0 && (
                <span style={{ color: '#f59e0b' }}>⏸ {plans.filter((p) => p.status === 'paused').length} موقوف</span>
              )}
            </div>
          </div>
          {/* Mastery percentage */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: masteredCount / plans.length >= 0.5 ? '#22c55e' : 'var(--text, #f1f5f9)', lineHeight: 1 }}>
              {Math.round((masteredCount / plans.length) * 100)}%
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>نسبة الإتقان</div>
          </div>
        </div>
      )}

      {/* Too-many-concurrent warning */}
      {activeCount > 5 && (
        <div style={{
          background: '#ef444411', borderRadius: '10px', padding: '10px 14px',
          marginBottom: '16px', borderRight: '3px solid #ef4444',
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem',
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong style={{ color: '#ef4444' }}>تنبيه: {activeCount} برامج نشطة</strong>
            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
              {' '}— يُنصح بعدم تجاوز 5–10 برامج متزامنة للمبتدئين لضمان فاعلية التعلم.
            </span>
          </div>
        </div>
      )}

      {/* Session snapshot */}
      {latestSummary.length > 0 && (
        <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '12px', padding: '16px 18px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '10px', fontWeight: 600 }}>
            آخر تقييم — النتائج الحالية
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MODULES.map((mod) => {
              const s = latestSummary.find((x) => x.module === mod);
              return <ScoreBar key={mod} mod={mod} pct={s?.pct ?? 0} />;
            })}
          </div>
          {latestSummary.some((s) => s.pct < 80) && (
            <button onClick={autoGenerate} disabled={generating} style={{
              marginTop: '12px', width: '100%', padding: '8px', borderRadius: '8px',
              border: '1px dashed #f59e0b44', background: '#f59e0b08',
              color: '#f59e0b', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
              fontSize: '0.8rem', fontWeight: 700,
            }}>
              ✨ توليد أهداف علاجية تلقائياً من نتائج التقييم
            </button>
          )}
        </div>
      )}

      {/* ── Add Form ────────────────────────────────────────── */}
      {showForm && (
        <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>➕ {t('addGoal')}</h3>

          {/* Module + Level */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>الوحدة</label>
              <select value={form.module} onChange={(e) => {
                const mod = e.target.value as PeakModule;
                setForm((f) => ({ ...f, module: mod, level: 1, targetItemId: '', strategy: MODULE_META[mod].strategy }));
              }} style={selectStyle}>
                {MODULES.map((m) => <option key={m} value={m}>{m} — {MODULE_META[m].ar}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>المستوى المستهدف</label>
              <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: +e.target.value, targetItemId: '' }))} style={selectStyle}>
                {Array.from({ length: maxLevel }, (_, i) => i + 1).map((l) => (
                  <option key={l} value={l}>المستوى {l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Program code */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>
              رمز البرنامج
              {form.targetItemId && <span style={{ marginRight: '8px', color: '#3b82f6', fontWeight: 700 }}>{form.targetItemId}</span>}
            </label>
            <select value={form.targetItemId} onChange={(e) => setForm((f) => ({ ...f, targetItemId: e.target.value }))} style={selectStyle}>
              <option value="">— اختر البرنامج —</option>
              {levelItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.ar.slice(0, 55)}{item.ar.length > 55 ? '...' : ''}
                </option>
              ))}
            </select>
            {levelItems.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: '#f59e0b', margin: '4px 0 0' }}>
                لا توجد بنود في المستوى {form.level} لوحدة {form.module}
              </p>
            )}
          </div>

          {/* Strategy */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t('goalStrategy')}</label>
            <textarea value={form.strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
              rows={3} placeholder="وصف استراتيجية التدخل..."
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Mastery criterion box */}
          <div style={{
            background: '#22c55e11', borderRadius: '8px', padding: '10px 14px',
            marginBottom: '12px', borderRight: '2px solid #22c55e44',
            fontSize: '0.8rem', color: '#22c55e',
          }}>
            <strong>✅ معيار الإتقان الثابت (PEAK Standard):</strong>
            <span style={{ color: 'var(--text-muted, #94a3b8)', marginRight: '8px' }}>
              90% أو أعلى (9 من 10 محاولات صحيحة) في 3 جلسات تدريبية متتالية.
              التعميم مطلوب مع مدربين ومواد وبيئات متعددة.
            </span>
          </div>

          {/* Date + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>{t('goalDate')}</label>
              <input type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>الحالة</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PlanItem['status'] }))} style={selectStyle}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s].ar}</option>)}
              </select>
            </div>
          </div>

          {/* SMART Goal Preview */}
          {previewGoal && (
            <div style={{
              background: '#3b82f611', borderRadius: '10px', padding: '12px 16px',
              marginBottom: '14px', borderRight: '3px solid #3b82f644',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700, marginBottom: '8px' }}>📋 معاينة الهدف SMART</div>
              <pre style={{
                margin: 0, fontSize: '0.78rem', lineHeight: 1.8,
                color: 'var(--text-muted, #94a3b8)', whiteSpace: 'pre-wrap',
                fontFamily: 'Cairo, sans-serif',
              }}>{previewGoal}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setShowForm(false); setPreviewGoal(''); }}>{t('cancel')}</Button>
            <Button variant="primary" onClick={savePlan} disabled={!form.strategy.trim()}>{t('save')}</Button>
          </div>
        </div>
      )}

      {/* Plans list */}
      {/* ── Status filter bar ─────────────────────────────── */}
      {plans.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {(['all', 'active', 'mastered', 'paused'] as const).map((f) => {
            const count = f === 'all' ? plans.length : plans.filter(p => p.status === f).length;
            const color = f === 'all' ? '#94a3b8' : STATUS_LABELS[f as PlanItem['status']].color;
            const label = f === 'all' ? 'الكل' : STATUS_LABELS[f as PlanItem['status']].ar;
            return (
              <button key={f} onClick={() => setStatusFilter(f)}
                style={{
                  padding: '4px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontFamily: 'Cairo,sans-serif', fontSize: '0.76rem', fontWeight: statusFilter === f ? 800 : 400,
                  background: statusFilter === f ? `${color}22` : 'transparent',
                  color: statusFilter === f ? color : 'var(--text-muted,#94a3b8)',
                  transition: 'all 0.15s',
                }}
              >
                {label} <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted, #94a3b8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎯</div>
          <p style={{ margin: '0 0 16px' }}>لا توجد أهداف تدخل بعد.</p>
          {latestSummary.length > 0
            ? <Button variant="primary" icon="✨" onClick={autoGenerate}>توليد خطة تلقائياً</Button>
            : <p style={{ fontSize: '0.82rem' }}>ابدأ بتقييم الطالب أولاً، ثم ولِّد الخطة تلقائياً.</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {urgentCount > 0 && (
            <div style={{
              fontSize: '0.75rem', color: '#ef4444', padding: '6px 12px',
              background: '#ef444411', borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              🔴 <strong>{urgentCount} هدف عاجل</strong> يحتاج تدخلاً فورياً (أداء أقل من 30%)
            </div>
          )}
          {sortedPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onStatusChange={updateStatus} onDelete={(id) => setDeleteId(id)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="حذف الهدف"
        message="هل تريد حذف هذا الهدف؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
        onConfirm={() => deleteId && deletePlan(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}

// ── Styles ───────────────────────────────────────────────────
const centeredStyle: React.CSSProperties = {
  padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl',
  color: 'var(--text, #f1f5f9)', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', minHeight: '60vh',
  gap: '16px', textAlign: 'center',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)',
  marginBottom: '4px', fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border, #334155)', background: 'var(--bg, #0a0f1a)',
  color: 'var(--text, #f1f5f9)', fontFamily: 'Cairo, sans-serif',
  fontSize: '0.88rem', direction: 'rtl', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
