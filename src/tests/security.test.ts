// ============================================================
//  مسار — Security Utilities Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizeField,
  safeNumber,
  safeTimestamp,
  csvCell,
  buildCSV,
  safeJSON,
  validateImportFile,
  validateImportedStudents,
  validateImportedSessions,
  validateImportedPlans,
} from '../services/security';

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes quotes', () => {
    expect(sanitizeText('"hello"')).toBe('&quot;hello&quot;');
    expect(sanitizeText("it's")).toBe('it&#x27;s');
  });

  it('removes null bytes', () => {
    expect(sanitizeText('hello\0world')).toBe('helloworld');
  });

  it('returns empty string for non-strings', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });
});

describe('sanitizeField', () => {
  it('respects maxLength', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeField(long, 500).length).toBe(500);
  });
});

describe('safeNumber', () => {
  it('returns number for valid input', () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber('3.14')).toBeCloseTo(3.14);
  });

  it('returns fallback for invalid', () => {
    expect(safeNumber('abc')).toBe(0);
    expect(safeNumber(NaN)).toBe(0);
    expect(safeNumber(Infinity)).toBe(0);
    expect(safeNumber(null, -1)).toBe(-1);
  });
});

describe('safeTimestamp', () => {
  it('accepts valid timestamps', () => {
    const ts = Date.now();
    expect(safeTimestamp(ts)).toBe(ts);
  });

  it('rejects timestamps before 2020', () => {
    const old = new Date('2000-01-01').getTime();
    expect(safeTimestamp(old)).toBeGreaterThan(old);
  });

  it('rejects zero', () => {
    expect(safeTimestamp(0)).toBeGreaterThan(0);
  });
});

describe('csvCell', () => {
  it('wraps cells with commas in quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes', () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('prevents formula injection', () => {
    expect(csvCell('=SUM(A1)')).toMatch(/^'/);
    expect(csvCell('+cmd')).toMatch(/^'/);
    expect(csvCell('-1+1')).toMatch(/^'/);
  });

  it('returns plain string for safe values', () => {
    expect(csvCell('Ahmed')).toBe('Ahmed');
    expect(csvCell(42)).toBe('42');
  });
});

describe('buildCSV', () => {
  it('starts with BOM', () => {
    const csv = buildCSV(['A', 'B'], [['1', '2']]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('builds correct structure', () => {
    const csv = buildCSV(['Name', 'Score'], [['Ahmed', '95']]);
    expect(csv).toContain('Name,Score');
    expect(csv).toContain('Ahmed,95');
  });
});

describe('safeJSON', () => {
  it('parses valid JSON', () => {
    expect(safeJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON', () => {
    expect(safeJSON('{bad json')).toBeNull();
    expect(safeJSON('')).toBeNull();
  });
});

describe('validateImportFile', () => {
  it('rejects empty files', () => {
    const file = new File([], 'test.json', { type: 'application/json' });
    expect(validateImportFile(file).ok).toBe(false);
  });

  it('rejects non-JSON/CSV files', () => {
    const file = new File(['data'], 'test.exe', { type: 'application/octet-stream' });
    expect(validateImportFile(file).ok).toBe(false);
  });

  it('accepts valid JSON files', () => {
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    expect(validateImportFile(file).ok).toBe(true);
  });
});

describe('validateImportedStudents', () => {
  const validStudent = {
    id: 'st1',
    name: 'أحمد محمد',
    updatedAt: Date.now(),
  };

  it('accepts valid students', () => {
    const { valid, skipped } = validateImportedStudents([validStudent]);
    expect(valid.length).toBe(1);
    expect(skipped).toBe(0);
  });

  it('rejects students missing id', () => {
    const { valid, skipped } = validateImportedStudents([{ name: 'Ahmed', updatedAt: Date.now() }]);
    expect(valid.length).toBe(0);
    expect(skipped).toBe(1);
  });

  it('rejects students missing name', () => {
    const { valid, skipped } = validateImportedStudents([{ id: 's1', updatedAt: Date.now() }]);
    expect(valid.length).toBe(0);
    expect(skipped).toBe(1);
  });

  it('sanitizes XSS in name', () => {
    const { valid } = validateImportedStudents([{
      ...validStudent,
      name: '<script>alert(1)</script>',
    }]);
    expect(valid[0].name).not.toContain('<script>');
  });

  it('skips non-object records', () => {
    const { skipped } = validateImportedStudents(['string', 42, null]);
    expect(skipped).toBe(3);
  });
});

describe('validateImportedSessions', () => {
  const validSession = {
    id: 'sess1',
    studentId: 'st1',
    savedAt: Date.now(),
    updatedAt: Date.now(),
    summary: [{ module: 'DT', total: 67, correct: 50, pct: 75 }],
  };

  it('accepts valid sessions', () => {
    const { valid } = validateImportedSessions([validSession]);
    expect(valid.length).toBe(1);
  });

  it('rejects sessions missing summary array', () => {
    const { skipped } = validateImportedSessions([{ id: 's1', studentId: 'st1', savedAt: Date.now() }]);
    expect(skipped).toBe(1);
  });
});

describe('validateImportedPlans', () => {
  const validPlan = {
    id: 'plan1',
    studentId: 'st1',
    module: 'DT',
    goal: 'Improve',
    strategy: 'DTT',
  };

  it('accepts valid plans', () => {
    const { valid } = validateImportedPlans([validPlan]);
    expect(valid.length).toBe(1);
  });

  it('rejects plans missing studentId', () => {
    const { skipped } = validateImportedPlans([{ id: 'p1', module: 'DT' }]);
    expect(skipped).toBe(1);
  });
});
