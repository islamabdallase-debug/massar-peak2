// ============================================================
//  PdfExportService — html2canvas + jsPDF  (Arabic-safe)
//  Captures #formal-report DOM node → A4 multi-page PDF
// ============================================================

let _exporting = false; // guard: one export at a time

// ── CSS var resolver ─────────────────────────────────────────
/**
 * html2canvas cannot evaluate CSS custom properties (var(--...)) at
 * capture time — it sees them as empty/transparent.
 *
 * Fix: before capture, inject a <style> tag that
 *  (a) reads every --var from :root's computed style and re-declares
 *      them with their actual computed values, AND
 *  (b) overlays known light-mode fallbacks for the formal-report scope
 *      so the PDF always captures a white-background document.
 *
 * @returns cleanup function — call after canvas is created
 */
function injectCssVarOverrides(targetId: string): () => void {
  const STYLE_ID = '__pdf-cssvar-fix';

  // Remove any stale leftover from a previous failed export
  document.getElementById(STYLE_ID)?.remove();

  // 1. Enumerate ALL --custom-props on :root
  const rootCS = getComputedStyle(document.documentElement);
  const rootDecls: string[] = [];
  for (let i = 0; i < rootCS.length; i++) {
    const prop = rootCS[i];
    if (prop.startsWith('--')) {
      const val = rootCS.getPropertyValue(prop).trim();
      if (val) rootDecls.push(`${prop}: ${val}`);
    }
  }

  // 2. Light-mode overrides that always look good on a white PDF
  //    (these override dark-theme values for the capture element only)
  const lightOverrides = [
    '--bg: #ffffff',
    '--surface: #f8fafc',
    '--surface2: #f1f5f9',
    '--border: #cbd5e1',
    '--text: #1a202c',
    '--text-muted: #475569',
    '--text-secondary: #64748b',
    '--blue: #3b82f6',
    '--blue-light: #eff6ff',
    '--green: #22c55e',
    '--red: #ef4444',
    '--amber: #f59e0b',
  ];

  // 3. Build the style rule:
  //    a) re-declare on :root so var() in <svg fill="var(--...)"> works
  //    b) also scope to the target element + its descendants
  const allDecls = [...rootDecls, ...lightOverrides].join(';\n    ');
  const css = `
    /* injected by PdfExportService — removed after capture */
    :root { ${allDecls} }
    #${targetId}, #${targetId} * { ${allDecls} }
  `;

  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = css;
  document.head.appendChild(tag);

  return () => { tag.remove(); };
}

export interface PdfExportOptions {
  /** id of the DOM element to capture (default: "formal-report") */
  elementId?: string;
  /** filename without extension (default: "تقرير_PEAK") */
  filename?: string;
  /** scale factor: 2 = retina quality (default: 2) */
  scale?: number;
}

export interface PdfExportResult {
  ok:    boolean;
  error?: string;
}

/**
 * Captures a fully-rendered DOM element and saves it as an A4 PDF.
 *
 * @example
 * const result = await exportToPdf({
 *   elementId: 'formal-report',
 *   filename:  `تقرير_${studentName}_2025-01-01`,
 * });
 *
 * Dependencies (install once):
 *   npm install jspdf html2canvas
 */
export async function exportToPdf(opts: PdfExportOptions = {}): Promise<PdfExportResult> {
  if (_exporting) return { ok: false, error: 'export already in progress' };
  _exporting = true;

  const {
    elementId = 'formal-report',
    filename  = 'تقرير_PEAK',
    scale     = 2,
  } = opts;

  try {
    // ── 1. Locate the target element ──────────────────────────
    const el = document.getElementById(elementId);
    if (!el) {
      return { ok: false, error: `Element #${elementId} not found in DOM` };
    }

    // ── 2. Wait for fonts and layout to stabilise ─────────────
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 250));

    // ── 3. Load libraries dynamically (tree-shaken in prod) ───
    const [jspdfMod, h2cMod] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { jsPDF }   = jspdfMod as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2canvas = (h2cMod as any).default ?? (h2cMod as any);

    // ── 3.5. Inject CSS var overrides so html2canvas sees resolved colors ──
    // html2canvas cannot compute var(--…) at capture time; this step
    // materialises all custom properties to concrete values temporarily.
    const removeCssOverride = injectCssVarOverrides(elementId);

    // Give the browser one frame to apply the injected styles
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ── 4. Render DOM element to canvas ───────────────────────
    // html2canvas v1.4 preserves SVG, colours, Arabic text as rendered
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(el, {
        scale,
        useCORS:         true,
        allowTaint:      true,
        logging:         false,
        backgroundColor: '#ffffff',
        // Force layout width so RTL columns don't wrap unexpectedly
        windowWidth:  Math.max(el.scrollWidth + 40, 860),
        windowHeight: Math.max(el.scrollHeight + 40, 1200),
      });
    } finally {
      // Always restore CSS regardless of success/failure
      removeCssOverride();
    }

    // ── 5. Compute page geometry (A4: 210 × 297 mm) ───────────
    const A4_W  = 210;  // mm
    const A4_H  = 297;  // mm
    const MARGIN = 10;  // mm on each side

    const printW  = A4_W  - MARGIN * 2;     // 190 mm usable width
    const printH  = A4_H  - MARGIN * 2;     // 277 mm usable height per page
    const imgH_mm = (canvas.height / canvas.width) * printW; // maintain aspect ratio

    // ── 6. Build PDF ──────────────────────────────────────────
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const imgData = canvas.toDataURL('image/jpeg', 0.93);

    let remainingH = imgH_mm;
    let srcY_mm    = 0;          // top of image slice to draw this page

    while (remainingH > 0) {
      // How much of the image fits on this page
      const sliceH = Math.min(remainingH, printH);

      // y offset: negative = we're scrolling down into the image
      pdf.addImage(
        imgData,
        'JPEG',
        MARGIN,
        MARGIN - srcY_mm,
        printW,
        imgH_mm,
      );

      // Clip to page so previous/next content doesn't bleed through
      // (white rectangles above and below the current slice)
      pdf.setFillColor(255, 255, 255);
      if (srcY_mm > 0) {
        pdf.rect(0, 0, A4_W, MARGIN, 'F');
      }
      const bottomEdge = MARGIN + sliceH;
      if (bottomEdge < A4_H) {
        pdf.rect(0, bottomEdge, A4_W, A4_H - bottomEdge, 'F');
      }

      remainingH -= printH;
      srcY_mm    += printH;

      if (remainingH > 0) {
        pdf.addPage();
      }
    }

    // ── 7. Add page numbers ───────────────────────────────────
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text(
        `${p} / ${totalPages}`,
        A4_W / 2,
        A4_H - 4,
        { align: 'center' },
      );
    }

    // ── 8. Save ───────────────────────────────────────────────
    pdf.save(`${filename}.pdf`);

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PdfExportService]', msg);
    return { ok: false, error: msg };
  } finally {
    _exporting = false;
  }
}
