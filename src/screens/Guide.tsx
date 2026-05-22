// ============================================================
//  مسار — Guide Screen  v1.0
//  دليل التدريب + RFT + أدوات الوحدات + التكيّف العربي
// ============================================================

import React, { useState } from 'react';

// ── Tab definitions ──────────────────────────────────────────
type GuideTab = 'rft' | 'howto' | 'tools' | 'arabic';

const TABS: { id: GuideTab; icon: string; label: string }[] = [
  { id: 'rft',    icon: '🧠', label: 'نظرية RFT' },
  { id: 'howto',  icon: '📖', label: 'دليل الاستخدام' },
  { id: 'tools',  icon: '🧰', label: 'أدوات الوحدات' },
  { id: 'arabic', icon: '🌙', label: 'التكيّف العربي' },
];

// ── Shared sub-components ────────────────────────────────────
function SectionCard({ icon, title, children, color = '#3b82f6' }: {
  icon: string; title: string; children: React.ReactNode; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--surface, #1e293b)', borderRadius: '16px',
      padding: '20px 24px', marginBottom: '16px',
      borderRight: `3px solid ${color}`,
    }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.3rem' }}>{icon}</span>
        <span style={{ color }}>{title}</span>
      </h3>
      {children}
    </div>
  );
}

function InfoBox({ icon, text, color = '#3b82f6' }: { icon: string; text: string; color?: string }) {
  return (
    <div style={{
      background: `${color}11`, border: `1px solid ${color}33`,
      borderRadius: '10px', padding: '10px 14px',
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '10px',
    }}>
      <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}>{icon}</span>
      <span style={{ color: 'var(--text, #f1f5f9)' }}>{text}</span>
    </div>
  );
}

function StepCard({ num, title, desc, color = '#3b82f6' }: {
  num: number; title: string; desc: string; color?: string;
}) {
  return (
    <div style={{
      display: 'flex', gap: '14px', alignItems: 'flex-start',
      padding: '14px', background: '#ffffff06',
      borderRadius: '12px', marginBottom: '10px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: `${color}22`, color, fontWeight: 900,
        fontSize: '1rem', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>{num}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

function ToolTag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', background: `${color}18`,
      color, border: `1px solid ${color}44`,
      borderRadius: '8px', padding: '4px 12px',
      fontSize: '0.78rem', fontWeight: 600, margin: '4px',
    }}>{text}</span>
  );
}

function AdaptCard({ itemCode, original, adapted, reason }: {
  itemCode: string; original: string; adapted: string; reason: string;
}) {
  return (
    <div style={{
      background: '#ffffff06', borderRadius: '12px',
      padding: '14px 16px', marginBottom: '10px',
      borderRight: '3px solid #f59e0b',
    }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          background: '#f59e0b22', color: '#f59e0b',
          borderRadius: '6px', padding: '2px 8px',
          fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace',
        }}>{itemCode}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '3px' }}>النص الأصلي (إنجليزي)</div>
          <div style={{ fontSize: '0.8rem', color: '#ef4444', direction: 'ltr', textAlign: 'left', padding: '6px 8px', background: '#ef444411', borderRadius: '6px' }}>{original}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '3px' }}>التكيّف العربي المقترح</div>
          <div style={{ fontSize: '0.8rem', color: '#22c55e', padding: '6px 8px', background: '#22c55e11', borderRadius: '6px' }}>{adapted}</div>
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <span>💡</span><span>{reason}</span>
      </div>
    </div>
  );
}

