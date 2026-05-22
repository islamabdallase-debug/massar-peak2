// ============================================================
//  مسار — Export / Import Screen  v5.1
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAppStore, selectSelectedStudent } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { StudentDB, SessionDB, PlanDB, DBRecovery } from "@/db/database";
import { Button } from '@/components/ui/Button';
import {
  validateImportFile,
  validateImportedStudents,
  validateImportedSessions,
  validateImportedPlans,
  safeJSON,
  buildCSV,
} from '@/services/security';
import type { Student, AssessSession, PlanItem } from '@/types';

type ExportStatus = '' | 'json' | 'csv' | 'plans' | 'student' | 'importing';

interface ImportResult {
  students: number;
  sessions: number;
  plans:    number;
  skipped:  number;
}

// ── Export card ───────────────────────────────────────────────
function ExportCard({
  icon, title, desc, action, busy, disabled = false,
}: {
  icon: string; title: string; desc: string;
  action: () => void; busy: boolean; disabled?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--surface, #1e293b)', borderRadius: '12px',
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px',
    }}>
      <div style={{ fontSize: '2rem', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>{desc}</div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={action}
        disabled={disabled || busy}
        aria-label={title}
      >
        {busy ? '⏳' : 'تصدير'}
      </Button>
    </div>
  );
}

