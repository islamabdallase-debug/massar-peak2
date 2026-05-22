// ============================================================
//  مسار — Assess Screen  v6.0
//  291 real PEAK items · factor nav · keyboard shortcuts
//  Quick-mode, Tab-to-unanswered, help overlay, summary bar
//  Student View: full-screen item display
//  ── v6.0 Therapist Fatigue Reduction ──────────────────────
//  Compact Mode (C): reduced padding & font size
//  Focus Mode  (D): hides tabs/strips/summary for deep work
//  Session Timer: live duration counter
//  Auto-compact suggestion after 30+ items
// ============================================================

import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useAppStore, selectSelectedStudent } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { AssessService } from '@/services/AssessService';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  PEAK_MODULES, MODULE_ORDER, MODULE_COLORS,
  getModuleItems, getModuleFactors, type PeakItemData,
} from '@/data/peakItems';
import type { PeakModule, ScoreValue, ModuleScores } from '@/types';

const MODULE_META: Record<PeakModule, { ar: string; en: string }> = {
  DT: { ar: 'التعلم المباشر',       en: 'Direct Training' },
  G:  { ar: 'التعميم العلائقي',    en: 'Generalization' },
  CE: { ar: 'التكافؤ السياقي',      en: 'Contextual Equivalence' },
  TE: { ar: 'تحويل وظائف المثير',  en: 'Transformation of Functions' },
};

