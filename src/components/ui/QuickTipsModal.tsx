// ============================================================
//  مسار — QuickTipsModal  v5.1
//  Contextual tips + troubleshooting guide for therapists
// ============================================================

import React, { useState, useEffect } from 'react';
import { Button } from './Button';

// ─── Types ───────────────────────────────────────────────────
type TabId = 'tips' | 'shortcuts' | 'troubleshoot';

interface Tip {
  icon:  string;
  title: string;
  body:  string;
}

interface Shortcut {
  key:  string;
  desc: string;
}

interface TroubleItem {
  problem: string;
  solution: string;
}

// ─── Content ─────────────────────────────────────────────────
const TIPS: Tip[] = [
  { icon: '⚡', title: 'الوضع السريع', body: 'فعّل "سريع" في شاشة التقييم لتقليل التأخير بين البنود من 380ms إلى 200ms.' },
  { icon: '📋', title: 'إكمال العامل أولاً', body: 'أكمل عاملاً كاملاً قبل الانتقال للتالي — النتائج أكثر موثوقية.' },
  { icon: '💾', title: 'احفظ كل 10 دقائق', body: 'اضغط Space لحفظ الجلسة في أي وقت. البيانات تُحفظ فوراً في IndexedDB.' },
  { icon: '🔍', title: 'تقرير فوري', body: 'بعد الحفظ، انتقل لشاشة التقارير لترى الرسم البياني وتحليل الأداء.' },
  { icon: '📤', title: 'النسخ الاحتياطي', body: 'انتقل لـ "الأدوات" > "النسخ الاحتياطي" وأنشئ نسخة كل جلسة — أرسلها لبريدك الإلكتروني.' },
  { icon: '🌐', title: 'يعمل بدون إنترنت', body: 'المنصة تعمل كاملاً بدون اتصال. البيانات محلية تماماً.' },
  { icon: '📱', title: 'على الأجهزة اللوحية', body: 'يُنصح بالوضع الأفقي (Landscape) عند استخدام التابلت أثناء الجلسة.' },
  { icon: '🔄', title: 'إعادة الجولة', body: 'لإعادة جولة الترحيب: الأدوات > إعادة الجولة التعريفية.' },
];

const SHORTCUTS: Shortcut[] = [
  { key: '→ / 1',     desc: 'تسجيل "نجح" والانتقال للتالي' },
  { key: '← / 0',     desc: 'تسجيل "أخفق" والانتقال للتالي' },
  { key: '↑ / ↓',     desc: 'التنقل للأمام والخلف' },
  { key: 'Tab',        desc: 'انتقل لأول بند غير مجاب' },
  { key: 'Space',      desc: 'حفظ الجلسة الحالية' },
  { key: '?',          desc: 'عرض هذه المساعدة' },
  { key: 'Escape',     desc: 'إغلاق أي نافذة' },
];

const TROUBLE: TroubleItem[] = [
  {
    problem:  'البيانات لم تُحفظ',
    solution: 'تأكد أنك ضغطت "حفظ التقييم" أو Space. افتح شاشة التقارير للتحقق من الجلسة المحفوظة.',
  },
  {
    problem:  'الصفحة بطيئة أو تتجمد',
    solution: 'أغلق التبويبات الأخرى. إذا استمرت المشكلة: انتقل لـ "الأدوات" > "تشغيل التشخيص".',
  },
  {
    problem:  'لا أستطيع إضافة طالب',
    solution: 'تأكد من ملء حقل الاسم. الحقول الإلزامية مشار إليها بعلامة *.',
  },
  {
    problem:  'اختفت بيانات الجلسات',
    solution: 'لا تحذف بيانات المتصفح. استعد البيانات من آخر نسخة احتياطية عبر: الأدوات > استيراد نسخة.',
  },
  {
    problem:  'التقرير لا يظهر',
    solution: 'يجب أن تكون هناك جلسة محفوظة لطالب محدد. قم بحفظ جلسة أولاً ثم افتح التقارير.',
  },
  {
    problem:  'رسالة "فقدان الاتصال"',
    solution: 'المنصة تعمل بدون إنترنت — الرسالة تشير فقط لانقطاع الشبكة. بياناتك محفوظة محلياً.',
  },
  {
    problem:  'المنصة لا تفتح',
    solution: 'جرّب: تحديث الصفحة (F5) · متصفح Chrome · وضع incognito. إذا استمرت: تواصل مع فريق الدعم.',
  },
];

