// ============================================================
//  مسار SaaS — Pricing / Upgrade Screen
// ============================================================

import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { PLANS } from '@/types/saas';
import { Button } from '@/components/ui/Button';
import type { SubscriptionPlan } from '@/types/saas';

const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  free: [
    'حتى 3 طلاب',
    'وحدات PEAK الأربعة',
    'حفظ التقييمات محلياً',
    'تصدير JSON',
  ],
  pro: [
    'حتى 50 طالباً',
    'كل مميزات المجاني',
    '📊 لوحة التحليلات المتقدمة',
    '📄 تصدير Word وExcel',
    '🤖 تحليل AI للنتائج',
    'مزامنة سحابية (Supabase)',
    'دعم عبر البريد الإلكتروني',
  ],
  enterprise: [
    'طلاب غير محدودين',
    'كل مميزات Pro',
    '👥 فريق معالجين متعدد',
    '🏛️ لوحة إدارة المركز',
    '🔗 API للتكامل مع الأنظمة',
    'دعم أولوي 24/7',
    'تقارير مخصصة',
    'تدريب وإعداد مخصص',
  ],
};

function PlanCard({
  planKey,
  isCurrentPlan,
  onSelect,
}: {
  planKey: SubscriptionPlan;
  isCurrentPlan: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
}) {
  const plan = PLANS[planKey];
  const isPopular = planKey === 'pro';

  return (
    <div
      style={{
        background: 'var(--surface, #1e293b)',
        borderRadius: '18px',
        padding: '28px 24px',
        border: `2px solid ${isCurrentPlan ? plan.color : isPopular ? `${plan.color}60` : 'var(--border, #334155)'}`,
        flex: '1 1 240px',
        maxWidth: '320px',
        position: 'relative',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {/* Popular badge */}
      {isPopular && (
        <div
          style={{
            position: 'absolute', top: '-12px', right: '50%', transform: 'translateX(50%)',
            background: plan.color, color: '#fff', borderRadius: '12px', padding: '3px 14px',
            fontSize: '0.72rem', fontWeight: 800, fontFamily: 'Cairo, sans-serif',
          }}
        >
          ⭐ الأكثر شيوعاً
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div style={{
          position: 'absolute', top: '-12px', left: '16px',
          background: plan.color, color: '#fff', borderRadius: '10px', padding: '2px 10px',
          fontSize: '0.68rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif',
        }}>
          خطتك الحالية
        </div>
      )}

      <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 900, color: plan.color }}>
        {plan.label}
      </h3>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text, #f1f5f9)', marginBottom: '6px' }}>
        {plan.price}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '20px' }}>
        {planKey === 'enterprise' ? 'تواصل معنا للتسعير' : planKey === 'free' ? 'مجاني للأبد' : 'يُدفع شهرياً'}
      </div>

      <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {PLAN_FEATURES[planKey].map((feat, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
            <span style={{ color: plan.color, flexShrink: 0, marginTop: '2px' }}>✓</span>
            {feat}
          </li>
        ))}
      </ul>

      <Button
        variant={isCurrentPlan ? 'secondary' : 'primary'}
        fullWidth
        disabled={isCurrentPlan}
        onClick={() => !isCurrentPlan && onSelect(planKey)}
        style={{ background: isCurrentPlan ? undefined : plan.color, borderColor: plan.color }}
      >
        {isCurrentPlan ? 'خطتك الحالية' : planKey === 'enterprise' ? 'تواصل معنا' : `الترقية إلى ${plan.label}`}
      </Button>
    </div>
  );
}

export function Pricing() {
  const subscription = useAuthStore((s) => s.subscription);
  const addToast     = useAppStore((s) => s.addToast);

  function handleSelect(plan: SubscriptionPlan) {
    if (plan === 'enterprise') {
      window.open('mailto:hello@massar.app?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    // In real implementation: redirect to payment gateway
    addToast(`جاري تفعيل خطة ${PLANS[plan].label}...`, 'info');
  }

  return (
    <main
      id="main-content"
      role="main"
      aria-label="خطط الاشتراك"
      style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text, #f1f5f9)' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.6rem', fontWeight: 900 }}>💳 خطط الاشتراك</h2>
        <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)' }}>اختر الخطة المناسبة لمركزك</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', maxWidth: '960px', margin: '0 auto' }}>
        {(['free', 'pro', 'enterprise'] as SubscriptionPlan[]).map((planKey) => (
          <PlanCard
            key={planKey}
            planKey={planKey}
            isCurrentPlan={subscription?.plan === planKey}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '36px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.82rem' }}>
        جميع الخطط تشمل تجربة مجانية 14 يوم · لا حاجة لبطاقة ائتمانية
      </div>
    </main>
  );
}
