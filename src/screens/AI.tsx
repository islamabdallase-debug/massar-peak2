// ============================================================
//  مسار — AI Analysis Screen  v2.0
//  PEAK Expert Analysis: Factor Scores + Age Norms + Program Priority
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAppStore, selectSelectedStudent } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SessionDB } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { PEAK_MODULES } from '@/data/peakItems';
import type { AssessSession, PeakModule, ScoreValue } from '@/types';

// ── Age Norms (PEAK Report Master Template — Dixon, 2014) ──────────────────
const DT_NORMS: Record<string, Record<string, number>> = {
  FLS: { '1-2': 2,  '3-4': 30, '5-6': 34, '7-8': 34, '9-10': 34 },
  PLS: { '1-2': 0,  '3-4': 18, '5-6': 21, '7-8': 22, '9-10': 22 },
  VCS: { '1-2': 0,  '3-4': 19, '5-6': 80, '7-8': 94, '9-10': 100 },
  VMS: { '1-2': 0,  '3-4': 0,  '5-6': 10, '7-8': 22, '9-10': 28  },
};
const G_NORMS: Record<string, Record<string, number>> = {
  LLS: { '1-2': 1,  '3-4': 15, '5-6': 24, '7-8': 25,  '9-10': 26, '11-12': 29, '13-14': 33, '15+': 33 },
  CMS: { '1-2': 1,  '3-4': 15, '5-6': 25, '7-8': 36,  '9-10': 57, '11-12': 55, '13-14': 58, '15+': 59 },
  CPM: { '1-2': 2,  '3-4': 4,  '5-6': 9,  '7-8': 13,  '9-10': 50, '11-12': 52, '13-14': 61, '15+': 63 },
  RPR: { '1-2': 0,  '3-4': 4,  '5-6': 0,  '7-8': 0,   '9-10': 0,  '11-12': 16, '13-14': 20, '15+': 29 },
};

const DT_AGE_BANDS = ['1-2', '3-4', '5-6', '7-8', '9-10'];
const G_AGE_BANDS  = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12', '13-14', '15+'];

// ── Helpers ────────────────────────────────────────────────────────────────
function getFactorScores(mod: PeakModule, scores: Record<string, ScoreValue>) {
  const items = PEAK_MODULES[mod].items;
  const byFactor: Record<string, { passed: number; total: number; failedIds: string[] }> = {};
  for (const item of items) {
    if (!byFactor[item.factor]) byFactor[item.factor] = { passed: 0, total: 0, failedIds: [] };
    byFactor[item.factor].total++;
    if (scores[item.id] === 1)       byFactor[item.factor].passed++;
    else if (scores[item.id] === 0)  byFactor[item.factor].failedIds.push(item.id);
  }
  return byFactor;
}

function ageEquiv(factor: string, passed: number, total: number, norms: Record<string, Record<string, number>>, bands: string[]): string {
  if (!norms[factor] || total === 0) return '—';
  const maxNorm = Math.max(...Object.values(norms[factor]));
  if (maxNorm === 0) return '—';
  const pct = (passed / total) * 100;
  for (const band of [...bands].reverse()) {
    const normPct = (norms[factor][band] / maxNorm) * 100;
    if (pct >= normPct - 5) return `${band} سنة`;
  }
  return '< 1 سنة';
}

function getPriorityPrograms(mod: PeakModule, scores: Record<string, ScoreValue>): string[] {
  const items = PEAK_MODULES[mod].items;
  return items
    .filter(i => scores[i.id] === 0)
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map(i => i.id);
}

