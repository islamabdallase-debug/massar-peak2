// ============================================================
//  مسار — PEAK RFT Assessment Platform
//  Types & Interfaces — TypeScript definitions
// ============================================================

export type Lang = 'ar' | 'en' | 'both';

export type PeakModule = 'DT' | 'G' | 'CE' | 'TE';

export type ScoreValue = 1 | 0 | null;

// ─── Student ────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  school?: string;
  grade?: string;
  dob?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface StudentCreate {
  name: string;
  school?: string;
  grade?: string;
  dob?: string;
  notes?: string;
}

// ─── Assessment ─────────────────────────────────────────────
export interface ScoreRecord {
  [itemId: string]: ScoreValue;
}

export interface ModuleScores {
  DT: ScoreRecord;
  G: ScoreRecord;
  CE: ScoreRecord;
  TE: ScoreRecord;
}

export interface SessionSummary {
  module: PeakModule;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pct: number;
  levels: LevelResult[];
}

export interface LevelResult {
  level: number;
  label: string;
  total: number;
  passed: number;
  pct: number;
}

export interface AssessSession {
  id: string;
  studentId: string;
  scores: ModuleScores;
  summary: SessionSummary[];
  lang: Lang;
  savedAt: number;
  updatedAt: number;
  deletedAt?: number;
  /** مدة الجلسة بالثواني — يُحسب من بدء التقييم حتى الحفظ */
  duration?: number;
  /** ملاحظات المعالج على الجلسة */
  notes?: string;
}

// ─── App State ──────────────────────────────────────────────
export type ScreenName =
  | 'dashboard'
  | 'students'
  | 'assess'
  | 'reports'
  | 'report-detail'
  | 'plan'
  | 'ai'
  | 'export'
  | 'tools'
  | 'guide'
  | 'settings'
  | 'analytics'
  | 'admin'
  | 'pricing'
  | 'cloud';

export interface AppState {
  lang: Lang;
  screen: ScreenName;
  selectedStudentId: string | null;
  selectedSessionId: string | null;
  activeModule: PeakModule;
  currentItemIdx: number;
  isSidebarOpen: boolean;
}

// ─── Item (Assessment question) ─────────────────────────────
export interface PeakItem {
  id: string;
  module: PeakModule;
  level: number;
  number: number;
  textAr: string;
  textEn: string;
  image?: string;
  stimulusAr?: string;
  stimulusEn?: string;
}

// ─── Cloud Sync ─────────────────────────────────────────────
export interface SyncConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error' | 'success' | 'offline';
  lastSyncAt: number | null;
  pendingOps: number;
  error?: string;
}

// ─── Report / Plan ──────────────────────────────────────────
export interface ReportData {
  student: Student;
  session: AssessSession;
  summary: SessionSummary[];
  generatedAt: number;
}

export interface PlanItem {
  id: string;
  studentId: string;
  module: PeakModule;
  level: number;
  targetItemId: string;
  strategy: string;
  targetDate?: string;
  status: 'active' | 'mastered' | 'paused';
  createdAt: number;
  updatedAt: number;
}

// ─── Toast ──────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}
