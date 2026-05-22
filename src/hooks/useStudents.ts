// ============================================================
//  مسار — useStudents hook (DB ↔ Store sync)
// ============================================================

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { StudentService } from '@/services/StudentService';
import { logDBError } from '@/components/ui/ErrorBoundary';
import type { StudentCreate } from '@/types';

export function useStudents() {
  const { students, setStudents, addStudent, updateStudent, removeStudent, addToast } =
    useAppStore();

  const loadStudents = useCallback(async () => {
    try {
      const data = await StudentService.getAll();
      setStudents(data);
    } catch (e) {
      logDBError('useStudents.load', e);
      addToast('خطأ في تحميل بيانات الطلاب', 'error');
    }
  }, [setStudents, addToast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const add = useCallback(
    async (data: StudentCreate) => {
      try {
        const student = await StudentService.add(data);
        addStudent(student);
        addToast('تم إضافة الطالب بنجاح', 'success');
        return student;
      } catch {
        addToast('خطأ أثناء إضافة الطالب', 'error');
        throw new Error('Failed to add student');
      }
    },
    [addStudent, addToast]
  );

  const update = useCallback(
    async (id: string, data: Partial<StudentCreate>) => {
      try {
        const student = await StudentService.update(id, data);
        updateStudent(student);
        addToast('تم تحديث بيانات الطالب', 'success');
        return student;
      } catch {
        addToast('خطأ أثناء التحديث', 'error');
        throw new Error('Failed to update student');
      }
    },
    [updateStudent, addToast]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await StudentService.softDelete(id);
        removeStudent(id);
        addToast('تم حذف الطالب', 'success');
      } catch {
        addToast('خطأ أثناء الحذف', 'error');
      }
    },
    [removeStudent, addToast]
  );

  return { students, add, update, remove, reload: loadStudents };
}
