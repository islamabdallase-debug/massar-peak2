// ============================================================
//  مسار SaaS — Types (Phase 5)
// ============================================================

export type UserRole = 'super_admin' | 'center_admin' | 'supervisor' | 'therapist';
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';

// ─── Center ──────────────────────────────────────────────────
export interface Center {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  logoUrl?: string;
  country: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  settings: Record<string, unknown>;
  createdAt: string;
}

// ─── User Profile ────────────────────────────────────────────
export interface UserProfile {
  id: string;
  centerId: string | null;
  role: UserRole;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  specialization?: string;
  isActive: boolean;
  preferences: Record<string, unknown>;
  lastSeenAt?: string;
  createdAt: string;
}

// ─── Subscription ────────────────────────────────────────────
export interface Subscription {
  id: string;
  centerId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string;
  studentLimit: number;       // -1 = unlimited
  therapistLimit: number;     // -1 = unlimited
  features: SubscriptionFeatures;
}

export interface SubscriptionFeatures {
  analytics: boolean;
  exportWord: boolean;
  exportExcel: boolean;
  aiAnalysis: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

// ─── Plan definitions ────────────────────────────────────────
export const PLANS: Record<SubscriptionPlan, {
  label: string;
  price: string;
  studentLimit: number;
  therapistLimit: number;
  features: SubscriptionFeatures;
  color: string;
}> = {
  free: {
    label: 'المجاني',
    price: '0 ر.س',
    studentLimit: 3,
    therapistLimit: 1,
    features: { analytics: false, exportWord: false, exportExcel: false, aiAnalysis: false, apiAccess: false, prioritySupport: false },
    color: '#64748b',
  },
  pro: {
    label: 'الاحترافي',
    price: '199 ر.س / شهر',
    studentLimit: 50,
    therapistLimit: 5,
    features: { analytics: true, exportWord: true, exportExcel: true, aiAnalysis: true, apiAccess: false, prioritySupport: false },
    color: '#3b82f6',
  },
  enterprise: {
    label: 'المؤسسي',
    price: 'تواصل معنا',
    studentLimit: -1,
    therapistLimit: -1,
    features: { analytics: true, exportWord: true, exportExcel: true, aiAnalysis: true, apiAccess: true, prioritySupport: true },
    color: '#f9a825',
  },
};

// ─── Center Stats ────────────────────────────────────────────
export interface CenterStats {
  totalStudents: number;
  totalSessions: number;
  totalTherapists: number;
  sessionsThisMonth: number;
  avgPassRate: number | null;
  plan: SubscriptionPlan;
  studentLimit: number;
}

// ─── Invitation ──────────────────────────────────────────────
export interface Invitation {
  id: string;
  centerId: string;
  invitedBy: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

// ─── Auth state ──────────────────────────────────────────────
export interface AuthState {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  center: Center | null;
  subscription: Subscription | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ─── Role permissions ────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<UserRole, {
  canManageCenter: boolean;
  canInviteTherapists: boolean;
  canViewAllStudents: boolean;
  canViewAnalytics: boolean;
  canDeleteStudents: boolean;
  canExport: boolean;
  label: string;
  icon: string;
}> = {
  super_admin: {
    canManageCenter: true, canInviteTherapists: true, canViewAllStudents: true,
    canViewAnalytics: true, canDeleteStudents: true, canExport: true,
    label: 'مدير النظام', icon: '👑',
  },
  center_admin: {
    canManageCenter: true, canInviteTherapists: true, canViewAllStudents: true,
    canViewAnalytics: true, canDeleteStudents: true, canExport: true,
    label: 'مدير المركز', icon: '🏛️',
  },
  supervisor: {
    canManageCenter: false, canInviteTherapists: false, canViewAllStudents: true,
    canViewAnalytics: true, canDeleteStudents: false, canExport: true,
    label: 'مشرف', icon: '👁️',
  },
  therapist: {
    canManageCenter: false, canInviteTherapists: false, canViewAllStudents: false,
    canViewAnalytics: false, canDeleteStudents: false, canExport: false,
    label: 'معالج', icon: '👨‍⚕️',
  },
};
