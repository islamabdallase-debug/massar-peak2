// ============================================================
//  مسار — useNotifications Hook
//  يحسب التنبيهات الذكية من بيانات الطلاب والجلسات
//  v1.1.0
// ============================================================

import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { PlanDB } from '@/db/database';
import type { AssessSession } from '@/types';

export type NotificationType =
  | 'no_assessment'      // طالب لم يُقيَّم أبداً
  | 'overdue_assessment' // طالب لم يُقيَّم منذ 14+ يوماً
  | 'no_plan';           // طالب لديه جلسات لكن لا خطة

export interface AppNotification {
  id: string;
  type: NotificationType;
  studentId: string;
  studentName: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  actionScreen: 'assess' | 'plan' | 'reports';
}

const OVERDUE_DAYS = 14;
const MS_PER_DAY   = 86_400_000;

export function useNotifications(): {
  notifications: AppNotification[];
  count: number;
  highCount: number;
} {
  const students = useAppStore(s => s.students);
  const sessions = useAppStore(s => s.sessions);

  // Map: studentId → hasPlan
  const [planMap, setPlanMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const map: Record<string, boolean> = {};
      await Promise.all(
        students.map(async (s) => {
          const plans = await PlanDB.getByStudentId(s.id).catch(() => []);
          map[s.id] = plans.length > 0;
        })
      );
      if (!cancelled) setPlanMap(map);
    }
    if (students.length > 0) load();
  }, [students]);

  const notifications = useMemo<AppNotification[]>(() => {
    const now  = Date.now();
    const list: AppNotification[] = [];

    students.forEach((student) => {
      const studentSessions = sessions
        .filter((s: AssessSession) => s.studentId === student.id)
        .sort((a, b) => b.savedAt - a.savedAt);

      const lastSession   = studentSessions[0] ?? null;
      const daysSinceLast = lastSession
        ? (now - lastSession.savedAt) / MS_PER_DAY
        : Infinity;

      // ── لم يُقيَّم أبداً ──
      if (!lastSession) {
        list.push({
          id:           `no_assess_${student.id}`,
          type:         'no_assessment',
          studentId:    student.id,
          studentName:  student.name,
          message:      `${student.name} لم يبدأ تقييمه بعد`,
          severity:     'high',
          actionScreen: 'assess',
        });
        return;
      }

      // ── لم يُقيَّم منذ 14+ يوماً ──
      if (daysSinceLast >= OVERDUE_DAYS) {
        const days = Math.floor(daysSinceLast);
        list.push({
          id:           `overdue_${student.id}`,
          type:         'overdue_assessment',
          studentId:    student.id,
          studentName:  student.name,
          message:      `${student.name} لم يُقيَّم منذ ${days} يوماً`,
          severity:     daysSinceLast >= 30 ? 'high' : 'medium',
          actionScreen: 'assess',
        });
      }

      // ── لا خطة علاجية رغم وجود جلستين+ ──
      if (!planMap[student.id] && studentSessions.length >= 2) {
        list.push({
          id:           `no_plan_${student.id}`,
          type:         'no_plan',
          studentId:    student.id,
          studentName:  student.name,
          message:      `${student.name} (${studentSessions.length} جلسات) بلا خطة علاجية`,
          severity:     'low',
          actionScreen: 'plan',
        });
      }
    });

    return list.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [students, sessions, planMap]);

  return {
    notifications,
    count:     notifications.length,
    highCount: notifications.filter(n => n.severity === 'high').length,
  };
}
