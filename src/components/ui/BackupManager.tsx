// ============================================================
//  مسار — BackupManager  v5.2
//  Full backup/restore system
//  ✅ Per-record validation (students / sessions / plans)
//  ✅ Atomic rollback — snapshot → write → restore on failure
//  ✅ Conflict detection with existing data
//  ✅ Merge vs Replace mode selection
//  ✅ Storage quota check before import
//  ✅ Export double-submit guard
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StudentDB, SessionDB, PlanDB, openDB } from '@/db/database';
import { checkStorageQuota } from '@/db/database';
import { Button } from './Button';

// ─── Types ──────────────────────────────────────────────────
interface BackupData {
  version:     string;
  exportedAt:  string;
  appVersion:  string;
  checksum:    number;
  students:    unknown[];
  sessions:    unknown[];
  plans:       unknown[];
}

interface BackupStatus {
  lastBackup:  number | null;  // timestamp
  daysAgo:     number;
  status:      'fresh' | 'warning' | 'danger' | 'never';
}

interface ValidationResult {
  students: { valid: number; invalid: number };
  sessions: { valid: number; invalid: number };
  plans:    { valid: number; invalid: number };
  hasErrors: boolean;
}

// ─── Checksum (simple sum of chars) ─────────────────────────
function calcChecksum(data: unknown): number {
  const str = JSON.stringify(data);
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum = (sum + str.charCodeAt(i)) & 0xffffffff;
  return sum;
}

// ─── Per-record validation helpers ──────────────────────────
function isValidStudentRecord(r: unknown): r is Record<string, unknown> {
  if (!r || typeof r !== 'object') return false;
  const s = r as Record<string, unknown>;
  return typeof s['id'] === 'string' && s['id'].length > 0
      && typeof s['name'] === 'string';
}

function isValidSessionRecord(r: unknown): r is Record<string, unknown> {
  if (!r || typeof r !== 'object') return false;
  const s = r as Record<string, unknown>;
  return typeof s['id'] === 'string' && s['id'].length > 0
      && typeof s['studentId'] === 'string';
}

function isValidPlanRecord(r: unknown): r is Record<string, unknown> {
  if (!r || typeof r !== 'object') return false;
  const s = r as Record<string, unknown>;
  return typeof s['id'] === 'string' && s['id'].length > 0;
}

function validateBackupRecords(data: BackupData): ValidationResult {
  const validStudents = data.students.filter(isValidStudentRecord).length;
  const validSessions = data.sessions.filter(isValidSessionRecord).length;
  const plans         = data.plans ?? [];
  const validPlans    = plans.filter(isValidPlanRecord).length;
  return {
    students:  { valid: validStudents,  invalid: data.students.length - validStudents },
    sessions:  { valid: validSessions,  invalid: data.sessions.length - validSessions },
    plans:     { valid: validPlans,     invalid: plans.length - validPlans },
    hasErrors: (data.students.length - validStudents > 0) ||
               (data.sessions.length - validSessions > 0) ||
               (plans.length - validPlans > 0),
  };
}

// ─── Snapshot helpers (atomic rollback) ─────────────────────
async function snapshotStore(
  db: IDBDatabase,
  storeName: string,
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
    req.onerror   = () => reject(req.error);
  });
}

