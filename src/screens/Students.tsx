// ============================================================
//  مسار — Students Screen
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudents } from '@/hooks/useStudents';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import type { Student, StudentCreate, SessionSummary } from '@/types';
import { SessionDB } from '@/db/database';
import { exportStudentFullReport } from '@/services/StudentFullReportService';
import { MODULE_COLORS, MODULE_ORDER } from '@/data/peakItems';

// ─── Add Student Modal ───────────────────────────────────────
interface StudentFormProps {
  initial?: Student;
  onSave: (data: StudentCreate) => Promise<void>;
  onCancel: () => void;
}

function StudentForm({ initial, onSave, onCancel }: StudentFormProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<StudentCreate>({
    name: initial?.name ?? '',
    school: initial?.school ?? '',
    grade: initial?.grade ?? '',
    dob: initial?.dob ?? '',
    notes: initial?.notes ?? '',
  });

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('errorNameEmpty')); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof StudentCreate,
    type = 'text',
    required = false
  ) => (
    <div style={{ marginBottom: '16px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '0.83rem',
          color: 'var(--text-muted, #94a3b8)',
          marginBottom: '6px',
          fontWeight: 600,
        }}
      >
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {key === 'notes' ? (
        <textarea
          value={(form[key] as string) ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          rows={3}
          style={inputStyle}
          placeholder={label}
        />
      ) : (
        <input
          ref={key === 'name' ? nameRef : undefined}
          type={type}
          value={(form[key] as string) ?? ''}
          onChange={(e) => {
            setForm((f) => ({ ...f, [key]: e.target.value }));
            if (key === 'name') setError('');
          }}
          required={required}
          placeholder={label}
          style={inputStyle}
        />
      )}
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border, #334155)',
    background: 'var(--bg, #0a0f1a)',
    color: 'var(--text, #f1f5f9)',
    fontFamily: 'Cairo, sans-serif',
    fontSize: '0.9rem',
    direction: 'rtl',
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 7000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? t('editStudent') : t('addStudent')}
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: '18px',
          padding: '28px 32px',
          maxWidth: '480px',
          width: '100%',
          fontFamily: 'Cairo, sans-serif',
          direction: 'rtl',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: '0 0 20px',
            fontSize: '1.1rem',
            fontWeight: 800,
            color: 'var(--text, #f1f5f9)',
          }}
        >
          {initial ? t('editStudent') : t('addStudent')}
        </h2>

        <form onSubmit={handleSubmit}>
          {field(t('studentName'), 'name', 'text', true)}
          {field(t('studentSchool'), 'school')}
          {field(t('studentGrade'), 'grade')}
          {field(t('studentDob'), 'dob', 'date')}
          {field(t('studentNotes'), 'notes')}

          {error && (
            <p
              role="alert"
              style={{ color: '#ef4444', fontSize: '0.82rem', margin: '0 0 12px' }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={onCancel}>
              {t('cancel')}
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Student Stats ───────────────────────────────────────────
interface StudentStats {
  sessionCount: number;
  lastAvgPct: number;
  lastSummary: SessionSummary[];
  /** avg pcts ordered oldest→newest for sparkline (up to 8) */
  trendPcts: number[];
  /** raw sessions for full PDF export */
  allSessions: import('@/types').AssessSession[];
}

// ─── Student Card ────────────────────────────────────────────
interface StudentCardProps {
  student: Student;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssess: () => void;
  onPlan: () => void;
  onPdfExport: () => void;
  stats?: StudentStats;
}

function StudentCard({ student, onSelect, onEdit, onDelete, onAssess, onPlan, onPdfExport, stats }: StudentCardProps) {
  const initials = student.name.charAt(0).toUpperCase();
  const colors = [
    '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  ];
  const color = colors[student.name.charCodeAt(0) % colors.length];

  return (
    <div
      style={{
        background: 'var(--surface, #1e293b)',
        borderRadius: '14px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 900,
          color: '#fff',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        aria-label={`عرض بيانات ${student.name}`}
      >
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={onSelect}>
        <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text, #f1f5f9)' }}>
          {student.name}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
          {[student.school, student.grade].filter(Boolean).join(' · ') || 'لا توجد بيانات إضافية'}
        </div>

        {/* Session stats row */}
        {stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {/* Session count badge */}
            <span style={{
              background: 'rgba(148,163,184,0.12)',
              borderRadius: '10px', padding: '1px 7px',
              fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)',
              whiteSpace: 'nowrap',
            }}>
              {stats.sessionCount} {stats.sessionCount === 1 ? 'جلسة' : 'جلسات'}
            </span>

            {/* Last avg pct badge */}
            {stats.lastAvgPct > 0 && (() => {
              const pctColor = stats.lastAvgPct >= 60 ? '#22c55e'
                             : stats.lastAvgPct >= 30 ? '#f59e0b'
                             : '#ef4444';
              return (
                <span style={{
                  background: `${pctColor}22`,
                  color: pctColor, borderRadius: '10px', padding: '1px 7px',
                  fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  {Math.round(stats.lastAvgPct)}%
                </span>
              );
            })()}

            {/* Module dots — DT G CE TE */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {MODULE_ORDER.map((mod) => {
                const s = stats.lastSummary.find((x) => x.module === mod);
                const col = MODULE_COLORS[mod];
                const opacity = s
                  ? (s.pct >= 60 ? 1 : s.pct >= 30 ? 0.65 : 0.35)
                  : 0.2;
                return (
                  <div
                    key={mod}
                    title={`${mod}: ${s ? Math.round(s.pct) + '%' : 'لم يُقيَّم'}`}
                    style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: s ? col : 'var(--text-muted, #94a3b8)',
                      opacity,
                    }}
                  />
                );
              })}
            </div>

            {/* Trend sparkline */}
            {stats.trendPcts.length >= 2 && (() => {
              const W = 80, H = 22;
              const vals = stats.trendPcts;
              const max = Math.max(...vals, 1);
              const pts = vals.map((v, i) => {
                const x = (i / (vals.length - 1)) * (W - 4) + 2;
                const y = H - 2 - ((v / max) * (H - 6));
                return `${x},${y}`;
              }).join(' ');
              const trendCol = vals[vals.length-1] >= vals[0] ? '#22c55e' : '#ef4444';
              return (
                <svg width={W} height={H} aria-label="مسار التقدم" title="مسار التقدم عبر الجلسات">
                  <polyline points={pts} fill="none" stroke={trendCol} strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
                </svg>
              );
            })()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={onAssess}
          aria-label={`بدء تقييم ${student.name}`}
          title="تقييم جديد"
          style={actionBtnStyle('#3b82f6')}
        >
          📋
        </button>
        <button
          onClick={onPlan}
          aria-label={`خطة تدخل ${student.name}`}
          title="خطة التدخل"
          style={actionBtnStyle('#a855f7')}
        >
          🎯
        </button>
        <button
          onClick={onPdfExport}
          aria-label={`تقرير PDF لـ ${student.name}`}
          title="تقرير شامل PDF"
          style={actionBtnStyle('#ef4444')}
        >
          📄
        </button>
        <button
          onClick={onEdit}
          aria-label={`تعديل ${student.name}`}
          title="تعديل"
          style={actionBtnStyle('transparent')}
        >
          ✏️
        </button>
        <button
          onClick={onDelete}
          aria-label={`حذف ${student.name}`}
          title="حذف"
          style={actionBtnStyle('transparent')}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function actionBtnStyle(bg: string): React.CSSProperties {
  return {
    background: bg === 'transparent' ? 'transparent' : `${bg}22`,
    border: 'none',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  };
}

// ─── Students Screen ─────────────────────────────────────────
export function Students() {
  const { setScreen, selectStudent } = useAppStore();
  const { t } = useTranslation();
  const { students, add, update, remove } = useStudents();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [statsMap, setStatsMap] = useState<Map<string, StudentStats>>(new Map());
  const [pdfExporting, setPdfExporting] = useState<string | null>(null); // studentId

  // Load session stats for all students whenever the student list changes
  useEffect(() => {
    let cancelled = false;
    SessionDB.getAll().then((sessions) => {
      if (cancelled) return;
      const byStudent = new Map<string, { savedAt: number; summary: SessionSummary[]; full: import('@/types').AssessSession }[]>();
      for (const s of sessions) {
        if (s.deletedAt) continue;
        if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, []);
        byStudent.get(s.studentId)!.push({ savedAt: s.savedAt, summary: s.summary, full: s });
      }
      const map = new Map<string, StudentStats>();
      for (const [sid, arr] of byStudent) {
        arr.sort((a, b) => b.savedAt - a.savedAt); // newest first
        const last = arr[0]?.summary ?? [];
        const avgPct = last.length > 0
          ? last.reduce((sum, x) => sum + x.pct, 0) / last.length
          : 0;
        // trend: up to 8 sessions oldest→newest
        const trend = arr.slice(-8).reverse().map(s =>
          s.summary.length
            ? Math.round(s.summary.reduce((a, x) => a + x.pct, 0) / s.summary.length)
            : 0
        );
        map.set(sid, {
          sessionCount: arr.length,
          lastAvgPct: avgPct,
          lastSummary: last,
          trendPcts: trend,
          allSessions: arr.map(x => x.full),
        });
      }
      setStatsMap(map);
    }).catch(() => {/* silent — non-critical */});
    return () => { cancelled = true; };
  }, [students]);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.school ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(data: StudentCreate) {
    if (editTarget) {
      await update(editTarget.id, data);
    } else {
      await add(data);
    }
    setShowForm(false);
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleAssess(student: Student) {
    selectStudent(student.id);
    setScreen('assess');
  }

  async function handlePdfExport(student: Student) {
    if (pdfExporting) return;
    const stats = statsMap.get(student.id);
    if (!stats || stats.allSessions.length === 0) {
      alert(`لا توجد جلسات محفوظة لـ ${student.name}`);
      return;
    }
    setPdfExporting(student.id);
    try {
      const result = await exportStudentFullReport(student, stats.allSessions);
      if (!result.ok) alert(`خطأ في تصدير التقرير: ${result.error}`);
    } finally {
      setPdfExporting(null);
    }
  }

  return (
    <main
      id="main-content"
      role="main"
      aria-label={t('students')}
      className="screen-enter"
      style={{
        padding: '24px',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
        color: 'var(--text, #f1f5f9)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
            {t('students')}
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
            {students.length} {t('totalStudents')}
          </p>
        </div>
        <Button
          variant="primary"
          icon="+"
          onClick={() => { setEditTarget(null); setShowForm(true); }}
        >
          {t('addStudent')}
        </Button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="search"
          placeholder={t('search') + '...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('search')}
          style={{
            width: '100%',
            padding: '10px 14px 10px 40px',
            borderRadius: '10px',
            border: '1px solid var(--border, #334155)',
            background: 'var(--surface, #1e293b)',
            color: 'var(--text, #f1f5f9)',
            fontFamily: 'Cairo, sans-serif',
            fontSize: '0.9rem',
            direction: 'rtl',
            boxSizing: 'border-box',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          {'\u{1F50D}'}
        </span>
      </div>

      {/* Students list */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          {students.length === 0 ? (
            <>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text, #f1f5f9)', marginBottom: '8px' }}>
                {t('addFirstStudent')}
              </div>
              <Button
                variant="primary"
                icon="+"
                onClick={() => setShowForm(true)}
              >
                {t('addStudent')}
              </Button>
            </>
          ) : (
            <p>{t('noSearchResults')}</p>
          )}
        </div>
      ) : (
        <div
          role="list"
          aria-label={t('students')}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {filtered.map((student) => (
            <div key={student.id} role="listitem">
              <StudentCard
                student={student}
                stats={statsMap.get(student.id)}
                onSelect={() => {
                  selectStudent(student.id);
                  setScreen('reports');
                }}
                onEdit={() => { setEditTarget(student); setShowForm(true); }}
                onDelete={() => setDeleteTarget(student)}
                onAssess={() => handleAssess(student)}
                onPlan={() => { selectStudent(student.id); setScreen('plan'); }}
                onPdfExport={() => handlePdfExport(student)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <StudentForm
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('deleteStudent')}
        message={t('deleteStudentConfirm') + '\n\n"' + (deleteTarget?.name ?? '') + '"'}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
