// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

// UI-3b Task 6: `assemblePdf()` — pure section-gating assembler behind
// `exportPdf()`. Verified with an injectable fake jsPDF-like doc (see
// `PdfDocLike` in `../perioPdf`) rather than a real jsPDF instance, since
// jsPDF may not instantiate cleanly under jsdom — this suite asserts WHICH
// sections get added (headings/images/save), never pixel output.
import { describe, it, expect } from "vitest";
import { assemblePdf } from "../perioPdf";

function fakeDoc() {
  const calls: string[] = [];
  return {
    calls,
    text: (...a: any[]) => { calls.push("text:" + String(a[0]).slice(0,80)); return doc; },
    addImage: () => { calls.push("addImage"); return doc; },
    addPage: () => { calls.push("addPage"); return doc; },
    setFontSize: () => doc, setFont: () => doc, save: () => { calls.push("save"); },
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  } as any;
  var doc: any;
}

const baseData = {
  hasPerio: true,
  caseMeta: { patientName: "X", patientDob: "1980-05-05", examDate: "2026-01-01" } as any,
  odontogramPng: "data:image/png;base64,AAA", odontogramSummaryText: "Odonto summary",
  individualNotesText: "",
  perioPng: "data:image/png;base64,BBB", perioSummaryText: "Perio summary",
};

const ALL_ON = {
  patientData: true, odontogramChart: true, odontogramDescription: true,
  individualNotes: true, perioStatus: true, perioDescription: true,
};

describe("UI-3b T6 / 2.2.1: assemblePdf section gating", () => {
  it("includes perio when opts.perioStatus and data exist", () => {
    const doc = fakeDoc();
    assemblePdf(ALL_ON, baseData, () => doc);
    expect(doc.calls).toContain("addImage");            // both charts
    expect(doc.calls.filter((c:string)=>c==="addImage").length).toBe(2);
    expect(doc.calls).toContain("save");
  });

  it("auto-skips perio when hasPerio is false, even if opts ask for it", () => {
    const doc = fakeDoc();
    assemblePdf(ALL_ON, { ...baseData, hasPerio: false }, () => doc);
    expect(doc.calls.filter((c:string)=>c==="addImage").length).toBe(1); // odontogram only
  });

  it("omits the odontogram chart image when opts.odontogramChart is false", () => {
    const doc = fakeDoc();
    assemblePdf({ ...ALL_ON, odontogramChart: false }, baseData, () => doc);
    expect(doc.calls.filter((c:string)=>c==="addImage").length).toBe(1); // perio only
  });

  it("2.2.1: chart image and description are independently selectable", () => {
    // Description only (no chart image): the odontogram prose is added but no
    // odontogram image — so addImage counts perio only.
    const doc = fakeDoc();
    assemblePdf({ ...ALL_ON, odontogramChart: false, perioStatus: false, perioDescription: false },
      baseData, () => doc);
    expect(doc.calls.filter((c:string)=>c==="addImage").length).toBe(0);
    expect(doc.calls.some((c:string)=>c.startsWith("text:Odonto summary"))).toBe(true);
  });

  it("2.2.1: individual-notes section is added only when notes text is present", () => {
    const withNotes = fakeDoc();
    assemblePdf(ALL_ON, { ...baseData, individualNotesText: "18: watch this tooth" }, () => withNotes);
    expect(withNotes.calls.some((c:string)=>c.startsWith("text:18: watch this"))).toBe(true);

    // Empty notes text → no notes paragraph even when opts.individualNotes is on.
    const noNotes = fakeDoc();
    assemblePdf(ALL_ON, { ...baseData, individualNotesText: "" }, () => noNotes);
    expect(noNotes.calls.some((c:string)=>c.startsWith("text:18:"))).toBe(false);
  });

  it("2.2.1: patient DOB line is emitted in the header", () => {
    const doc = fakeDoc();
    assemblePdf(ALL_ON, baseData, () => doc);
    // The DOB value "1980-05-05" is rendered on its own header line.
    expect(doc.calls.some((c:string)=>c.includes("1980-05-05"))).toBe(true);
  });

  it("2.2.1: empty identity fields fall back to placeholder name/DOB", () => {
    const doc = fakeDoc();
    assemblePdf({ ...ALL_ON, perioStatus: false, perioDescription: false },
      { ...baseData, caseMeta: { patientName: null, patientDob: null, examDate: null } as any }, () => doc);
    expect(doc.calls.some((c:string)=>c.startsWith("text:") && c.includes("John Doe"))).toBe(true);
    expect(doc.calls.some((c:string)=>c.includes("1980-01-01"))).toBe(true);
  });
});