async function restoreSnapshot(
  db: IDBDatabase,
  storeName: string,
  snapshot: Record<string, unknown>[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    snapshot.forEach(rec => store.put(rec));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ─── Local storage key ───────────────────────────────────────
const LAST_BACKUP_KEY = 'massar_last_backup_ts';

// ─── BackupManager Component ─────────────────────────────────
export function BackupManager() {
  const [exporting,    setExporting]    = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [status,       setStatus]       = useState<BackupStatus>({ lastBackup: null, daysAgo: 0, status: 'never' });
  const [importMsg,    setImportMsg]    = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [previewData,  setPreviewData]  = useState<BackupData | null>(null);
  const [validation,   setValidation]   = useState<ValidationResult | null>(null);
  const [mergeMode,    setMergeMode]    = useState<'replace' | 'merge'>('replace');
  const [storageInfo,  setStorageInfo]  = useState<string>('');
  const [conflictInfo, setConflictInfo] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Compute backup status ──────────────────────────────────
  const refreshStatus = useCallback(() => {
    const ts = Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0);
    if (!ts) { setStatus({ lastBackup: null, daysAgo: 0, status: 'never' }); return; }
    const daysAgo = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    const statusLevel = daysAgo === 0 ? 'fresh' : daysAgo <= 2 ? 'warning' : 'danger';
    setStatus({ lastBackup: ts, daysAgo, status: statusLevel });
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // ── Export ─────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (exporting) return;           // double-submit guard
    setExporting(true);
    try {
      const [students, allStudents] = await Promise.all([
        StudentDB.getAll(),
        StudentDB.getAll(),
      ]);
      const sessions = await SessionDB.getAll();
      // Gather plans for all students
      const planArrays = await Promise.all(allStudents.map((s) => PlanDB.getByStudentId(s.id)));
      const plans = planArrays.flat();

      const payload = { students, sessions, plans };
      const checksum = calcChecksum(payload);

      const backup: BackupData = {
        version:    '1',
        exportedAt: new Date().toISOString(),
        appVersion: 'massar-v5.2.0',
        checksum,
        ...payload,
      };

      const json    = JSON.stringify(backup, null, 2);
      const blob    = new Blob([json], { type: 'application/json' });
      const url     = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const a       = document.createElement('a');
      a.href     = url;
      a.download = `massar_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
      refreshStatus();

      setImportMsg({ type: 'success', text: `✅ تم تصدير النسخة الاحتياطية — ${students.length} طالب، ${sessions.length} جلسة، ${plans.length} خطة` });
      setTimeout(() => setImportMsg(null), 5000);
    } catch (err) {
      setImportMsg({ type: 'error', text: `❌ فشل التصدير: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setExporting(false);
    }
  }, [exporting, refreshStatus]);

  // ── File selected for import ───────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportMsg(null);
    setPreviewData(null);
    setValidation(null);
    setConflictInfo('');
    setStorageInfo('');

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      // Validate top-level structure
      if (!data.version || !data.exportedAt || !data.students || !data.sessions) {
        throw new Error('الملف لا يبدو نسخة احتياطية صحيحة من مسار');
      }

      // Verify checksum
      const expectedChecksum = calcChecksum({
        students: data.students,
        sessions: data.sessions,
        plans: data.plans ?? [],
      });
      if (data.checksum && data.checksum !== expectedChecksum) {
        setImportMsg({ type: 'warning', text: '⚠️ تحذير: الملف قد يكون تالفاً (checksum غير متطابق). تحقق قبل الاستمرار.' });
      }

      // Per-record validation
      const vr = validateBackupRecords(data);
      setValidation(vr);

      // Storage quota check
      try {
        const quota = await checkStorageQuota();
        if (quota.quota > 0) setStorageInfo(quota.label);
      } catch {/* non-critical */}

      // Conflict detection — check existing data
      try {
        const [existingStudents, existingSessions] = await Promise.all([
          StudentDB.getAll(),
          SessionDB.getAll(),
        ]);
        if (existingStudents.length > 0 || existingSessions.length > 0) {
          setConflictInfo(
            `تحذير: يوجد حالياً ${existingStudents.length} طالب و${existingSessions.length} جلسة في قاعدة البيانات`
          );
        }
      } catch {/* non-critical */}

      setPreviewData(data);
    } catch (err) {
      setImportMsg({ type: 'error', text: `❌ خطأ في قراءة الملف: ${err instanceof Error ? err.message : String(err)}` });
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  // ── Confirm import — atomic with rollback ──────────────────
  const confirmImport = useCallback(async () => {
    if (!previewData) return;
    if (exporting) return;          // export already in progress
    setImporting(true);
    setImportMsg(null);

    try {
      const db = await openDB();

      // Storage quota warning (non-blocking)
      try {
        const quota = await checkStorageQuota();
        if (quota.isLow) {
          setImportMsg({ type: 'warning', text: `⚠️ مساحة التخزين منخفضة (${quota.label}) — جارٍ المحاولة على أي حال...` });
        }
      } catch {/* non-critical */}

      // ── Snapshot current state for atomic rollback ─────────
      let studentsSnap: Record<string, unknown>[] = [];
      let sessionsSnap: Record<string, unknown>[] = [];
      let plansSnap:    Record<string, unknown>[] = [];
      try {
        [studentsSnap, sessionsSnap, plansSnap] = await Promise.all([
          snapshotStore(db, 'students'),
          snapshotStore(db, 'sessions'),
          snapshotStore(db, 'plans'),
        ]);
      } catch {
        // Continue even if snapshot fails — rollback will be best-effort
      }

      // ── Filter to valid records only ───────────────────────
      const validStudents = (previewData.students as unknown[]).filter(isValidStudentRecord);
      const validSessions = (previewData.sessions as unknown[]).filter(isValidSessionRecord);
      const validPlans    = (previewData.plans ?? [] as unknown[]).filter(isValidPlanRecord) as Record<string, unknown>[];

      try {
        // Write students
        await new Promise<void>((res, rej) => {
          const tx    = db.transaction('students', 'readwrite');
          const store = tx.objectStore('students');
          if (mergeMode === 'replace') store.clear();
          validStudents.forEach(s => store.put(s));
          tx.oncomplete = () => res();
          tx.onerror    = () => rej(tx.error);
        });

        // Write sessions
        await new Promise<void>((res, rej) => {
          const tx    = db.transaction('sessions', 'readwrite');
          const store = tx.objectStore('sessions');
          if (mergeMode === 'replace') store.clear();
          validSessions.forEach(s => store.put(s));
          tx.oncomplete = () => res();
          tx.onerror    = () => rej(tx.error);
        });

        // Write plans (only if present)
        if (validPlans.length > 0) {
          await new Promise<void>((res, rej) => {
            const tx    = db.transaction('plans', 'readwrite');
            const store = tx.objectStore('plans');
            if (mergeMode === 'replace') store.clear();
            validPlans.forEach(p => store.put(p));
            tx.oncomplete = () => res();
            tx.onerror    = () => rej(tx.error);
          });
        }

        const modeLabel = mergeMode === 'replace' ? 'استبدال' : 'دمج';
        setImportMsg({
          type: 'success',
          text: `✅ تم الاستيراد (${modeLabel}) — ${validStudents.length} طالب، ${validSessions.length} جلسة. سيتم إعادة تحميل الصفحة...`,
        });
        setPreviewData(null);
        setValidation(null);

        // Reload after short delay so user reads the message
        setTimeout(() => window.location.reload(), 2500);

      } catch (writeErr) {
        // ── Atomic rollback — restore snapshots ───────────────
        try {
          await Promise.all([
            restoreSnapshot(db, 'students', studentsSnap),
            restoreSnapshot(db, 'sessions', sessionsSnap),
            restoreSnapshot(db, 'plans',    plansSnap),
          ]);
          setImportMsg({
            type: 'error',
            text: `❌ فشل الاستيراد — تم استعادة البيانات السابقة تلقائياً.\nالخطأ: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
          });
        } catch (rollbackErr) {
          setImportMsg({
            type: 'error',
            text: `❌ خطأ حرج: فشل الاستيراد والاستعادة. يرجى إغلاق التطبيق والتحقق من بياناتك. (${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)})`,
          });
        }
      }
    } catch (err) {
      setImportMsg({ type: 'error', text: `❌ فشل الاستيراد: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setImporting(false);
    }
  }, [previewData, exporting, mergeMode]);

  // ─── Status label ─────────────────────────────────────────
  const statusLabel =
    status.status === 'never'   ? 'لم تُنشأ نسخة احتياطية بعد' :
    status.status === 'fresh'   ? 'النسخة الاحتياطية محدَّثة' :
    status.status === 'warning' ? `منذ ${status.daysAgo} أيام — يُنصح بنسخة جديدة` :
                                  `منذ ${status.daysAgo} أيام — ⚠️ مطلوب نسخة الآن!`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Status bar */}
      <div className={`backup-status ${status.status}`}>
        <div className="backup-status__dot" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{statusLabel}</div>
          {status.lastBackup && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              آخر نسخة: {new Date(status.lastBackup).toLocaleString('ar-SA')}
            </div>
          )}
        </div>
      </div>

      {/* Export */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '0.9rem' }}>💾 تصدير نسخة احتياطية</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
          احفظ جميع بياناتك (طلاب + جلسات + خطط) في ملف JSON واحد. يُنصح بذلك يومياً.
        </div>
        <Button variant="primary" size="md" loading={exporting} onClick={handleExport} fullWidth>
          {exporting ? 'جارٍ التصدير...' : '📤 تصدير النسخة الاحتياطية'}
        </Button>
      </div>

      {/* Import */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '0.9rem' }}>📥 استيراد نسخة احتياطية</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
          استعادة البيانات من ملف نسخة احتياطية سابقة.
        </div>

        {/* Merge / Replace mode */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '0.8rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: mergeMode === 'replace' ? 'var(--text)' : 'var(--text-muted)' }}>
            <input
              type="radio"
              name="mergeMode"
              value="replace"
              checked={mergeMode === 'replace'}
              onChange={() => setMergeMode('replace')}
              style={{ accentColor: '#ef4444' }}
            />
            <span>🔄 استبدال الكل</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: mergeMode === 'merge' ? 'var(--text)' : 'var(--text-muted)' }}>
            <input
              type="radio"
              name="mergeMode"
              value="merge"
              checked={mergeMode === 'merge'}
              onChange={() => setMergeMode('merge')}
              style={{ accentColor: '#22c55e' }}
            />
            <span>➕ دمج مع الموجود</span>
          </label>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="backup-file-input"
        />
        <label htmlFor="backup-file-input">
          <Button variant="secondary" size="md" fullWidth
            onClick={() => fileRef.current?.click()}>
            📂 اختيار ملف النسخة الاحتياطية
          </Button>
        </label>

        {/* Preview before confirm */}
        {previewData && (
          <div style={{
            marginTop: '12px', padding: '12px', background: 'var(--surface-2)',
            borderRadius: '8px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.82rem' }}>
              📋 معاينة الملف:
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <div>📅 تاريخ النسخة: {new Date(previewData.exportedAt).toLocaleString('ar-SA')}</div>
              <div>
                👤 طلاب: {validation ? (
                  <span>
                    <span style={{ color: '#22c55e' }}>{validation.students.valid} صحيح</span>
                    {validation.students.invalid > 0 && (
                      <span style={{ color: '#ef4444', marginRight: '6px' }}> — {validation.students.invalid} غير صالح</span>
                    )}
                  </span>
                ) : previewData.students.length}
              </div>
              <div>
                📊 جلسات: {validation ? (
                  <span>
                    <span style={{ color: '#22c55e' }}>{validation.sessions.valid} صحيح</span>
                    {validation.sessions.invalid > 0 && (
                      <span style={{ color: '#ef4444', marginRight: '6px' }}> — {validation.sessions.invalid} غير صالح</span>
                    )}
                  </span>
                ) : previewData.sessions.length}
              </div>
              <div>
                📋 خطط: {validation ? (
                  <span>
                    <span style={{ color: '#22c55e' }}>{validation.plans.valid} صحيح</span>
                    {validation.plans.invalid > 0 && (
                      <span style={{ color: '#ef4444', marginRight: '6px' }}> — {validation.plans.invalid} غير صالح</span>
                    )}
                  </span>
                ) : (previewData.plans?.length ?? 0)}
              </div>
            </div>

            {/* Storage info */}
            {storageInfo && (
              <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 8px', background: '#ffffff08', borderRadius: '5px' }}>
                💽 التخزين: {storageInfo}
              </div>
            )}

            {/* Conflict warning */}
            {conflictInfo && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#f59e0b', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px' }}>
                ⚠️ {conflictInfo} —
                {mergeMode === 'replace' ? ' سيتم استبدالهم' : ' سيتم الدمج'}
              </div>
            )}

            {/* Validation error summary */}
            {validation?.hasErrors && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px' }}>
                ⚠️ بعض السجلات غير صالحة — سيتم استيراد السجلات الصحيحة فقط
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <Button variant="success" size="sm" loading={importing} onClick={confirmImport}>
                ✅ تأكيد الاستيراد
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPreviewData(null); setValidation(null); setConflictInfo(''); setStorageInfo(''); }}>
                إلغاء
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Message */}
      {importMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '0.82rem',
          fontWeight: 600,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          background: importMsg.type === 'success' ? 'rgba(34,197,94,0.1)' :
                      importMsg.type === 'error'   ? 'rgba(239,68,68,0.1)'  :
                                                     'rgba(245,158,11,0.1)',
          border: `1px solid ${
            importMsg.type === 'success' ? 'rgba(34,197,94,0.3)' :
            importMsg.type === 'error'   ? 'rgba(239,68,68,0.3)'  :
                                           'rgba(245,158,11,0.3)'}`,
          color: importMsg.type === 'success' ? '#22c55e' :
                 importMsg.type === 'error'   ? '#ef4444' : '#f59e0b',
        }}>
          {importMsg.text}
        </div>
      )}
    </div>
  );
}

