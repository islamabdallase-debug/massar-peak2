// ============================================================
//  مسار — Reports Screen  (session list + full detail view)
// ============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore, selectSelectedStudent } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SessionDB } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { MODULE_COLORS, MODULE_ICONS, PEAK_MODULES, getModuleFactors } from '@/data/peakItems';
import { exportToPdf } from '@/services/PdfExportService';
import type { AssessSession, SessionSummary, PeakModule } from '@/types';

const MODULE_ORDER: PeakModule[] = ['DT', 'G', 'CE', 'TE'];

const MODULE_META: Record<PeakModule, { ar: string; en: string }> = {
  DT: { ar: 'التعلم المباشر',       en: 'Direct Training' },
  G:  { ar: 'التعميم العلائقي',    en: 'Generalization' },
  CE: { ar: 'التكافؤ السياقي',      en: 'Contextual Equivalence' },
  TE: { ar: 'تحويل وظائف المثير',  en: 'Transformation' },
};

function pctColor(pct: number): string {
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#84cc16';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}
function pctLabel(pct: number): string {
  if (pct >= 80) return 'ممتاز';
  if (pct >= 60) return 'جيد';
  if (pct >= 40) return 'متوسط';
  return 'يحتاج دعم';
}
function formatDate(ts: number, locale = 'ar-SA'): string {
  return new Date(ts).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}ث`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return s > 0 ? `${m}د ${s}ث` : `${m} دقيقة`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}س ${rm}د`;
}

// ── Score Ring ────────────────────────────────────────────────
function ScoreRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} role="img" aria-label={`${pct}%`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border,#334155)" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text,#f1f5f9)" fontSize={size*0.19} fontFamily="Cairo,sans-serif" fontWeight="800">
        {pct}%
      </text>
    </svg>
  );
}

