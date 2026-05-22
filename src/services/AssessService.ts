// ============================================================
//  مسار — AssessService (TypeScript)  v2.0
//  v2.0: auto-draft (crash recovery), archive, vacuum
// ============================================================

import { SessionDB, DraftDB } from '@/db/database';
import type { SessionDraft } from '@/db/database';
import type {
  AssessSession,
  ModuleScores,
  PeakModule,
  ScoreValue,
  SessionSummary,
  LevelResult,
  Lang,
} from '@/types';

/** Minimal item shape needed for summary computation */
export interface SummaryItem {
  id: string;
  module: PeakModule;
  level: number;
}

function uid(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const AssessService = {
  /** حفظ جلسة تقييم */
  async saveSession(
    studentId: string,
    scores: ModuleScores,
    items: SummaryItem[],
    lang: Lang,
    duration?: number,
    notes?: string
  ): Promise<AssessSession> {
    const now = Date.now();
    const summary = AssessService.buildSummary(scores, items);
    const session: AssessSession = {
      id: uid(),
      studentId,
      scores,
      summary,
      lang,
      savedAt: now,
      updatedAt: now,
      ...(duration !== undefined ? { duration } : {}),
      ...(notes ? { notes } : {}),
    };
    await SessionDB.save(session);
    return session;
  },

  /** جلب جلسات طالب */
  getByStudentId(studentId: string): Promise<AssessSession[]> {
    return SessionDB.getByStudentId(studentId);
  },

  /** جلب جلسة بـ id */
  getById(id: string): Promise<AssessSession | undefined> {
    return SessionDB.getById(id);
  },

  /** بناء ملخص النتائج */
  buildSummary(scores: ModuleScores, items: SummaryItem[]): SessionSummary[] {
    const modules: PeakModule[] = ['DT', 'G', 'CE', 'TE'];
    return modules.map((mod) => {
      const modItems = items.filter((it) => it.module === mod);
      const modScores = scores[mod] || {};
      const levels = [...new Set(modItems.map((it) => it.level))].sort();

      let total = 0, passed = 0, failed = 0, skipped = 0;
      const levelResults: LevelResult[] = levels.map((lvl) => {
        const lvlItems = modItems.filter((it) => it.level === lvl);
        let lp = 0;
        lvlItems.forEach((it) => {
          const v: ScoreValue = (modScores[it.id] ?? null) as ScoreValue;
          if (v === 1) { passed++; lp++; total++; }
          else if (v === 0) { failed++; total++; }
          else skipped++;
        });
        return {
          level: lvl,
          label: `المستوى ${lvl}`,
          total: lvlItems.length,
          passed: lp,
          pct: lvlItems.length ? Math.round((lp / lvlItems.length) * 100) : 0,
        };
      });

      return {
        module: mod,
        total,
        passed,
        failed,
        skipped,
        pct: total ? Math.round((passed / total) * 100) : 0,
        levels: levelResults,
      };
    });
  },

  /** تسجيل استجابة واحدة */
  recordScore(
    scores: ModuleScores,
    module: PeakModule,
    itemId: string,
    value: ScoreValue
  ): ModuleScores {
    return {
      ...scores,
      [module]: {
        ...scores[module],
        [itemId]: value,
      },
    };
  },

  /** مسح درجات وحدة */
  clearModule(scores: ModuleScores, module: PeakModule): ModuleScores {
    return { ...scores, [module]: {} };
  },

  /** مسح كل الدرجات */
  clearAll(): ModuleScores {
    return { DT: {}, G: {}, CE: {}, TE: {} };
  },

  // ─────────────────────────────────────────────────────────
  //  Auto-draft (crash recovery)
  //  Stores in-progress scores to localStorage so a crash
  //  or accidental refresh doesn't lose partial session data.
  // ─────────────────────────────────────────────────────────

  /** مفتاح localStorage للمسودة */
  _draftKey(studentId: string): string {
    return `massar_draft_${studentId}`;
  },

  /** حفظ مسودة تلقائية — localStorage (سريع) + IndexedDB (موثوق) */
  saveDraft(studentId: string, scores: ModuleScores, startedAt?: number): void {
    const savedAt = Date.now();
    // Primary: localStorage (synchronous, instant)
    try {
      localStorage.setItem(
        AssessService._draftKey(studentId),
        JSON.stringify({ scores, savedAt, startedAt: startedAt ?? savedAt })
      );
    } catch {
      // localStorage full or unavailable — silently ignore
    }
    // Redundant: IndexedDB (async, survives localStorage clearing)
    const draft: SessionDraft = {
      studentId,
      scores: scores as Record<string, Record<string, number | null>>,
      startedAt: startedAt ?? savedAt,
      savedAt,
    };
    DraftDB.save(draft); // fire-and-forget — errors are logged internally
  },

  /** تحميل مسودة محفوظة (إن وجدت) */
  loadDraft(studentId: string): { scores: ModuleScores; savedAt: number } | null {
    try {
      const raw = localStorage.getItem(AssessService._draftKey(studentId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { scores: ModuleScores; savedAt: number };
      // Discard drafts older than 24 hours
      if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
        AssessService.clearDraft(studentId);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  /** حذف المسودة بعد الحفظ الناجح — يمسح localStorage وIndexedDB */
  clearDraft(studentId: string): void {
    try {
      localStorage.removeItem(AssessService._draftKey(studentId));
    } catch {/* ignore */}
    DraftDB.delete(studentId); // fire-and-forget
  },

  /**
   * تحميل مسودة محفوظة — يتحقق من localStorage أولاً،
   * ثم يعود إلى IndexedDB إذا كانت localStorage فارغة أو أقدم.
   * يُستخدم عند فتح جلسة طالب لإظهار نافذة الاستعادة.
   */
  async loadDraftFull(studentId: string): Promise<{
    scores: ModuleScores;
    savedAt: number;
    startedAt: number;
    source: 'localStorage' | 'indexedDB';
  } | null> {
    // Check localStorage first (fastest)
    try {
      const raw = localStorage.getItem(AssessService._draftKey(studentId));
      if (raw) {
        const parsed = JSON.parse(raw) as { scores: ModuleScores; savedAt: number; startedAt?: number };
        if (Date.now() - parsed.savedAt <= 24 * 60 * 60 * 1000) {
          const totalScored = Object.values(parsed.scores).reduce(
            (sum, mod) => sum + Object.values(mod as Record<string, unknown>).filter(v => v !== null).length,
            0
          );
          if (totalScored > 0) {
            return {
              scores:    parsed.scores,
              savedAt:   parsed.savedAt,
              startedAt: parsed.startedAt ?? parsed.savedAt,
              source:    'localStorage',
            };
          }
        }
      }
    } catch {/* ignore */}

    // Fallback: IndexedDB (survives localStorage clearing)
    try {
      const draft = await DraftDB.get(studentId);
      if (draft) {
        const totalScored = Object.values(draft.scores).reduce(
          (sum, mod) => sum + Object.values(mod as Record<string, unknown>).filter(v => v !== null).length,
          0
        );
        if (totalScored > 0) {
          return {
            scores:    draft.scores as ModuleScores,
            savedAt:   draft.savedAt,
            startedAt: draft.startedAt,
            source:    'indexedDB',
          };
        }
      }
    } catch {/* ignore */}

    return null;
  },

  // ─────────────────────────────────────────────────────────
  //  DB Maintenance — archive + vacuum
  // ─────────────────────────────────────────────────────────

  /** أرشفة الجلسات القديمة (> 6 أشهر) بإضافة علامة archivedAt */
  async archiveOldSessions(thresholdDays = 180): Promise<number> {
    const all = await SessionDB.getAll();
    const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const s of all) {
      if (s.savedAt < cutoff && !(s as Record<string, unknown>)['archivedAt']) {
        await SessionDB.save({ ...s, archivedAt: Date.now(), updatedAt: Date.now() } as AssessSession);
        count++;
      }
    }
    return count;
  },

  /** تنظيف السجلات المحذوفة نهائياً (deletedAt قبل 30 يوم) */
  async vacuumDeletedSessions(thresholdDays = 30): Promise<number> {
    const { openDB } = await import('@/db/database');
    const db = await openDB();
    const all = await SessionDB.getAll();
    const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const s of all) {
      const ext = s as Record<string, unknown>;
      if (ext['deletedAt'] && typeof ext['deletedAt'] === 'number' && ext['deletedAt'] < cutoff) {
        await new Promise<void>((res, rej) => {
          const req = db.transaction('sessions', 'readwrite').objectStore('sessions').delete(s.id);
          req.onsuccess = () => res();
          req.onerror   = () => rej(req.error);
        });
        count++;
      }
    }
    return count;
  },

  // ─────────────────────────────────────────────────────────
  //  Failed-save counter — tracks DB save failures in
  //  localStorage so Analytics can surface the metric.
  // ─────────────────────────────────────────────────────────

  _failKey: 'massar_failed_saves',

  /** تسجيل خطأ حفظ واحد */
  recordFailedSave(): void {
    try {
      const prev = parseInt(localStorage.getItem(AssessService._failKey) ?? '0', 10);
      localStorage.setItem(AssessService._failKey, String(prev + 1));
    } catch {/* ignore */}
  },

  /** قراءة عدد محاولات الحفظ الفاشلة */
  getFailedSaves(): number {
    try {
      return parseInt(localStorage.getItem(AssessService._failKey) ?? '0', 10);
    } catch {
      return 0;
    }
  },

  /** إعادة تعيين العداد (بعد ظهور الرقم للمشرف) */
  resetFailedSaves(): void {
    try { localStorage.removeItem(AssessService._failKey); } catch {/* ignore */}
  },

  /** فحص صحة قاعدة البيانات — يُعيد قائمة بالمشاكل المكتشفة */
  async healthCheck(): Promise<{ issues: string[]; score: number }> {
    const issues: string[] = [];
    const [students, sessions] = await Promise.all([
      StudentDB.getAll(),
      SessionDB.getAll(),
    ]);

    // Orphaned sessions (no student)
    const studentIds = new Set(students.map((s) => s.id));
    const orphaned = sessions.filter((s) => !studentIds.has(s.studentId));
    if (orphaned.length > 0) issues.push(`${orphaned.length} جلسة يتيمة بدون طالب مرتبط`);

    // Sessions with empty scores
    const emptySessions = sessions.filter((s) => {
      const mods = ['DT','G','CE','TE'] as const;
      return mods.every((m) => Object.keys(s.scores?.[m] ?? {}).length === 0);
    });
    if (emptySessions.length > 0) issues.push(`${emptySessions.length} جلسة بدون أي درجات مسجّلة`);

    // Storage usage
    if ('storage' in navigator && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const pct = est.quota ? Math.round(((est.usage ?? 0) / est.quota) * 100) : 0;
      if (pct > 80) issues.push(`التخزين ممتلئ بنسبة ${pct}% — يُنصح بتصدير النسخة الاحتياطية`);
    }

    // Score: 100 - 20 per issue (min 0)
    const score = Math.max(0, 100 - issues.length * 20);
    return { issues, score };
  },
};
