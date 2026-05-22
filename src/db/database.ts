// ============================================================
//  مسار — IndexedDB wrapper  v5.1.0
//  Production-grade: validation, recovery, retry, transaction
//  safety, schema guards, corrupted-data handling
// ============================================================

import type { Student, AssessSession, PlanItem } from '@/types';
import { logDBError, withRetry } from '@/utils/errorUtils';

const DB_NAME   = 'peakDB';
const DB_VERSION = 5;

const STORES = {
  STUDENTS:       'students',
  SESSIONS:       'sessions',
  PLANS:          'plans',
  SYNC_META:      'syncMeta',
  SESSION_DRAFTS: 'sessionDrafts',
} as const;

// ─── Session Draft Type ──────────────────────────────────────
export interface SessionDraft {
  studentId: string;   // keyPath — one draft per student
  scores:    Record<string, Record<string, number | null>>;
  startedAt: number;
  savedAt:   number;
}

// ─── Dynamic IDB getter (supports test mocking) ──────────────
function _getIDB(): IDBFactory {
  const idb = (globalThis as unknown as Record<string, unknown>).indexedDB as IDBFactory | undefined;
  if (!idb) throw new Error('IndexedDB is not available in this environment');
  return idb;
}


// ─── Singleton connection with recovery ─────────────────────
let _db: IDBDatabase | null = null;
let _opening = false;
let _openCallbacks: Array<(db: IDBDatabase | null, err?: Error) => void> = [];

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    if (_opening) {
      // Queue callback while open is in progress
      _openCallbacks.push((db, err) => (err ? reject(err) : resolve(db!)));
      return;
    }
    _opening = true;

    const req = _getIDB().open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      _createOrUpgradeStores(db);
    };

    req.onsuccess = () => {
      _db = req.result;
      _opening = false;

      // Handle unexpected connection close
      _db.onclose = () => { _db = null; };
      _db.onerror = (e) => {
        logDBError('connection', (e.target as IDBDatabase)?.toString() ?? 'unknown');
      };

      const cbs = _openCallbacks.splice(0);
      resolve(_db);
      cbs.forEach((cb) => cb(_db!));
    };

    req.onerror = () => {
      _opening = false;
      const err = new Error(req.error?.message ?? 'Failed to open IndexedDB');
      const cbs = _openCallbacks.splice(0);
      reject(err);
      cbs.forEach((cb) => cb(null, err));
    };

    req.onblocked = () => {
      if (import.meta.env.DEV) {
        console.warn('[مسار DB] Database upgrade blocked — close other tabs');
      }
    };
  });
}

/** Creates or upgrades object stores idempotently */
function _createOrUpgradeStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORES.STUDENTS)) {
    const s = db.createObjectStore(STORES.STUDENTS, { keyPath: 'id' });
    s.createIndex('updatedAt', 'updatedAt');
    s.createIndex('name', 'name');
  }
  if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
    const s = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
    s.createIndex('studentId', 'studentId');
    s.createIndex('savedAt', 'savedAt');
    s.createIndex('updatedAt', 'updatedAt');
  }
  if (!db.objectStoreNames.contains(STORES.PLANS)) {
    const s = db.createObjectStore(STORES.PLANS, { keyPath: 'id' });
    s.createIndex('studentId', 'studentId');
  }
  if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
    db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains(STORES.SESSION_DRAFTS)) {
    db.createObjectStore(STORES.SESSION_DRAFTS, { keyPath: 'studentId' });
  }
}

/** Reset cached connection — used in recovery and tests */
export function resetDBConnection(): void {
  if (_db) {
    try { _db.close(); } catch { /* ignore */ }
    _db = null;
  }
  // Also reset opening state so next openDB() can retry cleanly
  _opening = false;
  _openCallbacks.length = 0;
}

// ─── Generic helpers ────────────────────────────────────────
function tx(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  return openDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    transaction.onerror = () =>
      logDBError(`tx[${storeName}]`, transaction.error);
    return transaction.objectStore(storeName);
  });
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return promisify(store.getAll() as IDBRequest<T[]>);
}

