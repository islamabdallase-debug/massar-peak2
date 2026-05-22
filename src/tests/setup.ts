// ============================================================
//  مسار — Vitest Test Setup
// ============================================================

import '@testing-library/jest-dom';

// ── Polyfill IndexedDB for jsdom (which doesn't include it) ──
// fake-indexeddb v6: explicitly assign all required globals
import {
  IDBFactory,
  IDBKeyRange,
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBIndex,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
} from 'fake-indexeddb';

// Assign to globalThis so ALL modules in the test see them
Object.assign(globalThis, {
  indexedDB:            new IDBFactory(),
  IDBKeyRange,
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBIndex,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
});

// ── Per-test DB isolation ────────────────────────────────────
import { resetDBConnection } from '../db/database';

beforeEach(() => {
  // Give each test a fresh IDBFactory instance (clean DB state)
  (globalThis as unknown as Record<string, unknown>).indexedDB = new IDBFactory();
  // Reset the cached DB connection in the module
  resetDBConnection();
});

// ── Suppress known test noise ────────────────────────────────
const originalError = console.error.bind(console);
const originalWarn  = console.warn.bind(console);

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('Warning: ReactDOM') || msg.includes('act(') || msg.includes('Not implemented:')) return;
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('esbuild') || msg.includes('deprecated') || msg.includes('oxc')) return;
    originalWarn(...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn  = originalWarn;
});