// ── Progress bar ─────────────────────────────────────────────
function ProgressBar({ value, color, label }: { value: number; color: string; label?: string }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
      aria-label={label ?? `${value}%`}
      style={{ height:'5px', borderRadius:'3px', background:'var(--border,#334155)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:'3px', transition:'width 0.35s ease' }} />
    </div>
  );
}

// ── Score button ──────────────────────────────────────────────
function ScoreBtn({ label, emoji, active, color, onClick, shortcut, compact }: {
  label: string; emoji: string; active: boolean; color: string;
  onClick: () => void; shortcut?: string; compact?: boolean;
}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      aria-label={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      style={{
        flex:1,
        padding: compact ? '8px 6px' : '16px 8px',
        borderRadius: compact ? '10px' : '14px',
        border:`2px solid ${active ? color : 'var(--border,#334155)'}`,
        background: active ? `${color}22` : 'var(--surface,#1e293b)',
        color: active ? color : 'var(--text-muted,#94a3b8)',
        cursor:'pointer', fontFamily:'Cairo,sans-serif',
        fontSize: compact ? '0.85rem' : '1rem',
        fontWeight:700,
        transition:'all 0.15s',
        minHeight: compact ? '44px' : '56px',
        display:'flex', flexDirection: compact ? 'row' : 'column',
        alignItems:'center', justifyContent:'center', gap: compact ? '6px' : '4px',
        boxShadow: active ? `0 0 0 3px ${color}30` : 'none',
      }}>
      <span style={{ fontSize: compact ? '1rem' : '1.4rem' }}>{emoji}</span>
      <span>{label}</span>
      {!compact && shortcut && (
        <kbd style={{ fontSize:'0.6rem', background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:'3px', color:'var(--text-muted,#94a3b8)', fontFamily:'monospace' }}>{shortcut}</kbd>
      )}
    </button>
  );
}

// ── Session Timer ─────────────────────────────────────────────
function SessionTimer({ startTime, compact }: { startTime: number; compact?: boolean }) {
  const [elapsed, setElapsed] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const isLong = elapsed > 45 * 60; // 45+ min
  return (
    <span style={{
      fontSize: compact ? '0.65rem' : '0.7rem',
      fontFamily: 'monospace',
      color: isLong ? '#f59e0b' : 'var(--text-muted,#64748b)',
      fontWeight: isLong ? 700 : 400,
      title: isLong ? 'جلسة طويلة — خذ استراحة' : undefined,
    }}>
      {isLong ? '⚠️ ' : '⏱ '}{mm}:{ss}
    </span>
  );
}

// ── Factor strip ──────────────────────────────────────────────
function FactorStrip({ module, activeFactor, scores, onSelect }: {
  module: PeakModule; activeFactor: string;
  scores: Record<string, ScoreValue>; onSelect: (f: string) => void;
}) {
  const factors = getModuleFactors(module);
  const color = MODULE_COLORS[module];
  const items = getModuleItems(module);
  return (
    <div style={{ display:'flex', gap:'6px', padding:'8px 16px', overflowX:'auto', borderBottom:'1px solid var(--border,#1e293b)', background:'var(--bg,#0a0f1a)', flexShrink:0 }}
      role="group" aria-label="عوامل الوحدة">
      {factors.map(f => {
        const fItems = items.filter(it => it.factor === f.key);
        const answered = fItems.filter(it => scores[it.id] !== undefined && scores[it.id] !== null).length;
        const pct = fItems.length ? Math.round((answered/fItems.length)*100) : 0;
        const isActive = activeFactor === f.key;
        return (
          <button key={f.key} onClick={() => onSelect(f.key)} aria-pressed={isActive} title={f.nameAr}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:'3px',
              padding:'6px 10px', borderRadius:'10px',
              border:`1px solid ${isActive ? color : 'var(--border,#334155)'}`,
              background: isActive ? `${color}18` : 'transparent',
              color: isActive ? color : 'var(--text-muted,#94a3b8)',
              cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.72rem',
              fontWeight: isActive ? 700 : 400, transition:'all 0.15s', minWidth:'52px', whiteSpace:'nowrap',
            }}>
            <span style={{ fontWeight:800, fontSize:'0.8rem' }}>{f.key}</span>
            <span style={{ fontSize:'0.62rem', opacity:0.8 }}>{pct}%</span>
            <div style={{ width:'100%', height:'3px', borderRadius:'2px', background:'var(--border,#334155)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background: pct===100 ? '#22c55e' : color, borderRadius:'2px', transition:'width 0.3s' }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Module tab bar ────────────────────────────────────────────
function ModuleTabs({ activeModule, scores, onSelect }: {
  activeModule: PeakModule;
  scores: Record<PeakModule, Record<string, ScoreValue>>;
  onSelect: (m: PeakModule) => void;
}) {
  return (
    <div role="tablist" aria-label="وحدات PEAK"
      style={{ display:'flex', gap:'2px', padding:'10px 16px 0', background:'var(--surface,#1e293b)', borderBottom:'1px solid var(--border,#1e293b)', flexShrink:0 }}>
      {MODULE_ORDER.map(mod => {
        const isActive = activeModule === mod;
        const color = MODULE_COLORS[mod];
        const items = getModuleItems(mod);
        const answered = Object.keys(scores[mod] ?? {}).filter(k => scores[mod][k] !== null).length;
        const pct = items.length ? Math.round((answered/items.length)*100) : 0;
        return (
          <button key={mod} role="tab" aria-selected={isActive} onClick={() => onSelect(mod)}
            style={{
              padding:'7px 14px', borderRadius:'8px 8px 0 0', border:'none',
              background: isActive ? 'var(--bg,#0a0f1a)' : 'transparent',
              color: isActive ? color : 'var(--text-muted,#94a3b8)',
              cursor:'pointer', fontFamily:'Cairo,sans-serif', fontWeight: isActive ? 800 : 400,
              fontSize:'0.85rem', borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
              display:'flex', alignItems:'center', gap:'6px', transition:'all 0.15s',
            }}>
            <span>{mod}</span>
            {pct > 0 && (
              <span style={{ background: pct===100 ? '#22c55e22' : `${color}22`, color: pct===100 ? '#22c55e' : color, borderRadius:'8px', padding:'1px 6px', fontSize:'0.66rem', fontWeight:700 }}>{pct}%</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Keyboard Help Overlay ─────────────────────────────────────
function KeyboardHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === '?') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const shortcuts = [
    ['→ / 1', 'تسجيل "نجح" والانتقال التالي'],
    ['← / 0', 'تسجيل "أخفق" والانتقال التالي'],
    ['Space', 'تخطي البند (بدون درجة) والانتقال'],
    ['U / Ctrl+Z', 'تراجع عن آخر تسجيل'],
    ['↑ / ↓', 'التنقل بين البنود'],
    ['Tab', 'انتقل لأول بند غير مجاب'],
    ['S', 'حفظ الجلسة'],
    ['F', 'عرض وضع الطالب (ملء الشاشة)'],
    ['C', 'تبديل الوضع المضغوط (Compact)'],
    ['D', 'وضع التركيز — بدون تشتيت'],
    ['?', 'عرض / إخفاء هذه المساعدة'],
    ['Esc', 'إغلاق النوافذ المنبثقة'],
  ];

  return (
    <div
      role="dialog" aria-modal="true" aria-label="اختصارات لوحة المفاتيح"
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:9999, fontFamily:'Cairo,sans-serif',
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--surface,#1e293b)', borderRadius:'16px',
        padding:'28px 32px', maxWidth:'420px', width:'90%',
        boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h3 style={{ margin:0, fontSize:'1.1rem', fontWeight:800 }}>⌨️ اختصارات لوحة المفاتيح</h3>
          <button onClick={onClose} aria-label="إغلاق"
            style={{ background:'none', border:'none', color:'var(--text-muted,#94a3b8)', cursor:'pointer', fontSize:'1.3rem' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {shortcuts.map(([key, desc]) => (
            <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#ffffff06', borderRadius:'8px', fontSize:'0.85rem' }}>
              <span style={{ color:'var(--text-muted,#94a3b8)' }}>{desc}</span>
              <kbd style={{ background:'#ffffff15', padding:'2px 10px', borderRadius:'6px', fontFamily:'monospace', fontSize:'0.82rem', color:'var(--text,#f1f5f9)', fontWeight:700 }}>{key}</kbd>
            </div>
          ))}
        </div>
        <p style={{ margin:'16px 0 0', fontSize:'0.75rem', color:'var(--text-muted,#475569)', textAlign:'center' }}>
          اضغط <kbd style={{ background:'#ffffff10', padding:'1px 6px', borderRadius:'4px' }}>?</kbd> في أي وقت لإظهار هذه المساعدة
        </p>
      </div>
    </div>
  );
}

// ── Pass-rate colour helper ───────────────────────────────────
function passRateColor(rate: number): string {
  if (rate >= 70) return '#22c55e'; // green
  if (rate >= 40) return '#f59e0b'; // amber
  return '#ef4444';                 // red
}

// ── Quick summary bar (across modules) ───────────────────────
function QuickSummaryBar({ scores, activeModule, onSelect }: {
  scores: Record<PeakModule, Record<string, ScoreValue>>;
  activeModule: PeakModule;
  onSelect: (m: PeakModule) => void;
}) {
  return (
    <div style={{ display:'flex', gap:'4px', padding:'8px 12px', background:'#ffffff05', borderTop:'1px solid var(--border,#1e293b)', flexShrink:0, overflowX:'auto' }}>
      {MODULE_ORDER.map(mod => {
        const color    = MODULE_COLORS[mod];
        const items    = getModuleItems(mod);
        const total    = items.length;
        const modScores = scores[mod] ?? {};
        const passed   = Object.values(modScores).filter(v => v === 1).length;
        const answered = Object.values(modScores).filter(v => v !== null).length;
        const coverPct = total ? Math.round((answered / total) * 100) : 0;
        const passPct  = answered ? Math.round((passed / answered) * 100) : 0;
        const rateClr  = answered > 0 ? passRateColor(passPct) : 'var(--text-muted,#475569)';
        const isActive = mod === activeModule;
        return (
          <button key={mod} onClick={() => onSelect(mod)}
            style={{
              flex: 1, minWidth: '64px', background: isActive ? `${color}12` : 'transparent',
              border: `1px solid ${isActive ? color + '40' : 'transparent'}`,
              borderRadius: '8px', padding: '5px 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: '4px', transition: 'all 0.15s',
            }}>
            {/* Module label + answered count */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.62rem' }}>
              <span style={{ fontWeight: 800, color: isActive ? color : 'var(--text-muted,#94a3b8)', fontFamily:'monospace' }}>{mod}</span>
              <span style={{ color:'var(--text-muted,#64748b)', fontFamily:'monospace' }}>{answered}/{total}</span>
            </div>
            {/* Coverage progress bar */}
            <ProgressBar value={coverPct} color={color} label={`${mod}: ${coverPct}%`} />
            {/* Pass rate row */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.6rem' }}>
              <span style={{ color:'var(--text-muted,#475569)' }}>نجاح</span>
              <span style={{ fontWeight: 700, color: rateClr, fontFamily:'monospace' }}>
                {answered > 0 ? `${passPct}%` : '—'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Student View Overlay ──────────────────────────────────────
// Full-screen presentation mode: show the item to the student
function StudentViewOverlay({
  item,
  module,
  color,
  lang,
  itemIndex,
  totalItems,
  onClose,
  onPrev,
  onNext,
}: {
  item: PeakItemData;
  module: PeakModule;
  color: string;
  lang: string;
  itemIndex: number;
  totalItems: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, onNext, onPrev]);

  const showAr = lang !== 'en';
  const showEn = lang !== 'ar';

  // Module emoji for display
  const moduleEmoji: Record<PeakModule, string> = { DT:'📘', G:'🔄', CE:'⚖️', TE:'🔁' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="وضع عرض الطالب"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #1a0f2e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
        padding: '24px',
      }}
    >
      {/* Header bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${color}30`,
      }}>
        {/* Module + item ID */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'1.4rem' }}>{moduleEmoji[module]}</span>
          <div>
            <div style={{ fontSize:'0.7rem', color: color, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>
              {module} · وضع عرض الطالب
            </div>
            <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.6)', fontFamily:'monospace' }}>
              {item.id}
            </div>
          </div>
        </div>

        {/* Navigation counter */}
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <span style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.5)' }}>
            {itemIndex + 1} / {totalItems}
          </span>
          <button
            onClick={onClose}
            aria-label="إغلاق وضع عرض الطالب"
            style={{
              background:'rgba(255,255,255,0.08)',
              border:'1px solid rgba(255,255,255,0.15)',
              color:'#fff',
              borderRadius:'10px',
              padding:'6px 16px',
              cursor:'pointer',
              fontFamily:'Cairo,sans-serif',
              fontSize:'0.82rem',
              display:'flex', alignItems:'center', gap:'6px',
            }}
          >
            <span>✕</span>
            <span>إغلاق (Esc)</span>
          </button>
        </div>
      </div>

      {/* Main item card */}
      <div style={{
        maxWidth: '860px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        textAlign: 'center',
      }}>
        {/* Decorative module indicator */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `${color}18`,
          border: `3px solid ${color}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.2rem',
          boxShadow: `0 0 40px ${color}30`,
        }}>
          {moduleEmoji[module]}
        </div>

        {/* Item text — big, bold, centered */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${color}30`,
          borderRadius: '24px',
          padding: '48px 56px',
          width: '100%',
          boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${color}15`,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {showAr && (
            <p style={{
              margin: 0,
              fontSize: 'clamp(1.5rem, 4vw, 2.6rem)',
              fontWeight: 800,
              lineHeight: 1.6,
              color: '#ffffff',
              direction: 'rtl',
              textAlign: 'center',
              letterSpacing: '-0.01em',
              textShadow: `0 0 30px ${color}40`,
            }}>
              {item.ar}
            </p>
          )}
          {showAr && showEn && (
            <div style={{ height:'1px', background:`${color}25`, margin:'4px 0' }} />
          )}
          {showEn && (
            <p style={{
              margin: 0,
              fontSize: 'clamp(1.1rem, 2.5vw, 1.8rem)',
              fontWeight: showAr ? 400 : 700,
              lineHeight: 1.65,
              color: showAr ? 'rgba(255,255,255,0.55)' : '#ffffff',
              direction: 'ltr',
              textAlign: 'center',
            }}>
              {item.en}
            </p>
          )}
        </div>

        {/* Factor label */}
        <div style={{
          display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <span style={{
            background: `${color}18`,
            color: color,
            border: `1px solid ${color}40`,
            borderRadius: '10px',
            padding: '6px 18px',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}>
            {lang === 'en' ? item.factorNameEn : item.factorNameAr}
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '6px 18px',
            fontSize: '0.78rem',
            fontFamily: 'monospace',
          }}>
            المستوى {item.level}
          </span>
        </div>
      </div>

      {/* Navigation arrows */}
      <div style={{
        position: 'absolute',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <button
          onClick={onPrev}
          disabled={itemIndex === 0}
          aria-label="البند السابق"
          style={{
            background: itemIndex === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: itemIndex === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
            borderRadius: '12px',
            padding: '10px 24px',
            cursor: itemIndex === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'Cairo,sans-serif',
            fontSize: '0.9rem',
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          ‹ السابق
        </button>

        {/* Dot indicators (up to 10) */}
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          {Array.from({ length: Math.min(totalItems, 10) }, (_, i) => {
            const dotIdx = totalItems <= 10 ? i : Math.round(i * (totalItems - 1) / 9);
            const isCurrent = totalItems <= 10
              ? i === itemIndex
              : Math.abs(dotIdx - itemIndex) < totalItems / 10;
            return (
              <div key={i} style={{
                width: isCurrent ? '24px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: isCurrent ? color : 'rgba(255,255,255,0.2)',
                transition: 'all 0.25s',
              }} />
            );
          })}
        </div>

        <button
          onClick={onNext}
          disabled={itemIndex >= totalItems - 1}
          aria-label="البند التالي"
          style={{
            background: itemIndex >= totalItems - 1 ? 'rgba(255,255,255,0.04)' : `${color}20`,
            border: `1px solid ${itemIndex >= totalItems - 1 ? 'rgba(255,255,255,0.12)' : color + '50'}`,
            color: itemIndex >= totalItems - 1 ? 'rgba(255,255,255,0.2)' : color,
            borderRadius: '12px',
            padding: '10px 24px',
            cursor: itemIndex >= totalItems - 1 ? 'not-allowed' : 'pointer',
            fontFamily: 'Cairo,sans-serif',
            fontSize: '0.9rem',
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          التالي ›
        </button>
      </div>

      {/* Keyboard hint */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '0.62rem',
        color: 'rgba(255,255,255,0.2)',
        whiteSpace: 'nowrap',
      }}>
        → التالي · ← السابق · Esc إغلاق
      </div>
    </div>
  );
}

// ── Draft Recovery Dialog ─────────────────────────────────────
function DraftRecoveryDialog({ savedAt, itemCount, onRestore, onDiscard }: {
  savedAt:   number;
  itemCount: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const minutesAgo = Math.round((Date.now() - savedAt) / 60000);
  const timeLabel =
    minutesAgo < 1  ? 'للتو' :
    minutesAgo < 60 ? `منذ ${minutesAgo} دقيقة` :
                      `منذ ${Math.round(minutesAgo / 60)} ساعة`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="استعادة جلسة غير مكتملة"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.70)',
        backdropFilter: 'blur(5px)',
        zIndex: 8000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        fontFamily: 'Cairo,sans-serif',
        direction: 'rtl',
      }}
    >
      <div style={{
        background: 'var(--surface,#1e293b)',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        border: '1px solid rgba(59,130,246,0.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>♻️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text,#f1f5f9)' }}>
          جلسة تقييم غير مكتملة
        </h3>
        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text-muted,#94a3b8)', lineHeight: 1.8 }}>
          وجدنا جلسة محفوظة تلقائياً <strong style={{ color: '#60a5fa' }}>{timeLabel}</strong>
        </p>
        <p style={{ margin: '0 0 24px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
          تحتوي على <strong style={{ color: '#f1f5f9' }}>{itemCount} إجابة</strong> — هل تريد الاستمرار من حيث توقفت؟
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="primary"   onClick={onRestore} style={{ flex: 1 }}>♻️ استعادة الجلسة</Button>
          <Button variant="secondary" onClick={onDiscard} style={{ flex: 1 }}>بدء جديد</Button>
        </div>
      </div>
    </div>
  );
}

// ── ModuleCompleteAlert ───────────────────────────────────────
function ModuleCompleteAlert({
  moduleName,
  nextModule,
  countdown,
  onConfirm,
  onCancel,
}: {
  moduleName: PeakModule;
  nextModule: PeakModule | null;
  countdown: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const radius = 22;
  const circ   = 2 * Math.PI * radius;
  const offset = circ * (1 - countdown / 5);

  return (
    <div style={{
      position:      'fixed',
      bottom:        '90px',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        9999,
      background:    'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',
      border:        '1.5px solid #22c55e',
      borderRadius:  '16px',
      padding:       '16px 22px',
      boxShadow:     '0 8px 32px rgba(0,0,0,0.55)',
      display:       'flex',
      alignItems:    'center',
      gap:           '16px',
      minWidth:      '300px',
      maxWidth:      '420px',
      direction:     'rtl',
      animation:     'slideUpAlert 0.3s ease',
    }}>
      <style>{`@keyframes slideUpAlert{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      {/* Countdown SVG ring */}
      <svg width="52" height="52" style={{ flexShrink: 0 }}>
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#1e3a2f" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={radius}
          fill="none" stroke="#22c55e" strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
          style={{ transition: 'stroke-dashoffset 0.85s linear' }}
        />
        <text x="26" y="31" textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="700"
          fontFamily="Cairo, sans-serif">
          {countdown}
        </text>
      </svg>

      {/* Message + actions */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#22c55e', lineHeight: 1.3 }}>
          ✓ اكتملت وحدة {moduleName}
        </p>
        {nextModule ? (
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
            الانتقال إلى <strong style={{ color: '#60a5fa' }}>{nextModule}</strong> خلال {countdown}ث
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
            تم إكمال جميع الوحدات 🎉
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          {nextModule && (
            <button
              onClick={onConfirm}
              style={{
                background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '6px 14px', fontSize: '0.82rem',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              انتقل الآن
            </button>
          )}
          <button
            onClick={onCancel}
            style={{
              background: 'transparent', color: '#94a3b8',
              border: '1px solid #334155', borderRadius: '8px',
              padding: '6px 14px', fontSize: '0.82rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ابقَ هنا
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Assess Screen ────────────────────────────────────────
export function Assess() {
  const {
    selectedStudentId, activeModule, currentItemIdx, scores,
    setScreen, setActiveModule, setCurrentItemIdx, recordScore, clearScores, addToast,
  } = useAppStore();
  const selectedStudent = useAppStore(selectSelectedStudent);
  const { t, lang } = useTranslation();

  const firstFactor = useMemo(() => getModuleFactors(activeModule)[0]?.key ?? '', [activeModule]);
  const [activeFactor, setActiveFactor] = useState<string>(firstFactor);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHelp, setShowHelp]                 = useState(false);
  const [showStudentView, setShowStudentView]   = useState(false);
  const [quickMode, setQuickMode]               = useState(false);
  const [compactMode, setCompactMode]           = useState(false);
  const [focusMode, setFocusMode]               = useState(false);
  const [justScored, setJustScored] = useState<{ id: string; value: ScoreValue } | null>(null);
  // Draft recovery dialog
  const [pendingDraft, setPendingDraft] = useState<{
    scores: ModuleScores; savedAt: number; startedAt: number; itemCount: number;
  } | null>(null);
  // Auto-save flash indicator ("محفوظ ✓")
  const [showAutoSaved,   setShowAutoSaved]   = useState(false);
  // Persistent "جارٍ الحفظ..." indicator — true while debounce timer is armed
  const [isSavingDraft,   setIsSavingDraft]   = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const saveFlash    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce timer for draft saves
  const draftTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Double-submit guard
  const isSaving     = useRef(false);
  // Undo history: stack of previous values before each score change
  const scoreHistory = useRef<Array<{ module: PeakModule; itemId: string; prevValue: ScoreValue }>>([]);
  // Session start time (preserved across re-renders)
  const sessionStart = useRef(Date.now());
  // Track the startedAt for draft continuity
  const sessionStartedAt = useRef(Date.now());
  // ── Module-complete alert state ───────────────────────────────
  const completedModulesAlerted = useRef<Set<PeakModule>>(new Set());
  const [moduleCompleteAlert, setModuleCompleteAlert] = useState<{
    module: PeakModule; nextModule: PeakModule | null; countdown: number;
  } | null>(null);

  useEffect(() => {
    const f = getModuleFactors(activeModule)[0]?.key ?? '';
    setActiveFactor(f);
    setCurrentItemIdx(0);
  }, [activeModule]);

  useEffect(() => { setCurrentItemIdx(0); }, [activeFactor]);

  // ── Module-complete detection ─────────────────────────────────
  useEffect(() => {
    if (allModuleItems.length === 0) return;
    if (answeredCount < allModuleItems.length) return;
    if (completedModulesAlerted.current.has(activeModule)) return;

    completedModulesAlerted.current.add(activeModule);

    // Find next module that still has unanswered items
    const curIdx = MODULE_ORDER.indexOf(activeModule);
    let nextModule: PeakModule | null = null;
    for (let i = curIdx + 1; i < MODULE_ORDER.length; i++) {
      const mod  = MODULE_ORDER[i];
      const mScores  = scores[mod] ?? {};
      const mItems   = getModuleItems(mod);
      const mAnswered = Object.values(mScores).filter(v => v !== null).length;
      if (mAnswered < mItems.length) { nextModule = mod; break; }
    }

    setModuleCompleteAlert({ module: activeModule, nextModule, countdown: 5 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, allModuleItems.length, activeModule]);

  // ── Countdown tick ────────────────────────────────────────────
  useEffect(() => {
    if (!moduleCompleteAlert) return;
    if (moduleCompleteAlert.countdown <= 0) {
      if (moduleCompleteAlert.nextModule) setActiveModule(moduleCompleteAlert.nextModule);
      setModuleCompleteAlert(null);
      return;
    }
    const t = setTimeout(() => {
      setModuleCompleteAlert(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);
    return () => clearTimeout(t);
  }, [moduleCompleteAlert, setActiveModule]);

  // ── Clear alert on manual module switch ───────────────────────
  useEffect(() => {
    setModuleCompleteAlert(null);
  }, [activeModule]);

  // Close student view if student is deselected
  useEffect(() => {
    if (!selectedStudentId) setShowStudentView(false);
  }, [selectedStudentId]);

  // ── Draft recovery check — shows dialog instead of silent restore ──
  useEffect(() => {
    if (!selectedStudentId) { setPendingDraft(null); return; }

    // Only show if current store is empty (don't prompt mid-session)
    const currentTotal = Object.values(scores).reduce(
      (acc, mod) => acc + Object.values(mod as Record<string, unknown>).filter(v => v !== null).length, 0
    );
    if (currentTotal > 0) return;

    // Check localStorage first (sync), then IDB (async)
    AssessService.loadDraftFull(selectedStudentId).then((draft) => {
      if (!draft) return;
      const itemCount = Object.values(draft.scores).reduce(
        (acc, mod) => acc + Object.values(mod as Record<string, unknown>).filter(v => v !== null).length, 0
      );
      if (itemCount > 0) {
        sessionStartedAt.current = draft.startedAt;
        setPendingDraft({ scores: draft.scores, savedAt: draft.savedAt, startedAt: draft.startedAt, itemCount });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId]);

  // ── Debounced auto-save (800ms after last score) ──────────
  const scheduleDraftSave = useCallback(() => {
    if (!selectedStudentId) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    // Show persistent "جارٍ الحفظ..." immediately when timer is armed
    setIsSavingDraft(true);
    draftTimer.current = setTimeout(() => {
      const latestScores = useAppStore.getState().scores;
      AssessService.saveDraft(selectedStudentId, latestScores, sessionStartedAt.current);
      setIsSavingDraft(false);
      // Show "محفوظ ✓" flash after save completes
      setShowAutoSaved(true);
      if (saveFlash.current) clearTimeout(saveFlash.current);
      saveFlash.current = setTimeout(() => setShowAutoSaved(false), 2200);
    }, 800);
  }, [selectedStudentId]);

  // ── Final save before tab close / refresh ────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!selectedStudentId) return;
      const latestScores = useAppStore.getState().scores;
      const hasAny = Object.values(latestScores).some(
        mod => Object.values(mod as Record<string, unknown>).some(v => v !== null)
      );
      if (hasAny) {
        // Synchronous localStorage save (IDB write may not complete in time)
        try {
          localStorage.setItem(
            `massar_draft_${selectedStudentId}`,
            JSON.stringify({ scores: latestScores, savedAt: Date.now(), startedAt: sessionStartedAt.current })
          );
        } catch {/* ignore */}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedStudentId]);

  // ── visibilitychange — save draft immediately when tab is hidden (mobile) ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      if (!selectedStudentId) return;
      // Cancel any pending debounced save and flush immediately
      if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null; }
      const latestScores = useAppStore.getState().scores;
      const hasAny = Object.values(latestScores).some(
        mod => Object.values(mod as Record<string, unknown>).some(v => v !== null)
      );
      if (!hasAny) return;
      // Synchronous localStorage save (IDB write may not complete before suspension)
      try {
        localStorage.setItem(
          `massar_draft_${selectedStudentId}`,
          JSON.stringify({ scores: latestScores, savedAt: Date.now(), startedAt: sessionStartedAt.current })
        );
      } catch {/* ignore */}
      // Async IDB save (best-effort on mobile — may complete before OS suspends the tab)
      AssessService.saveDraft(selectedStudentId, latestScores, sessionStartedAt.current);
      setIsSavingDraft(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedStudentId]);

  // ── Cleanup timers on unmount (prevent memory leaks) ─────
  useEffect(() => {
    return () => {
      if (draftTimer.current)  clearTimeout(draftTimer.current);
      if (saveFlash.current)   clearTimeout(saveFlash.current);
    };
  }, []);

  const color = MODULE_COLORS[activeModule];
  const moduleScores = scores[activeModule] ?? {};

  const factorItems = useMemo(
    () => getModuleItems(activeModule).filter(it => it.factor === activeFactor),
    [activeModule, activeFactor]
  );

  const currentItem: PeakItemData | undefined = factorItems[currentItemIdx];
  const currentScore: ScoreValue = currentItem ? (moduleScores[currentItem.id] ?? null) : null;

  const allModuleItems = useMemo(() => getModuleItems(activeModule), [activeModule]);
  const answeredCount = Object.values(moduleScores).filter(v => v !== null).length;
  const passedCount   = Object.values(moduleScores).filter(v => v === 1).length;
  const moduleProgress = allModuleItems.length ? Math.round((answeredCount/allModuleItems.length)*100) : 0;
  // Factor-level progress (items answered within the CURRENT factor only)
  const factorAnsweredCount = factorItems.filter(it => moduleScores[it.id] !== null && moduleScores[it.id] !== undefined).length;
  const factorPassedCount   = factorItems.filter(it => moduleScores[it.id] === 1).length;
  const factorProgress      = factorItems.length ? Math.round((factorAnsweredCount / factorItems.length) * 100) : 0;

  const allSummaryItems = useMemo(() =>
    MODULE_ORDER.flatMap(mod => getModuleItems(mod).map(it => ({ id:it.id, module:mod, level:it.level }))),
    []
  );

  // Jump to first unanswered in current factor
  const jumpToUnanswered = useCallback(() => {
    const idx = factorItems.findIndex(it => moduleScores[it.id] === null || moduleScores[it.id] === undefined);
    if (idx !== -1) setCurrentItemIdx(idx);
    else addToast('جميع بنود العامل مكتملة ✓', 'success');
  }, [factorItems, moduleScores, setCurrentItemIdx, addToast]);

  const advanceAfterScore = useCallback((idx: number) => {
    const delay = quickMode ? 200 : 380;
    setTimeout(() => {
      if (idx < factorItems.length - 1) setCurrentItemIdx(idx + 1);
      setJustScored(null);
    }, delay);
  }, [quickMode, factorItems.length, setCurrentItemIdx]);

  const handleScoreAndAdvance = useCallback((value: 1 | 0) => {
    if (!currentItem) return;
    // Push current value to undo history before overwriting
    const prevValue = ((useAppStore.getState().scores[activeModule] ?? {}) as Record<string, ScoreValue>)[currentItem.id] ?? null;
    scoreHistory.current.push({ module: activeModule, itemId: currentItem.id, prevValue });
    recordScore(activeModule, currentItem.id, value);
    setJustScored({ id: currentItem.id, value });
    advanceAfterScore(currentItemIdx);
    // Debounced auto-save (800ms) — prevents writing on every keystroke
    scheduleDraftSave();
  }, [currentItem, activeModule, currentItemIdx, recordScore, advanceAfterScore, selectedStudentId, scheduleDraftSave]);

  // Space: mark current item as skipped (null) and advance
  const handleSkipItem = useCallback(() => {
    if (!currentItem) return;
    const prevValue = ((useAppStore.getState().scores[activeModule] ?? {}) as Record<string, ScoreValue>)[currentItem.id] ?? null;
    scoreHistory.current.push({ module: activeModule, itemId: currentItem.id, prevValue });
    recordScore(activeModule, currentItem.id, null as unknown as ScoreValue);
    scheduleDraftSave();
    const delay = quickMode ? 200 : 380;
    setTimeout(() => {
      if (currentItemIdx < factorItems.length - 1) setCurrentItemIdx(currentItemIdx + 1);
    }, delay);
  }, [currentItem, activeModule, currentItemIdx, factorItems.length, recordScore, setCurrentItemIdx, quickMode, scheduleDraftSave]);

  // Ctrl+Z: revert last scored item to its previous value
  const handleUndo = useCallback(() => {
    if (scoreHistory.current.length === 0) {
      addToast('لا يوجد ما يمكن التراجع عنه', 'info');
      return;
    }
    const last = scoreHistory.current.pop()!;
    recordScore(last.module, last.itemId, last.prevValue as ScoreValue);
    scheduleDraftSave();
    addToast('↩ تم التراجع عن آخر تسجيل', 'info');
  }, [recordScore, scheduleDraftSave, addToast]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Student view gets its own keyboard handler — skip main handler when open
    if (showStudentView) return;

    switch (e.key) {
      case '?':
        e.preventDefault();
        setShowHelp(h => !h);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        if (currentItem) setShowStudentView(true);
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        setCompactMode(m => !m);
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        setFocusMode(f => !f);
        break;
      case 'Escape':
        setShowHelp(false);
        setShowClearConfirm(false);
        setShowStudentView(false);
        if (focusMode) setFocusMode(false);
        break;
      case 'ArrowRight':
      case '1':
        if (!currentItem) break;
        e.preventDefault();
        handleScoreAndAdvance(1);
        break;
      case 'ArrowLeft':
      case '0':
        if (!currentItem) break;
        e.preventDefault();
        handleScoreAndAdvance(0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentItemIdx > 0) setCurrentItemIdx(currentItemIdx - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentItemIdx < factorItems.length - 1) setCurrentItemIdx(currentItemIdx + 1);
        break;
      case 'Tab':
        e.preventDefault();
        jumpToUnanswered();
        break;
      case ' ':
        // Space = skip current item (set to null) and advance
        e.preventDefault();
        handleSkipItem();
        break;
      case 's':
      case 'S':
        // S = save session (moved from Space)
        e.preventDefault();
        handleSave();
        break;
      case 'z':
      case 'Z':
        // Ctrl+Z / Cmd+Z = undo last score
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleUndo();
        }
        break;
      case 'u':
      case 'U':
        // U = undo last score (standalone, no modifier)
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleUndo();
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, currentItemIdx, factorItems.length, handleScoreAndAdvance, handleSkipItem, handleUndo, jumpToUnanswered, setCurrentItemIdx, showStudentView, focusMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!selectedStudentId || !selectedStudent) {
    return (
      <main id="main-content" role="main"
        style={{ padding:'24px', fontFamily:'Cairo,sans-serif', direction:'rtl', color:'var(--text,#f1f5f9)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'16px', textAlign:'center' }}>
        <div style={{ fontSize:'4rem' }}>📋</div>
        <h2 style={{ margin:0, fontSize:'1.2rem' }}>{t('selectStudentFirst')}</h2>
        <p style={{ margin:0, color:'var(--text-muted,#94a3b8)', fontSize:'0.9rem' }}>اختر طالباً من قائمة الطلاب لبدء التقييم</p>
        <Button variant="primary" onClick={() => setScreen('students')}>{t('students')}</Button>
      </main>
    );
  }

  async function handleSave() {
    if (!selectedStudentId) return;
    // Double-submit guard — prevent concurrent saves
    if (isSaving.current) return;
    isSaving.current = true;

    // Cancel any pending debounced draft save
    if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null; }

    const durationSecs = Math.round((Date.now() - sessionStart.current) / 1000);
    try {
      await AssessService.saveSession(
        selectedStudentId,
        scores,
        allSummaryItems,
        lang as 'ar' | 'en' | 'both',
        durationSecs,
        sessionNotes.trim() || undefined
      );
      // Clear auto-draft (localStorage + IDB) after successful save
      AssessService.clearDraft(selectedStudentId);
      addToast(t('assessSaved'), 'success');
      setScreen('reports');
    } catch {
      // Track failed save so Analytics can surface the metric
      AssessService.recordFailedSave();
      addToast(t('errorSaving'), 'error');
    } finally {
      isSaving.current = false;
    }
  }

  const unansweredCount = factorItems.filter(it => moduleScores[it.id] === null || moduleScores[it.id] === undefined).length;
  const flashColor = justScored?.value === 1 ? '#22c55e' : justScored?.value === 0 ? '#ef4444' : null;

  // Total answered across all modules (for fatigue indicator)
  const totalAnsweredAll = MODULE_ORDER.reduce((sum, mod) =>
    sum + Object.values(scores[mod] ?? {}).filter(v => v !== null).length, 0);
  const showFatigueHint = totalAnsweredAll > 0 && totalAnsweredAll % 30 === 0 && !compactMode;

  return (
    <>
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}

      {/* Draft Recovery Dialog — shown when a saved draft is found */}
      {pendingDraft && (
        <DraftRecoveryDialog
          savedAt={pendingDraft.savedAt}
          itemCount={pendingDraft.itemCount}
          onRestore={() => {
            // Apply draft scores into Zustand store
            Object.entries(pendingDraft.scores).forEach(([mod, modScores]) => {
              Object.entries(modScores as Record<string, number | null>).forEach(([itemId, value]) => {
                if (value !== null) recordScore(mod as PeakModule, itemId, value as 0 | 1);
              });
            });
            sessionStart.current = pendingDraft.startedAt;
            sessionStartedAt.current = pendingDraft.startedAt;
            setPendingDraft(null);
          }}
          onDiscard={() => {
            if (selectedStudentId) AssessService.clearDraft(selectedStudentId);
            setPendingDraft(null);
          }}
        />
      )}

      {/* Student View — full-screen overlay */}
      {showStudentView && currentItem && (
        <StudentViewOverlay
          item={currentItem}
          module={activeModule}
          color={color}
          lang={lang}
          itemIndex={currentItemIdx}
          totalItems={factorItems.length}
          onClose={() => setShowStudentView(false)}
          onPrev={() => {
            if (currentItemIdx > 0) setCurrentItemIdx(currentItemIdx - 1);
          }}
          onNext={() => {
            if (currentItemIdx < factorItems.length - 1) setCurrentItemIdx(currentItemIdx + 1);
          }}
        />
      )}

      <main id="main-content" role="main"
        style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', fontFamily:'Cairo,sans-serif', direction:'rtl', color:'var(--text,#f1f5f9)', overflow:'hidden', transition:'background 0.2s', background: flashColor ? `${flashColor}08` : 'var(--bg,#0a0f1a)' }}>

        {/* Focus mode: minimal breadcrumb instead of tabs + strip */}
        {focusMode ? (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 16px', background:'var(--surface,#1e293b)',
            borderBottom:`2px solid ${color}40`, flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontFamily:'monospace', fontSize:'0.75rem', color, fontWeight:700 }}>{activeModule}</span>
              <span style={{ fontSize:'0.7rem', color:'var(--text-muted,#64748b)' }}>›</span>
              <span style={{ fontSize:'0.75rem', color:'var(--text-muted,#94a3b8)', fontWeight:600 }}>{activeFactor}</span>
              <span style={{ fontSize:'0.7rem', color:'var(--text-muted,#475569)' }}>{currentItemIdx + 1}/{factorItems.length}</span>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <SessionTimer startTime={sessionStart.current} compact />
              <button onClick={() => setFocusMode(false)}
                title="إنهاء وضع التركيز (D أو Esc)"
                style={{ background:`${color}18`, border:`1px solid ${color}30`, color, borderRadius:'6px', padding:'3px 10px', cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.68rem', fontWeight:700 }}>
                ✕ تركيز
              </button>
            </div>
          </div>
        ) : (
          <>
            <ModuleTabs activeModule={activeModule} scores={scores} onSelect={mod => setActiveModule(mod)} />
            <FactorStrip module={activeModule} activeFactor={activeFactor} scores={moduleScores} onSelect={setActiveFactor} />
          </>
        )}

        {/* Save state indicator — "جارٍ الحفظ..." during debounce, "محفوظ ✓" after */}
        {(isSavingDraft || showAutoSaved) && (
          <div style={{
            background: isSavingDraft
              ? 'rgba(99,102,241,0.08)'
              : 'rgba(34,197,94,0.08)',
            border: `1px solid ${isSavingDraft ? 'rgba(99,102,241,0.25)' : 'rgba(34,197,94,0.25)'}`,
            padding: '4px 16px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.73rem',
            color: isSavingDraft ? '#818cf8' : '#22c55e',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}>
            {isSavingDraft ? (
              <>
                <span style={{ fontSize: '0.8rem', animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⟳</span>
                <span>جارٍ الحفظ...</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.85rem' }}>✓</span>
                <span>محفوظ تلقائياً</span>
              </>
            )}
          </div>
        )}

        {/* Module progress header */}
        <div style={{ padding: compactMode ? '5px 16px 4px' : '8px 16px 6px', flexShrink:0, background:'var(--surface,#1e293b)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px', fontSize:'0.78rem', color:'var(--text-muted,#94a3b8)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontWeight:700, color }}>{lang === 'en' ? MODULE_META[activeModule].en : MODULE_META[activeModule].ar}</span>
              {!focusMode && <SessionTimer startTime={sessionStart.current} compact={compactMode} />}
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {/* Quick mode */}
              <label style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize:'0.68rem', color: quickMode ? '#f59e0b' : 'var(--text-muted,#94a3b8)' }}>
                <input type="checkbox" checked={quickMode} onChange={e => setQuickMode(e.target.checked)} style={{ accentColor:'#f59e0b', width:'11px', height:'11px' }} />
                سريع
              </label>
              {/* Compact mode */}
              <button onClick={() => setCompactMode(m => !m)} title="الوضع المضغوط (C)"
                style={{ background: compactMode ? '#6366f118' : 'transparent', border:`1px solid ${compactMode ? '#6366f150' : 'transparent'}`, color: compactMode ? '#818cf8' : 'var(--text-muted,#64748b)', borderRadius:'5px', padding:'1px 7px', cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.66rem', fontWeight: compactMode ? 700 : 400, transition:'all 0.15s' }}>
                ⊟ مضغوط
              </button>
              {/* Focus mode */}
              <button onClick={() => setFocusMode(f => !f)} title="وضع التركيز (D)"
                style={{ background: focusMode ? '#8b5cf618' : 'transparent', border:`1px solid ${focusMode ? '#8b5cf650' : 'transparent'}`, color: focusMode ? '#a78bfa' : 'var(--text-muted,#64748b)', borderRadius:'5px', padding:'1px 7px', cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.66rem', fontWeight: focusMode ? 700 : 400, transition:'all 0.15s' }}>
                ◎ تركيز
              </button>
              <span>✓ <strong style={{ color:'#22c55e' }}>{passedCount}</strong> / {answeredCount} من {allModuleItems.length}</span>
            </div>
          </div>
          {/* All-modules simultaneous progress bar */}
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', gap: '3px', height: '7px', borderRadius: '4px', overflow: 'hidden' }}>
              {MODULE_ORDER.map((mod) => {
                const modItems  = getModuleItems(mod);
                const modAns    = Object.values(scores[mod] ?? {}).filter(v => v !== null).length;
                const modPct    = modItems.length ? (modAns / modItems.length) * 100 : 0;
                const isActive  = mod === activeModule;
                const modColor  = MODULE_COLORS[mod];
                return (
                  <div key={mod} style={{ flex: modItems.length || 1, background: 'var(--surface2,#0f172a)', borderRadius: '3px', overflow: 'hidden', outline: isActive ? `2px solid ${modColor}` : 'none', outlineOffset: '1px' }}>
                    <div style={{ width: `${modPct}%`, height: '100%', background: modColor, transition: 'width 0.35s ease', opacity: isActive ? 1 : 0.55 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '3px', marginTop: '3px', fontSize: '0.62rem' }}>
              {MODULE_ORDER.map((mod) => {
                const modItems  = getModuleItems(mod);
                const modAns    = Object.values(scores[mod] ?? {}).filter(v => v !== null).length;
                const isDone    = modItems.length > 0 && modAns === modItems.length;
                const isActive  = mod === activeModule;
                const modColor  = MODULE_COLORS[mod];
                return (
                  <div key={mod} style={{ flex: modItems.length || 1, textAlign: 'center', color: isActive ? modColor : isDone ? '#22c55e' : 'var(--text-muted,#64748b)', fontWeight: isActive ? 800 : 400, transition: 'color 0.2s' }}>
                    {isDone ? `\u2713 ${mod}` : `${modAns}/${modItems.length} ${mod}`}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable item area */}
        <div style={{ flex:1, overflow:'auto', padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>

          {/* Factor counter + actions */}
          <div style={{ paddingTop:'8px' }}>
            {/* Factor-level mini progress bar */}
            {!compactMode && (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', fontSize:'0.7rem', color:'var(--text-muted,#64748b)' }}>
                <span style={{ fontWeight:700, color }}>
                  {activeFactor}
                </span>
                <div style={{ flex:1, height:'4px', background:'var(--surface2,#0f172a)', borderRadius:'2px', overflow:'hidden' }}>
                  <div style={{ width:`${factorProgress}%`, height:'100%', background: factorProgress === 100 ? '#22c55e' : color, borderRadius:'2px', transition:'width 0.3s ease' }} />
                </div>
                <span style={{ flexShrink:0 }}>
                  <strong style={{ color: factorAnsweredCount === factorItems.length ? '#22c55e' : 'var(--text,#f1f5f9)' }}>
                    {factorAnsweredCount}
                  </strong>/{factorItems.length}
                  {factorPassedCount > 0 && (
                    <span style={{ color:'#22c55e', marginRight:'4px' }}> · ✓{factorPassedCount}</span>
                  )}
                </span>
              </div>
            )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.76rem', color:'var(--text-muted,#94a3b8)' }}>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <span>{activeFactor} — {t('item')} {currentItemIdx + 1} {t('of')} {factorItems.length}</span>
              {unansweredCount > 0 && (
                <button onClick={jumpToUnanswered}
                  title="انتقل لأول بند غير مجاب (Tab)"
                  style={{ background:'#f59e0b18', border:'1px solid #f59e0b40', color:'#f59e0b', borderRadius:'6px', padding:'2px 8px', cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.68rem', fontWeight:700 }}>
                  ⟶ {unansweredCount} غير مجاب
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {/* Student View button */}
              {currentItem && (
                <button
                  onClick={() => setShowStudentView(true)}
                  title="عرض البند للطالب بملء الشاشة (F)"
                  aria-label="وضع عرض الطالب"
                  style={{
                    background:`${color}15`,
                    border:`1px solid ${color}40`,
                    color: color,
                    borderRadius:'6px',
                    padding:'2px 10px',
                    cursor:'pointer',
                    fontFamily:'Cairo,sans-serif',
                    fontSize:'0.72rem',
                    fontWeight:700,
                    display:'flex', alignItems:'center', gap:'4px',
                  }}
                >
                  🖥️ عرض الطالب
                </button>
              )}
              {/* Undo last score */}
              <button
                onClick={handleUndo}
                title="تراجع عن آخر تسجيل (U أو Ctrl+Z)"
                aria-label="تراجع عن آخر تسجيل"
                style={{ background: scoreHistory.current.length > 0 ? '#f59e0b15' : 'none', border: scoreHistory.current.length > 0 ? '1px solid #f59e0b40' : 'none', color: scoreHistory.current.length > 0 ? '#f59e0b' : 'var(--text-muted,#64748b)', borderRadius:'6px', cursor:'pointer', fontSize:'0.72rem', fontFamily:'Cairo,sans-serif', padding:'2px 8px', transition:'all 0.15s' }}>
                ↩ تراجع
              </button>
              <button onClick={() => setShowHelp(true)} aria-label="اختصارات لوحة المفاتيح"
                style={{ background:'none', border:'none', color:'var(--text-muted,#64748b)', cursor:'pointer', fontSize:'0.72rem', fontFamily:'Cairo,sans-serif', padding:'2px 6px' }}>
                ⌨️ ?
              </button>
              <button onClick={() => setShowClearConfirm(true)}
                style={{ background:'none', border:'none', color:'var(--text-muted,#64748b)', cursor:'pointer', fontSize:'0.72rem', fontFamily:'Cairo,sans-serif', padding:'2px 6px' }}>
                🗑 مسح
              </button>
            </div>
          </div>
          </div>

          {/* Fatigue hint — appears every 30 answered items */}
          {showFatigueHint && (
            <div style={{ background:'#f59e0b10', border:'1px solid #f59e0b30', borderRadius:'8px', padding:'8px 12px', display:'flex', alignItems:'center', gap:'10px', fontSize:'0.78rem', color:'#fbbf24', flexShrink:0 }}>
              <span style={{ fontSize:'1.1rem' }}>☕</span>
              <span>لقد سجّلت <strong>{totalAnsweredAll}</strong> بنداً — خذ استراحة قصيرة للحفاظ على الدقة</span>
              <button onClick={() => setCompactMode(true)} style={{ marginRight:'auto', background:'#f59e0b18', border:'1px solid #f59e0b40', color:'#f59e0b', borderRadius:'5px', padding:'2px 8px', cursor:'pointer', fontFamily:'Cairo,sans-serif', fontSize:'0.7rem', fontWeight:700 }}>
                تفعيل المضغوط
              </button>
            </div>
          )}

          {currentItem ? (
            <>
              {/* Item card */}
              <div role="region" aria-label={`البند: ${currentItem.ar}`}
                style={{ background:'var(--surface,#1e293b)', borderRadius: compactMode ? '10px' : '16px', padding: compactMode ? '12px' : '20px', borderTop:`3px solid ${currentScore === 1 ? '#22c55e' : currentScore === 0 ? '#ef4444' : color}`, display:'flex', flexDirection:'column', gap: compactMode ? '8px' : '14px', transition:'border-color 0.2s, padding 0.2s' }}>

                {/* ID + factor + status + student view button */}
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <span style={{ background:`${color}22`, color, borderRadius:'6px', padding:'3px 10px', fontSize:'0.72rem', fontWeight:700, fontFamily:'monospace', letterSpacing:'0.03em' }}>{currentItem.id}</span>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted,#64748b)' }}>{lang === 'en' ? currentItem.factorNameEn : currentItem.factorNameAr}</span>
                  {currentScore === 1 && <span style={{ marginRight:'auto', color:'#22c55e', fontWeight:700, fontSize:'0.8rem' }}>✓ نجح</span>}
                  {currentScore === 0 && <span style={{ marginRight:'auto', color:'#ef4444', fontWeight:700, fontSize:'0.8rem' }}>✗ أخفق</span>}
                  {/* Fullscreen button inside card */}
                  <button
                    onClick={() => setShowStudentView(true)}
                    title="عرض بملء الشاشة للطالب"
                    style={{
                      marginRight: 'auto',
                      marginLeft: 'auto',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted,#64748b)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      transition: 'color 0.15s',
                      lineHeight: 1,
                    }}
                    aria-label="عرض للطالب بملء الشاشة"
                    onMouseEnter={e => (e.currentTarget.style.color = color)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted,#64748b)')}
                  >
                    ⛶
                  </button>
                </div>

                {/* Item text */}
                <div style={{ display:'flex', flexDirection:'column', gap: compactMode ? '6px' : '10px' }}>
                  {lang !== 'en' && (
                    <p style={{ margin:0, fontSize: compactMode ? '0.95rem' : '1.1rem', fontWeight:700, lineHeight: compactMode ? 1.5 : 1.65, color:'var(--text,#f1f5f9)', direction:'rtl', textAlign:'right' }}>
                      {currentItem.ar}
                    </p>
                  )}
                  {lang !== 'ar' && (
                    <p style={{ margin:0, fontSize: compactMode ? (lang === 'en' ? '0.9rem' : '0.78rem') : (lang === 'en' ? '1.05rem' : '0.88rem'), fontWeight: lang === 'en' ? 700 : 400, lineHeight:1.6, color: lang === 'en' ? 'var(--text,#f1f5f9)' : 'var(--text-muted,#94a3b8)', direction:'ltr', textAlign:'left' }}>
                      {currentItem.en}
                    </p>
                  )}
                </div>

                {/* Correct answer */}
                {(currentItem.correctAr || currentItem.correctEn) && (
                  <div style={{ background:'#22c55e12', border:'1px solid #22c55e30', borderRadius:'8px', padding:'8px 12px', fontSize:'0.8rem' }}>
                    <span style={{ color:'#22c55e', fontWeight:700, marginLeft:'6px' }}>✓ الإجابة الصحيحة: </span>
                    {lang !== 'en' && currentItem.correctAr && <span style={{ color:'var(--text,#f1f5f9)' }}>{currentItem.correctAr}</span>}
                    {lang !== 'ar' && currentItem.correctEn && (
                      <span style={{ color:'var(--text-muted,#94a3b8)', direction:'ltr', marginRight:'6px' }}>
                        {lang === 'both' ? ` / ${currentItem.correctEn}` : currentItem.correctEn}
                      </span>
                    )}
                  </div>
                )}

                {/* Student view hint — hidden in compact mode to save space */}
                {!compactMode && (
                  <div style={{ textAlign:'center', fontSize:'0.66rem', color:'var(--text-muted,#475569)', paddingTop:'2px' }}>
                    <span>🖥️ اضغط </span>
                    <kbd style={{ background:'rgba(255,255,255,0.07)', padding:'1px 5px', borderRadius:'4px', fontFamily:'monospace', fontSize:'0.66rem' }}>F</kbd>
                    <span> لعرض البند للطالب بملء الشاشة</span>
                  </div>
                )}
              </div>

              {/* Score buttons */}
              <div style={{ display:'flex', gap: compactMode ? '8px' : '12px' }} role="group" aria-label="تسجيل الاستجابة">
                <ScoreBtn label={t('passed')} emoji="✓" active={currentScore === 1} color="#22c55e" onClick={() => handleScoreAndAdvance(1)} shortcut="→ / 1" compact={compactMode} />
                <ScoreBtn label={t('failed')} emoji="✗" active={currentScore === 0} color="#ef4444" onClick={() => handleScoreAndAdvance(0)} shortcut="← / 0" compact={compactMode} />
                {/* Skip button — sets score to null and advances */}
                <button
                  onClick={handleSkipItem}
                  aria-label="تخطي البند (Space)"
                  title="تخطي البند بدون تسجيل درجة (Space)"
                  style={{
                    flex: compactMode ? '0 0 auto' : '0 0 72px',
                    padding: compactMode ? '8px 6px' : '16px 8px',
                    borderRadius: compactMode ? '10px' : '14px',
                    border: '2px solid var(--border,#334155)',
                    background: 'var(--surface,#1e293b)',
                    color: 'var(--text-muted,#94a3b8)',
                    cursor: 'pointer', fontFamily: 'Cairo,sans-serif',
                    fontSize: compactMode ? '0.75rem' : '0.82rem',
                    fontWeight: 600,
                    transition: 'all 0.15s',
                    minHeight: compactMode ? '44px' : '56px',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '3px',
                  }}>
                  <span style={{ fontSize: compactMode ? '0.85rem' : '1.1rem', opacity: 0.6 }}>⊘</span>
                  <span>تخطي</span>
                  {!compactMode && <kbd style={{ fontSize:'0.58rem', background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:'3px', fontFamily:'monospace' }}>Space</kbd>}
                </button>
              </div>

              {/* Navigation */}
              <div style={{ display:'flex', gap:'8px' }}>
                <Button variant="secondary" size="sm" onClick={() => currentItemIdx > 0 && setCurrentItemIdx(currentItemIdx - 1)} disabled={currentItemIdx === 0} style={{ flex:1 }}>‹ {t('previous')}</Button>
                <Button variant="secondary" size="sm" onClick={() => currentItemIdx < factorItems.length - 1 && setCurrentItemIdx(currentItemIdx + 1)} disabled={currentItemIdx === factorItems.length - 1} style={{ flex:1 }}>{t('next')} ›</Button>
              </div>

              {/* Keyboard hint */}
              {!compactMode && (
                <div aria-hidden="true" style={{ textAlign:'center', fontSize:'0.62rem', color:'var(--text-muted,#475569)' }}>
                  →/1 نجح · ←/0 أخفق · Space تخطي · U/Ctrl+Z تراجع · ↑↓ تنقل · Tab غير مجاب · F طالب · S حفظ
                </div>
              )}

              {/* ── Session Notes ───────────────────────────────── */}
              <div>
                <button
                  onClick={() => setShowNotesPanel(p => !p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                    background: 'transparent', border: '1px dashed var(--border,#334155)',
                    borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
                    color: sessionNotes ? '#f59e0b' : 'var(--text-muted,#64748b)',
                    fontFamily: 'Cairo,sans-serif', fontSize: '0.78rem', fontWeight: sessionNotes ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                  title="ملاحظات الجلسة"
                >
                  <span>📝</span>
                  <span>{sessionNotes ? `ملاحظات (${sessionNotes.length})` : 'إضافة ملاحظة للجلسة'}</span>
                  <span style={{ marginRight: 'auto', fontSize: '0.65rem' }}>{showNotesPanel ? '▲' : '▼'}</span>
                </button>
                {showNotesPanel && (
                  <textarea
                    value={sessionNotes}
                    onChange={e => setSessionNotes(e.target.value)}
                    placeholder="ملاحظات الجلسة، سلوكيات ملحوظة، توصيات..."
                    maxLength={1000}
                    rows={3}
                    style={{
                      width: '100%', marginTop: '6px', padding: '8px 10px', boxSizing: 'border-box',
                      background: 'var(--surface,#1e293b)', border: '1px solid var(--border,#334155)',
                      borderRadius: '8px', color: 'var(--text,#f1f5f9)', fontFamily: 'Cairo,sans-serif',
                      fontSize: '0.82rem', resize: 'vertical', outline: 'none', direction: 'rtl',
                      lineHeight: 1.6,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border,#334155)'; }}
                  />
                )}
              </div>

              {/* Save */}
              <Button variant="success" fullWidth icon="💾" onClick={handleSave} aria-keyshortcuts="s">
                {t('saveAssessment')}
                <kbd aria-hidden="true" style={{ fontSize:'0.65rem', background:'rgba(255,255,255,0.15)', padding:'1px 6px', borderRadius:'3px', marginRight:'6px' }}>S</kbd>
              </Button>
            </>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'14px', color:'var(--text-muted,#94a3b8)', padding:'32px', textAlign:'center' }}>
              <div style={{ fontSize:'3.5rem' }}>🎉</div>
              <p style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#22c55e' }}>تم الانتهاء من عامل {activeFactor}!</p>
              <p style={{ margin:0, fontSize:'0.85rem' }}>انتقل إلى العامل التالي أو احفظ الجلسة</p>
              {sessionNotes && (
                <div style={{ fontSize:'0.78rem', color:'#f59e0b', background:'#f59e0b12', border:'1px solid #f59e0b33', borderRadius:'8px', padding:'6px 10px', direction:'rtl', textAlign:'right', maxWidth:'260px' }}>
                  📝 {sessionNotes.slice(0, 80)}{sessionNotes.length > 80 ? '…' : ''}
                </div>
              )}
              <Button variant="success" icon="💾" onClick={handleSave}>{t('saveAssessment')}</Button>
            </div>
          )}
        </div>

        {/* All-modules summary bar — hidden in focus mode */}
        {!focusMode && <QuickSummaryBar scores={scores} activeModule={activeModule} onSelect={mod => setActiveModule(mod)} />}

        {/* Module-complete floating alert */}
        {moduleCompleteAlert && (
          <ModuleCompleteAlert
            moduleName={moduleCompleteAlert.module}
            nextModule={moduleCompleteAlert.nextModule}
            countdown={moduleCompleteAlert.countdown}
            onConfirm={() => {
              if (moduleCompleteAlert.nextModule) setActiveModule(moduleCompleteAlert.nextModule);
              setModuleCompleteAlert(null);
            }}
            onCancel={() => setModuleCompleteAlert(null)}
          />
        )}

        {showClearConfirm && (
          <ConfirmDialog
            title="مسح درجات التقييم"
            message="هل تريد مسح جميع الدرجات المسجّلة؟ لا يمكن التراجع عن هذا."
            type="danger"
            confirmLabel="مسح الكل"
            onConfirm={() => { clearScores(); addToast('تم مسح الدرجات', 'info'); setShowClearConfirm(false); setCurrentItemIdx(0); }}
            onCancel={() => setShowClearConfirm(false)}
          />
        )}
      </main>
    </>
  );
}
