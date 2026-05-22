// ============================================================
//  StudentFullReportService — تقرير شامل متعدد الجلسات
//  Generates a full A4 PDF report for a student (all sessions)
//  Uses html2canvas + jsPDF — same pipeline as PdfExportService
// ============================================================

import type { Student, AssessSession, PeakModule } from '@/types';

const MODULE_ORDER: PeakModule[] = ['DT', 'G', 'CE', 'TE'];
const MODULE_COLORS: Record<PeakModule, string> = {
  DT: '#3b82f6', G: '#22c55e', CE: '#a855f7', TE: '#f59e0b',
};
const MODULE_NAMES: Record<PeakModule, string> = {
  DT: 'التعلم المباشر',
  G:  'التعميم العلائقي',
  CE: 'التكافؤ السياقي',
  TE: 'تحويل وظائف المثير',
};

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
function fmtDur(secs: number): string {
  if (!secs) return '—';
  if (secs < 60) return `${secs} ث`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return s > 0 ? `${m}د ${s}ث` : `${m} دقيقة`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}س ${rm}د`;
}
function pctColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 60) return '#65a30d';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}
function pctLabel(pct: number): string {
  if (pct >= 80) return 'ممتاز';
  if (pct >= 60) return 'جيد';
  if (pct >= 40) return 'متوسط';
  return 'يحتاج دعم';
}

// ── Build the off-screen HTML element ────────────────────────
function buildReportHTML(student: Student, sessions: AssessSession[]): string {
  const sorted = [...sessions]
    .filter(s => !s.deletedAt)
    .sort((a, b) => a.savedAt - b.savedAt); // oldest first for trend

  // Compute overall averages per module across all sessions
  const moduleAvgs: Record<PeakModule, number[]> = { DT: [], G: [], CE: [], TE: [] };
  sorted.forEach(sess => {
    MODULE_ORDER.forEach(mod => {
      const s = sess.summary.find(x => x.module === mod);
      if (s) moduleAvgs[mod].push(s.pct);
    });
  });

  const latestSession = sorted[sorted.length - 1];
  const age = student.dob
    ? Math.floor((Date.now() - new Date(student.dob).getTime()) / (365.25 * 86400000))
    : null;

  // ── session rows ─────────────────────────────────────────
  const sessionRows = sorted.map((sess, idx) => {
    const avg = sess.summary.length
      ? Math.round(sess.summary.reduce((s, x) => s + x.pct, 0) / sess.summary.length)
      : 0;
    const modCells = MODULE_ORDER.map(mod => {
      const s = sess.summary.find(x => x.module === mod);
      const p = s ? s.pct : null;
      return `<td style="text-align:center;padding:6px 4px;font-size:0.8rem;color:${p !== null ? pctColor(p) : '#94a3b8'};font-weight:700">
        ${p !== null ? p + '%' : '—'}
      </td>`;
    }).join('');

    const deltaSess = idx > 0 ? sorted[idx - 1] : null;
    const prevAvg = deltaSess && deltaSess.summary.length
      ? Math.round(deltaSess.summary.reduce((s, x) => s + x.pct, 0) / deltaSess.summary.length)
      : null;
    const delta = prevAvg !== null ? avg - prevAvg : null;
    const deltaStr = delta === null ? '' : delta > 0
      ? `<span style="color:#16a34a">▲${delta}%</span>`
      : delta < 0
        ? `<span style="color:#dc2626">▼${Math.abs(delta)}%</span>`
        : `<span style="color:#94a3b8">—</span>`;

    return `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:6px 8px;font-size:0.78rem;color:#475569">${sorted.length - idx}</td>
      <td style="padding:6px 8px;font-size:0.78rem">${fmt(sess.savedAt)}</td>
      ${modCells}
      <td style="text-align:center;padding:6px 4px;font-weight:800;color:${pctColor(avg)}">${avg}%</td>
      <td style="text-align:center;padding:6px 4px;font-size:0.75rem">${deltaStr}</td>
      <td style="padding:6px 8px;font-size:0.75rem;color:#64748b">${fmtDur(sess.duration ?? 0)}</td>
    </tr>`;
  }).reverse().join(''); // show newest first in table

  // ── module summary cards ──────────────────────────────────
  const moduleCards = MODULE_ORDER.map(mod => {
    const vals = moduleAvgs[mod];
    const latest = latestSession?.summary.find(x => x.module === mod);
    const latestPct = latest?.pct ?? null;
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const best = vals.length ? Math.max(...vals) : null;
    const col = MODULE_COLORS[mod];
    return `<div style="flex:1;min-width:140px;border:2px solid ${col}33;border-top:4px solid ${col};border-radius:10px;padding:14px;background:#fff">
      <div style="font-size:0.7rem;color:#64748b;margin-bottom:4px">${MODULE_NAMES[mod]}</div>
      <div style="font-size:0.65rem;color:#94a3b8;letter-spacing:0.05em;margin-bottom:8px">${mod}</div>
      <div style="font-size:1.6rem;font-weight:900;color:${latestPct !== null ? pctColor(latestPct) : '#94a3b8'}">${latestPct !== null ? latestPct + '%' : '—'}</div>
      <div style="font-size:0.65rem;color:#64748b;margin-top:4px">آخر جلسة</div>
      ${avg !== null ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between">
        <div><div style="font-size:0.6rem;color:#94a3b8">متوسط</div><div style="font-size:0.8rem;font-weight:700;color:#475569">${avg}%</div></div>
        <div><div style="font-size:0.6rem;color:#94a3b8">أفضل</div><div style="font-size:0.8rem;font-weight:700;color:#475569">${best}%</div></div>
      </div>` : ''}
    </div>`;
  }).join('');

  // ── mini sparkline for each module ───────────────────────
  const sparklines = MODULE_ORDER.map(mod => {
    const vals = moduleAvgs[mod];
    if (vals.length < 2) return '';
    const W = 120, H = 40;
    const max = Math.max(...vals, 100);
    const points = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * (W - 4) + 2;
      const y = H - 2 - ((v / max) * (H - 8));
      return `${x},${y}`;
    }).join(' ');
    const col = MODULE_COLORS[mod];
    return `<div style="text-align:center">
      <div style="font-size:0.6rem;color:#94a3b8;margin-bottom:2px">${mod}</div>
      <svg width="${W}" height="${H}" style="display:block;margin:0 auto">
        <polyline points="${points}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${vals.map((v, i) => {
          const x = (i / (vals.length - 1)) * (W - 4) + 2;
          const y = H - 2 - ((v / max) * (H - 8));
          return `<circle cx="${x}" cy="${y}" r="3" fill="${col}"/>`;
        }).join('')}
      </svg>
    </div>`;
  }).join('');

  const hasSparklines = MODULE_ORDER.some(m => moduleAvgs[m].length >= 2);
  const overallLatest = latestSession && latestSession.summary.length
    ? Math.round(latestSession.summary.reduce((s, x) => s + x.pct, 0) / latestSession.summary.length)
    : null;

  return `
<div id="student-full-report" style="
  font-family: 'Cairo', 'Segoe UI', sans-serif;
  direction: rtl;
  text-align: right;
  background: #ffffff;
  color: #1a202c;
  padding: 32px;
  max-width: 800px;
  margin: 0;
  box-sizing: border-box;
">
  <!-- Header -->
  <div style="border-bottom:3px solid #3b82f6;padding-bottom:18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:0.7rem;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">منصة مسار · PEAK RFT Assessment</div>
      <div style="font-size:1.6rem;font-weight:900;color:#1e293b">${student.name}</div>
      <div style="display:flex;gap:16px;margin-top:8px;font-size:0.75rem;color:#475569;flex-wrap:wrap">
        ${student.school ? `<span>🏫 ${student.school}</span>` : ''}
        ${student.grade  ? `<span>📚 ${student.grade}</span>` : ''}
        ${age            ? `<span>🎂 ${age} سنة</span>` : ''}
        <span>📅 تاريخ التقرير: ${fmt(Date.now())}</span>
      </div>
    </div>
    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 20px">
      <div style="font-size:0.65rem;color:#94a3b8;margin-bottom:4px">الأداء الكلي</div>
      <div style="font-size:2.2rem;font-weight:900;color:${overallLatest !== null ? pctColor(overallLatest) : '#94a3b8'}">${overallLatest !== null ? overallLatest + '%' : '—'}</div>
      <div style="font-size:0.65rem;color:#64748b">${overallLatest !== null ? pctLabel(overallLatest) : ''}</div>
      <div style="margin-top:6px;font-size:0.65rem;color:#94a3b8">${sorted.length} جلسة</div>
    </div>
  </div>

  <!-- Module Cards -->
  <div style="margin-bottom:24px">
    <div style="font-size:0.85rem;font-weight:800;color:#1e293b;margin-bottom:12px">أداء الوحدات — آخر جلسة</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${moduleCards}</div>
  </div>

  ${hasSparklines ? `
  <!-- Trend Sparklines -->
  <div style="margin-bottom:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
    <div style="font-size:0.85rem;font-weight:800;color:#1e293b;margin-bottom:12px">مسار التقدم عبر الجلسات</div>
    <div style="display:flex;gap:16px;justify-content:space-around;flex-wrap:wrap">${sparklines}</div>
    <div style="margin-top:8px;font-size:0.65rem;color:#94a3b8;text-align:center">كل نقطة تمثل جلسة واحدة — من الأقدم (يمين) إلى الأحدث (يسار)</div>
  </div>` : ''}

  <!-- Sessions Table -->
  <div style="margin-bottom:24px">
    <div style="font-size:0.85rem;font-weight:800;color:#1e293b;margin-bottom:10px">سجل الجلسات (${sorted.length} جلسة)</div>
    <table style="width:100%;border-collapse:collapse;font-family:'Cairo',sans-serif">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px;font-size:0.72rem;color:#475569;font-weight:700;border-bottom:2px solid #cbd5e1">#</th>
          <th style="padding:8px;font-size:0.72rem;color:#475569;font-weight:700;border-bottom:2px solid #cbd5e1">التاريخ</th>
          ${MODULE_ORDER.map(m => `<th style="padding:8px;text-align:center;font-size:0.72rem;color:${MODULE_COLORS[m]};font-weight:700;border-bottom:2px solid #cbd5e1">${m}</th>`).join('')}
          <th style="padding:8px;text-align:center;font-size:0.72rem;color:#475569;font-weight:700;border-bottom:2px solid #cbd5e1">المتوسط</th>
          <th style="padding:8px;text-align:center;font-size:0.72rem;color:#475569;font-weight:700;border-bottom:2px solid #cbd5e1">Δ</th>
          <th style="padding:8px;font-size:0.72rem;color:#475569;font-weight:700;border-bottom:2px solid #cbd5e1">المدة</th>
        </tr>
      </thead>
      <tbody>${sessionRows}</tbody>
    </table>
  </div>

  ${student.notes ? `
  <!-- Student Notes -->
  <div style="margin-bottom:24px;background:#fffbeb;border:1px solid #f59e0b66;border-right:4px solid #f59e0b;border-radius:8px;padding:14px">
    <div style="font-size:0.78rem;font-weight:700;color:#92400e;margin-bottom:6px">📝 ملاحظات</div>
    <div style="font-size:0.8rem;color:#78350f;line-height:1.6">${student.notes}</div>
  </div>` : ''}

  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;font-size:0.65rem;color:#94a3b8">
    <span>منصة مسار — تقييم PEAK RFT</span>
    <span>أُنشئ بتاريخ ${fmt(Date.now())}</span>
  </div>
</div>`;
}

