// ============================================================
//  مسار — Security Utilities  v5.0.0
//  Sanitization · Import validation · XSS prevention
//  Safe export · Input guards
// ============================================================

import type { Student, AssessSession, PlanItem } from '@/types';

// ─── Text sanitization ───────────────────────────────────────

/** Strip all HTML tags from a string to prevent XSS */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    // Remove null bytes
    .replace(/\0/g, '')
    .trim();
}

/** Sanitize and limit string length */
export function sanitizeField(
  input: unknown,
  maxLength = 500
): string {
  const s = sanitizeText(input);
  return s.slice(0, maxLength);
}

/** Safe numeric value — returns fallback on invalid/null/undefined */
export function safeNumber(input: unknown, fallback = 0): number {
  if (input === null || input === undefined) return fallback;
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

/** Safe timestamp — returns Date.now() on invalid */
export function safeTimestamp(input: unknown): number {
  const n = safeNumber(input, 0);
  // Reject timestamps before year 2020 or after year 2100
  if (n > 1577836800000 && n < 4102444800000) return n;
  return Date.now();
}

// ─── Import validation (JSON restore) ───────────────────────

interface ImportResult<T> {
  valid: T[];
  skipped: number;
  errors: string[];
}

/** Validate and sanitize imported student records */
export function validateImportedStudents(
  raw: unknown[]
): ImportResult<Student> {
  const valid: Student[] = [];
  const errors: string[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      errors.push('Non-object student record skipped');
      continue;
    }
    const s = item as Record<string, unknown>;

    if (typeof s.id !== 'string' || !s.id.trim()) {
      errors.push('Student missing id — skipped');
      continue;
    }
    if (typeof s.name !== 'string' || !s.name.trim()) {
      errors.push(`Student ${s.id}: missing name — skipped`);
      continue;
    }

    valid.push({
      id: sanitizeField(s.id, 64),
      name: sanitizeField(s.name, 200),
      nameEn: sanitizeField(s.nameEn, 200),
      dob: sanitizeField(s.dob, 20),
      notes: sanitizeField(s.notes, 2000),
      centerId: sanitizeField(s.centerId, 64),
      therapistId: sanitizeField(s.therapistId, 64),
      updatedAt: safeTimestamp(s.updatedAt),
      deletedAt: s.deletedAt ? safeTimestamp(s.deletedAt) : undefined,
    } as Student);
  }

  return { valid, skipped: raw.length - valid.length, errors };
}

/** Validate and sanitize imported session records */
export function validateImportedSessions(
  raw: unknown[]
): ImportResult<AssessSession> {
  const valid: AssessSession[] = [];
  const errors: string[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      errors.push('Non-object session record skipped');
      continue;
    }
    const s = item as Record<string, unknown>;

    if (typeof s.id !== 'string' || !s.id.trim()) {
      errors.push('Session missing id — skipped');
      continue;
    }
    if (typeof s.studentId !== 'string' || !s.studentId.trim()) {
      errors.push(`Session ${s.id}: missing studentId — skipped`);
      continue;
    }
    if (!Array.isArray(s.summary)) {
      errors.push(`Session ${s.id}: missing summary array — skipped`);
      continue;
    }

    // Validate summary items
    const cleanSummary = (s.summary as unknown[]).filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const si = item as Record<string, unknown>;
      return typeof si.module === 'string' && typeof si.total === 'number';
    });

    valid.push({
      ...s,
      id: sanitizeField(s.id, 64),
      studentId: sanitizeField(s.studentId, 64),
      savedAt: safeTimestamp(s.savedAt),
      updatedAt: safeTimestamp(s.updatedAt ?? s.savedAt),
      summary: cleanSummary,
    } as AssessSession);
  }

  return { valid, skipped: raw.length - valid.length, errors };
}

/** Validate and sanitize imported plan records */
export function validateImportedPlans(
  raw: unknown[]
): ImportResult<PlanItem> {
  const valid: PlanItem[] = [];
  const errors: string[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      errors.push('Non-object plan record skipped');
      continue;
    }
    const p = item as Record<string, unknown>;

    if (typeof p.id !== 'string' || !p.id.trim()) {
      errors.push('Plan missing id — skipped');
      continue;
    }
    if (typeof p.studentId !== 'string' || !p.studentId.trim()) {
      errors.push(`Plan ${p.id}: missing studentId — skipped`);
      continue;
    }

    valid.push({
      ...p,
      id: sanitizeField(p.id, 64),
      studentId: sanitizeField(p.studentId, 64),
      module: sanitizeField(p.module, 10),
      goal: sanitizeField(p.goal, 2000),
      strategy: sanitizeField(p.strategy, 2000),
      notes: sanitizeField(p.notes, 2000),
    } as PlanItem);
  }

  return { valid, skipped: raw.length - valid.length, errors };
}

// ─── Safe JSON parse ─────────────────────────────────────────

/** Parse JSON safely — returns null on any error */
export function safeJSON<T = unknown>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

// ─── File validation ─────────────────────────────────────────

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateImportFile(file: File): FileValidationResult {
  if (!file) return { ok: false, error: 'لم يتم اختيار ملف' };

  if (file.size === 0) return { ok: false, error: 'الملف فارغ' };

  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    return {
      ok: false,
      error: `حجم الملف كبير جداً (الحد الأقصى: ${MAX_IMPORT_SIZE_BYTES / 1024 / 1024} MB)`,
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['json', 'csv'].includes(ext ?? '')) {
    return { ok: false, error: 'نوع الملف غير مدعوم — يقبل فقط JSON أو CSV' };
  }

  return { ok: true };
}

// ─── CSP nonce helper ────────────────────────────────────────
// (For inline scripts/styles when CSP is applied server-side)
export function getCSPNonce(): string | undefined {
  return document
    .querySelector('meta[name="csp-nonce"]')
    ?.getAttribute('content') ?? undefined;
}

// ─── Safe CSV generation ─────────────────────────────────────

/** Escape a CSV cell value to prevent injection */
export function csvCell(value: unknown): string {
  const s = String(value ?? '');
  // If cell starts with = + - @ it could be a formula injection
  const sanitized = s.replace(/^[=+\-@\t\r\n]/, "'$&");
  // Wrap in quotes if it contains comma, quote, or newline
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return '"' + sanitized.replace(/"/g, '""') + '"';
  }
  return sanitized;
}

/** Generate a safe CSV string from rows */
export function buildCSV(headers: string[], rows: unknown[][]): string {
  const header = headers.map(csvCell).join(',');
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  // \uFEFF = UTF-8 BOM prefix for Arabic Excel compatibility
  return '\uFEFF' + header + '\n' + body;
}