function buildPrompt(
  name: string, age: string,
  dtF: Record<string, { passed: number; total: number }>,
  gF:  Record<string, { passed: number; total: number }>,
  ceP: number, ceT: number, teP: number, teT: number,
  dtPrio: string[], gPrio: string[],
): string {
  const dtLines = Object.entries(dtF).map(([f, v]) => `  - ${f}: ${v.passed}/${v.total} (${Math.round(v.total > 0 ? (v.passed/v.total)*100 : 0)}%)`).join('\n');
  const gLines  = Object.entries(gF).map(([f, v]) =>  `  - ${f}: ${v.passed}/${v.total} (${Math.round(v.total > 0 ? (v.passed/v.total)*100 : 0)}%)`).join('\n');
  return `أنت خبير في نظام PEAK Relational Training System (RFT).
مهمتك تحليل نتائج التقييم الشامل للطفل وتقديم خطة علاجية متكاملة.

═══════════════════════════════════════
معلومات الطالب:
  الاسم: ${name}
  العمر: ${age || 'غير محدد'}

═══════════════════════════════════════
نتائج التقييم المباشر (DT):
${dtLines || '  (لا بيانات)'}

نتائج التعميم (G):
${gLines || '  (لا بيانات)'}

التكافؤ (CE): ${ceP}/${ceT} (${ceT > 0 ? Math.round((ceP/ceT)*100) : 0}%)
التحويل (TE): ${teP}/${teT} (${teT > 0 ? Math.round((teP/teT)*100) : 0}%)

═══════════════════════════════════════
بنود ذات أولوية للتدريب:

DT — أول ${dtPrio.length} بند:  ${dtPrio.join('، ') || 'لا يوجد'}
G  — أول ${gPrio.length} بند:   ${gPrio.join('، ')  || 'لا يوجد'}

═══════════════════════════════════════
المطلوب:

1. احسب درجة الانحراف (Deviation Score) لكل عامل بالمقارنة مع المعايير العمرية.
2. حدد المعادل العمري لكل عامل.
3. اقترح أول 5 برامج للبدء فوراً مع:
   - رمز البرنامج | وصف الهدف | معيار الإتقان (90% × 3 جلسات) | استراتيجية التدريب
4. أوصِ بعدد ساعات التدريب اليومي وموعد إعادة التقييم.
5. حدد التسلسل الأمثل: متى الانتقال من DT → G → CE → TE؟

ابدأ تحليلك.`;
}

