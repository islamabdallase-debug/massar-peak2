// ============================================================
//  مسار — IndexedDB Unit Tests
//  Uses fake-indexeddb for isolated in-memory testing
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

// ── IDB setup: must run BEFORE importing database module ─────
// In each test, assign a fresh factory before any DB call
function setupFreshIDB() {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  (globalThis as Record<string, unknown>).IDBKeyRange = IDBKeyRange;
}

// ── Import DB module (after globalThis is initialized) ───────
import { StudentDB, SessionDB, PlanDB, DBRecovery, resetDBConnection } from '../db/database';
import type { Student, AssessSession, PlanItem } from '../types';

beforeEach(() => {
  setupFreshIDB();
  resetDBConnection();
});

// ── Fixtures ─────────────────────────────────────────────────
const makeStudent = (o: Partial<Student> = {}): Student => ({
  id: 'st-1', name: 'أحمد محمد', nameEn: 'Ahmed',
  dob: '2015-03-12', notes: 'test', centerId: 'c1',
  therapistId: 't1', updatedAt: Date.now(), ...o,
} as Student);

const makeSession = (o: Partial<AssessSession> = {}): AssessSession => ({
  id: 'sess-1', studentId: 'st-1', savedAt: Date.now(), updatedAt: Date.now(),
  summary: [
    { module: 'DT', total: 67, correct: 50, pct: 75, levels: [] },
    { module: 'G',  total: 65, correct: 40, pct: 61, levels: [] },
  ], ...o,
} as AssessSession);

const makePlan = (o: Partial<PlanItem> = {}): PlanItem => ({
  id: 'plan-1', studentId: 'st-1', module: 'DT', level: 1,
  goal: 'تحسين', strategy: 'DTT', status: 'active', createdAt: Date.now(),
  targetDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  ...o,
} as PlanItem);

// ── StudentDB ─────────────────────────────────────────────────
describe('StudentDB', () => {
  it('adds and retrieves a student', async () => {
    await StudentDB.add(makeStudent());
    const found = await StudentDB.getById('st-1');
    expect(found?.name).toBe('أحمد محمد');
  });

  it('getAll returns only non-deleted students', async () => {
    await StudentDB.add(makeStudent({ id: 'st1', name: 'Ayesha' }));
    await StudentDB.add(makeStudent({ id: 'st2', name: 'Omar' }));
    await StudentDB.softDelete('st1');
    const all = await StudentDB.getAll();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Omar');
  });

  it('updates a student correctly', async () => {
    await StudentDB.add(makeStudent());
    await StudentDB.update({ ...makeStudent(), name: 'اسم جديد' });
    const updated = await StudentDB.getById('st-1');
    expect(updated?.name).toBe('اسم جديد');
  });

  it('count returns correct number', async () => {
    await StudentDB.add(makeStudent({ id: 'sc1', name: 'A' }));
    await StudentDB.add(makeStudent({ id: 'sc2', name: 'B' }));
    expect(await StudentDB.count()).toBe(2);
  });

  it('rejects invalid student data', async () => {
    await expect(StudentDB.add({ id: '', name: '' } as Student)).rejects.toThrow();
  });

  it('getById returns undefined for missing id', async () => {
    expect(await StudentDB.getById('nonexistent')).toBeUndefined();
  });

  it('handles empty id gracefully', async () => {
    expect(await StudentDB.getById('')).toBeUndefined();
  });
});

// ── SessionDB ─────────────────────────────────────────────────
describe('SessionDB', () => {
  it('saves and retrieves a session', async () => {
    await SessionDB.save(makeSession());
    const found = await SessionDB.getById('sess-1');
    expect(found?.summary.length).toBe(2);
  });

  it('getByStudentId returns correct sessions', async () => {
    await SessionDB.save(makeSession({ id: 'sa1', studentId: 'st-a' }));
    await SessionDB.save(makeSession({ id: 'sa2', studentId: 'st-a' }));
    await SessionDB.save(makeSession({ id: 'sb1', studentId: 'st-b' }));
    expect((await SessionDB.getByStudentId('st-a')).length).toBe(2);
    expect((await SessionDB.getByStudentId('st-b')).length).toBe(1);
  });

  it('softDelete hides session from getAll', async () => {
    await SessionDB.save(makeSession({ id: 'del-1' }));
    await SessionDB.softDelete('del-1');
    const all = await SessionDB.getAll();
    expect(all.find((s) => s.id === 'del-1')).toBeUndefined();
  });

  it('rejects invalid session missing summary', async () => {
    await expect(
      SessionDB.save({ id: 'x', studentId: 'y', savedAt: Date.now() } as AssessSession)
    ).rejects.toThrow();
  });

  it('getByStudentId returns [] for empty id', async () => {
    expect(await SessionDB.getByStudentId('')).toEqual([]);
  });
});

// ── PlanDB ────────────────────────────────────────────────────
describe('PlanDB', () => {
  it('saves and retrieves a plan', async () => {
    await PlanDB.save(makePlan());
    const plans = await PlanDB.getByStudentId('st-1');
    expect(plans.length).toBe(1);
    expect(plans[0].goal).toBe('تحسين');
  });

  it('delete removes a plan', async () => {
    await PlanDB.save(makePlan({ id: 'del-p' }));
    await PlanDB.delete('del-p');
    const plans = await PlanDB.getByStudentId('st-1');
    expect(plans.find((p) => p.id === 'del-p')).toBeUndefined();
  });

  it('count returns correct number', async () => {
    await PlanDB.save(makePlan({ id: 'p1' }));
    await PlanDB.save(makePlan({ id: 'p2', studentId: 'st2' }));
    expect(await PlanDB.count()).toBe(2);
  });
});

// ── DBRecovery ────────────────────────────────────────────────
describe('DBRecovery', () => {
  it('audit returns empty array for clean DB', async () => {
    await StudentDB.add(makeStudent());
    await SessionDB.save(makeSession());
    expect(await DBRecovery.audit()).toEqual([]);
  });

  it('exportAll returns correct structure', async () => {
    await StudentDB.add(makeStudent());
    await SessionDB.save(makeSession());
    const exported = await DBRecovery.exportAll();
    expect(exported.students.length).toBe(1);
    expect(exported.sessions.length).toBe(1);
    expect(exported.exportedAt).toBeGreaterThan(0);
  });
});