// ── Main export function ──────────────────────────────────────
export async function exportStudentFullReport(
  student: Student,
  sessions: AssessSession[],
): Promise<{ ok: boolean; error?: string }> {
  if (sessions.filter(s => !s.deletedAt).length === 0) {
    return { ok: false, error: 'لا توجد جلسات لهذا الطالب بعد' };
  }

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    // Build & mount hidden container
    const container = document.createElement('div');
    container.style.cssText = [
      'position:fixed',
      'top:-9999px',
      'left:-9999px',
      'width:842px',  // A4 at 96dpi
      'background:#ffffff',
      'z-index:-1',
    ].join(';');
    container.innerHTML = buildReportHTML(student, sessions);
    document.body.appendChild(container);

    // Load Cairo font if not already loaded
    const fontLink = document.getElementById('__cairo-font');
    if (!fontLink) {
      const link = document.createElement('link');
      link.id = '__cairo-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap';
      document.head.appendChild(link);
      await new Promise(r => setTimeout(r, 400));
    }

    await new Promise(r => setTimeout(r, 150));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const A4_W = 210, A4_H = 297, MARGIN = 8;
    const printW = A4_W - MARGIN * 2;
    const printH = A4_H - MARGIN * 2;
    const ratio  = canvas.width / canvas.height;
    const imgH_mm = printW / ratio;

    let srcY_mm = 0, remainingH = imgH_mm;
    let firstPage = true;
    while (remainingH > 0) {
      if (!firstPage) pdf.addPage();
      firstPage = false;
      const sliceH = Math.min(remainingH, printH);
      pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN - srcY_mm, printW, imgH_mm);
      pdf.setFillColor(255, 255, 255);
      if (srcY_mm > 0) pdf.rect(0, 0, A4_W, MARGIN, 'F');
      const bottom = MARGIN + sliceH;
      if (bottom < A4_H) pdf.rect(0, bottom, A4_W, A4_H - bottom, 'F');
      remainingH -= printH;
      srcY_mm    += printH;
    }

    const total = pdf.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`${p} / ${total}`, A4_W / 2, A4_H - 3, { align: 'center' });
    }

    const safeName = student.name.replace(/[^a-zA-Z؀-ۿ0-9]/g, '_');
    pdf.save(`تقرير_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[StudentFullReport]', msg);
    return { ok: false, error: msg };
  }
}