// ── Main Component ──────────────────────────────────────────────────────────
export function AI() {
  const selectedStudent = useAppStore(selectSelectedStudent);
  const { setScreen } = useAppStore();
  const { t } = useTranslation();

  const [sessions, setSessions]       = useState<AssessSession[]>([]);
  const [activeTab, setActiveTab]     = useState<'analysis' | 'prompt'>('analysis');
  const [analysisReady, setReady]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);

  useEffect(() => {
    if (selectedStudent) SessionDB.getByStudentId(selectedStudent.id).then(setSessions);
  }, [selectedStudent?.id]);

  if (!selectedStudent) {
    return (
      <main id="main-content" role="main" style={centeredStyle}>
        <div style={{ fontSize: '3rem' }}>🤖</div>
        <p style={{ color: 'var(--text-muted,#94a3b8)' }}>{t('selectStudentFirst')}</p>
        <Button variant="primary" onClick={() => setScreen('students')}>{t('students')}</Button>
      </main>
    );
  }

  const latest  = sessions[0];
  const scores  = latest?.scores ?? { DT: {}, G: {}, CE: {}, TE: {} };
  const dtFD    = getFactorScores('DT', scores.DT ?? {});
  const gFD     = getFactorScores('G',  scores.G  ?? {});
  const ceFD    = getFactorScores('CE', scores.CE ?? {});
  const teFD    = getFactorScores('TE', scores.TE ?? {});
  const ceP     = Object.values(ceFD).reduce((a, b) => a + b.passed, 0);
  const ceT     = Object.values(ceFD).reduce((a, b) => a + b.total,  0);
  const teP     = Object.values(teFD).reduce((a, b) => a + b.passed, 0);
  const teT     = Object.values(teFD).reduce((a, b) => a + b.total,  0);
  const dtPrio  = getPriorityPrograms('DT', scores.DT ?? {});
  const gPrio   = getPriorityPrograms('G',  scores.G  ?? {});

  const studentAge = selectedStudent.dob
    ? `${Math.floor((Date.now() - new Date(selectedStudent.dob).getTime()) / (365.25*864e5))} سنة`
    : '';

  const prompt = buildPrompt(
    selectedStudent.name, studentAge,
    Object.fromEntries(Object.entries(dtFD).map(([k,v])=>[k,{passed:v.passed,total:v.total}])),
    Object.fromEntries(Object.entries(gFD).map(([k,v])=>[k,{passed:v.passed,total:v.total}])),
    ceP, ceT, teP, teT, dtPrio, gPrio,
  );

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); } catch { /**/ }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  const hasData = sessions.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <main id="main-content" role="main"
      style={{ padding: '20px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: 'var(--text,#f1f5f9)' }}>

      {/* Header */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>🤖 التحليل الذكي PEAK</h2>
        <p style={{ margin: 0, color: 'var(--text-muted,#94a3b8)', fontSize: '0.83rem' }}>
          {selectedStudent.name} — {sessions.length} جلسة مسجلة
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['analysis', 'prompt'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontFamily: 'Cairo, sans-serif', fontSize: '0.87rem',
            fontWeight: tab === activeTab ? 700 : 400,
            background: tab === activeTab ? 'var(--primary,#3b82f6)' : 'var(--surface,#1e293b)',
            color: tab === activeTab ? '#fff' : 'var(--text-muted,#94a3b8)',
            transition: 'all 0.2s',
          }}>
            {tab === 'analysis' ? '📊 تحليل تلقائي' : '📋 برومت الخبير'}
          </button>
        ))}
      </div>

      {/* ── Analysis Tab ── */}
      {activeTab === 'analysis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!hasData ? (
            <EmptyCard icon="📋" msg="لا توجد جلسات تقييم. ابدأ بتقييم الطالب في وحدة DT أولاً." />
          ) : !analysisReady ? (
            <div style={{ textAlign: 'center', padding: '36px', background: 'var(--surface,#1e293b)', borderRadius: '16px' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🤖</div>
              <p style={{ color: 'var(--text-muted,#94a3b8)', marginBottom: '20px', fontSize: '0.9rem' }}>
                يُحلّل النظام الدرجات لكل عامل ويُقارنها بالمعايير العمرية لـ PEAK
              </p>
              <Button variant="primary" loading={loading} onClick={() => { setLoading(true); setTimeout(() => { setReady(true); setLoading(false); }, 900); }}>
                {loading ? 'جارٍ التحليل...' : 'تحليل النتائج'}
              </Button>
            </div>
          ) : (
            <>
              {/* DT Factors */}
              <FactorCard title="🔵 التدريب المباشر (DT)" color="#3b82f6"
                factors={dtFD} norms={DT_NORMS} bands={DT_AGE_BANDS} />

              {/* G Factors */}
              <FactorCard title="🟢 التعميم (G)" color="#10b981"
                factors={gFD} norms={G_NORMS} bands={G_AGE_BANDS} />

              {/* CE / TE summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <ModSummary title="🟡 التكافؤ (CE)" color="#f59e0b" passed={ceP} total={ceT}
                  note="Reflexivity · Symmetry · Transitivity · Equivalence — الحد الأقصى 48" />
                <ModSummary title="🟣 التحويل (TE)" color="#8b5cf6" passed={teP} total={teT}
                  note="6 عوامل × تعبيري + استقبالي — الحد الأقصى 192" />
              </div>

              {/* Priority Programs */}
              {(dtPrio.length > 0 || gPrio.length > 0) && (
                <PriorityCard dtPrio={dtPrio} gPrio={gPrio} dtFD={dtFD} gFD={gFD} scores={scores} />
              )}

              {/* Clinical Recs */}
              <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px', borderTop:'3px solid #22c55e' }}>
                <h3 style={{ margin:'0 0 12px', fontSize:'0.95rem', fontWeight:700 }}>💡 التوصيات السريرية</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:'7px', fontSize:'0.87rem', color:'var(--text-muted,#94a3b8)', lineHeight:1.7 }}>
                  {[
                    ['⏱','كثافة التدريب: 2–4 ساعات يومياً باستخدام منهج PEAK'],
                    ['✅','معيار الإتقان: 90% أو أعلى (9/10 تجارب صحيحة) في 3 جلسات متتالية'],
                    ['📅','إعادة التقييم: كل 3 أشهر لمقارنة التقدم بالمعايير العمرية'],
                    ['📶','التسلسل: DT أولاً ← G ← CE ← TE (بعد إتقان كافٍ في كل مرحلة)'],
                    ['🔢','عدد البرامج المتزامنة: 5 للمبتدئين، حتى 10 للمتقدمين'],
                    ['🔄','التعميم: اختبر كل مهارة مع أشخاص وبيئات ومواد مختلفة بدون مساعدة'],
                  ].map(([ic, tx], i) => (
                    <div key={i} style={{ display:'flex', gap:'8px' }}><span>{ic}</span><span>{tx}</span></div>
                  ))}
                </div>
              </div>

              <Button variant="secondary" onClick={() => setReady(false)}>🔄 إعادة التحليل</Button>
            </>
          )}
        </div>
      )}

      {/* ── Prompt Tab ── */}
      {activeTab === 'prompt' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <h3 style={{ margin:0, fontSize:'0.95rem', fontWeight:700 }}>📋 برومت الخبير — PEAK Expert Prompt</h3>
              <button onClick={copyPrompt} style={{
                padding:'8px 16px', borderRadius:'8px', border:'none', cursor:'pointer',
                background: copied ? '#22c55e' : 'var(--primary,#3b82f6)',
                color:'#fff', fontFamily:'Cairo,sans-serif', fontSize:'0.82rem', fontWeight:700,
                transition:'background 0.2s',
              }}>
                {copied ? '✅ تم النسخ' : '📋 نسخ البرومت'}
              </button>
            </div>
            <p style={{ margin:'0 0 12px', fontSize:'0.82rem', color:'var(--text-muted,#94a3b8)' }}>
              البرومت مُضمَّن ببيانات {selectedStudent.name} الفعلية من آخر جلسة.
              انسخه والصقه في كلود للحصول على تحليل سريري متعمق.
            </p>
            <textarea readOnly value={prompt} style={{
              width:'100%', minHeight:'300px', background:'#0f172a',
              border:'1px solid var(--border,#334155)', borderRadius:'10px', padding:'14px',
              fontFamily:'Cairo, monospace', fontSize:'0.82rem', color:'#cbd5e1',
              lineHeight:1.7, direction:'rtl', resize:'vertical', boxSizing:'border-box',
            }} />
          </div>

          <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px', borderTop:'3px solid #8b5cf6' }}>
            <h3 style={{ margin:'0 0 10px', fontSize:'0.95rem', fontWeight:700 }}>🚀 كيفية الاستخدام</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', fontSize:'0.87rem', color:'var(--text-muted,#94a3b8)', lineHeight:1.7 }}>
              {[
                'انقر "نسخ البرومت" أعلاه',
                'افتح محادثة جديدة مع كلود (claude.ai)',
                'الصق البرومت وأرسله',
                'سيُحلّل كلود النتائج ويُقدّم خطة علاجية متكاملة',
                'احفظ التوصيات واستخدمها في شاشة الخطة (Plan)',
              ].map((step, i) => (
                <div key={i} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                  <span style={{
                    width:'22px', height:'22px', borderRadius:'50%', background:'#8b5cf6',
                    color:'#fff', fontSize:'0.75rem', fontWeight:800, display:'flex',
                    alignItems:'center', justifyContent:'center', flexShrink:0,
                  }}>{i+1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FactorCard({ title, color, factors, norms, bands }: {
  title: string; color: string;
  factors: Record<string, { passed: number; total: number; failedIds: string[] }>;
  norms: Record<string, Record<string, number>>;
  bands: string[];
}) {
  const entries = Object.entries(factors);
  if (!entries.length) return null;
  return (
    <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px', borderTop:`3px solid ${color}` }}>
      <h3 style={{ margin:'0 0 14px', fontSize:'0.95rem', fontWeight:700 }}>{title}</h3>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
          <thead>
            <tr style={{ color:'var(--text-muted,#94a3b8)', fontSize:'0.78rem' }}>
              {['العامل','الدرجة','النسبة','المعادل العمري','الحالة'].map(h => (
                <th key={h} style={{ padding:'8px 10px', textAlign:'right', borderBottom:'1px solid var(--border,#334155)', fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([factor, data]) => {
              const pct = data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0;
              const eq  = ageEquiv(factor, data.passed, data.total, norms, bands);
              const sc  = pct >= 80 ? '#22c55e' : pct >= 60 ? '#84cc16' : pct >= 40 ? '#f59e0b' : '#ef4444';
              const lb  = pct >= 80 ? 'ممتاز' : pct >= 60 ? 'جيد' : pct >= 40 ? 'متوسط' : 'يحتاج تدخلاً';
              return (
                <tr key={factor} style={{ borderBottom:'1px solid var(--border,#334155)' }}>
                  <td style={TD}><span style={{ fontWeight:700, color }}>{factor}</span></td>
                  <td style={TD}>{data.passed}/{data.total}</td>
                  <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ width:'55px', height:'5px', background:'#ffffff12', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:sc }} />
                      </div>
                      <span style={{ color:sc, fontWeight:700 }}>{pct}%</span>
                    </div>
                  </td>
                  <td style={TD}>{eq}</td>
                  <td style={TD}><span style={{ color:sc, fontSize:'0.78rem', fontWeight:700 }}>{lb}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModSummary({ title, color, passed, total, note }: {
  title: string; color: string; passed: number; total: number; note: string;
}) {
  const pct = total > 0 ? Math.round((passed/total)*100) : 0;
  const sc  = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'16px', borderTop:`3px solid ${color}` }}>
      <h4 style={{ margin:'0 0 8px', fontSize:'0.88rem', fontWeight:700 }}>{title}</h4>
      <div style={{ fontSize:'1.4rem', fontWeight:800, color:sc }}>{pct}%</div>
      <div style={{ fontSize:'0.78rem', color:'var(--text-muted,#94a3b8)', margin:'3px 0 6px' }}>{passed}/{total} بند</div>
      <div style={{ fontSize:'0.72rem', color:'var(--text-muted,#94a3b8)', lineHeight:1.5 }}>{note}</div>
    </div>
  );
}

function PriorityCard({ dtPrio, gPrio, dtFD, gFD, scores }: {
  dtPrio: string[]; gPrio: string[];
  dtFD: Record<string, { passed: number; total: number; failedIds: string[] }>;
  gFD:  Record<string, { passed: number; total: number; failedIds: string[] }>;
  scores: any;
}) {
  return (
    <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px', borderTop:'3px solid #f59e0b' }}>
      <h3 style={{ margin:'0 0 6px', fontSize:'0.95rem', fontWeight:700 }}>🎯 البرامج ذات الأولوية للبدء فوراً</h3>
      <p style={{ margin:'0 0 12px', fontSize:'0.8rem', color:'var(--text-muted,#94a3b8)' }}>
        مرتّبة من الأسهل للأصعب — مرّر فوق الكود لرؤية وصف البند
      </p>
      {dtPrio.length > 0 && <PrioRow mod="DT" color="#3b82f6" ids={dtPrio} />}
      {gPrio.length  > 0 && <PrioRow mod="G"  color="#10b981" ids={gPrio}  />}
    </div>
  );
}

function PrioRow({ mod, color, ids }: { mod: PeakModule; color: string; ids: string[] }) {
  const items = PEAK_MODULES[mod].items;
  return (
    <div style={{ marginBottom:'10px' }}>
      <div style={{ fontSize:'0.8rem', fontWeight:700, color, marginBottom:'6px' }}>{mod} — أولويات:</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
        {ids.map((id, idx) => {
          const item = items.find(i => i.id === id);
          return (
            <div key={id} title={item?.ar ?? id} style={{
              padding:'4px 10px', borderRadius:'6px',
              background:`${color}22`, border:`1px solid ${color}44`,
              fontSize:'0.78rem', fontWeight:700, color, cursor:'default',
            }}>
              {idx+1}. {id}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCard({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{ textAlign:'center', padding:'40px', background:'var(--surface,#1e293b)', borderRadius:'16px' }}>
      <div style={{ fontSize:'3rem', marginBottom:'12px' }}>{icon}</div>
      <p style={{ color:'var(--text-muted,#94a3b8)', fontSize:'0.9rem' }}>{msg}</p>
    </div>
  );
}

const centeredStyle: React.CSSProperties = {
  padding:'24px', fontFamily:'Cairo,sans-serif', direction:'rtl', color:'var(--text,#f1f5f9)',
  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
  minHeight:'60vh', gap:'16px', textAlign:'center',
};
const TD: React.CSSProperties = {
  padding:'9px 10px', textAlign:'right', color:'var(--text-muted,#94a3b8)',
};
