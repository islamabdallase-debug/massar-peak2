// ============================================================
//  مسار — Error Utilities (NO React imports — safe for DB use)
//  Extracted to break circular dependency:
//  database.ts → ErrorBoundary.tsx (React component) was causing
//  "Cannot access 'X' before initialization" TDZ errors in prod.
// ============================================================

// ── Types ────────────────────────────────────────────────────
export interface ErrorLog {
  id: string;
  ts: number;
  type: 'render' | 'async' | 'unhandled' | 'db' | 'network';
  message: string;
  stack?: string;
  context?: string;
}

// ── In-memory error log (shared singleton) ───────────────────
export const errorLogs: ErrorLog[] = [];

export function getErrorLogs(): ErrorLog[] {
  return [...errorLogs];
}

export function clearErrorLogs(): void {
  errorLogs.length = 0;
}

export function logError(
  type: ErrorLog['type'],
  message: string,
  stack?: string,
  context?: string
): void {
  const entry: ErrorLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    type,
    message: message.slice(0, 500),
    stack: stack?.slice(0, 1000),
    context,
  };
  errorLogs.push(entry);
  if (errorLogs.length > 100) errorLogs.shift();

  if (import.meta.env.DEV) {
    console.error(`[مسار Error][${type}]`, message, stack ?? '');
  }

  try {
    sessionStorage.setItem(
      'massar_last_error',
      JSON.stringify({ type, message, ts: entry.ts })
    );
  } catch {
    // sessionStorage not available — ignore
  }
}

// ── DB Error helper ──────────────────────────────────────────
export function logDBError(operation: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  logError('db', `DB[${operation}]: ${msg}`);
}

// ── Network Error helper ─────────────────────────────────────
export function logNetworkError(operation: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  logError('network', `Net[${operation}]: ${msg}`);
}

// ── Async retry utility ──────────────────────────────────────
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 300, context = '' }: { retries?: number; delayMs?: number; context?: string } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  logError('async', `Retry failed[${context}]: ${msg}`);
  throw lastError;
}