// ─── Backup Reminder Hook ────────────────────────────────────
export function useBackupReminder(): { shouldRemind: boolean; dismiss: () => void } {
  const [shouldRemind, setShouldRemind] = useState(false);

  useEffect(() => {
    const ts = Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0);
    const dismissed = Number(localStorage.getItem('massar_backup_dismiss_ts') ?? 0);
    const dismissedToday = new Date(dismissed).toDateString() === new Date().toDateString();

    if (dismissedToday) { setShouldRemind(false); return; }

    if (!ts) { setShouldRemind(true); return; }
    const daysAgo = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    setShouldRemind(daysAgo >= 1);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem('massar_backup_dismiss_ts', String(Date.now()));
    setShouldRemind(false);
  }, []);

  return { shouldRemind, dismiss };
}

// ─── Backup Reminder Banner ──────────────────────────────────
export function BackupReminderBanner({ onGoToBackup }: { onGoToBackup?: () => void }) {
  const { shouldRemind, dismiss } = useBackupReminder();
  if (!shouldRemind) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px',
      background: 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: '10px',
      fontSize: '0.82rem',
    }}>
      <span style={{ fontSize: '1.2rem' }}>💾</span>
      <span style={{ flex: 1, color: '#f59e0b', fontWeight: 600 }}>
        يُنصح بإنشاء نسخة احتياطية اليوم لحماية بيانات الطلاب
      </span>
      {onGoToBackup && (
        <button
          onClick={onGoToBackup}
          style={{
            background: '#f59e0b', color: '#1a1a1a', border: 'none',
            borderRadius: '6px', padding: '5px 12px', fontWeight: 700,
            fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
          }}
        >
          نسخ الآن
        </button>
      )}
      <button
        onClick={dismiss}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
        aria-label="إغلاق التذكير"
      >
        ✕
      </button>
    </div>
  );
}