// ─── Validation guards ───────────────────────────────────────
function isValidStudent(s: unknown): s is Student {
  if (!s || typeof s !== 'object') return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.name === 'string' && obj.name.length > 0 &&
    typeof obj.updatedAt === 'number'
  );
}

function isValidSession(s: unknown): s is AssessSession {
  if (!s || typeof s !== 'object') return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.studentId === 'string' && obj.studentId.length > 0 &&
    typeof obj.savedAt === 'number' &&
    Array.isArray(obj.summary)
  );
}

function isValidPlan(p: unknown): p is PlanItem {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.studentId === 'string' && obj.studentId.length > 0
  );
}

// ─── Students ───────────────────────────────────────────────
export const StudentDB = {
  async getAll(): Promise<Student[]> {
    try {
      const store = await tx(STORES.STUDENTS);
      const rows = await getAll<unknown>(store);
      return rows
        .filter(isValidStudent)
        .filter((r) => !r.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
      logDBError('StudentDB.getAll', err);
      return [];
    }
  },

  async getById(id: string): Promise<Student | undefined> {
    if (!id) return undefined;
    try {
      const store = await tx(STORES.STUDENTS);
      const result = await promisify(store.get(id));
      return isValidStudent(result) ? result : undefined;
    } catch (err) {
      logDBError('StudentDB.getById', err);
      return undefined;
    }
  },

  async add(student: Student): Promise<void> {
    if (!isValidStudent(student)) {
      throw new Error('Invalid student data');
    }
    await withRetry(
      async () => {
        const store = await tx(STORES.STUDENTS, 'readwrite');
        await promisify(store.put(student));
      },
      { retries: 2, context: 'StudentDB.add' }
    );
  },

  async update(student: Student): Promise<void> {
    if (!isValidStudent(student)) {
      throw new Error('Invalid student data');
    }
    await withRetry(
      async () => {
        const store = await tx(STORES.STUDENTS, 'readwrite');
        await promisify(store.put({ ...student, updatedAt: Date.now() }));
      },
      { retries: 2, context: 'StudentDB.update' }
    );
  },

  async softDelete(id: string): Promise<void> {
    if (!id) return;
    try {
      const store = await tx(STORES.STUDENTS, 'readwrite');
      const student = await promisify<unknown>(store.get(id));
      if (isValidStudent(student)) {
        await promisify(
          store.put({ ...student, deletedAt: Date.now(), updatedAt: Date.now() })
        );
      }
    } catch (err) {
      logDBError('StudentDB.softDelete', err);
      throw err;
    }
  },

  async count(): Promise<number> {
    try {
      const students = await this.getAll();
      return students.length;
    } catch {
      return 0;
    }
  },
};

// ─── Sessions ───────────────────────────────────────────────
export const SessionDB = {
  async getAll(): Promise<AssessSession[]> {
    try {
      const store = await tx(STORES.SESSIONS);
      const rows = await getAll<unknown>(store);
      return rows
        .filter(isValidSession)
        .filter((r) => !r.deletedAt)
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch (err) {
      logDBError('SessionDB.getAll', err);
      return [];
    }
  },

  async getByStudentId(studentId: string): Promise<AssessSession[]> {
    if (!studentId) return [];
    try {
      const store = await tx(STORES.SESSIONS);
      const index = store.index('studentId');
      const rows = await promisify<unknown[]>(
        index.getAll(studentId) as IDBRequest<unknown[]>
      );
      return rows
        .filter(isValidSession)
        .filter((r) => !r.deletedAt)
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch (err) {
      logDBError('SessionDB.getByStudentId', err);
      return [];
    }
  },

  async getById(id: string): Promise<AssessSession | undefined> {
    if (!id) return undefined;
    try {
      const store = await tx(STORES.SESSIONS);
      const result = await promisify(store.get(id));
      return isValidSession(result) ? result : undefined;
    } catch (err) {
      logDBError('SessionDB.getById', err);
      return undefined;
    }
  },

  async save(session: AssessSession): Promise<void> {
    if (!isValidSession(session)) {
      throw new Error('Invalid session data');
    }
    await withRetry(
      async () => {
        const store = await tx(STORES.SESSIONS, 'readwrite');
        await promisify(store.put(session));
      },
      { retries: 2, context: 'SessionDB.save' }
    );
  },

  async softDelete(id: string): Promise<void> {
    if (!id) return;
    try {
      const store = await tx(STORES.SESSIONS, 'readwrite');
      const session = await promisify<unknown>(store.get(id));
      if (isValidSession(session)) {
        await promisify(
          store.put({ ...session, deletedAt: Date.now(), updatedAt: Date.now() })
        );
      }
    } catch (err) {
      logDBError('SessionDB.softDelete', err);
      throw err;
    }
  },

  async getChangedSince(ts: number): Promise<AssessSession[]> {
    try {
      const store = await tx(STORES.SESSIONS);
      const rows = await getAll<unknown>(store);
      return rows
        .filter(isValidSession)
        .filter((r) => r.updatedAt > ts);
    } catch (err) {
      logDBError('SessionDB.getChangedSince', err);
      return [];
    }
  },

  async count(): Promise<number> {
    try {
      const sessions = await this.getAll();
      return sessions.length;
    } catch {
      return 0;
    }
  },
};

// ─── Plans ──────────────────────────────────────────────────
export const PlanDB = {
  async getByStudentId(studentId: string): Promise<PlanItem[]> {
    if (!studentId) return [];
    try {
      const store = await tx(STORES.PLANS);
      const index = store.index('studentId');
      const rows = await promisify<unknown[]>(
        index.getAll(studentId) as IDBRequest<unknown[]>
      );
      return rows.filter(isValidPlan);
    } catch (err) {
      logDBError('PlanDB.getByStudentId', err);
      return [];
    }
  },

  async save(plan: PlanItem): Promise<void> {
    if (!isValidPlan(plan)) {
      throw new Error('Invalid plan data');
    }
    await withRetry(
      async () => {
        const store = await tx(STORES.PLANS, 'readwrite');
        await promisify(store.put(plan));
      },
      { retries: 2, context: 'PlanDB.save' }
    );
  },

  async delete(id: string): Promise<void> {
    if (!id) return;
    try {
      const store = await tx(STORES.PLANS, 'readwrite');
      await promisify(store.delete(id));
    } catch (err) {
      logDBError('PlanDB.delete', err);
      throw err;
    }
  },

  async count(): Promise<number> {
    try {
      const store = await tx(STORES.PLANS);
      const rows = await getAll<unknown>(store);
      return rows.filter(isValidPlan).length;
    } catch {
      return 0;
    }
  },
};

// ─── Sync Meta ──────────────────────────────────────────────
export const SyncMetaDB = {
  async get(key: string): Promise<{ key: string; value: unknown } | undefined> {
    if (!key) return undefined;
    try {
      const store = await tx(STORES.SYNC_META);
      return promisify(store.get(key));
    } catch (err) {
      logDBError('SyncMetaDB.get', err);
      return undefined;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    if (!key) return;
    try {
      const store = await tx(STORES.SYNC_META, 'readwrite');
      await promisify(store.put({ key, value }));
    } catch (err) {
      logDBError('SyncMetaDB.set', err);
      throw err;
    }
  },
};

// ─── Recovery Utilities ──────────────────────────────────────
export const DBRecovery = {
  /** Export all valid data as JSON — used before nuke or for backup */
  async exportAll(): Promise<{
    students: Student[];
    sessions: AssessSession[];
    plans: PlanItem[];
    exportedAt: number;
  }> {
    const [students, sessions, plans] = await Promise.all([
      StudentDB.getAll(),
      SessionDB.getAll(),
      (async () => {
        const all = await StudentDB.getAll();
        const nested = await Promise.all(all.map((s) => PlanDB.getByStudentId(s.id)));
        return nested.flat();
      })(),
    ]);
    return { students, sessions, plans, exportedAt: Date.now() };
  },

  /** Validate DB integrity — returns list of issues found */
  async audit(): Promise<string[]> {
    const issues: string[] = [];
    try {
      const store = await tx(STORES.STUDENTS);
      const rawStudents = await getAll<unknown>(store);
      const invalid = rawStudents.filter((r) => !isValidStudent(r));
      if (invalid.length) issues.push(`${invalid.length} corrupted student record(s)`);
    } catch (err) {
      issues.push(`Cannot read students: ${String(err)}`);
    }

    try {
      const store = await tx(STORES.SESSIONS);
      const rawSessions = await getAll<unknown>(store);
      const invalid = rawSessions.filter((r) => !isValidSession(r));
      if (invalid.length) issues.push(`${invalid.length} corrupted session record(s)`);
    } catch (err) {
      issues.push(`Cannot read sessions: ${String(err)}`);
    }

    try {
      const store = await tx(STORES.PLANS);
      const rawPlans = await getAll<unknown>(store);
      const invalid = rawPlans.filter((r) => !isValidPlan(r));
      if (invalid.length) issues.push(`${invalid.length} corrupted plan record(s)`);
    } catch (err) {
      issues.push(`Cannot read plans: ${String(err)}`);
    }

    return issues;
  },

  /** Clear all data — use only in Tools screen with confirmation */
  async clearAll(): Promise<void> {
    resetDBConnection();
    await new Promise<void>((resolve, reject) => {
      const req = _getIDB().deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};

// ─── Draft DB ────────────────────────────────────────────────
// Stores one draft per student (keyed by studentId).
// Acts as a crash-safe redundant backup alongside localStorage.
export const DraftDB = {
  /** Upsert (fire-and-forget safe) */
  async save(draft: SessionDraft): Promise<void> {
    try {
      const store = await tx(STORES.SESSION_DRAFTS, 'readwrite');
      await promisify(store.put(draft));
    } catch (err) {
      logDBError('DraftDB.save', err);
    }
  },

  /** Retrieve draft; returns null if missing, invalid, or >24h old */
  async get(studentId: string): Promise<SessionDraft | null> {
    if (!studentId) return null;
    try {
      const store  = await tx(STORES.SESSION_DRAFTS);
      const result = await promisify(store.get(studentId));
      if (!result || typeof result !== 'object') return null;
      const d = result as SessionDraft;
      // Discard drafts older than 24 hours
      if (Date.now() - d.savedAt > 24 * 60 * 60 * 1000) {
        await DraftDB.delete(studentId);
        return null;
      }
      return d;
    } catch (err) {
      logDBError('DraftDB.get', err);
      return null;
    }
  },

  /** Delete draft (called on successful session save) */
  async delete(studentId: string): Promise<void> {
    if (!studentId) return;
    try {
      const store = await tx(STORES.SESSION_DRAFTS, 'readwrite');
      await promisify(store.delete(studentId));
    } catch {
      /* ignore — non-critical */
    }
  },
};

// ─── Storage Quota Utility ───────────────────────────────────
export interface StorageQuotaResult {
  used:   number;   // bytes used
  quota:  number;   // total bytes available
  pct:    number;   // 0–100
  isLow:  boolean;  // true when pct > 80
  label:  string;   // human-readable summary (Arabic)
}

/**
 * Returns storage usage estimate.
 * Safe to call without await — returns a "no data" result if API unavailable.
 */
export async function checkStorageQuota(): Promise<StorageQuotaResult> {
  const unavailable: StorageQuotaResult = {
    used: 0, quota: 0, pct: 0, isLow: false,
    label: 'معلومات التخزين غير متاحة',
  };

  try {
    if (!('storage' in navigator) || !navigator.storage?.estimate) return unavailable;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const pct = quota > 0 ? Math.round((usage / quota) * 100) : 0;
    const usedMB  = (usage  / 1_048_576).toFixed(1);
    const quotaMB = (quota  / 1_048_576).toFixed(0);
    return {
      used:  usage,
      quota,
      pct,
      isLow: pct > 80,
      label: `${usedMB} MB من أصل ${quotaMB} MB (${pct}%)`,
    };
  } catch {
    return unavailable;
  }
}
