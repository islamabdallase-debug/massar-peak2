// ============================================================
//  مسار — App Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Lang,
  ScreenName,
  PeakModule,
  Student,
  AssessSession,
  ModuleScores,
  SyncStatus,
  Toast,
  ToastType,
} from '@/types';

// ─── Toasts helper ──────────────────────────────────────────
let _toastCounter = 0;
function makeToastId() {
  return `toast_${++_toastCounter}`;
}

// ─── Store Interface ────────────────────────────────────────
export interface AppStore {
  // ── UI
  lang: Lang;
  theme: 'dark' | 'light';
  screen: ScreenName;
  isSidebarOpen: boolean;
  toasts: Toast[];

  // ── Data
  students: Student[];
  sessions: AssessSession[];

  // ── Assessment state
  selectedStudentId: string | null;
  selectedSessionId: string | null;
  activeModule: PeakModule;
  currentItemIdx: number;
  scores: ModuleScores;

  // ── Cloud
  syncStatus: SyncStatus;

  // ── Actions: Navigation
  setScreen: (screen: ScreenName) => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // ── Actions: Students
  setStudents: (students: Student[]) => void;
  addStudent: (student: Student) => void;
  updateStudent: (student: Student) => void;
  removeStudent: (id: string) => void;

  // ── Actions: Sessions
  setSessions: (sessions: AssessSession[]) => void;
  addSession: (session: AssessSession) => void;

  // ── Actions: Assessment
  selectStudent: (id: string | null) => void;
  selectSession: (id: string | null) => void;
  setActiveModule: (module: PeakModule) => void;
  setCurrentItemIdx: (idx: number) => void;
  recordScore: (module: PeakModule, itemId: string, value: 1 | 0 | null) => void;
  clearScores: () => void;
  clearModuleScores: (module: PeakModule) => void;

  // ── Actions: Cloud
  setSyncStatus: (status: Partial<SyncStatus>) => void;

  // ── Actions: Toasts
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

// ─── Store ──────────────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        // ── Initial state
        lang: 'ar',
        theme: 'dark',
        screen: 'dashboard',
        isSidebarOpen: true,
        toasts: [],

        students: [],
        sessions: [],

        selectedStudentId: null,
        selectedSessionId: null,
        activeModule: 'DT',
        currentItemIdx: 0,
        scores: { DT: {}, G: {}, CE: {}, TE: {} },

        syncStatus: {
          state: 'idle',
          lastSyncAt: null,
          pendingOps: 0,
        },

        // ── Navigation
        setScreen: (screen) => set({ screen }),
        setLang: (lang) => {
          set({ lang });
          document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
          document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
        },
        setTheme: (theme) => {
          set({ theme });
          document.documentElement.dataset.theme = theme;
        },
        toggleTheme: () =>
          set((s) => {
            const next = s.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            return { theme: next };
          }),
        toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
        setSidebarOpen: (open) => set({ isSidebarOpen: open }),

        // ── Students
        setStudents: (students) => set({ students }),
        addStudent: (student) =>
          set((s) => ({ students: [student, ...s.students] })),
        updateStudent: (student) =>
          set((s) => ({
            students: s.students.map((st) =>
              st.id === student.id ? student : st
            ),
          })),
        removeStudent: (id) =>
          set((s) => ({
            students: s.students.filter((st) => st.id !== id),
            selectedStudentId:
              s.selectedStudentId === id ? null : s.selectedStudentId,
          })),

        // ── Sessions
        setSessions: (sessions) => set({ sessions }),
        addSession: (session) =>
          set((s) => ({ sessions: [session, ...s.sessions] })),

        // ── Assessment
        selectStudent: (id) =>
          set({
            selectedStudentId: id,
            currentItemIdx: 0,
            scores: { DT: {}, G: {}, CE: {}, TE: {} },
          }),
        selectSession: (id) => set({ selectedSessionId: id }),
        setActiveModule: (module) => set({ activeModule: module, currentItemIdx: 0 }),
        setCurrentItemIdx: (idx) => set({ currentItemIdx: idx }),
        recordScore: (module, itemId, value) =>
          set((s) => ({
            scores: {
              ...s.scores,
              [module]: { ...s.scores[module], [itemId]: value },
            },
          })),
        clearScores: () =>
          set({ scores: { DT: {}, G: {}, CE: {}, TE: {} }, currentItemIdx: 0 }),
        clearModuleScores: (module) =>
          set((s) => ({
            scores: { ...s.scores, [module]: {} },
            currentItemIdx: 0,
          })),

        // ── Cloud
        setSyncStatus: (status) =>
          set((s) => ({ syncStatus: { ...s.syncStatus, ...status } })),

        // ── Toasts
        addToast: (message, type = 'info', duration = 3500) => {
          const id = makeToastId();
          set((s) => ({
            toasts: [...s.toasts.slice(-4), { id, message, type, duration }],
          }));
          setTimeout(() => {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
          }, duration);
        },
        removeToast: (id) =>
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      }),
      {
        name: 'massar-app-store',
        // Persist lang + theme; everything else reloads from DB
        partialize: (state) => ({ lang: state.lang, theme: state.theme }),
      }
    ),
    { name: 'MassarStore' }
  )
);

// ─── Selectors (memoized) ────────────────────────────────────
export const selectSelectedStudent = (s: AppStore) =>
  s.students.find((st) => st.id === s.selectedStudentId) ?? null;

export const selectStudentSessions = (studentId: string) => (s: AppStore) =>
  s.sessions.filter((sess) => sess.studentId === studentId);

export const selectCurrentScore =
  (module: PeakModule, itemId: string) => (s: AppStore) =>
    s.scores[module]?.[itemId] ?? null;
