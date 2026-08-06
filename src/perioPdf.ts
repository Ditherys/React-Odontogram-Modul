// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// UI-3b Task 6: `exportPdf()` — jsPDF-native PDF report assembler (vector
// text via jsPDF `.text`/`.addImage`, raster tooth/perio charts, NO
// svg2pdf.js — jsPDF is already a dependency, this is its first use in the
// engine).
//
// Split for testability (per the task spec): this module holds the PURE
// `assemblePdf(opts, data, docFactory)` — no I/O, no SVG rasterization, no
// `fetch`/`Image`/`canvas` — it only decides which sections to add and
// drives a jsPDF-like `PdfDocLike` doc. `exportPdf()` (the impure half that
// gathers `data` via SVG→PNG rasterization + summary text +
// `hasAnyPerioData()`, drives the export-progress overlay, and calls
// `assemblePdf`) lives in `odontogram.ts` alongside `exportImage`/
// `exportPerioImage`, which it now shares a `rasterizeSvgToPng` raster
// helper with (DRY — see odontogram.ts).
//
// jsPDF-in-jsdom note: constructing a REAL `jsPDF` instance touches browser
// canvas/font internals jsdom doesn't fully provide, so `assemblePdf` is
// unit-tested exclusively via an injected fake `PdfDocLike` (see
// `src/__tests__/ui3b-export-pdf.test.ts`) — never a real `new jsPDF()`.
// `exportPdf()`'s real-jsPDF path is a controller/browser-verify item.

// jsPDF is NOT imported statically — it is lazy-loaded via a dynamic
// `import("jspdf")` in `exportPdf()` (see odontogram.ts) so consumers who never
// export a PDF don't pull jspdf (and its html2canvas/dompurify deps) into their
// bundle. `assemblePdf` receives a jsPDF-backed `docFactory` from its caller
// (or an injected fake, in tests) — it never references jsPDF itself.
import { t } from "./i18n/useI18n";

/** UI-3b Task 6/7: which PDF sections the user opted into. The perio
 *  sections are additionally auto-skipped whenever `data.hasPerio` is false
 *  (see {@link assemblePdf}), regardless of these flags — a blank perio
 *  chart never gets an empty "Periodontal status" page. */
export interface PdfExportOptions {
  patientData: boolean;
  /** 2.2.1: the odontogram chart IMAGE. Split out of the former combined
   *  `odontogram` flag so the chart and its prose description are independently
   *  selectable in the export dialog. */
  odontogramChart: boolean;
  /** 2.2.1: the whole-mouth odontogram summary PROSE (was bundled with the
   *  chart image under the old `odontogram` flag). */
  odontogramDescription: boolean;
  /** 2.2.1: the per-tooth "Individual notes" section — omitted whenever no
   *  tooth carries a note (`data.individualNotesText` empty), regardless of
   *  this flag. */
  individualNotes: boolean;
  perioStatus: boolean;
  perioDescription: boolean;
}

/** Minimal case-identity shape the PDF header needs (patient name + exam
 *  date). Deliberately a LOCAL structural type rather than importing
 *  odontogram.ts's `CaseMeta` — `getCaseMeta()`'s return value satisfies it
 *  structurally, and keeping this module free of any `odontogram.ts` import
 *  avoids a circular dependency (odontogram.ts is the one importing FROM
 *  perioPdf.ts). */
export interface PdfCaseIdentity {
  patientName: string | null;
  /** 2.2.1: patient date of birth (ISO `YYYY-MM-DD`), shown 2nd in the header. */
  patientDob: string | null;
  examDate: string | null;
}

/** Pixel dimensions of a rasterized chart, used to keep the embedded PDF
 *  image's aspect ratio correct. Optional — `assemblePdf` falls back to a
 *  reasonable default aspect ratio when omitted (e.g. in the unit test's
 *  minimal fixture). */
export interface PdfImageSize {
  width: number;
  height: number;
}

/** Pre-rendered input for {@link assemblePdf} — every PNG/text value is
 *  already computed by `exportPdf()` before this is built; `assemblePdf`
 *  itself performs no I/O. */
export interface PdfAssembleData {
  /** `hasAnyPerioData()` — when false, BOTH perio sections are omitted no
   *  matter what `opts.perioStatus`/`opts.perioDescription` ask for. */
  hasPerio: boolean;
  caseMeta: PdfCaseIdentity;
  odontogramPng: string;
  odontogramSummaryText: string;
  /** 2.2.1: pre-flattened per-tooth notes ("<tooth>: <note>" lines, one per
   *  line). Empty string when no tooth has a note — the notes section is then
   *  omitted no matter what `opts.individualNotes` asks for. */
  individualNotesText: string;
  odontogramImageSize?: PdfImageSize;
  perioPng: string;
  perioSummaryText: string;
  perioImageSize?: PdfImageSize;
}

/** The minimal jsPDF surface `assemblePdf` drives — lets tests inject a
 *  lightweight fake without constructing a real `jsPDF` (see the jsdom note
 *  above). A real `jsPDF` instance satisfies this structurally. */
export interface PdfDocLike {
  text: (text: string, x: number, y: number, options?: any) => PdfDocLike;
  addImage: (imageData: string, format: string, x: number, y: number, width: number, height: number) => PdfDocLike;
  addPage: (...args: any[]) => PdfDocLike;
  setFontSize: (size: number) => PdfDocLike;
  setFont: (fontName: string, fontStyle?: string) => PdfDocLike;
  save: (filename?: string) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}

const MARGIN_MM = 15;
const LINE_HEIGHT_MM = 6;
/** Rough default aspect ratio (height/width) for a chart image when the
 *  caller didn't supply real pixel dimensions (e.g. the unit test's minimal
 *  fixture) — the odontogram/perio charts are both wider than tall. */