// ── RFT Tab ──────────────────────────────────────────────────
function RftTab() {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #3b82f622 0%, #a855f722 100%)',
        borderRadius: '16px', padding: '24px', marginBottom: '20px',
        border: '1px solid #3b82f633', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🧠</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 900, color: '#a855f7' }}>
          نظرية أطر العلاقات
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.7 }}>
          Relational Frame Theory (RFT) — أساس برنامج PEAK
        </p>
      </div>

      <SectionCard icon="🌱" title="ما هي نظرية أطر العلاقات؟" color="#3b82f6">
        <InfoBox icon="📌" color="#3b82f6"
          text="RFT هي نظرية سلوكية بيانية (Post-Skinnerian) طوّرها ستيفن هايز وزملاؤه. تقول النظرية أن البشر يتعلمون الاستجابة للأشياء ليس فقط بناءً على تجاربهم المباشرة معها، بل أيضاً بناءً على العلاقات اللفظية بين المفاهيم." />
        <InfoBox icon="🔑" color="#a855f7"
          text="مثال بسيط: إذا عرف الطفل أن 'الأسد خطير' وعرف أن 'القطة تشبه الأسد في كونها حيواناً مفترساً'، فقد يستجيب للقطة باحتياط — دون أن يعض قطة من قبل. هذا هو 'نقل وظائف المثير' عبر إطار العلاقة." />
        <InfoBox icon="💡" color="#22c55e"
          text="بعكس نظرية VB (Verbal Behavior) التي تُصنّف اللغة بحسب وظيفتها فقط، تُفسّر RFT الكيفية التي يُعمّم بها الطفل المعرفة لسياقات جديدة لم يتدرب عليها صراحةً." />
      </SectionCard>

      <SectionCard icon="⚙️" title="الخصائص الثلاث لأطر العلاقات" color="#a855f7">
        {[
          { icon: '🔄', title: 'التناسق (Mutual Entailment)', desc: 'إذا كان A ← B، فإن B ← A. إذا قيل للطفل: "الكلب يشبه الذئب"، فهو يُدرك ضمنياً أن "الذئب يشبه الكلب" دون تدريب صريح.' },
          { icon: '🔗', title: 'الاشتقاق المركّب (Combinatorial Entailment)', desc: 'إذا كان A ← B و B ← C، فإن A ← C. تدريب علاقتين فقط يُنتج 6 علاقات مشتقة مجاناً — هذا هو قلب DRR.' },
          { icon: '🌊', title: 'تحويل الوظائف (Transformation of Functions)', desc: 'الوظيفة النفسية (الخوف، الرغبة، الحزن) تنتقل عبر إطار العلاقة. "الشيء الخطير" يكتسب خطورته حتى لو لم نختبره مباشرة.' },
        ].map((item) => (
          <div key={item.title} style={{
            display: 'flex', gap: '12px', padding: '12px', background: '#a855f711',
            borderRadius: '10px', marginBottom: '8px',
          }}>
            <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#a855f7', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard icon="🔗" title="أنواع أطر العلاقات الرئيسية" color="#22c55e">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { frame: 'التنسيق / التشابه', en: 'Coordination', example: 'هذا مثل ذاك · نفس الشيء' },
            { frame: 'التعارض', en: 'Opposition', example: 'كبير / صغير · ساخن / بارد' },
            { frame: 'المقارنة', en: 'Comparison', example: 'أكبر من · أفضل من · أكثر' },
            { frame: 'التسلسل / الترتيب', en: 'Hierarchy', example: 'جزء من · ينتمي لـ · فئة' },
            { frame: 'المكانية', en: 'Spatial', example: 'فوق / تحت · أمام / خلف' },
            { frame: 'الزمانية', en: 'Temporal', example: 'قبل / بعد · الآن / مستقبل' },
            { frame: 'الشرطية (السببية)', en: 'Causal/Conditional', example: 'إذا... إذن · لأن... يؤدي إلى' },
            { frame: 'المنظور / الضمائر', en: 'Deictic', example: 'أنا / أنت · هنا / هناك' },
          ].map((f) => (
            <div key={f.frame} style={{
              background: '#22c55e11', borderRadius: '8px', padding: '10px 12px',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#22c55e', marginBottom: '2px' }}>{f.frame}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontStyle: 'italic' }}>{f.en}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text, #f1f5f9)' }}>مثال: {f.example}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon="📊" title="DRR — الاستجابة العلائقية المشتقة" color="#f59e0b">
        <InfoBox icon="🎯" color="#f59e0b"
          text="DRR (Derived Relational Responding) هي الظاهرة المحورية في RFT. عندما نُدرّب علاقتين فقط (A=B، B=C) فإن الطفل يشتق تلقائياً 6 علاقات مجانية: A=B، B=A، B=C، C=B، A=C، C=A." />
        <div style={{
          background: '#f59e0b11', borderRadius: '10px', padding: '14px',
          textAlign: 'center', border: '1px solid #f59e0b33',
        }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '10px', color: '#f59e0b' }}>
            2 علاقة مُدرَّبة ← 6 علاقات مشتقة مجاناً
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            {['تدريب: A→B', 'تدريب: B→C', 'اشتقاق: B→A', 'اشتقاق: C→B', 'اشتقاق: A→C', 'اشتقاق: C→A'].map((r, i) => (
              <span key={r} style={{
                background: i < 2 ? '#f59e0b22' : '#22c55e15',
                color: i < 2 ? '#f59e0b' : '#22c55e',
                borderRadius: '6px', padding: '4px 10px',
                fontWeight: 700, fontSize: '0.78rem',
              }}>{r}</span>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard icon="🏆" title="كيف يُجسّد PEAK نظرية RFT؟" color="#3b82f6">
        {[
          { mod: 'DT', color: '#3b82f6', desc: 'التدريب المباشر — يبني المهارات الأساسية للتعلم والمطابقة واللغة الاستقبالية والتعبيرية. يُنشئ الأساس العلائقي.' },
          { mod: 'G',  color: '#22c55e', desc: 'التعميم العلائقي — يُدرّب الطفل على تطبيق العلاقات التي تعلّمها في سياقات جديدة وأشخاص ومواد مختلفة.' },
          { mod: 'CE', color: '#a855f7', desc: 'التكافؤ السياقي — يُعلّم كيف يُغيّر السياق معنى العلاقات. "كبير" قد يعني شيئاً ما بجانب فيل وشيئاً آخر بجانب نملة.' },
          { mod: 'TE', color: '#f59e0b', desc: 'تحويل الوظائف — المرحلة الأعلى: يُدرّب الطفل على نقل الوظائف النفسية (عاطفية، دوافعية) عبر الأطر. مهارة معقّدة تميّز RFT.' },
        ].map((item) => (
          <div key={item.mod} style={{
            display: 'flex', gap: '12px', alignItems: 'flex-start',
            padding: '10px 12px', background: `${item.color}0d`,
            borderRadius: '10px', marginBottom: '8px',
          }}>
            <span style={{
              background: `${item.color}22`, color: item.color, borderRadius: '6px',
              padding: '4px 10px', fontSize: '0.8rem', fontWeight: 900,
              fontFamily: 'monospace', flexShrink: 0,
            }}>{item.mod}</span>
            <span style={{ fontSize: '0.84rem', color: 'var(--text, #f1f5f9)', lineHeight: 1.6 }}>{item.desc}</span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

// ── HowTo Tab ────────────────────────────────────────────────
function HowtoTab() {
  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #22c55e22 0%, #3b82f622 100%)',
        borderRadius: '16px', padding: '20px 24px', marginBottom: '20px',
        border: '1px solid #22c55e33',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>📖</div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 900, color: '#22c55e' }}>دليل الاستخدام العملي</h2>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted, #94a3b8)' }}>
          خطوات منظّمة من الإعداد حتى صياغة الأهداف
        </p>
      </div>

      <SectionCard icon="1️⃣" title="المرحلة الأولى: الإعداد قبل التقييم" color="#3b82f6">
        {[
          { n: 1, t: 'إضافة الطالب', d: 'انتقل لشاشة "الطلاب" ← أضف طالباً جديداً مع بياناته الأساسية: الاسم، تاريخ الميلاد، المرحلة الدراسية. احرص على دقة تاريخ الميلاد لحساب العمر الزمني.' },
          { n: 2, t: 'جمع المعلومات الأساسية', d: 'راجع أي تقارير سابقة، سجل تاريخ تطور الطفل، تحدّث مع الوالدين عن المخاوف الرئيسية. حدّد من أين تبدأ: من DT أم من مرحلة أكثر تقدماً.' },
          { n: 3, t: 'تجهيز مواد التقييم', d: 'الـ Flipbooks الأربعة (DT, G, CE, TE)، أدوات الاستجابة (مكعبات، بطاقات)، بيئة هادئة خالية من المشتتات، أقلام تسجيل، نموذج التسجيل.' },
          { n: 4, t: 'تحديد الوقت', d: 'خصّص 60–90 دقيقة لكل وحدة على حدة. لا تُجري التقييم كله في جلسة واحدة. ابدأ بـ DT دائماً ثم G ثم CE ثم TE تدريجياً.' },
        ].map((s) => <StepCard key={s.n} num={s.n} title={s.t} desc={s.d} color="#3b82f6" />)}
      </SectionCard>

      <SectionCard icon="2️⃣" title="المرحلة الثانية: التقييم" color="#a855f7">
        {[
          { n: 1, t: 'فتح شاشة التقييم', d: 'اختر الطالب ← انتقل لتبويب "تقييم". ستظهر الوحدات الأربعة (DT, G, CE, TE) في الأعلى.' },
          { n: 2, t: 'اتّباع إجراء PEAK الموحّد', d: 'قدّم كل بند مرة واحدة فقط. سجّل: نجح (✓ = 1) أو أخفق (✗ = 0). لا توجد "محاولة ثانية" في مرحلة التقييم. استخدم أوراق الـ Flipbook المرافقة بالتزامن مع المنصة.' },
          { n: 3, t: 'استخدام اختصارات لوحة المفاتيح', d: 'السهم الأيمن أو رقم 1: نجح، السهم الأيسر أو 0: أخفق، Tab: انتقل لأول بند غير مجاب، ؟ (علامة استفهام): عرض مساعدة الاختصارات.' },
          { n: 4, t: 'حفظ الجلسة', d: 'اضغط مفتاح Space أو زر "حفظ التقييم" عند الانتهاء. ستنتقل تلقائياً لشاشة التقارير.' },
        ].map((s) => <StepCard key={s.n} num={s.n} title={s.t} desc={s.d} color="#a855f7" />)}
      </SectionCard>

      <SectionCard icon="3️⃣" title="المرحلة الثالثة: قراءة النتائج" color="#22c55e">
        {[
          { n: 1, t: 'فهم مثلث الأداء (Performance Matrix)', d: 'المثلث يُظهر الوحدات الأربعة مرتّبة. كل وحدة تحتوي مستويات 1–14. المستويات باللون الأخضر = أُتقنت. الأصفر = حدّية. الأحمر = تحتاج تدخّلاً.' },
          { n: 2, t: 'استخدام تبويب الذكاء الاصطناعي', d: 'انتقل لشاشة "الذكاء الاصطناعي". ستجد تحليلاً تلقائياً للعوامل مع نسب الإتقان والعمر المكافئ لكل عامل. يمكن نسخ "برومت كلود" لتحليل أعمق.' },
          { n: 3, t: 'تحديد نقاط البداية (Entry Points)', d: 'ابدأ التدريب من آخر مستوى نجح فيه الطفل +1. لا تبدأ من الأعلى ولا من الأدنى بكثير. استهدف البنود الفاشلة في المستوى الحدّي.' },
        ].map((s) => <StepCard key={s.n} num={s.n} title={s.t} desc={s.d} color="#22c55e" />)}
      </SectionCard>

      <SectionCard icon="4️⃣" title="المرحلة الرابعة: بناء خطة التدخّل" color="#f59e0b">
        {[
          { n: 1, t: 'الانتقال لشاشة الخطة', d: 'انقر "توليد تلقائي" ليُنشئ النظام خطة مبنية على نتائج التقييم. أو أضف أهدافاً يدوياً لمزيد من التخصيص.' },
          { n: 2, t: 'قراءة الهدف SMART', d: 'لكل برنامج مُضاف انقر "▼ هدف SMART" لرؤية الهدف المصاغ بصيغة: "عند تقديم [تعليمة] سيُنفّذ [الطالب] [الاستجابة] بمعدل 90% في 3 جلسات".' },
          { n: 3, t: 'تحديد الأولويات', d: 'لا تُشغّل أكثر من 5–10 برامج متزامنة للمبتدئين. ابدأ بالبرامج التأسيسية (مستوى 1–3). رتّب بحسب الأهمية الوظيفية للطالب.' },
          { n: 4, t: 'إعادة التقييم', d: 'كل 3 أشهر: أعد تقييم الوحدات المُدرَّبة. قارن نتائج الجلسة الجديدة بالقديمة في شاشة التقارير لقياس التقدّم.' },
        ].map((s) => <StepCard key={s.n} num={s.n} title={s.t} desc={s.d} color="#f59e0b" />)}
      </SectionCard>

      {/* معايير الإتقان */}
      <div style={{
        background: 'linear-gradient(135deg, #22c55e1a 0%, #3b82f61a 100%)',
        borderRadius: '16px', padding: '20px 24px',
        border: '1px solid #22c55e33',
      }}>
        <h3 style={{ margin: '0 0 14px', fontWeight: 800, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✅</span> معايير الإتقان الموحّدة (PEAK Standard)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'نسبة الإتقان',      value: '90% أو أعلى', icon: '📊' },
            { label: 'عدد المحاولات',     value: '9 من 10 صحيحة', icon: '🎯' },
            { label: 'التتالي المطلوب',   value: '3 جلسات متتالية', icon: '🔁' },
            { label: 'التعميم',           value: 'بيئات + مدربون متعددون', icon: '🌍' },
            { label: 'مدة التدريب اليومي', value: '2–4 ساعات/يوم', icon: '⏱' },
            { label: 'إعادة التقييم',     value: 'كل 3 أشهر', icon: '📅' },
          ].map((c) => (
            <div key={c.label} style={{ background: '#ffffff08', borderRadius: '10px', padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{c.label}</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#22c55e' }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tools Tab ────────────────────────────────────────────────
function ToolsTab() {
  const modules = [
    {
      key: 'DT', color: '#3b82f6', icon: '🔵',
      name: 'التدريب المباشر (Direct Training)',
      desc: 'يُقيّم المهارات الأساسية للتعلم، اللغة الاستقبالية والتعبيرية، والمهارات الإدراكية',
      essential: ['كتاب التقييم DT Flipbook', 'بطاقات الصور (مواضيع متنوعة)', 'مكعبات ملوّنة صغيرة (3–4 ألوان)', 'دمية أو دبدوب محشو', 'بطاقات حروف وأرقام'],
      additional: ['أكواب بلاستيكية (3 أكواب متماثلة)', 'فرشاة أسنان', 'مرآة صغيرة', 'بطاقة اسم الطفل', 'مواد تعزيز (حلوى صغيرة، مفضّلات الطفل)'],
      tips: ['ضع المواد على طاولة نظيفة خالية من الفوضى', 'استخدم مواد مألوفة للطفل في مجتمعه', 'أحضر بدائل عربية للأشياء الغربية (مثل رغيف الخبز العربي بدلاً من الـ Bread المقطّع)'],
    },
    {
      key: 'G', color: '#22c55e', icon: '🟢',
      name: 'التعميم العلائقي (Generalization)',
      desc: 'يُقيّم قدرة الطفل على تطبيق المهارات في سياقات جديدة وعلى أشخاص ومواد مختلفة',
      essential: ['كتاب التقييم G Flipbook', 'مجموعة صور بيئات متنوعة', 'أشياء متعددة من نفس الفئة (3 تفاحات مختلفة الشكل)', 'بطاقات "مثلي/مختلف"'],
      additional: ['دمى من جنسيات مختلفة', 'صور من بيئة المنزل والمدرسة', 'أشياء يومية (كوب، قلم، كتاب)', 'ملابس متنوعة للدمى'],
      tips: ['أجرِ التقييم في أكثر من مكان (غرفة، حديقة، فصل)', 'استخدم مقيّمين مختلفين لتقييم التعميم الحقيقي', 'وثّق أين تعمّم المهارة وأين لا تتعمّم'],
    },
    {
      key: 'CE', color: '#a855f7', icon: '🟣',
      name: 'التكافؤ السياقي (Contextual Equivalence)',
      desc: 'يُقيّم قدرة الطفل على تغيير استجاباته بناءً على تغيّر السياق',
      essential: ['كتاب التقييم CE Flipbook', 'بطاقات تمثّل أطر العلاقات (أكبر/أصغر، أقبل قبل/بعد)', 'صور متسلسلة (قصص مصورة 3–4 صور)', 'بطاقات ألوان متدرّجة'],
      additional: ['مجموعة حيوانات بأحجام متدرّجة', 'ساعة تعليمية', 'خريطة بسيطة للمنزل', 'أشكال هندسية متداخلة'],
      tips: ['CE يتطلب أن يكون الطفل قد أتقن DT أولاً', 'ابدأ بأطر بسيطة (أكبر/أصغر) قبل الأطر المعقّدة (قبل/بعد، داخل/خارج)', 'السياق البصري مهم جداً — استخدم بطاقات واضحة كبيرة'],
    },
    {
      key: 'TE', color: '#f59e0b', icon: '🟡',
      name: 'تحويل وظائف المثير (Transformation of Functions)',
      desc: 'يُقيّم المرحلة الأكثر تعقيداً: تحويل المعنى الوظيفي للأشياء عبر العلاقات',
      essential: ['كتاب التقييم TE Flipbook', 'مثيرات مشروطة (أشياء تمثّل مثيرات تحكّمية)', 'مكعبات بألوان محدّدة (تمثّل فئات)', 'بطاقات الوظيفة (ألم/خوف/سعادة)'],
      additional: ['قصص مصورة بمواضيع عاطفية', 'دمى تعبيرات الوجه', 'مواد تثير استجابات طبيعية (حلوى للسعادة، ضجيج للخوف)', 'سيناريوهات مصورة'],
      tips: ['TE يُدرَّس فقط بعد إتقان DT + G + CE', 'يحتاج إلى تدريب مكثّف على الأطر الشرطية أولاً', 'استخدم مواقف قصصية ذات معنى للطفل، لا مجرّدة'],
    },
  ];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b22 0%, #22c55e22 100%)',
        borderRadius: '16px', padding: '20px 24px', marginBottom: '20px',
        border: '1px solid #f59e0b33',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>🧰</div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>أدوات ومواد كل وحدة</h2>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted, #94a3b8)' }}>
          قائمة شاملة بالمواد الأساسية والإضافية لإجراء كل وحدة تقييم
        </p>
      </div>

      {modules.map((mod) => (
        <div key={mod.key} style={{
          background: 'var(--surface, #1e293b)', borderRadius: '16px',
          padding: '20px 24px', marginBottom: '16px',
          borderRight: `3px solid ${mod.color}`,
        }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem' }}>{mod.icon}</span>
            <span style={{ color: mod.color }}>{mod.name}</span>
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>{mod.desc}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: mod.color, marginBottom: '8px' }}>⭐ أدوات أساسية (مطلوبة)</div>
              {mod.essential.map((t) => (
                <div key={t} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: mod.color, flexShrink: 0, marginTop: '2px' }}>◆</span>
                  <span style={{ color: 'var(--text, #f1f5f9)' }}>{t}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>➕ أدوات إضافية (تُحسّن التقييم)</div>
              {mod.additional.map((t) => (
                <div key={t} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted, #64748b)', flexShrink: 0, marginTop: '2px' }}>◇</span>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px', background: `${mod.color}0d`, borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: mod.color, marginBottom: '8px' }}>💡 نصائح إعداد وحدة {mod.key}</div>
            {mod.tips.map((tip) => (
              <div key={tip} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '5px', fontSize: '0.78rem' }}>
                <span style={{ color: mod.color, flexShrink: 0, marginTop: '2px' }}>›</span>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Arabic Adaptation Tab ────────────────────────────────────
function ArabicTab() {
  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b22 0%, #ef444422 100%)',
        borderRadius: '16px', padding: '20px 24px', marginBottom: '20px',
        border: '1px solid #f59e0b33',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>🌙</div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>التكيّف الثقافي واللغوي للطلاب الناطقين بالعربية</h2>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted, #94a3b8)' }}>
          توصيات لتكييف بنود PEAK مع السياق العربي الإسلامي
        </p>
      </div>

      <SectionCard icon="📋" title="مبادئ عامة للتكيّف" color="#f59e0b">
        {[
          { icon: '🎯', text: 'حافظ على القياس النفسي: الهدف من التكيّف هو الوصول لنفس البنية النفسية المقيسة، لا تغييرها. إذا كان البند يقيس "مطابقة مثير"، استبدل المثير لا المفهوم.' },
          { icon: '📸', text: 'استبدل الصور لا المهمة: إذا أظهر بند صورة طعام غربي، استبدلها بصورة طعام عربي مألوف. المهمة (المطابقة، التصنيف) تبقى كما هي.' },
          { icon: '🗣️', text: 'استخدم اللهجة المحلية برفق: النص العربي الفصيح مفضّل للتوحيد، لكن في الاستجابة الشفهية اقبل الاستجابات باللهجة المحلية إذا كانت صحيحة مفهومياً.' },
          { icon: '👨‍👩‍👧', text: 'اعتبر بنية الأسرة: بنود "من هذا؟" قد تشير لصور وجوه أشخاص لا يعرفها الطفل. استخدم صور أفراد الأسرة الحقيقيين أو صور مألوفة محلياً.' },
          { icon: '🕌', text: 'البيئة الدينية والثقافية: بعض الأطفال في بيئات محافظة قد لا يتعاملون مع صور معينة (وجه بشري، حيوانات معينة). اعمل مع الأهل مسبقاً.' },
        ].map((item) => <InfoBox key={item.text.slice(0,20)} icon={item.icon} text={item.text} color="#f59e0b" />)}
      </SectionCard>

      <SectionCard icon="🔄" title="بنود DT تحتاج تكيّف" color="#3b82f6">
        <AdaptCard
          itemCode="FLS-12"
          original="Jim says 'Hi!' What do you say?"
          adapted="سالم يقول: مرحباً! ماذا تقول أنت؟ / استخدم اسماً عربياً مألوفاً مثل: أحمد أو سارة"
          reason="الاسم 'Jim' غريب على الطفل العربي. استخدم اسماً عربياً يعرفه ليصبح السياق ذا معنى وظيفي." />
        <AdaptCard
          itemCode="PLS-4"
          original="Show me the bread (صورة Loaf of bread)"
          adapted="استخدم صورة رغيف عربي أو خبز بلدي بدلاً من التوست الغربي"
          reason="الخبز في البيئة العربية يختلف شكله. الطفل قد لا يعرف 'الـ Loaf' ولكنه يعرف الخبز العربي." />
        <AdaptCard
          itemCode="VCS-7"
          original="Tell me something that has spots (Ladybug)"
          adapted="أخبِرني بشيء عليه نقاط. القبول: بقرة، نمر، فهد، دجاجة رومي، فطر"
          reason="الدعسوقة (Ladybug) نادرة في البيئة العربية. البقرة والنمر أكثر مألوفية للطفل العربي." />
        <AdaptCard
          itemCode="VCS-12"
          original="Which clock shows 9:30?"
          adapted="أيُّها تشير إلى الساعة التاسعة والنصف؟ — تأكّد أن الطفل تعلّم قراءة الساعة بالعربي"
          reason="المفهوم الزمني محايد، لكن قراءة الساعة قد لا تُدرَّس بنفس الترتيب في المناهج العربية." />
      </SectionCard>

      <SectionCard icon="🔄" title="بنود G تحتاج تكيّف" color="#22c55e">
        <AdaptCard
          itemCode="G – أسماء الأشخاص"
          original="Bob's balloon popped / Mary has a dog"
          adapted="استخدم أسماء عربية في كل القصص: أحمد، سارة، محمد، فاطمة"
          reason="الأسماء الأجنبية تُضيف عبئاً معرفياً غير ضروري. الاسم المألوف يُساعد الطفل على التركيز في المهمة." />
        <AdaptCard
          itemCode="G – المجموعات الثقافية"
          original="Thanksgiving turkey / Halloween pumpkin"
          adapted="استبدل بمناسبات عربية: خروف العيد، فانوس رمضان، ملابس العيد"
          reason="المناسبات الغربية لا سياق ثقافي لها عند الطفل العربي. البديل العربي يُنشّط نفس البنية المعرفية (تصنيف المناسبات)." />
      </SectionCard>

      <SectionCard icon="🔄" title="بنود CE و TE تحتاج تكيّف" color="#a855f7">
        <AdaptCard
          itemCode="CE – الأطر الزمنية"
          original="Before Thanksgiving / After Christmas"
          adapted="قبل العيد / بعد رمضان / قبل المدرسة / بعد الغداء"
          reason="المرجع الزمني يجب أن يكون ذا معنى للطفل. المناسبات الإسلامية والمواقف اليومية أكثر فاعلية." />
        <AdaptCard
          itemCode="CE – المثيرات العاطفية"
          original="Bob is sad because his dog died"
          adapted="أحمد حزين لأن لعبته انكسرت / سارة خائفة من الرعد"
          reason="مفهوم 'الكلب' قد يكون ذا حمولة ثقافية في بعض الأسر. استخدم مواقف عاطفية محايدة ومألوفة." />
        <AdaptCard
          itemCode="TE – الاستجابات العاطفية"
          original="How might Bob feel if he won the game?"
          adapted="كيف يشعر أحمد لو فاز بالسباق؟ / فاطمة حصلت على هدية — كيف ستشعر؟"
          reason="TE يعتمد على العواطف الوظيفية. تأكّد أن المواقف تثير استجابات حقيقية لدى الطفل في ثقافته." />
      </SectionCard>

      <SectionCard icon="✅" title="توصيات عملية للمعالج" color="#22c55e">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          {[
            { n: '01', title: 'وثّق التكيّفات', desc: 'احفظ ملاحظة في خانة "ملاحظات الطالب" لكل تكيّف أجريته حتى يعلم به المقيّمون الآخرون.' },
            { n: '02', title: 'لا تُغيّر القياس', desc: 'إذا غيّرت البند كثيراً، لن تستطيع مقارنة النتيجة بمعايير العمر. غيّر المثير فقط، لا البنية المعرفية.' },
            { n: '03', title: 'جرّب مع الأهل', desc: 'اسأل الأهل قبل التقييم: ما الأشياء التي يسمّيها طفلك؟ ما الأسماء التي يعرفها؟ ما الأكل المفضّل؟' },
            { n: '04', title: 'استخدم صور حقيقية', desc: 'إذا أمكن، اطبع صوراً من بيئة الطفل الفعلية (صورة منزله، مدرسته، ألعابه). تزيد المصداقية الإيكولوجية للتقييم.' },
            { n: '05', title: 'التعزيز الثقافي', desc: 'المعزّزات يجب أن تكون ذات قيمة للطفل. تمر، بسكويت محلي، نشاط مفضّل ثقافياً أفضل من مكافآت غربية قد لا تكون مُعزِّزة.' },
            { n: '06', title: 'اللغة الفصيحة مقابل اللهجة', desc: 'دوّن في الملاحظات اللهجة المستخدمة. إذا كان الطفل يتكلم المصرية أو الخليجية، تقبّل استجاباته بلهجته وسجّلها في التقييم.' },
          ].map((item) => (
            <div key={item.n} style={{
              display: 'flex', gap: '14px', alignItems: 'flex-start',
              padding: '12px', background: '#ffffff06', borderRadius: '10px',
            }}>
              <div style={{
                background: '#22c55e22', color: '#22c55e',
                borderRadius: '8px', padding: '4px 10px',
                fontSize: '0.75rem', fontWeight: 900, flexShrink: 0,
              }}>{item.n}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '3px' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* روابط مراجع */}
      <div style={{
        background: 'var(--surface, #1e293b)', borderRadius: '14px',
        padding: '18px 20px', marginTop: '4px',
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', marginBottom: '12px' }}>
          📚 المراجع العلمية المعتمدة في هذا الدليل
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            'Dixon, M. R. (2014). PEAK Relational Training System — DT',
            'Hayes, S. C., Barnes-Holmes, D. & Roche, B. (2001). Relational Frame Theory',
            'Törneke, N. (2010). Learning RFT — An Introduction',
            'Rehfeldt & Barnes-Holmes (2009). Derived Relational Responding Applications',
            'Cooper, Heron & Heward — Applied Behavior Analysis (3rd Ed.)',
          ].map((ref) => <ToolTag key={ref} text={ref} color="#3b82f6" />)}
        </div>
      </div>
    </div>
  );
}

// ── Main Guide Screen ─────────────────────────────────────────
export function Guide() {
  const [activeTab, setActiveTab] = useState<GuideTab>('rft');

  return (
    <main
      id="main-content"
      role="main"
      style={{
        padding: '0',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
        color: 'var(--text, #f1f5f9)',
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '2px', padding: '12px 20px 0',
        background: 'var(--surface, #1e293b)',
        borderBottom: '1px solid var(--border, #1e293b)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--bg, #0a0f1a)' : 'transparent',
                color: isActive ? '#f9a825' : 'var(--text-muted, #94a3b8)',
                fontFamily: 'Cairo, sans-serif', fontWeight: isActive ? 800 : 400,
                fontSize: '0.88rem',
                borderBottom: isActive ? '2px solid #f9a825' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.15s',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'rft'    && <RftTab />}
        {activeTab === 'howto' && <HowtoTab />}
        {activeTab === 'tools'  && <ToolsTab />}
        {activeTab === 'arabic' && <ArabicTab />}
      </div>
    </main>
  );
}
