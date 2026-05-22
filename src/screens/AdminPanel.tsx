// ============================================================
//  مسار SaaS — Admin Panel
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { AuthService } from '@/services/AuthService';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PLANS, ROLE_PERMISSIONS } from '@/types/saas';
import type { UserProfile, UserRole } from '@/types/saas';

// ─── Therapist Card ──────────────────────────────────────────
function TherapistCard({
  profile,
  onDeactivate,
  studentCount,
}: {
  profile: UserProfile;
  onDeactivate: () => void;
  studentCount: number;
}) {
  const roleInfo = ROLE_PERMISSIONS[profile.role];
  const color = profile.role === 'center_admin' ? '#f9a825' : profile.role === 'supervisor' ? '#8b5cf6' : '#3b82f6';

  return (
    <div
      style={{
        background: 'var(--surface, #1e293b)', borderRadius: '14px', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: '14px',
        opacity: profile.isActive ? 1 : 0.5,
        borderRight: `3px solid ${profile.isActive ? color : '#334155'}`,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', fontWeight: 800, color: '#fff', flexShrink: 0,
        }}
      >
        {profile.fullName.charAt(0)}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{profile.fullName}</span>
          <span style={{ background: `${color}22`, color, borderRadius: '6px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
            {roleInfo.icon} {roleInfo.label}
          </span>
          {!profile.isActive && (
            <span style={{ background: '#ef444422', color: '#ef4444', borderRadius: '6px', padding: '1px 8px', fontSize: '0.7rem' }}>
              غير نشط
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
          {studentCount} طالب مخصّص
          {profile.specialization && ` · ${profile.specialization}`}
        </div>
      </div>

      {profile.isActive && (
        <button
          onClick={onDeactivate}
          aria-label={`إلغاء تفعيل ${profile.fullName}`}
          style={{
            background: '#ef444415', border: '1px solid #ef444440', borderRadius: '8px',
            padding: '5px 12px', color: '#ef4444', cursor: 'pointer',
            fontFamily: 'Cairo, sans-serif', fontSize: '0.75rem',
          }}
        >
          تعطيل
        </button>
      )}
    </div>
  );
}

// ─── Invite Form ─────────────────────────────────────────────
function InviteForm({ onSend, onCancel }: { onSend: (email: string, role: UserRole) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('therapist');

  return (
    <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '14px', padding: '20px', marginBottom: '16px', border: '1px solid var(--blue, #3b82f6)40' }}>
      <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700 }}>📧 دعوة معالج جديد</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '12px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الإلكتروني"
          style={inputStyle}
          aria-label="البريد الإلكتروني للمدعو"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={inputStyle}>
          <option value="therapist">معالج</option>
          <option value="supervisor">مشرف</option>
          <option value="center_admin">مدير مركز</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>إلغاء</Button>
        <Button variant="primary" size="sm" onClick={() => email && onSend(email, role)} disabled={!email.trim()}>
          إرسال الدعوة
        </Button>
      </div>
    </div>
  );
}

// ─── Subscription Card ───────────────────────────────────────
function SubscriptionCard() {
  const { subscription } = useAuthStore();
  if (!subscription) return null;

  const plan = PLANS[subscription.plan];
  const isTrialing = subscription.status === 'trialing';
  const trialDays = isTrialing
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <section
      aria-label="الاشتراك الحالي"
      style={{ background: 'var(--surface, #1e293b)', borderRadius: '14px', padding: '20px', marginBottom: '16px', borderTop: `3px solid ${plan.color}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>الاشتراك الحالي</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: plan.color }}>{plan.label}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>{plan.price}</div>
          {isTrialing && trialDays > 0 && (
            <div style={{ background: '#f9a82522', color: '#f9a825', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, marginTop: '6px', display: 'inline-block' }}>
              تجربة مجانية — {trialDays} يوم متبقٍ
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>مميزات الخطة</div>
          {Object.entries(subscription.features).map(([feat, enabled]) => (
            <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', marginBottom: '3px', color: enabled ? '#22c55e' : 'var(--text-muted, #94a3b8)' }}>
              <span>{enabled ? '✓' : '✗'}</span>
              <span>{{ analytics: 'تحليلات', exportWord: 'تصدير Word', exportExcel: 'تصدير Excel', aiAnalysis: 'تحليل AI', apiAccess: 'API', prioritySupport: 'دعم أولوي' }[feat]}</span>
            </div>
          ))}
        </div>
      </div>

      {subscription.plan !== 'enterprise' && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border, #334155)', paddingTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {subscription.plan === 'free' && (
            <Button variant="primary" icon="⬆️">الترقية إلى Pro — 199 ر.س/شهر</Button>
          )}
          <Button variant="secondary">التواصل للخطة المؤسسية</Button>
        </div>
      )}
    </section>
  );
}

// ─── Admin Panel ─────────────────────────────────────────────
export function AdminPanel() {
  const { center, profile, subscription, setScreen } = useAuthStore((s) => ({
    center: s.center, profile: s.profile, subscription: s.subscription,
    setScreen: () => {},
  }));
  const { students, addToast } = useAppStore();

  const [therapists] = useState<UserProfile[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'subscription'>('overview');

  // Count students per therapist
  const studentsByTherapist = (therapistId: string) =>
    students.filter((s) => (s as unknown as { assignedTo?: string }).assignedTo === therapistId).length;

  function handleInvite(email: string, role: UserRole) {
    addToast(`تم إرسال الدعوة إلى ${email}`, 'success');
    setShowInvite(false);
  }

  return (
    <main
      id="main-content"
      role="main"
      aria-label="لوحة الإدارة"
      style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text, #f1f5f9)' }}
    >
      <RoleGuard roles={['center_admin', 'super_admin']} fallback={
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted, #94a3b8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
          <p>هذه الصفحة للمسؤولين فقط</p>
        </div>
      }>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800 }}>🏛️ لوحة الإدارة</h2>
          <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
            {center?.name ?? 'المركز'} · {profile?.fullName}
          </p>
        </div>

        {/* Tabs */}
        <div role="tablist" style={{ display: 'flex', gap: '4px', background: 'var(--surface, #1e293b)', padding: '4px', borderRadius: '10px', marginBottom: '20px', width: 'fit-content' }}>
          {([
            { id: 'overview', label: 'نظرة عامة', icon: '📊' },
            { id: 'team', label: 'الفريق', icon: '👥' },
            { id: 'subscription', label: 'الاشتراك', icon: '💳' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--blue, #3b82f6)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted, #94a3b8)',
                fontFamily: 'Cairo, sans-serif', fontSize: '0.85rem', fontWeight: activeTab === tab.id ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: '6px', minHeight: '36px',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              {[
                { label: 'الطلاب', value: students.length, icon: '👥', max: subscription?.studentLimit ?? 3, color: '#3b82f6' },
                { label: 'المعالجون', value: therapists.length, icon: '👨‍⚕️', max: subscription?.therapistLimit ?? 1, color: '#8b5cf6' },
                { label: 'خطة الاشتراك', value: PLANS[subscription?.plan ?? 'free'].label, icon: '💳', color: '#f9a825' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'var(--surface, #1e293b)', borderRadius: '14px', padding: '18px 20px', flex: '1 1 150px', borderTop: `3px solid ${stat.color}` }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{stat.icon}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text, #f1f5f9)' }}>{stat.value}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>{stat.label}</div>
                  {typeof stat.max === 'number' && stat.max > 0 && (
                    <div style={{ fontSize: '0.72rem', color: stat.color, marginTop: '2px' }}>
                      من أصل {stat.max === -1 ? '∞' : stat.max}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--surface, #1e293b)', borderRadius: '14px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>⚙️ إعدادات المركز</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { label: 'اسم المركز', value: center?.name ?? '—' },
                  { label: 'المدينة', value: center?.city ?? '—' },
                  { label: 'البريد الإلكتروني', value: center?.email ?? '—' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', minWidth: '140px' }}>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>👥 فريق المركز ({therapists.length} معالج)</h3>
              <Button variant="primary" size="sm" icon="+" onClick={() => setShowInvite(true)}>دعوة معالج</Button>
            </div>

            {showInvite && <InviteForm onSend={handleInvite} onCancel={() => setShowInvite(false)} />}

            {therapists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>👥</div>
                <p>لا يوجد معالجون مضافون. أرسل دعوة لإضافة أول معالج.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {therapists.map((t) => (
                  <TherapistCard
                    key={t.id}
                    profile={t}
                    studentCount={studentsByTherapist(t.id)}
                    onDeactivate={() => setDeactivateTarget(t)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && <SubscriptionCard />}

        {/* Deactivate Confirm */}
        <ConfirmDialog
          isOpen={!!deactivateTarget}
          title="تعطيل المعالج"
          message={`هل تريد تعطيل حساب "${deactivateTarget?.fullName}"؟ لن يتمكن من الوصول إلى المنصة.`}
          confirmText="تعطيل"
          cancelText="إلغاء"
          type="warning"
          onConfirm={() => { addToast('تم تعطيل الحساب', 'success'); setDeactivateTarget(null); }}
          onCancel={() => setDeactivateTarget(null)}
        />
      </RoleGuard>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #334155)',
  background: 'var(--bg, #0a0f1a)', color: 'var(--text, #f1f5f9)',
  fontFamily: 'Cairo, sans-serif', fontSize: '0.88rem', direction: 'rtl', width: '100%',
};