const DEFAULT_IMAGE_ASPECT = 0.55;

/** Greedy plain-text word-wrap to a fixed character budget per line. No
 *  dependency on jsPDF's own `splitTextToSize` (which the fake test doc
 *  doesn't implement, and which needs a real font metrics table) — an
 *  approximate char-count wrap is more than sufficient for a report's prose
 *  paragraphs. */
function wrapPlainText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if(words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for(const word of words){
    const candidate = current ? `${current} ${word}` : word;
    if(candidate.length > maxCharsPerLine && current){
      lines.push(current);
      current = word;
    }else{
      current = candidate;
    }
  }
  if(current) lines.push(current);
  return lines;
}

function pdfStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** Today as ISO `YYYY-MM-DD` — the exam-date fallback when the case has none
 *  (the export dialog pre-fills today, so this is belt-and-suspenders for a
 *  programmatic caller that left examDate null). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Assemble the PDF report from pre-rendered `data`, gated by `opts`. PURE —
 * no I/O, no rasterization; `docFactory` defaults to a real `new jsPDF()`
 * but tests always inject a fake (see the jsdom note above).
 *
 * Section order: (1) header (patient name + DOB + exam date, with
 * placeholder fallbacks) when `opts.patientData`; (2) odontogram — chart image
 * (`opts.odontogramChart`) and/or summary prose (`opts.odontogramDescription`),
 * independently selectable under one heading; (3) per-tooth notes when
 * `opts.individualNotes` AND `data.individualNotesText` is non-empty; (4) perio
 * chart image when `data.hasPerio && opts.perioStatus`; (5) perio
 * summary/classification text + the explanatory abbreviation-legend footer when
 * `data.hasPerio && opts.perioDescription` — the footer is tied to `perioDescription`
 * (mirrors the export dialog's "Perio description + footer" grouping) not
 * to "any perio section shown", so enabling only the perio graphic
 * (`perioStatus`) without the description never prints a legend for text
 * that isn't there.
 */
export function assemblePdf(
  opts: PdfExportOptions,
  data: PdfAssembleData,
  docFactory: () => PdfDocLike = () => {
    throw new Error("assemblePdf: a docFactory is required — jsPDF is lazy-loaded by exportPdf()");
  },
): PdfDocLike {
  const doc = docFactory();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_MM * 2;
  let y = MARGIN_MM;

  const ensureSpace = (neededMm: number) => {
    if(y + neededMm > pageHeight - MARGIN_MM){
      doc.addPage();
      y = MARGIN_MM;
    }
  };

  const heading = (text: string) => {
    ensureSpace(LINE_HEIGHT_MM * 2);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(text, MARGIN_MM, y);
    y += LINE_HEIGHT_MM * 1.6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  };

  const paragraph = (text: string) => {
    if(!text) return;
    const maxChars = Math.max(20, Math.floor(contentWidth / 1.7));
    for(const raw of text.split("\n")){
      const lines = raw.trim() === "" ? [""] : wrapPlainText(raw, maxChars);
      for(const line of lines){
        ensureSpace(LINE_HEIGHT_MM);
        doc.text(line, MARGIN_MM, y);
        y += LINE_HEIGHT_MM;
      }
    }
    y += LINE_HEIGHT_MM * 0.5;
  };

  const image = (png: string, size?: PdfImageSize) => {
    if(!png) return;
    const aspect = size && size.width > 0 ? size.height / size.width : DEFAULT_IMAGE_ASPECT;
    const imgWidth = contentWidth;
    const maxImgHeight = pageHeight - MARGIN_MM * 2;
    const imgHeight = Math.min(maxImgHeight, imgWidth * aspect);
    ensureSpace(imgHeight);
    doc.addImage(png, "PNG", MARGIN_MM, y, imgWidth, imgHeight);
    y += imgHeight + LINE_HEIGHT_MM;
  };

  if(opts.patientData){
    heading(t("pdf.section.patientData"));
    // 2.2.1: export must succeed even with empty identity fields — fall back to
    // placeholder name/DOB (and today's date) rather than a "not specified"
    // note, so the report always reads like a complete document.
    const name = data.caseMeta.patientName ?? "John Doe";
    const dob = data.caseMeta.patientDob ?? "1980-01-01";
    const examDate = data.caseMeta.examDate ?? todayIso();
    paragraph(`${t("pdf.field.patientName")}: ${name}`);
    paragraph(`${t("pdf.field.patientDob")}: ${dob}`);
    paragraph(`${t("pdf.field.examDate")}: ${examDate}`);
  }

  // 2.2.1: the odontogram chart image and its prose summary are now
  // independently selectable; a single "Dental chart" heading covers whichever
  // of the two is requested.
  if(opts.odontogramChart || opts.odontogramDescription){
    heading(t("pdf.section.odontogram"));
    if(opts.odontogramChart) image(data.odontogramPng, data.odontogramImageSize);
    if(opts.odontogramDescription) paragraph(data.odontogramSummaryText);
  }

  // 2.2.1: per-tooth individual notes — omitted when no tooth carries a note.
  if(opts.individualNotes && data.individualNotesText){
    heading(t("toothInfo.notes"));
    paragraph(data.individualNotesText);
  }

  if(data.hasPerio && opts.perioStatus){
    heading(t("pdf.section.perioStatus"));
    image(data.perioPng, data.perioImageSize);
  }

  if(data.hasPerio && opts.perioDescription){
    heading(t("pdf.section.perioDescription"));
    paragraph(data.perioSummaryText);
    heading(t("pdf.footer.title"));
    paragraph(t("pdf.footer.legend"));
  }

  doc.save(`odontogram-report-${pdfStamp()}.pdf`);
  return doc;
}