// ─── Tab button ───────────────────────────────────────────────
function TabBtn({ id, label, icon, active, onClick }: {
  id: TabId; label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      role="tab" aria-selected={active} id={`tab-${id}`}
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 8px', border: 'none',
        background: active ? 'var(--bg, #0a0f1a)' : 'transparent',
        color: active ? '#3b82f6' : 'var(--text-muted, #94a3b8)',
        borderRadius: '8px', cursor: 'pointer',
        fontFamily: 'Cairo, sans-serif', fontSize: '0.82rem', fontWeight: active ? 700 : 400,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────
interface QuickTipsModalProps {
  onClose: () => void;
}

export function QuickTipsModal({ onClose }: QuickTipsModalProps) {
  const [tab, setTab] = useState<TabId>('tips');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label="نصائح وتعليمات الاستخدام"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9998, fontFamily: 'Cairo, sans-serif', direction: 'rtl',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: '18px',
          width: 'min(540px, 95vw)',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 22px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>📚 دليل الاستخدام السريع</h3>
            <button onClick={onClose} aria-label="إغلاق"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="أقسام المساعدة"
            style={{ display: 'flex', gap: '4px', background: 'var(--bg, #0a0f1a)', borderRadius: '10px', padding: '4px' }}>
            <TabBtn id="tips" label="نصائح" icon="💡" active={tab === 'tips'} onClick={() => setTab('tips')} />
            <TabBtn id="shortcuts" label="الاختصارات" icon="⌨️" active={tab === 'shortcuts'} onClick={() => setTab('shortcuts')} />
            <TabBtn id="troubleshoot" label="مشاكل شائعة" icon="🔧" active={tab === 'troubleshoot'} onClick={() => setTab('troubleshoot')} />
          </div>
        </div>

        {/* Content */}
        <div
          role="tabpanel" aria-labelledby={`tab-${tab}`}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 22px' }}
        >
          {tab === 'tips' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TIPS.map((tip) => (
                <div key={tip.title} style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  padding: '12px 14px', background: '#ffffff06', borderRadius: '10px',
                }}>
                  <span style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: '1px' }}>{tip.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '3px' }}>{tip.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5 }}>{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SHORTCUTS.map((s) => (
                <div key={s.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#ffffff06', borderRadius: '8px', fontSize: '0.85rem',
                }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{s.desc}</span>
                  <kbd style={{
                    background: '#ffffff15', padding: '3px 12px', borderRadius: '6px',
                    fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text, #f1f5f9)', fontWeight: 700,
                  }}>{s.key}</kbd>
                </div>
              ))}
              <div style={{ marginTop: '8px', padding: '10px 14px', background: '#3b82f615', borderRadius: '8px', fontSize: '0.78rem', color: '#3b82f6' }}>
                💡 الاختصارات تعمل فقط في شاشة التقييم عندما لا يكون التركيز على حقل نص
              </div>
            </div>
          )}

          {tab === 'troubleshoot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TROUBLE.map((item) => (
                <details key={item.problem} style={{
                  background: '#ffffff06', borderRadius: '10px', overflow: 'hidden',
                }}>
                  <summary style={{
                    padding: '12px 14px', cursor: 'pointer', fontWeight: 700,
                    fontSize: '0.88rem', color: 'var(--text, #f1f5f9)',
                    display: 'flex', gap: '8px', alignItems: 'center',
                    listStyle: 'none',
                  }}>
                    <span style={{ color: '#f59e0b' }}>⚠</span>
                    {item.problem}
                  </summary>
                  <div style={{
                    padding: '0 14px 14px',
                    fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6,
                    borderTop: '1px solid var(--border, #334155)',
                    paddingTop: '10px',
                  }}>
                    ✅ {item.solution}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border, #1e293b)', flexShrink: 0 }}>
          <Button variant="secondary" size="sm" onClick={onClose} style={{ width: '100%' }}>إغلاق</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Trigger button (for use in Header or Tools) ──────────────
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="نصائح وتعليمات الاستخدام"
        title="مساعدة"
        style={{
          background: 'none', border: '1px solid var(--border, #334155)',
          borderRadius: '8px', padding: '6px 12px',
          color: 'var(--text-muted, #94a3b8)', cursor: 'pointer',
          fontFamily: 'Cairo, sans-serif', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '5px',
          transition: 'all 0.15s',
        }}
      >
        ❓ مساعدة
      </button>
      {open && <QuickTipsModal onClose={() => setOpen(false)} />}
    </>
  );
}