// ── Radar Chart ───────────────────────────────────────────────
function RadarChart({ summary, size = 200 }: { summary: SessionSummary[]; size?: number }) {
  const cx = size/2, cy = size/2, r = size*0.36;
  const angles = MODULE_ORDER.map((_,i) => (Math.PI*2*i)/4 - Math.PI/2);
  function pt(angle: number, radius: number) {
    return { x: cx + radius*Math.cos(angle), y: cy + radius*Math.sin(angle) };
  }
  const dataPoints = MODULE_ORDER.map((mod,i) => {
    const s = summary.find(x => x.module === mod);
    return pt(angles[i], r * ((s?.pct ?? 0)/100));
  });
  const polyline = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg width={size} height={size} role="img" aria-label="مخطط الرادار">
      {[25,50,75,100].map(ring => (
        <polygon key={ring}
          points={MODULE_ORDER.map((_,i) => { const p=pt(angles[i],r*(ring/100)); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="var(--border,#334155)" strokeWidth={0.7} opacity={0.6} />
      ))}
      {MODULE_ORDER.map((_,i) => {
        const outer = pt(angles[i],r);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--border,#334155)" strokeWidth={0.7} opacity={0.5} />;
      })}
      <polygon points={polyline} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map((p,i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={MODULE_COLORS[MODULE_ORDER[i]]} stroke="var(--bg,#0a0f1a)" strokeWidth={2} />
      ))}
      {MODULE_ORDER.map((mod,i) => {
        const lp = pt(angles[i], r*1.22);
        const s = summary.find(x => x.module === mod);
        return (
          <g key={mod}>
            <text x={lp.x} y={lp.y-5} textAnchor="middle" fill={MODULE_COLORS[mod]} fontSize={10} fontFamily="Cairo,sans-serif" fontWeight="800">{mod}</text>
            <text x={lp.x} y={lp.y+9} textAnchor="middle" fill="var(--text-muted,#94a3b8)" fontSize={9} fontFamily="Cairo,sans-serif">{s?.pct ?? 0}%</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Module Trend Chart ────────────────────────────────────────
function ModuleTrendChart({ sessions }: { sessions: AssessSession[] }) {
  const [hoveredPt, setHoveredPt] = React.useState<{ x: number; y: number; label: string } | null>(null);
  if (sessions.length < 2) return null;

  const sorted = [...sessions]
    .filter(s => s.summary && s.summary.length > 0)
    .sort((a, b) => a.savedAt - b.savedAt)
    .slice(-10);

  if (sorted.length < 2) return null;

  const W = 340, H = 140;
  const pad = { l: 28, r: 12, t: 12, b: 28 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const n  = sorted.length;

  function xOf(i: number)   { return pad.l + (n === 1 ? cw / 2 : (i / (n - 1)) * cw); }
  function yOf(pct: number) { return pad.t + (1 - pct / 100) * ch; }

  const dateLabel = (ts: number) =>
    new Date(ts).toLocaleDateString('ar-SA', { month: 'numeric', day: 'numeric' });

  // per-module pct series
  const series = MODULE_ORDER.map(mod => ({
    mod,
    color: MODULE_COLORS[mod],
    pcts: sorted.map(s => {
      const ms = s.summary?.find(x => x.module === mod);
      return ms ? ms.pct : null;
    }),
  }));

  // overall avg per session
  const avgPcts = sorted.map(s =>
    s.summary?.length
      ? Math.round(s.summary.reduce((a, b) => a + b.pct, 0) / s.summary.length)
      : 0
  );

  return (
    <div style={{ marginBottom: '20px', background: 'var(--surface,#1e293b)', borderRadius: '14px', padding: '14px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text,#f1f5f9)' }}>
          📈 مسار التقدم عبر الجلسات ({sorted.length})
        </span>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {MODULE_ORDER.map(mod => (
            <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: MODULE_COLORS[mod], fontWeight: 700 }}>
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={MODULE_COLORS[mod]} strokeWidth="2.5" strokeLinecap="round"/></svg>
              {mod}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>
            <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" strokeLinecap="round"/></svg>
            متوسط
          </div>
        </div>
      </div>

      {/* SVG chart */}
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} role="img" aria-label="مخطط التقدم لكل وحدة" style={{ display: 'block' }}
          onMouseLeave={() => setHoveredPt(null)}>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <g key={y}>
              <line x1={pad.l} y1={yOf(y)} x2={W - pad.r} y2={yOf(y)}
                stroke="var(--border,#334155)" strokeWidth={y === 0 || y === 100 ? 1 : 0.5} strokeDasharray={y === 0 || y === 100 ? '' : '3,3'} />
              <text x={pad.l - 4} y={yOf(y) + 3} textAnchor="end"
                fill="var(--text-muted,#64748b)" fontSize={8} fontFamily="Cairo,sans-serif">{y}</text>
            </g>
          ))}

          {/* X-axis date labels */}
          {sorted.map((s, i) => (
            <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
              fill="var(--text-muted,#64748b)" fontSize={7.5} fontFamily="Cairo,sans-serif">
              {dateLabel(s.savedAt)}
            </text>
          ))}

          {/* Average dashed line */}
          {avgPcts.map((pct, i) => i === 0 ? null : (
            <line key={i}
              x1={xOf(i - 1)} y1={yOf(avgPcts[i - 1])}
              x2={xOf(i)}     y2={yOf(pct)}
              stroke="#475569" strokeWidth={1.2} strokeDasharray="4,3" />
          ))}

          {/* Per-module lines + dots */}
          {series.map(({ mod, color, pcts }) => {
            const validPts = pcts.map((p, i) => p !== null ? { i, p } : null).filter(Boolean) as { i: number; p: number }[];
            return (
              <g key={mod}>
                {validPts.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = validPts[idx - 1];
                  return (
                    <line key={idx}
                      x1={xOf(prev.i)} y1={yOf(prev.p)}
                      x2={xOf(pt.i)}   y2={yOf(pt.p)}
                      stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  );
                })}
                {validPts.map(({ i, p }) => (
                  <circle key={i} cx={xOf(i)} cy={yOf(p)} r={4}
                    fill={color} stroke="var(--bg,#0a0f1a)" strokeWidth={1.5}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => {
                      const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                      setHoveredPt({
                        x: xOf(i),
                        y: yOf(p),
                        label: `${mod}: ${p}%  •  ${dateLabel(sorted[i].savedAt)}`,
                      });
                    }}>
                    <title>{mod}: {p}% — {dateLabel(sorted[i].savedAt)}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredPt && (() => {
            const tw = 130, th = 20;
            const tx = Math.min(hoveredPt.x - tw / 2, W - pad.r - tw);
            const ty = hoveredPt.y - th - 6;
            return (
              <g>
                <rect x={Math.max(tx, pad.l)} y={Math.max(ty, pad.t)} width={tw} height={th}
                  fill="#1e293b" stroke="#334155" strokeWidth={1} rx={4} />
                <text x={Math.max(tx, pad.l) + tw / 2} y={Math.max(ty, pad.t) + 13}
                  textAnchor="middle" fill="#f1f5f9" fontSize={9} fontFamily="Cairo,sans-serif">
                  {hoveredPt.label}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Last session summary row */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {series.map(({ mod, color, pcts }) => {
          const last = [...pcts].reverse().find(p => p !== null) ?? null;
          const prev = [...pcts].slice(0, -1).reverse().find(p => p !== null) ?? null;
          const delta = last !== null && prev !== null ? last - prev : null;
          return (
            <div key={mod} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '8px',
              padding: '5px 10px', minWidth: '56px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color }}>{mod}</span>
              <span style={{ fontSize: '0.92rem', fontWeight: 900, color: pctColor(last ?? 0) }}>{last ?? '—'}%</span>
              {delta !== null && (
                <span style={{ fontSize: '0.65rem', color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Factor bar ────────────────────────────────────────────────
function FactorBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'7px' }}>
      <span style={{ minWidth:'48px', fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted,#94a3b8)', textAlign:'right', fontFamily:'monospace' }}>{label}</span>
      <div style={{ flex:1, height:'10px', borderRadius:'5px', background:'var(--border,#334155)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, borderRadius:'5px', background:pctColor(pct), transition:'width 0.6s ease' }} />
      </div>
      <span style={{ minWidth:'36px', fontSize:'0.72rem', fontWeight:700, color:pctColor(pct), textAlign:'left' }}>{pct}%</span>
    </div>
  );
}

// ── Module Panel ──────────────────────────────────────────────
function ModulePanel({ mod, summary, session }: {
  mod: PeakModule; summary: SessionSummary | undefined; session: AssessSession;
}) {
  const color = MODULE_COLORS[mod];
  const pct = summary?.pct ?? 0;
  const factors = getModuleFactors(mod);
  const modScores = session.scores[mod] ?? {};
  const items = PEAK_MODULES[mod].items;
  return (
    <div style={{ background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px', borderTop:`3px solid ${color}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
        <ScoreRing pct={pct} color={pctColor(pct)} size={64} />
        <div>
          <div style={{ fontWeight:800, fontSize:'1rem', color }}>{MODULE_ICONS[mod]} {mod} — {MODULE_META[mod].ar}</div>
          <div style={{ fontSize:'0.78rem', color:'var(--text-muted,#94a3b8)', marginTop:'3px' }}>
            {summary?.passed ?? 0} نجح · {summary?.failed ?? 0} أخفق · {summary?.skipped ?? 0} لم يُقيَّم
          </div>
          <div style={{ display:'inline-block', marginTop:'4px', background:`${pctColor(pct)}22`, color:pctColor(pct), borderRadius:'6px', padding:'2px 8px', fontSize:'0.72rem', fontWeight:700 }}>
            {pctLabel(pct)}
          </div>
        </div>
      </div>
      {factors.map(f => {
        const fItems = items.filter(it => it.factor === f.key);
        const passed = fItems.filter(it => modScores[it.id] === 1).length;
        const answered = fItems.filter(it => modScores[it.id] !== undefined && modScores[it.id] !== null).length;
        const fPct = answered > 0 ? Math.round((passed/answered)*100) : 0;
        return <FactorBar key={f.key} label={f.key} pct={fPct} />;
      })}
    </div>
  );
}

// ── Recommendations ───────────────────────────────────────────
function RecommendationBlock({ summary }: { summary: SessionSummary[] }) {
  if (!summary.length) return null;
  const sorted = [...summary].sort((a,b) => a.pct - b.pct);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length-1];
  const recTexts: Record<PeakModule,string> = {
    DT: 'ركّز على تقنيات DTT وتعزيز مهارات التعلم الأساسية والتقليد.',
    G:  'دعّم مهارات التعميم عبر تنويع المواد والسياقات التدريبية.',
    CE: 'طوّر مهارات التكافؤ السياقي بتمارين التمييز والمقارنة.',
    TE: 'عالج تحويل وظائف المثير بتمارين هرمية متدرجة الصعوبة.',
  };
  const recs = summary.filter(s => s.pct < 60);
  return (
    <div style={{ marginTop:'20px', background:'var(--surface,#1e293b)', borderRadius:'14px', padding:'18px' }}>
      <h3 style={{ margin:'0 0 14px', fontSize:'1rem', fontWeight:800 }}>🤖 توصيات التدخل</h3>
      <div style={{ display:'flex', gap:'12px', marginBottom: recs.length ? '14px' : 0, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:'160px', background:'#22c55e12', border:'1px solid #22c55e30', borderRadius:'10px', padding:'10px 14px' }}>
          <div style={{ fontSize:'0.72rem', color:'#22c55e', fontWeight:700, marginBottom:'3px' }}>✓ الأقوى</div>
          <div style={{ fontWeight:800, color:MODULE_COLORS[strongest.module] }}>{strongest.module} — {strongest.pct}%</div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted,#94a3b8)', marginTop:'2px' }}>{MODULE_META[strongest.module].ar}</div>
        </div>
        <div style={{ flex:1, minWidth:'160px', background:'#ef444412', border:'1px solid #ef444430', borderRadius:'10px', padding:'10px 14px' }}>
          <div style={{ fontSize:'0.72rem', color:'#ef4444', fontWeight:700, marginBottom:'3px' }}>⚠ الأضعف</div>
          <div style={{ fontWeight:800, color:MODULE_COLORS[weakest.module] }}>{weakest.module} — {weakest.pct}%</div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted,#94a3b8)', marginTop:'2px' }}>{MODULE_META[weakest.module].ar}</div>
        </div>
      </div>
      {recs.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {recs.map(({ module: mod }) => (
            <div key={mod} style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:`${MODULE_COLORS[mod]}10`, borderRadius:'8px', padding:'10px 12px' }}>
              <span style={{ color:MODULE_COLORS[mod], fontSize:'1.1rem', flexShrink:0 }}>{MODULE_ICONS[mod]}</span>
              <span style={{ fontSize:'0.85rem', lineHeight:1.55 }}>{recTexts[mod]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Formal Report (MASTER TEMPLATE) ──────────────────────────
function FormalReport({ session, studentName, students }: {
  session: AssessSession;
  studentName: string;
  students: import('@/types').Student[];
}) {
  const student = students.find(s => s.id === session.studentId);
  const dateStr = formatDate(session.savedAt, 'ar-SA');
  const todayStr = formatDate(Date.now(), 'ar-SA');
  const avgPct = session.summary?.length
    ? Math.round(session.summary.reduce((a,b) => a+b.pct,0)/session.summary.length) : 0;
  const sorted = session.summary ? [...session.summary].sort((a,b) => a.pct - b.pct) : [];
  const weakest  = sorted[0];
  const strongest = sorted[sorted.length - 1];

  const levelLabel = (pct: number) => {
    if (pct >= 80) return 'مستوى ممتاز — أداء متقدم';
    if (pct >= 60) return 'مستوى جيد — أداء فوق المتوسط';
    if (pct >= 40) return 'مستوى متوسط — يحتاج دعم موجّه';
    return 'مستوى ضعيف — يحتاج تدخلاً مكثفاً';
  };

  const interpretModule = (mod: PeakModule, pct: number): string => {
    const interp: Record<PeakModule, Record<string,string>> = {
      DT: {
        high: 'يُحقق الطالب أداءً متميزاً في التعلم المباشر، ويُظهر استجابة واضحة وقدرة راسخة على اكتساب المهارات الأساسية — وهو مؤشر إيجابي يدعم التوسع نحو مهارات أكثر تعقيداً.',
        mid:  'يمتلك الطالب قاعدة جيدة في التعلم المباشر، وتُشير النتائج إلى إمكانات نمو واعدة عند تكثيف الدعم في مهارات التقليد والتعلم الهيكلي.',
        low:  'يستجيب الطالب للتدريب المبني على الملاحظة والتعلم المنظم؛ وتستهدف الخطة التالية بناء قدراته في التعلم المباشر بخطوات متدرجة وتعزيز مستمر.',
      },
      G: {
        high: 'يتمتع الطالب بقدرة راسخة على تعميم ما يتعلمه عبر سياقات ومواد متنوعة، مما يُعزز انتقال المهارات للبيئة الطبيعية ويُقلل الاعتماد على التدريب المتكرر.',
        mid:  'يُظهر الطالب بدايات واعدة في التعميم العلائقي؛ والتوسع في تنويع المثيرات والسياقات سيُسرّع انتقال المهارات المكتسبة إلى بيئات جديدة.',
        low:  'يستفيد الطالب من بيئات تدريب منظمة ومتكررة؛ وتستهدف الخطة توسيع نطاق التعميم تدريجياً عبر مثيرات وأشخاص وسياقات متعددة.',
      },
      CE: {
        high: 'يتمتع الطالب بفهم متقدم للتكافؤ السياقي ويُميّز العلاقات السياقية بكفاءة عبر سياقات متعددة — وهو أساس قوي للبناء نحو شبكات علائقية أكثر تعقيداً.',
        mid:  'يمتلك الطالب فهماً نامياً للعلاقات السياقية؛ والتدرج في تعقيد التمارين وإثراء السياقات سيُمكّنه من توطيد هذه المهارة وتوسيع تطبيقاتها.',
        low:  'يُظهر الطالب استعداداً للتعلم السياقي؛ وتبدأ الخطة بتمارين التمييز الثنائي لبناء أساس متين، ثم التدرج نحو أطر سياقية أكثر تعقيداً.',
      },
      TE: {
        high: 'يُظهر الطالب قدرة متقدمة على اكتساب وظائف المثير بشكل اشتقاقي دون تدريب مباشر — وهو مؤشر قوي على مرونة علائقية ناضجة تفتح آفاقاً واسعة للتعلم.',
        mid:  'يمتلك الطالب قدرات اشتقاقية ناشئة يمكن تعزيزها؛ والتدرج في تعقيد الشبكات العلائقية وتوسيع الأطر المُدرَّبة سيُطور هذه المهارة بشكل ملحوظ.',
        low:  'يمتلك الطالب الأساس اللازم لتطوير مهارات تحويل الوظائف؛ وتعتمد الخطة على بناء الأطر الأساسية خطوة بخطوة انطلاقاً من أطر التناظر والتمييز.',
      },
    };
    const level = pct >= 60 ? 'high' : pct >= 40 ? 'mid' : 'low';
    return interp[mod][level];
  };

  const goalSuggestions: Record<PeakModule, string> = {
    DT: `سيُنفّذ ${studentName} استجابة صحيحة لتعليمة التعلم المباشر بنسبة 90% أو أعلى في 3 جلسات متتالية مع مدربين متعددين.`,
    G:  `سيُعمّم ${studentName} المهارة المكتسبة عبر 3 سياقات مختلفة و3 مجموعات مثيرات بنسبة نجاح 90% في جلستين متتاليتين.`,
    CE: `سيُميّز ${studentName} العلاقات السياقية المطلوبة بنسبة 90% في 3 جلسات متتالية عبر مثيرات جديدة لم يُدرَّب عليها مسبقاً.`,
    TE: `سيُظهر ${studentName} تحويل وظيفة المثير بشكل اشتقاقي في مواقف جديدة بنسبة 90% أو أعلى في 3 جلسات متتالية.`,
  };

  const S = { // section heading style
    fontSize: '1rem',
    fontWeight: 900,
    color: '#1e3a5f',
    borderBottom: '2px solid #1e3a5f',
    paddingBottom: '6px',
    marginBottom: '14px',
    marginTop: '28px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties;

  return (
    <div id="formal-report" style={{
      background: '#fff',
      color: '#1a202c',
      fontFamily: 'Cairo, sans-serif',
      direction: 'rtl',
      padding: '36px 40px',
      maxWidth: '800px',
      margin: '0 auto',
      borderRadius: '16px',
      boxShadow: '0 4px 40px rgba(0,0,0,0.2)',
      lineHeight: 1.7,
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '28px', borderBottom: '3px solid #1e3a5f', paddingBottom: '20px' }}>
        <div style={{ fontSize: '0.8rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>منصة مسار · PEAK Relational Frame Theory Assessment</div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.8rem', fontWeight: 900, color: '#1e3a5f' }}>
          تقرير تقييم مهارات الإطار العلائقي
        </h1>
        <div style={{ fontSize: '0.85rem', color: '#475569' }}>PEAK Relational Training Assessment Report</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>📅 تاريخ التقييم: <strong style={{ color: '#1e3a5f' }}>{dateStr}</strong></span>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>📅 تاريخ التقرير: <strong style={{ color: '#1e3a5f' }}>{todayStr}</strong></span>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>🔖 رمز الجلسة: <strong style={{ color: '#1e3a5f', fontFamily: 'monospace', fontSize: '0.7rem' }}>{session.id.slice(0, 8)}</strong></span>
        </div>
      </div>

      {/* ── رسالة للأسرة ── */}
      <div style={{ background: '#fefce8', border: '2px solid #fbbf24', borderRadius: '14px', padding: '18px 22px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>💛</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#92400e' }}>رسالة إلى الأسرة</div>
            <div style={{ fontSize: '0.76rem', color: '#a16207' }}>ملخص مبسّط لنتائج تقييم {studentName} — بعيداً عن المصطلحات التقنية</div>
          </div>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#78350f', lineHeight: 1.9 }}>
          {avgPct >= 70 ? (
            <>أظهر <strong>{studentName}</strong> مستوى <strong style={{ color: '#166534' }}>ممتازاً</strong> في تقييم مهارات التعلم، وحقّق نسبة <strong>{avgPct}%</strong> في المتوسط الكلي. هذه النتائج تعكس قدرة واضحة على اكتساب مهارات التفكير، وهي أساس قوي نبني عليه في الجلسات القادمة. 🌟</>
          ) : avgPct >= 50 ? (
            <>أظهر <strong>{studentName}</strong> مستوى <strong style={{ color: '#b45309' }}>جيداً</strong> في تقييم مهارات التعلم، وحقّق نسبة <strong>{avgPct}%</strong> في المتوسط الكلي. النتائج تُشير إلى نقاط قوة واضحة نبني عليها، مع بعض المجالات التي ستتطور أكثر بدعم الفريق المتخصص. 💪</>
          ) : (
            <>أظهر <strong>{studentName}</strong> نقاط قوة في بعض مجالات التعلم، وتهدف خطتنا القادمة إلى تعزيز مهاراته خطوة بخطوة. كل طفل يتعلم بإيقاعه الخاص، والفريق سيواكب تقدمه عن قرب. 🤝</>
          )}
        </div>
        {strongest && (
          <div style={{ marginTop: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 14px', fontSize: '0.83rem', color: '#166534', fontWeight: 600 }}>
            ✨ <strong>نقطة قوة بارزة:</strong> تميّز {studentName} في <strong>{MODULE_META[strongest.module].ar}</strong> بنسبة <strong>{strongest.pct}%</strong>
          </div>
        )}
      </div>

      {/* ── القسم الأول: بيانات المُقيَّم ── */}
      <div style={S}>
        <span>👤</span> القسم الأول: بيانات المُقيَّم
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <tbody>
          {[
            ['الاسم الكامل', studentName],
            ['المدرسة / المركز', student?.school || '—'],
            ['الصف / المرحلة', student?.grade || '—'],
            ['تاريخ الميلاد', student?.dob ? formatDate(new Date(student.dob).getTime(), 'ar-SA') : '—'],
            ['لغة التقييم', session.lang === 'ar' ? 'عربي' : session.lang === 'en' ? 'إنجليزي' : 'عربي / إنجليزي'],
            ['الأداة المستخدمة', 'PEAK — RFT Assessment (النموذج المكيّف)'],
            ...(session.duration ? [['مدة الجلسة', fmtDuration(session.duration)]] : []),
          ].map(([label, val]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '40%', background: '#f8fafc' }}>{label}</td>
              <td style={{ padding: '8px 12px', color: '#1a202c' }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── القسم الثاني: نظرة عامة على الأداء ── */}
      <div style={S}>
        <span>📊</span> القسم الثاني: نظرة عامة على الأداء
      </div>

      {/* Overall score */}
      <div style={{ background: '#f0f7ff', border: '2px solid #3b82f6', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ textAlign: 'center', minWidth: '80px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: pctColor(avgPct) }}>{avgPct}%</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>المتوسط الكلي</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e3a5f', marginBottom: '4px' }}>{levelLabel(avgPct)}</div>
          <div style={{ fontSize: '0.83rem', color: '#475569' }}>
            {avgPct >= 60
              ? `يُظهر الطالب مستوى ${levelLabel(avgPct).split('—')[0].trim()} في مهارات الإطار العلائقي، مع نقاط قوة واضحة في وحدة ${strongest?.module ?? '—'} بنسبة ${strongest?.pct ?? 0}%.`
              : `يحتاج الطالب إلى دعم مكثف في مهارات الإطار العلائقي، ولا سيما في وحدة ${weakest?.module ?? '—'} التي سجّل فيها ${weakest?.pct ?? 0}%.`
            }
          </div>
        </div>
      </div>

      {/* Module overview table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '8px' }}>
        <thead>
          <tr style={{ background: '#1e3a5f', color: '#fff' }}>
            {['الوحدة', 'الاسم', 'نجح', 'أخفق', 'لم يُقيَّم', 'النسبة', 'المستوى'].map(h => (
              <th key={h} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', fontSize: '0.78rem' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULE_ORDER.map((mod, i) => {
            const s = session.summary?.find(x => x.module === mod);
            const pct = s?.pct ?? 0;
            return (
              <tr key={mod} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 10px', fontWeight: 800, color: MODULE_COLORS[mod], textAlign: 'center', fontFamily: 'monospace', fontSize: '0.9rem' }}>{mod}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>{MODULE_META[mod].ar}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#22c55e', fontWeight: 700 }}>{s?.passed ?? 0}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{s?.failed ?? 0}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8' }}>{s?.skipped ?? 0}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: pctColor(pct), fontSize: '1rem' }}>{pct}%</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{ background: `${pctColor(pct)}18`, color: pctColor(pct), borderRadius: '6px', padding: '2px 8px', fontWeight: 700, fontSize: '0.72rem' }}>
                    {pctLabel(pct)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── القسم الثالث: التحليل التفصيلي ── */}
      <div style={S}>
        <span>🔍</span> القسم الثالث: التحليل التفصيلي للوحدات الأربعة
      </div>

      {MODULE_ORDER.map(mod => {
        const s = session.summary?.find(x => x.module === mod);
        const pct = s?.pct ?? 0;
        const color = MODULE_COLORS[mod];
        const factors = getModuleFactors(mod);
        const modScores = session.scores[mod] ?? {};
        const items = PEAK_MODULES[mod].items;

        return (
          <div key={mod} style={{ marginBottom: '20px', border: `1px solid ${color}40`, borderRadius: '10px', overflow: 'hidden' }}>
            {/* Module header */}
            <div style={{ background: `${color}12`, borderBottom: `2px solid ${color}30`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 900, fontSize: '1rem', color, fontFamily: 'monospace' }}>{mod}</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e3a5f', flex: 1 }}>{MODULE_META[mod].ar}</span>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: pctColor(pct) }}>{pct}%</span>
              <span style={{ background: `${pctColor(pct)}18`, color: pctColor(pct), borderRadius: '6px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{pctLabel(pct)}</span>
            </div>
            {/* Factor breakdown */}
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '10px' }}>{interpretModule(mod, pct)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                {factors.map(f => {
                  const fItems = items.filter(it => it.factor === f.key);
                  const passed = fItems.filter(it => modScores[it.id] === 1).length;
                  const answered = fItems.filter(it => modScores[it.id] !== undefined && modScores[it.id] !== null).length;
                  const fPct = answered > 0 ? Math.round((passed / answered) * 100) : 0;
                  return (
                    <div key={f.key} style={{ background: '#f8fafc', borderRadius: '6px', padding: '6px 10px', border: `1px solid ${pctColor(fPct)}30` }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color, fontFamily: 'monospace' }}>{f.key}</div>
                      <div style={{ height: '4px', borderRadius: '2px', background: '#e2e8f0', margin: '4px 0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${fPct}%`, background: pctColor(fPct), borderRadius: '2px' }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: pctColor(fPct) }}>{fPct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── القسم الرابع: التفسير والاستنتاجات ── */}
      <div style={S}>
        <span>🧠</span> القسم الرابع: التفسير والاستنتاجات السريرية
      </div>

      <div style={{ fontSize: '0.88rem', color: '#1a202c', lineHeight: 1.9 }}>
        <p style={{ margin: '0 0 12px' }}>
          بناءً على نتائج تقييم PEAK — نظرية الإطار العلائقي (RFT) المُجرى بتاريخ {dateStr}، يتضح ما يلي:
        </p>
        {session.summary?.map(s => (
          <p key={s.module} style={{ margin: '0 0 8px', paddingRight: '12px', borderRight: `3px solid ${pctColor(s.pct)}` }}>
            <strong style={{ color: MODULE_COLORS[s.module] }}>وحدة {s.module} ({MODULE_META[s.module].ar}):</strong>{' '}
            {interpretModule(s.module, s.pct)}
          </p>
        ))}
        <p style={{ margin: '12px 0 0', background: '#f0f7ff', borderRadius: '8px', padding: '10px 14px', borderRight: '4px solid #3b82f6', fontWeight: 600 }}>
          <strong>الاستنتاج العام:</strong>{' '}
          {avgPct >= 70
            ? `يُعدّ أداء ${studentName} في التقييم الحالي ${pctLabel(avgPct)}، مما يُشير إلى امتلاكه قواعد علائقية متطورة نسبياً. يُنصح بالتوسع في البرامج الحالية وتعزيز الاحتفاظ والتعميم.`
            : avgPct >= 50
            ? `يُظهر ${studentName} مستوى ${pctLabel(avgPct)} يتطلب تدخلاً موجّهاً لتعزيز الوحدات الأضعف، مع الإبقاء على برامج التعزيز في الوحدات الأقوى.`
            : `يحتاج ${studentName} إلى تدخل مكثف ومنظم عبر الوحدات الأربعة، مع الأولوية لوحدة ${weakest?.module ?? '—'} (${weakest?.pct ?? 0}%). يُوصى بجلسات فردية مكثفة واستخدام التعزيز المستمر.`
          }
        </p>
      </div>

      {/* ── القسم الخامس: التوصيات وأهداف التدخل ── */}
      <div style={S}>
        <span>🎯</span> القسم الخامس: التوصيات وأهداف التدخل
      </div>

      {/* Priority recommendations */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e3a5f', marginBottom: '10px' }}>أ) التوصيات ذات الأولوية</div>
        {session.summary
          ?.filter(s => s.pct < 70)
          .sort((a, b) => a.pct - b.pct)
          .map(s => {
            const recs: Record<PeakModule, string> = {
              DT: 'تطبيق تقنيات DTT مع جدول تعزيز متغير النسبة · استخدام الإرشاد التدريجي (prompt fading) · دمج NET في البيئات الطبيعية',
              G:  'تنويع المثيرات والسياقات عبر مواد وأشخاص مختلفين · تطبيق نموذج MET (Multiple Exemplar Training) · تقييم التعميم دورياً',
              CE: 'تدريب تمييز الأطر السياقية (if/when/while) · استخدام تمارين الانتخاب والمطابقة · التدرّج من الأزواج البسيطة إلى الشبكات',
              TE: 'بناء شبكات علائقية هرمية · تدريب التحويل عبر أطر متعددة · البدء بالأطر الأبسط (التناظر) قبل الانتقال للأكثر تعقيداً',
            };
            return (
              <div key={s.module} style={{ marginBottom: '10px', padding: '10px 14px', background: `${MODULE_COLORS[s.module]}08`, border: `1px solid ${MODULE_COLORS[s.module]}30`, borderRadius: '8px' }}>
                <div style={{ fontWeight: 800, color: MODULE_COLORS[s.module], marginBottom: '4px', fontSize: '0.88rem' }}>
                  {MODULE_ICONS[s.module]} وحدة {s.module} — {MODULE_META[s.module].ar} ({s.pct}%)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.7 }}>
                  {recs[s.module]}
                </div>
              </div>
            );
          })
        }
        {(session.summary?.every(s => s.pct >= 70)) && (
          <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #22c55e40', borderRadius: '8px', fontSize: '0.85rem', color: '#166534' }}>
            ✅ يُظهر الطالب أداءً جيداً عبر الوحدات — يُنصح بالتوسع في البرامج الأكثر تعقيداً وتعزيز التعميم.
          </div>
        )}
      </div>

      {/* SMART Goals */}
      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e3a5f', marginBottom: '10px' }}>ب) أهداف التدخل المقترحة (صياغة SMART)</div>
      <div style={{ background: '#fffbeb', border: '1px solid #f59e0b40', borderRadius: '8px', padding: '10px 14px', marginBottom: '10px', fontSize: '0.78rem', color: '#92400e' }}>
        ⚠️ معيار الإتقان المعتمد: 90% أو أعلى (9 من 10 محاولات صحيحة) في 3 جلسات تدريبية متتالية
      </div>
      {session.summary
        ?.filter(s => s.pct < 90)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 3)
        .map((s, idx) => (
          <div key={s.module} style={{ marginBottom: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', padding: '6px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 900, color: '#1e3a5f', fontSize: '0.82rem' }}>الهدف {idx + 1}</span>
              <span style={{ background: `${MODULE_COLORS[s.module]}18`, color: MODULE_COLORS[s.module], borderRadius: '5px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{s.module}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b', flex: 1 }}>{MODULE_META[s.module].ar}</span>
            </div>
            <div style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#1a202c', lineHeight: 1.8 }}>
              {goalSuggestions[s.module]}
            </div>
          </div>
        ))
      }

      {/* Signature block */}
      <div style={{ marginTop: '40px', borderTop: '2px solid #e2e8f0', paddingTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {[
          { label: 'اسم المقيِّم', blank: true },
          { label: 'توقيع المقيِّم', blank: true },
          { label: 'مراجعة المشرف', blank: true },
          { label: 'تاريخ التقرير', value: todayStr },
        ].map(({ label, blank, value }) => (
          <div key={label}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px' }}>{label}</div>
            <div style={{ borderBottom: '1px solid #94a3b8', minHeight: '28px', paddingBottom: '4px', color: '#1a202c', fontSize: '0.85rem' }}>
              {blank ? '' : value}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
        تم إنشاء هذا التقرير بواسطة منصة مسار — PEAK RFT Assessment Platform · {todayStr}
      </div>
    </div>
  );
}

// ── Delta Compare ─────────────────────────────────────────────
function DeltaCompare({ current, previous }: {
  current: SessionSummary[];
  previous: SessionSummary[];
}) {
  if (!previous.length || !current.length) return null;

  const rows = MODULE_ORDER.map(mod => {
    const cur  = current.find(s => s.module === mod);
    const prev = previous.find(s => s.module === mod);
    const curPct  = cur?.pct  ?? 0;
    const prevPct = prev?.pct ?? 0;
    const delta   = curPct - prevPct;
    return { mod, curPct, prevPct, delta };
  });

  const anyDelta = rows.some(r => r.delta !== 0);

  return (
    <div style={{
      background: 'var(--surface,#1e293b)', borderRadius: '14px',
      padding: '18px', marginBottom: '16px',
      border: '1px solid var(--border,#334155)',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
        <span style={{ fontSize:'1.2rem' }}>📈</span>
        <div>
          <div style={{ fontWeight:800, fontSize:'0.95rem' }}>مقارنة مع الجلسة السابقة</div>
          <div style={{ fontSize:'0.74rem', color:'var(--text-muted,#94a3b8)', marginTop:'1px' }}>
            {anyDelta ? 'التغيّر لكل وحدة مقارنةً بالجلسة التي سبقتها' : 'لا تغيير مُلاحظ بين الجلستين'}
          </div>
        </div>
      </div>

      {/* Grid of module deltas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:'10px' }}>
        {rows.map(({ mod, curPct, prevPct, delta }) => {
          const isUp   = delta > 0;
          const isDown = delta < 0;
          const arrow      = isUp ? '↑' : isDown ? '↓' : '→';
          const arrowColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#94a3b8';
          const bgColor    = isUp ? '#22c55e0a' : isDown ? '#ef44440a' : 'var(--bg,#0a0f1a)';
          const borderCol  = isUp ? '#22c55e30' : isDown ? '#ef444430' : 'var(--border,#334155)';
          const label      = isUp ? 'تحسّن' : isDown ? 'تراجع' : 'ثابت';
          const absDelta   = Math.abs(delta);

          return (
            <div key={mod} style={{
              background: bgColor,
              border: `1px solid ${borderCol}`,
              borderRadius: '10px', padding: '12px 14px',
            }}>
              {/* Module header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                <span style={{ fontWeight:800, fontSize:'0.8rem', color:MODULE_COLORS[mod] }}>
                  {MODULE_ICONS[mod]} {mod}
                </span>
                <span style={{ fontSize:'1.4rem', color:arrowColor, fontWeight:900, lineHeight:1 }}>
                  {arrow}
                </span>
              </div>

              {/* Current score */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:'5px' }}>
                <span style={{ fontSize:'1.5rem', fontWeight:900, color:pctColor(curPct) }}>
                  {curPct}%
                </span>
                {delta !== 0 && (
                  <span style={{ fontSize:'0.78rem', color:arrowColor, fontWeight:700, marginBottom:'3px' }}>
                    ({isUp ? '+' : ''}{delta})
                  </span>
                )}
              </div>

              {/* Previous + label */}
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted,#94a3b8)', marginTop:'3px' }}>
                سابق: {prevPct}%
                {absDelta > 0 && (
                  <span style={{ marginRight:'5px', color:arrowColor, fontWeight:700 }}>
                    {' · '}{label}
                  </span>
                )}
              </div>

              {/* Delta bar */}
              {delta !== 0 && (
                <div style={{
                  marginTop:'8px', height:'4px',
                  background:'var(--border,#334155)', borderRadius:'2px', overflow:'hidden',
                }}>
                  <div style={{
                    height:'100%',
                    width:`${Math.min(absDelta * 2, 100)}%`,
                    background: arrowColor, borderRadius:'2px',
                    transition:'width 0.6s ease',
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Session Detail ────────────────────────────────────────────
function SessionDetail({ session, studentName, onBack, students, previousSession }: {
  session: AssessSession; studentName: string; onBack: () => void;
  students: import('@/types').Student[];
  previousSession?: AssessSession;
}) {
  const { lang } = useTranslation();
  const [activeTab,      setActiveTab]      = useState<'summary' | 'formal'>('summary');
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pdfError,       setPdfError]       = useState<string | null>(null);
  const avgPct = session.summary?.length
    ? Math.round(session.summary.reduce((a,b) => a+b.pct,0)/session.summary.length) : 0;
  const dateStr = formatDate(session.savedAt, lang === 'en' ? 'en-US' : 'ar-SA');

  async function handleExportPDF() {
    if (isPdfExporting) return;
    setPdfError(null);

    // Ensure the formal report tab is visible so html2canvas can capture it
    if (activeTab !== 'formal') {
      setActiveTab('formal');
      // Wait for React to render the formal report DOM
      await new Promise(r => setTimeout(r, 450));
    }

    setIsPdfExporting(true);
    try {
      const filename = `تقرير_${studentName}_${new Date(session.savedAt).toISOString().slice(0, 10)}`;
      const result = await exportToPdf({ elementId: 'formal-report', filename });
      if (!result.ok) {
        setPdfError(result.error ?? 'حدث خطأ أثناء إنشاء الـ PDF');
      }
    } finally {
      setIsPdfExporting(false);
    }
  }

  function handleExportCSV() {
    // Export ALL sessions for this student as a comprehensive multi-row CSV
    const bom = '\ufeff';
    const MODULE_ORDER_CSV: PeakModule[] = ['DT', 'G', 'CE', 'TE'];
    const header = [
      'التاريخ',
      'رقم الجلسة',
      'المتوسط الكلي%',
      'DT%', 'DT نجح', 'DT مجموع',
      'G%',  'G نجح',  'G مجموع',
      'CE%', 'CE نجح', 'CE مجموع',
      'TE%', 'TE نجح', 'TE مجموع',
      'المدة (ثانية)',
      'ملاحظات',
    ].join(',') + '\n';

    // Build rows for all sessions of this student, newest first
    const studentSessions = (typeof allSessions !== 'undefined' ? allSessions : [session])
      .filter((s: AssessSession) => s.studentId === session.studentId && !s.deletedAt)
      .sort((a: AssessSession, b: AssessSession) => b.savedAt - a.savedAt);

    const rows = studentSessions.map((sess: AssessSession, idx: number) => {
      const dateStr2 = new Date(sess.savedAt).toLocaleDateString('ar-SA', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      const avgPct2 = sess.summary.length
        ? Math.round(sess.summary.reduce((s, x) => s + x.pct, 0) / sess.summary.length)
        : 0;
      const modCols = MODULE_ORDER_CSV.flatMap(mod => {
        const s = sess.summary.find(x => x.module === mod);
        return s ? [s.pct, s.passed, s.total] : ['', '', ''];
      });
      const notesEsc = (sess.notes ?? '').replace(/,/g, '،').replace(/\n/g, ' ');
      return [
        dateStr2,
        studentSessions.length - idx,
        avgPct2,
        ...modCols,
        sess.duration ?? '',
        notesEsc,
      ].join(',');
    }).join('\n');

    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `جلسات_${studentName}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function handleExportJSON() {
    const blob = new Blob([JSON.stringify(session,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `تقرير_${studentName}_${new Date(session.savedAt).toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Copy plain-text summary to clipboard ─────────────────────
  const [copied, setCopied] = useState(false);
  function handleCopySummary() {
    const lines: string[] = [
      `📊 تقرير PEAK — ${studentName} — ${dateStr}`,
      '─'.repeat(36),
    ];
    (session.summary ?? []).forEach(s => {
      const pct  = String(s.pct).padStart(3);
      const bar  = '█'.repeat(Math.round(s.pct / 10)).padEnd(10, '░');
      lines.push(`${s.module.padEnd(3)}  ${pct}%  ${bar}  (${s.passed}/${s.total} نجح)`);
    });
    lines.push('─'.repeat(36));
    lines.push(`المتوسط الكلي: ${avgPct}%`);
    if (session.duration) lines.push(`مدة الجلسة: ${fmtDuration(session.duration)}`);
    if (session.notes) lines.push(`ملاحظات: ${session.notes}`);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {/* silent */});
  }

  // ── Print — inject @media print overrides, call window.print ─
  function handlePrint() {
    const STYLE_ID = '__reports-print-style';
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media print {
        body > *  { visibility: hidden !important; }
        #main-content, #main-content * { visibility: visible !important; }
        #main-content { position: fixed; inset: 0; z-index: 9999; background: #fff; color: #111; direction: rtl; padding: 24px; font-family: Cairo, sans-serif; }
        button, [role="button"] { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Remove after print dialog closes
    setTimeout(() => style.remove(), 1500);
  }

  return (
    <main id="main-content" role="main" aria-label="تفاصيل التقرير"
      style={{ padding:'24px', fontFamily:'Cairo,sans-serif', direction:'rtl', color:'var(--text,#f1f5f9)', maxWidth:'900px', margin:'0 auto' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px', flexWrap:'wrap' }}>
        <Button variant="ghost" size="sm" onClick={onBack}>‹ رجوع</Button>
        <div style={{ flex:1 }}>
          <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:800 }}>📊 تقرير التقييم</h2>
          <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-muted,#94a3b8)' }}>
            {studentName} — {dateStr}
            {session.duration ? <span style={{ marginRight: '6px', color: 'var(--text-muted,#64748b)' }}> · ⏱ {fmtDuration(session.duration)}</span> : null}
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} icon="📊">CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleExportJSON} icon="💾">JSON</Button>
          <Button variant="secondary" size="sm" onClick={handleCopySummary} icon={copied ? '✓' : '📋'}
            style={copied ? { color:'#22c55e', borderColor:'#22c55e40' } : undefined}>
            {copied ? 'تم النسخ' : 'نسخ ملخص'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint} icon="🖨️">طباعة</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPDF}
            disabled={isPdfExporting}
            icon={isPdfExporting ? undefined : '📄'}
          >
            {isPdfExporting
              ? <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{
                    display:'inline-block', width:'13px', height:'13px',
                    border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff',
                    borderRadius:'50%', animation:'spin 0.7s linear infinite',
                  }} />
                  جارٍ إنشاء PDF...
                </span>
              : 'PDF'
            }
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:'var(--surface,#1e293b)', borderRadius:'10px', padding:'4px' }}>
        {(['summary','formal'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex:1, padding:'9px 16px', borderRadius:'7px', border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontSize:'0.9rem', fontWeight:700, transition:'all 0.15s',
              background: activeTab === tab ? 'var(--blue,#3b82f6)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-muted,#94a3b8)',
            }}>
            {tab === 'summary' ? '📊 ملخص' : '📄 تقرير رسمي'}
          </button>
        ))}
      </div>

      {/* PDF error banner */}
      {pdfError && (
        <div style={{
          marginBottom:'12px', padding:'10px 14px', borderRadius:'10px',
          background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
          color:'#ef4444', fontSize:'0.83rem', display:'flex', alignItems:'center', gap:'8px',
        }}>
          <span>⚠</span>
          <span>فشل إنشاء PDF: {pdfError}</span>
          <span
            role="button" tabIndex={0} onClick={() => setPdfError(null)}
            style={{ marginRight:'auto', cursor:'pointer', opacity:0.6, fontSize:'1rem' }}>✕</span>
        </div>
      )}

      {activeTab === 'summary' ? (
        <>
          {/* Delta comparison — shown only when previous session exists */}
          {previousSession?.summary && previousSession.summary.length > 0 && session.summary && (
            <DeltaCompare current={session.summary} previous={previousSession.summary} />
          )}

          {/* Overview */}
          <div style={{ background:'var(--surface,#1e293b)', borderRadius:'16px', padding:'24px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'24px', flexWrap:'wrap' }}>
            {session.summary && session.summary.length > 0 && (
              <div style={{ flexShrink:0 }}>
                <RadarChart summary={session.summary} size={200} />
              </div>
            )}
            <div style={{ flex:1, minWidth:'220px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px', marginBottom:'16px' }}>
                {MODULE_ORDER.map(mod => {
                  const s = session.summary?.find(x => x.module === mod);
                  const pct = s?.pct ?? 0;
                  const color = MODULE_COLORS[mod];
                  return (
                    <div key={mod} style={{ background:`${color}10`, border:`1px solid ${color}30`, borderRadius:'10px', padding:'10px 14px' }}>
                      <div style={{ fontSize:'0.72rem', color, fontWeight:700, marginBottom:'3px' }}>{MODULE_ICONS[mod]} {mod}</div>
                      <div style={{ fontSize:'1.4rem', fontWeight:900, color }}>{pct}%</div>
                      <div style={{ fontSize:'0.65rem', color:'var(--text-muted,#94a3b8)', marginTop:'1px' }}>{pctLabel(pct)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background:`${pctColor(avgPct)}15`, border:`1px solid ${pctColor(avgPct)}40`, borderRadius:'10px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                <ScoreRing pct={avgPct} color={pctColor(avgPct)} size={52} />
                <div>
                  <div style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text-muted,#94a3b8)' }}>المتوسط الكلي</div>
                  <div style={{ fontSize:'1.1rem', fontWeight:900, color:pctColor(avgPct) }}>{pctLabel(avgPct)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Module panels */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'14px' }}>
            {MODULE_ORDER.map(mod => (
              <ModulePanel key={mod} mod={mod} summary={session.summary?.find(s => s.module === mod)} session={session} />
            ))}
          </div>

          <RecommendationBlock summary={session.summary ?? []} />

          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @media print {
              nav, header, .sidebar-mobile-overlay { display: none !important; }
              body { background: #fff !important; color: #000 !important; direction: rtl; }
              main { padding: 0 !important; }
              button { display: none !important; }
              * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
            }
          `}</style>
        </>
      ) : (
        <>
          <FormalReport session={session} studentName={studentName} students={students} />
          <style>{`
            @media print {
              nav, header, .sidebar-mobile-overlay { display: none !important; }
              body { background: #fff !important; direction: rtl; }
              main { padding: 0 !important; margin: 0 !important; }
              button { display: none !important; }
              #formal-report { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
              * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
            }
          `}</style>
        </>
      )}
    </main>
  );
}

// ── Compare Panel ─────────────────────────────────────────────
function ComparePanel({
  sessionA, sessionB, nameA, nameB, onClose,
}: {
  sessionA: AssessSession; sessionB: AssessSession;
  nameA: string; nameB: string;
  onClose: () => void;
}) {
  const dateA = formatDate(sessionA.savedAt, 'ar-SA');
  const dateB = formatDate(sessionB.savedAt, 'ar-SA');
  const avgA = sessionA.summary?.length
    ? Math.round(sessionA.summary.reduce((a,b) => a+b.pct,0)/sessionA.summary.length) : 0;
  const avgB = sessionB.summary?.length
    ? Math.round(sessionB.summary.reduce((a,b) => a+b.pct,0)/sessionB.summary.length) : 0;

  return (
    <div style={{
      background:'var(--surface,#1e293b)', borderRadius:'16px',
      padding:'18px', marginBottom:'20px',
      border:'1.5px solid #3b82f640', boxShadow:'0 4px 24px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <span style={{ fontSize:'0.95rem', fontWeight:800, color:'var(--text,#f1f5f9)' }}>
          ⚖️ مقارنة جلستين
        </span>
        <button onClick={onClose} style={{
          background:'transparent', border:'1px solid var(--border,#334155)',
          color:'var(--text-muted,#94a3b8)', borderRadius:'8px',
          padding:'4px 12px', cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.78rem',
        }}>إغلاق</button>
      </div>

      {/* Session headers */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'12px', alignItems:'center', marginBottom:'14px' }}>
        <div style={{ background:'#3b82f615', border:'1px solid #3b82f630', borderRadius:'10px', padding:'10px 14px', textAlign:'center' }}>
          <div style={{ fontWeight:700, fontSize:'0.82rem', color:'#3b82f6', marginBottom:'2px' }}>{nameA}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-muted,#94a3b8)' }}>{dateA}</div>
          <div style={{ fontSize:'1.6rem', fontWeight:900, color:pctColor(avgA), marginTop:'4px' }}>{avgA}%</div>
          <div style={{ fontSize:'0.7rem', color:pctColor(avgA), fontWeight:700 }}>{pctLabel(avgA)}</div>
        </div>
        <div style={{ textAlign:'center', color:'var(--text-muted,#64748b)', fontSize:'1.2rem' }}>VS</div>
        <div style={{ background:'#a855f715', border:'1px solid #a855f730', borderRadius:'10px', padding:'10px 14px', textAlign:'center' }}>
          <div style={{ fontWeight:700, fontSize:'0.82rem', color:'#a855f7', marginBottom:'2px' }}>{nameB}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-muted,#94a3b8)' }}>{dateB}</div>
          <div style={{ fontSize:'1.6rem', fontWeight:900, color:pctColor(avgB), marginTop:'4px' }}>{avgB}%</div>
          <div style={{ fontSize:'0.7rem', color:pctColor(avgB), fontWeight:700 }}>{pctLabel(avgB)}</div>
        </div>
      </div>

      {/* Per-module comparison bars */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {MODULE_ORDER.map(mod => {
          const sa = sessionA.summary?.find(x => x.module === mod);
          const sb = sessionB.summary?.find(x => x.module === mod);
          const pA = sa?.pct ?? 0, pB = sb?.pct ?? 0;
          const diff = pB - pA;
          const color = MODULE_COLORS[mod];
          return (
            <div key={mod}>
              {/* Module label */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px', fontSize:'0.72rem' }}>
                <span style={{ color, fontWeight:700 }}>{MODULE_ICONS[mod]} {mod}</span>
                <span style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : '#94a3b8', fontWeight:700, fontSize:'0.7rem' }}>
                  {diff > 0 ? `+${diff}` : diff !== 0 ? diff : '='} نقطة
                </span>
              </div>
              {/* Dual bar */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 8px 1fr', alignItems:'center', gap:'4px' }}>
                {/* Bar A — right-aligned */}
                <div style={{ display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, color:pctColor(pA) }}>{pA}%</span>
                  <div style={{ width:`${pA}%`, maxWidth:'100%', height:'10px', background:`#3b82f6`, borderRadius:'4px 0 0 4px', transition:'width 0.5s ease', minWidth: pA > 0 ? '3px' : 0 }} />
                </div>
                <div style={{ width:'8px', height:'20px', background:'var(--border,#334155)', borderRadius:'2px' }} />
                {/* Bar B — left-aligned */}
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:`${pB}%`, maxWidth:'100%', height:'10px', background:`#a855f7`, borderRadius:'0 4px 4px 0', transition:'width 0.5s ease', minWidth: pB > 0 ? '3px' : 0 }} />
                  <span style={{ fontSize:'0.7rem', fontWeight:700, color:pctColor(pB) }}>{pB}%</span>
                </div>
              </div>
              {/* Passed/total detail */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 8px 1fr', alignItems:'center', gap:'4px', marginTop:'2px', fontSize:'0.65rem', color:'var(--text-muted,#64748b)' }}>
                <div style={{ textAlign:'left' }}>{sa ? `${sa.passed}/${sa.total}` : '—'}</div>
                <div />
                <div>{sb ? `${sb.passed}/${sb.total}` : '—'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner summary */}
      {(avgA !== avgB) && (
        <div style={{ marginTop:'14px', padding:'10px 14px', borderRadius:'10px',
          background: avgB > avgA ? '#a855f715' : '#3b82f615',
          border: `1px solid ${avgB > avgA ? '#a855f730' : '#3b82f630'}`,
          fontSize:'0.82rem', fontWeight:700,
          color: avgB > avgA ? '#a855f7' : '#3b82f6',
          textAlign:'center' }}>
          {avgB > avgA
            ? `✓ جلسة ${nameB} أعلى بفارق ${avgB - avgA} نقطة`
            : `✓ جلسة ${nameA} أعلى بفارق ${avgA - avgB} نقطة`}
        </div>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────
function SessionCard({ session, studentName, onClick, compareMode, isSelected, onToggleCompare }: {
  session: AssessSession; studentName: string; onClick: () => void;
  compareMode?: boolean; isSelected?: boolean; onToggleCompare?: () => void;
}) {
  const { lang } = useTranslation();
  const avgPct = session.summary?.length
    ? Math.round(session.summary.reduce((a,b) => a+b.pct,0)/session.summary.length) : 0;
  const dateStr = formatDate(session.savedAt, lang === 'en' ? 'en-US' : 'ar-SA');
  return (
    <div style={{ display:'flex', alignItems:'stretch', gap:'8px' }}>
      {/* Compare checkbox */}
      {compareMode && (
        <button
          onClick={e => { e.stopPropagation(); onToggleCompare?.(); }}
          aria-label={isSelected ? 'إلغاء تحديد الجلسة' : 'تحديد الجلسة للمقارنة'}
          style={{
            flexShrink: 0, width: '38px', borderRadius: '10px',
            border: isSelected ? '2px solid #3b82f6' : '2px solid var(--border,#334155)',
            background: isSelected ? '#3b82f620' : 'var(--surface,#1e293b)',
            cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: '1.1rem', transition:'all 0.15s',
          }}>
          {isSelected ? '✓' : '○'}
        </button>
      )}
      <div role="button" tabIndex={0}
        onClick={compareMode ? onToggleCompare : onClick}
        onKeyDown={e => (e.key==='Enter'||e.key===' ') && (compareMode ? onToggleCompare?.() : onClick())}
        style={{
          flex: 1,
          background: isSelected ? '#3b82f610' : 'var(--surface,#1e293b)',
          borderRadius:'14px', padding:'16px 20px',
          cursor:'pointer', transition:'transform 0.15s, box-shadow 0.15s',
          display:'flex', alignItems:'center', gap:'16px',
          borderRight:`3px solid ${isSelected ? '#3b82f6' : pctColor(avgPct)}`,
          outline: isSelected ? '1.5px solid #3b82f640' : 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateX(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 20px rgba(0,0,0,0.25)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=''; (e.currentTarget as HTMLDivElement).style.boxShadow=''; }}
        aria-label={`جلسة ${dateStr} — ${avgPct}%`}>
        <ScoreRing pct={avgPct} color={pctColor(avgPct)} size={64} />
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:'0.92rem', marginBottom:'6px' }}>{studentName} · {dateStr}</div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {session.summary?.map((s: SessionSummary) => (
              <span key={s.module} style={{ background:`${MODULE_COLORS[s.module]}20`, color:MODULE_COLORS[s.module], borderRadius:'6px', padding:'2px 8px', fontSize:'0.7rem', fontWeight:700 }}>
                {s.module}: {s.pct}%
              </span>
            ))}
          </div>
          <div style={{ fontSize:'0.72rem', color:pctColor(avgPct), fontWeight:700, marginTop:'5px' }}>{pctLabel(avgPct)}</div>
        </div>
        {!compareMode && <span style={{ color:'var(--text-muted,#94a3b8)', fontSize:'1.4rem' }}>›</span>}
      </div>
    </div>
  );
}

// ── Main Reports ──────────────────────────────────────────────
export function Reports() {
  const { setScreen, selectSession, selectedSessionId, students, selectedStudentId, selectStudent } = useAppStore();
  const selectedStudent = useAppStore(selectSelectedStudent);
  const { t } = useTranslation();

  const [allSessions, setAllSessions] = useState<AssessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailSession, setDetailSession] = useState<AssessSession | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds]   = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await SessionDB.getAll();
        setAllSessions(data.sort((a,b) => b.savedAt - a.savedAt));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedSessionId && allSessions.length) {
      const found = allSessions.find(s => s.id === selectedSessionId);
      if (found) setDetailSession(found);
    }
  }, [selectedSessionId, allSessions]);

  const sessions = useMemo(() =>
    selectedStudentId ? allSessions.filter(s => s.studentId === selectedStudentId) : allSessions,
    [allSessions, selectedStudentId]
  );

  function getStudentName(id: string) { return students.find(s => s.id === id)?.name ?? 'غير معروف'; }

  if (detailSession) {
    // Find the chronologically previous session for the same student
    const studentSessions = allSessions
      .filter(s => s.studentId === detailSession.studentId && s.id !== detailSession.id)
      .sort((a, b) => b.savedAt - a.savedAt); // newest first
    const previousSession = studentSessions.find(s => s.savedAt < detailSession.savedAt);

    return (
      <SessionDetail
        session={detailSession}
        studentName={getStudentName(detailSession.studentId)}
        onBack={() => { selectSession(null); setDetailSession(null); }}
        students={students}
        previousSession={previousSession}
      />
    );
  }

  return (
    <main id="main-content" role="main" aria-label={t('reports')}
      className="screen-enter"
      style={{ padding:'24px', fontFamily:'Cairo,sans-serif', direction:'rtl', color:'var(--text,#f1f5f9)', maxWidth:'900px', margin:'0 auto' }}>
      <div style={{ marginBottom:'20px' }}>
        <h2 style={{ margin:'0 0 4px', fontSize:'1.3rem', fontWeight:800 }}>📊 {t('reports')}</h2>
        <p style={{ margin:0, color:'var(--text-muted,#94a3b8)', fontSize:'0.85rem' }}>
          {selectedStudent ? `${selectedStudent.name} — ` : ''}{sessions.length} جلسة
        </p>
      </div>

      {/* Student quick-selector chips */}
      {students.length > 0 && (
        <div style={{ marginBottom:'10px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
          <button
            onClick={() => selectStudent(null)}
            style={{
              padding:'5px 12px', borderRadius:'20px', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontSize:'0.78rem', fontWeight:700,
              background: !selectedStudentId ? '#3b82f6' : 'var(--surface,#1e293b)',
              border: !selectedStudentId ? '1.5px solid #3b82f6' : '1px solid var(--border,#334155)',
              color: !selectedStudentId ? '#fff' : 'var(--text-muted,#94a3b8)',
              transition:'all 0.15s',
            }}>
            الكل
          </button>
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => selectStudent(selectedStudentId === s.id ? null : s.id)}
              style={{
                padding:'5px 12px', borderRadius:'20px', cursor:'pointer',
                fontFamily:'Cairo,sans-serif', fontSize:'0.78rem', fontWeight:700,
                background: selectedStudentId === s.id ? '#3b82f620' : 'var(--surface,#1e293b)',
                border: selectedStudentId === s.id ? '1.5px solid #3b82f6' : '1px solid var(--border,#334155)',
                color: selectedStudentId === s.id ? '#3b82f6' : 'var(--text-muted,#94a3b8)',
                transition:'all 0.15s',
                maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}
              title={s.name}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom:'16px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        <select value={selectedStudentId ?? ''} onChange={e => selectStudent(e.target.value || null)}
          aria-label="تصفية حسب الطالب"
          style={{ padding:'8px 14px', borderRadius:'8px', border:'1px solid var(--border,#334155)', background:'var(--surface,#1e293b)', color:'var(--text,#f1f5f9)', fontFamily:'Cairo,sans-serif', fontSize:'0.88rem', cursor:'pointer' }}>
          <option value="">كل الطلاب</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {sessions.length >= 2 && (
          <button
            onClick={() => { setCompareMode(m => !m); setCompareIds([]); }}
            style={{
              padding:'8px 16px', borderRadius:'8px', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontSize:'0.85rem', fontWeight:700,
              background: compareMode ? '#3b82f620' : 'var(--surface,#1e293b)',
              border: compareMode ? '1.5px solid #3b82f6' : '1px solid var(--border,#334155)',
              color: compareMode ? '#3b82f6' : 'var(--text-muted,#94a3b8)',
              transition:'all 0.15s',
            }}>
            ⚖️ {compareMode ? 'إلغاء المقارنة' : 'مقارنة جلستين'}
          </button>
        )}
        {compareMode && compareIds.length > 0 && compareIds.length < 2 && (
          <span style={{ fontSize:'0.78rem', color:'#f59e0b', fontWeight:700, padding:'6px 12px',
            background:'#f59e0b15', borderRadius:'8px', border:'1px solid #f59e0b30' }}>
            اختر جلسة ثانية ({compareIds.length}/2)
          </span>
        )}
      </div>

      {sessions.length >= 2 && !compareMode && <ModuleTrendChart sessions={sessions} />}

      {/* Compare Panel — shown when two sessions are selected */}
      {compareMode && compareIds.length === 2 && (() => {
        const sA = allSessions.find(s => s.id === compareIds[0]);
        const sB = allSessions.find(s => s.id === compareIds[1]);
        if (!sA || !sB) return null;
        return (
          <ComparePanel
            sessionA={sA} sessionB={sB}
            nameA={`${getStudentName(sA.studentId)} · ${formatDate(sA.savedAt,'ar-SA')}`}
            nameB={`${getStudentName(sB.studentId)} · ${formatDate(sB.savedAt,'ar-SA')}`}
            onClose={() => setCompareIds([])}
          />
        );
      })()}

      {loading ? (
        /* ── Skeleton loading cards ── */
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }} aria-busy="true" aria-label={t('loading')}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              background: 'var(--surface,#1e293b)', borderRadius: '14px',
              padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <div className="skeleton" style={{ width:'48px', height:'48px', borderRadius:'50%', flexShrink:0 }} />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
                <div className="skeleton" style={{ height:'16px', width:`${55 + i * 15}%`, borderRadius:'6px' }} />
                <div className="skeleton" style={{ height:'12px', width:`${35 + i * 10}%`, borderRadius:'6px' }} />
              </div>
              <div className="skeleton" style={{ width:'60px', height:'32px', borderRadius:'8px', flexShrink:0 }} />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'60px 20px',
          background:'var(--surface,#1e293b)', borderRadius:'18px',
          color:'var(--text-muted,#94a3b8)',
        }}>
          <div style={{ fontSize:'4rem', marginBottom:'12px', lineHeight:1 }}>📊</div>
          <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--text,#f1f5f9)', marginBottom:'8px' }}>
            لا توجد جلسات بعد
          </div>
          <p style={{ margin:'0 0 24px', fontSize:'0.88rem', maxWidth:'260px', marginInline:'auto', lineHeight:1.7 }}>
            {t('noReports') ?? 'ابدأ أول تقييم لترى التقارير والتحليلات هنا'}
          </p>
          <Button variant="primary" icon="📋" onClick={() => setScreen('assess')} style={{ marginTop:'4px' }}>
            {t('startAssessment')}
          </Button>
        </div>
      ) : (
        <div role="list" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {sessions.map((session, idx) => {
            // ── Improvement indicator ──
            // Find previous session for same student (earlier savedAt)
            const prevSession = allSessions.find(
              s => s.studentId === session.studentId && s.savedAt < session.savedAt
            );
            let improvementBadge: React.ReactNode = null;
            if (prevSession) {
              const scoreRatio = (s: typeof session) => {
                let ones = 0, total = 0;
                Object.values(s.scores).forEach(modScores => {
                  Object.values(modScores).forEach(v => {
                    if (v !== null) { total++; if (v === 1) ones++; }
                  });
                });
                return total > 0 ? ones / total : null;
              };
              const curRatio  = scoreRatio(session);
              const prevRatio = scoreRatio(prevSession);
              if (curRatio !== null && prevRatio !== null) {
                const delta = Math.round((curRatio - prevRatio) * 100);
                if (delta !== 0) {
                  improvementBadge = (
                    <span style={{
                      display:'inline-block', fontSize:'0.72rem', fontWeight:800,
                      padding:'2px 8px', borderRadius:'12px', marginRight:'6px',
                      background: delta > 0 ? '#22c55e15' : '#ef444415',
                      color: delta > 0 ? '#22c55e' : '#ef4444',
                      border: `1px solid ${delta > 0 ? '#22c55e30' : '#ef444430'}`,
                      verticalAlign:'middle',
                    }}>
                      {delta > 0 ? `↑ +${delta}%` : `↓ ${delta}%`}
                    </span>
                  );
                }
              }
            }
            return (
              <div key={session.id} role="listitem">
                {improvementBadge && (
                  <div style={{ marginBottom:'4px', textAlign:'right', paddingRight:'4px' }}>
                    {improvementBadge}
                    <span style={{ fontSize:'0.68rem', color:'var(--text-muted,#64748b)' }}>
                      مقارنةً بالجلسة السابقة
                    </span>
                  </div>
                )}
                <SessionCard
                  session={session}
                  studentName={getStudentName(session.studentId)}
                  onClick={() => { selectSession(session.id); setDetailSession(session); }}
                  compareMode={compareMode}
                  isSelected={compareIds.includes(session.id)}
                  onToggleCompare={() => {
                    setCompareIds(prev => {
                      if (prev.includes(session.id)) return prev.filter(id => id !== session.id);
                      if (prev.length >= 2) return [prev[1], session.id];
                      return [...prev, session.id];
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
