// ============================================================
//  مسار — StudentService (TypeScript)
// ============================================================

import { StudentDB } from '@/db/database';
import type { Student, StudentCreate } from '@/types';

function uid(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const StudentService = {
  /** جلب كل الطلاب الفعّالين */
  getAll(): Promise<Student[]> {
    return StudentDB.getAll();
  },

  /** جلب طالب بـ id */
  getById(id: string): Promise<Student | undefined> {
    return StudentDB.getById(id);
  },

  /** إضافة طالب جديد */
  async add(data: StudentCreate): Promise<Student> {
    const now = Date.now();
    const student: Student = {
      id: uid(),
      name: data.name.trim(),
      school: data.school?.trim(),
      grade: data.grade?.trim(),
      dob: data.dob,
      notes: data.notes?.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await StudentDB.add(student);
    return student;
  },

  /** تحديث بيانات طالب */
  async update(id: string, data: Partial<StudentCreate>): Promise<Student> {
    const existing = await StudentDB.getById(id);
    if (!existing) throw new Error(`Student ${id} not found`);
    const updated: Student = {
      ...existing,
      ...data,
      id,
      updatedAt: Date.now(),
    };
    await StudentDB.update(updated);
    return updated;
  },

  /** حذف ناعم للطالب */
  softDelete(id: string): Promise<void> {
    return StudentDB.softDelete(id);
  },

  /** عدد الطلاب */
  count(): Promise<number> {
    return StudentDB.count();
  },
};
