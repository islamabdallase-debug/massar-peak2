// ============================================================
//  مسار — OnboardingWalkthrough  v5.1
//  First-use guided tour for therapists
//  Shown automatically on first visit, dismissable
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';

const ONBOARDING_KEY = 'massar_onboarding_done';

interface Step {
  icon:  string;
  title: string;
  body:  string;
  tip?:  string;
}

const STEPS: Step[] = [
  {
    icon:  '👋',
    title: 'مرحباً بك في مسار!',
    body:  'منصة مسار أداةٌ مصممة خصيصاً للمختصين في التربية الخاصة لتقييم مهارات الطلاب وفق برنامج PEAK للتدريب العلائقي.',
    tip:   'ستستغرق هذه الجولة أقل من دقيقة.',
  },
  {
    icon:  '👥',
    title: 'أضف طلابك أولاً',
    body:  'ابدأ بإضافة الطالب من شاشة "الطلاب". أدخل الاسم والعمر والمستوى، وستُحفظ البيانات تلقائياً على جهازك.',
    tip:   'البيانات محفوظة محلياً — لا إنترنت مطلوب.',
  },
  {
    icon:  '📋',
    title: 'ابدأ جلسة التقييم',
    body:  'اختر طالباً ثم انتقل إلى شاشة "التقييم". ستجد 291 بنداً موزعة على 4 وحدات PEAK: DT · G · CE · TE.',
    tip:   'اضغط → أو 1 للنجاح، ← أو 0 للإخفاق. Tab للقفز لأول بند غير مجاب.',
  },
  {
    icon:  '💾',
    title: 'احفظ الجلسة وشاهد التقرير',
    body:  'بعد التقييم، اضغط "حفظ التقييم" أو Space. ستُحوَّل تلقائياً إلى شاشة التقارير مع رسم بياني تفاعلي.',
    tip:   'يمكنك مراجعة جميع الجلسات السابقة في أي وقت.',
  },
  {
    icon:  '🗂️',
    title: 'الخطة العلاجية',
    body:  'في شاشة "الخطة" ستجد بنوداً مقترحة مرتبة حسب الأولوية بناءً على نتائج التقييم. يمكنك تخصيصها وطباعتها.',
    tip:   'الخطة تُولَّد تلقائياً من نتائج الجلسات.',
  },
  {
    icon:  '💾',
    title: 'النسخ الاحتياطي اليومي',
    body:  'في شاشة "الأدوات" ستجد زر النسخ الاحتياطي. أنشئ نسخة يومياً وانقلها إلى بريدك أو قرص USB.',
    tip:   'ستظهر تذكيرات تلقائية إذا مرّت 7 أيام دون نسخة.',
  },
  {
    icon:  '🎉',
    title: 'أنت جاهز!',
    body:  'يمكنك الآن بدء العمل الفعلي. إذا احتجت مساعدة اضغط ⌨️ في شاشة التقييم أو زر "؟" في أي مكان.',
    tip:   'اضغط Escape أو انقر خارج هذه النافذة للإغلاق في أي وقت.',
  },
];

// ─── Dot indicator ────────────────────────────────────────────
function StepDots({ total, current, color }: { total: number; current: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '20px 0 0' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? '20px' : '6px',
          height: '6px', borderRadius: '3px',
          background: i === current ? color : '#ffffff20',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function OnboardingWalkthrough() {
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      // Small delay so app has time to render first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
  }, []);

  const goNext = useCallback(() => {
    if (step === STEPS.length - 1) { dismiss(); return; }
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimating(false);
    }, 200);
  }, [step, dismiss]);

  const goPrev = useCallback(() => {
    if (step === 0) return;
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setAnimating(false);
    }, 200);
  }, [step]);

  // Keyboard nav
  useEffect(() => {
    if (!visible) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev();
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [visible, goNext, goPrev, dismiss]);

  if (!visible) return null;

  const current = STEPS[step];
  const accent  = '#3b82f6';
  const isLast  = step === STEPS.length - 1;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="جولة الترحيب"
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, fontFamily: 'Cairo, sans-serif', direction: 'rtl',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: '20px',
          padding: '36px 32px 28px',
          maxWidth: '460px', width: '92%',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          opacity: animating ? 0.3 : 1,
          transform: animating ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="تخطي الجولة"
          style={{
            position: 'absolute', top: '16px', left: '16px',
            background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer', fontSize: '1.2rem',
          }}
        >✕</button>

        {/* Step counter */}
        <div style={{ position: 'absolute', top: '18px', right: '20px', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* Icon */}
        <div style={{
          fontSize: '3.5rem', textAlign: 'center', marginBottom: '16px',
          lineHeight: 1,
        }}>
          {current.icon}
        </div>

        {/* Title */}
        <h2 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 800, textAlign: 'center', color: 'var(--text, #f1f5f9)' }}>
          {current.title}
        </h2>

        {/* Body */}
        <p style={{ margin: '0 0 14px', fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-muted, #cbd5e1)', textAlign: 'center' }}>
          {current.body}
        </p>

        {/* Tip */}
        {current.tip && (
          <div style={{
            background: `${accent}15`, border: `1px solid ${accent}30`,
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '0.8rem', color: accent,
            textAlign: 'center', marginBottom: '4px',
          }}>
            💡 {current.tip}
          </div>
        )}

        {/* Dots */}
        <StepDots total={STEPS.length} current={step} color={accent} />

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {step > 0 && (
            <Button variant="secondary" size="sm" onClick={goPrev} style={{ flex: 1 }}>
              ‹ السابق
            </Button>
          )}
          <Button
            variant={isLast ? 'success' : 'primary'}
            size="sm"
            onClick={goNext}
            style={{ flex: step > 0 ? 1 : undefined, width: step === 0 ? '100%' : undefined }}
          >
            {isLast ? '✓ ابدأ الاستخدام' : 'التالي ›'}
          </Button>
        </div>

        {step === 0 && (
          <button onClick={dismiss} style={{
            display: 'block', width: '100%', marginTop: '10px',
            background: 'none', border: 'none', color: 'var(--text-muted, #64748b)',
            cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Cairo, sans-serif',
          }}>
            تخطي الجولة
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Re-trigger hook (for "إعادة الجولة" button) ─────────────
export function useOnboardingReset() {
  return useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    window.location.reload();
  }, []);
}