// ── Helper: trigger download ──────────────────────────────────
function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main ──────────────────────────────────────────────────────
export function Export() {
  const { t, lang } = useTranslation();
  const selectedStudent = useAppStore(selectSelectedStudent);
  const { students, addToast } = useAppStore();
  const [busy, setBusy]           = useState<ExportStatus>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [planCount, setPlanCount]   = useState(0);

  useEffect(() => {
    let cancelled = false;
    SessionDB.getAll().then((s) => { if (!cancelled) setSessionCount(s.length); });
    StudentDB.getAll().then(async (sts) => {
      if (cancelled) return;
      let total = 0;
      for (const s of sts) { const p = await PlanDB.getByStudentId(s.id); total += p.length; }
      if (!cancelled) setPlanCount(total);
    });
    return () => { cancelled = true; };
  }, []);

  // ── JSON full backup ────────────────────────────────────
  async function exportJSONAll() {
    setBusy('json');
    try {
      const allStudents = await StudentDB.getAll();
      const allSessions = await SessionDB.getAll();
      const allPlans: PlanItem[] = [];
      for (const s of allStudents) {
        const p = await PlanDB.getByStudentId(s.id);
        allPlans.push(...p);
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        version:    '5.1',
        platform:   'مسار React',
        students:   allStudents,
        sessions:   allSessions,
        plans:      allPlans,
      };
      download(
        JSON.stringify(payload, null, 2),
        `massar_backup_${Date.now()}.json`,
        'application/json'
      );
      addToast?.({ type: 'success', message: `تم تصدير ${allStudents.length} طالب · ${allSessions.length} جلسة · ${allPlans.length} خطة` });
    } catch (err) {
      addToast?.({ type: 'error', message: 'فشل تصدير النسخة الاحتياطية' });
    } finally {
      setBusy('');
    }
  }

  // ── CSV sessions ────────────────────────────────────────
  async function exportCSV() {
    setBusy('csv');
    try {
      const sessions = await SessionDB.getAll();
      if (sessions.length === 0) {
        addToast?.({ type: 'error', message: 'لا توجد جلسات للتصدير' });
        return;
      }
      const headers = ['الطالب', 'التاريخ', 'DT%', 'G%', 'CE%', 'TE%', 'المتوسط', 'عدد البنود'];
      const rows = sessions.map((sess) => {
        const student = students.find((s) => s.id === sess.studentId);
        const name = student?.name ?? 'غير معروف';
        const date = new Date(sess.savedAt).toLocaleDateString('ar-SA');
        const getP = (mod: string) => sess.summary?.find((s) => s.module === mod)?.pct ?? 0;
        const mods = ['DT', 'G', 'CE', 'TE'].map(getP);
        const nonZero = mods.filter((m) => m > 0);
        const avg  = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
        const total = sess.summary?.reduce((a, s) => a + s.total, 0) ?? 0;
        return [name, date, `${mods[0]}%`, `${mods[1]}%`, `${mods[2]}%`, `${mods[3]}%`, `${avg}%`, total];
      });
      download(
        buildCSV(headers, rows),
        `massar_sessions_${Date.now()}.csv`,
        'text/csv;charset=utf-8'
      );
      addToast?.({ type: 'success', message: `تم تصدير ${sessions.length} جلسة بصيغة CSV` });
    } catch (err) {
      addToast?.({ type: 'error', message: 'فشل تصدير جلسات CSV' });
    } finally {
      setBusy('');
    }
  }

  // ── CSV plans ───────────────────────────────────────────
  async function exportPlansCSV() {
    setBusy('plans');
    try {
      const allStudents = await StudentDB.getAll();
      const header = ['الطالب', 'الوحدة', 'المستوى', 'الاستراتيجية', 'تاريخ الهدف', 'الحالة'];
      const rows: unknown[][] = [];
      for (const s of allStudents) {
        const plans = await PlanDB.getByStudentId(s.id);
        plans.forEach((p) => {
          rows.push([s.name, p.module, p.level, p.strategy, p.targetDate ?? '', p.status]);
        });
      }
      if (rows.length === 0) {
        addToast?.({ type: 'error', message: 'لا توجد خطط للتصدير' });
        return;
      }
      download(
        buildCSV(header, rows),
        `massar_plans_${Date.now()}.csv`,
        'text/csv;charset=utf-8'
      );
      addToast?.({ type: 'success', message: `تم تصدير ${rows.length} خطة تدخل` });
    } catch (err) {
      addToast?.({ type: 'error', message: 'فشل تصدير خطط CSV' });
    } finally {
      setBusy('');
    }
  }

  // ── JSON single student ─────────────────────────────────
  async function exportStudent() {
    if (!selectedStudent) return;
    setBusy('student');
    try {
      const sessions = await SessionDB.getByStudentId(selectedStudent.id);
      const plans    = await PlanDB.getByStudentId(selectedStudent.id);
      const payload  = {
        exportedAt: new Date().toISOString(),
        version:    '5.1',
        student:    selectedStudent,
        sessions,
        plans,
      };
      download(
        JSON.stringify(payload, null, 2),
        `massar_${selectedStudent.name.replace(/\s+/g, '_')}_${Date.now()}.json`,
        'application/json'
      );
      addToast?.({ type: 'success', message: `تم تصدير بيانات ${selectedStudent.name} (${sessions.length} جلسة · ${plans.length} خطة)` });
    } catch (err) {
      addToast?.({ type: 'error', message: 'فشل تصدير بيانات الطالب' });
    } finally {
      setBusy('');
    }
  }

  // ── Import JSON ─────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileCheck = validateImportFile(file);
    if (!fileCheck.ok) {
      addToast?.({ type: 'error', message: fileCheck.error ?? 'ملف غير صالح' });
      e.target.value = '';
      return;
    }

    setBusy('importing');
    setImportResult(null);
    try {
      const text = await file.text();
      const data = safeJSON<Record<string, unknown>>(text);
      if (!data || typeof data !== 'object') {
        addToast?.({ type: 'error', message: 'ملف JSON غير صالح — تأكد من تنسيق الملف' });
        return;
      }

      const result: ImportResult = { students: 0, sessions: 0, plans: 0, skipped: 0 };

      // Students
      const rawStudents = Array.isArray(data.students) ? data.students
        : Array.isArray(data.student) ? data.student
        : data.student ? [data.student] : [];
      const { valid: validStudents, skipped: skSt } = validateImportedStudents(rawStudents);
      result.skipped += skSt;
      for (const s of validStudents) {
        try { await StudentDB.add(s as Student); result.students++; }
        catch { result.skipped++; }
      }

      // Sessions
      const rawSessions = Array.isArray(data.sessions) ? data.sessions : [];
      const { valid: validSessions, skipped: skSe } = validateImportedSessions(rawSessions);
      result.skipped += skSe;
      for (const s of validSessions) {
        try { await SessionDB.save(s as AssessSession); result.sessions++; }
        catch { result.skipped++; }
      }

      // Plans
      const rawPlans = Array.isArray(data.plans) ? data.plans : [];
      const { valid: validPlans, skipped: skPl } = validateImportedPlans(rawPlans);
      result.skipped += skPl;
      for (const p of validPlans) {
        try { await PlanDB.save(p as PlanItem); result.plans++; }
        catch { result.skipped++; }
      }

      setImportResult(result);
      setSessionCount((c) => c + result.sessions);
      addToast?.({ type: 'success', message: `تم الاستيراد: ${result.students} طالب · ${result.sessions} جلسة · ${result.plans} خطة` });
    } catch {
      addToast?.({ type: 'error', message: 'خطأ أثناء قراءة الملف — تأكد أنه ملف JSON من مسار' });
    } finally {
      setBusy('');
      e.target.value = '';
    }
  }

  // ── Clear all data ──────────────────────────────────────
  async function handleClearAll() {
    const ok = window.confirm('هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.\n\nتأكد من تصدير نسخة احتياطية أولاً!');
    if (!ok) return;
    try {
      
      await DBRecovery.clearAll();
      setSessionCount(0);
      setPlanCount(0);
      addToast?.({ type: 'success', message: 'تم حذف جميع البيانات. يُنصح بإعادة تحميل الصفحة.' });
    } catch {
      addToast?.({ type: 'error', message: 'فشل حذف البيانات' });
    }
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <main
      id="main-content"
      role="main"
      aria-label="شاشة التصدير والاستيراد"
      style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text, #f1f5f9)' }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800 }}>
          📥 {t('exportData') ?? 'تصدير البيانات'}
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
          {sessionCount > 0 ? `${students.length} طالب · ${sessionCount} جلسة · ${planCount} خطة — ` : ''}
          تصدير واستيراد البيانات بصيغ متعددة
        </p>
      </div>

      {/* Export section */}
      <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
        تصدير البيانات
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
        <ExportCard
          icon="📦"
          title="نسخة احتياطية كاملة (JSON)"
          desc="جميع الطلاب والجلسات والخطط — مناسب للنسخ الاحتياطي"
          action={exportJSONAll}
          busy={busy === 'json'}
          disabled={students.length === 0}
        />
        <ExportCard
          icon="📊"
          title="جلسات التقييم (CSV)"
          desc="جدول بيانات بكل الجلسات ونتائج الوحدات — يفتح في Excel"
          action={exportCSV}
          busy={busy === 'csv'}
          disabled={sessionCount === 0}
        />
        <ExportCard
          icon="🎯"
          title="خطط التدخل (CSV)"
          desc="جدول بجميع الأهداف والاستراتيجيات لكل الطلاب"
          action={exportPlansCSV}
          busy={busy === 'plans'}
          disabled={planCount === 0}
        />
        {selectedStudent && (
          <ExportCard
            icon="👤"
            title={`بيانات الطالب: ${selectedStudent.name}`}
            desc="تصدير جلسات وخطط هذا الطالب فقط بصيغة JSON"
            action={exportStudent}
            busy={busy === 'student'}
          />
        )}
      </div>

      {/* Import section */}
      <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
        استيراد البيانات
      </h3>
      <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '12px', padding: '20px' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.92rem' }}>
          استيراد من نسخة احتياطية (JSON)
        </p>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
          يدعم ملفات النسخ الاحتياطي من مسار (v4 أو v5). السجلات المكررة تُتجاهل تلقائياً.
        </p>

        <input
          type="file"
          accept=".json"
          id="import-file"
          aria-label="اختر ملف JSON للاستيراد"
          style={{ display: 'none' }}
          onChange={handleImport}
        />

        <Button
          variant="secondary"
          icon="📤"
          onClick={() => document.getElementById('import-file')?.click()}
          disabled={busy === 'importing'}
          loading={busy === 'importing'}
          aria-label="اختيار ملف JSON للاستيراد"
        >
          {busy === 'importing' ? 'جارٍ الاستيراد...' : 'اختيار ملف JSON'}
        </Button>

        {/* Import result */}
        {importResult && (
          <div style={{
            marginTop: '16px', padding: '14px', borderRadius: '10px',
            background: '#22c55e14', border: '1px solid #22c55e33',
          }} role="status" aria-live="polite">
            <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: '8px', fontSize: '0.88rem' }}>
              ✅ تم الاستيراد بنجاح
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', flexWrap: 'wrap' }}>
              <span>👥 {importResult.students} طالب</span>
              <span>📋 {importResult.sessions} جلسة</span>
              <span>🎯 {importResult.plans} خطة</span>
              {importResult.skipped > 0 && (
                <span style={{ color: 'var(--warning, #f59e0b)' }}>⚠️ {importResult.skipped} سجل تم تخطيه</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div style={{ marginTop: '32px', padding: '16px', borderRadius: '10px', border: '1px solid #ef444433', background: '#ef444408' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.88rem', color: '#ef4444' }}>
          ⚠️ منطقة الخطر
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
          حذف جميع البيانات بشكل نهائي. تأكد من تصدير نسخة احتياطية أولاً.
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={handleClearAll}
          disabled={students.length === 0 && sessionCount === 0}
          aria-label="حذف جميع البيانات"
        >
          حذف جميع البيانات
        </Button>
      </div>
    </main>
  );
}
