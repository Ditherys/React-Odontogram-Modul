// Periodontal "Dental Chart" polish, Task 1: occlusal-to-occlusal arch
// orientation + browser-responsive sizing + tighter/bigger teeth. Structural
// tests only — visual correctness (arches face occlusal-to-occlusal, the
// diagram resizes with the window, the curve tracks the teeth with deep
// pockets toward the root) is a browser check, see task-1-report.md.
//
// Same sync-core-against-a-hand-built-cache technique as
// perio-graphic-toothrow.test.ts (readFileSync + DOMParser on the real SVG
// asset text) — no fetch(), the live odontogram tiles are never touched.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildArchGraphic,
  TOOTH_GAP,
  PERIO_DISPLAY_SCALE,
  type TemplateDocCache,
  type TemplateNo,
} from "../perioGraphic";

const testFileUrl = import.meta.url;
const svgText = (tplNo: TemplateNo) =>
  readFileSync(fileURLToPath(new URL(`../assets/teeth-svgs/${tplNo}.svg`, testFileUrl)), "utf8");

const TEMPLATE_NOS: readonly TemplateNo[] = [11, 13, 14, 16];

function buildCache(): TemplateDocCache {
  const cache: TemplateDocCache = new Map();
  for (const tplNo of TEMPLATE_NOS) {
    cache.set(tplNo, new DOMParser().parseFromString(svgText(tplNo), "image/svg+xml"));
  }
  return cache;
}

const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

describe("Task 1: occlusal-to-occlusal per-arch orientation", () => {
  const cache = buildCache();

  it("the UPPER arch's buccal row renders crown-DOWN (flipped about the CEJ baseline)", () => {
    const svg = buildArchGraphic(cache, UPPER_ARCH);
    const buccal = svg.querySelector(".perio-tooth-row-buccal")!;
    // matrix(1 0 0 -1 0 80) == scale(1,-1) about y = ROW_BASELINE_Y (40): the
    // buccal row flips crown-down while the CEJ baseline stays put, so the upper
    // arch's occlusal edges face the mid-line between the arches.
    expect(buccal.getAttribute("transform") || "").toMatch(/matrix\(1 0 0 -1 0 80\)/);
  });

  it("the LOWER arch's buccal row renders crown-UP (no orientation flip)", () => {
    const svg = buildArchGraphic(cache, LOWER_ARCH);
    const buccal = svg.querySelector(".perio-tooth-row-buccal")!;
    expect(buccal.getAttribute("transform")).toBeNull();
  });

  it("the two arches carry DIFFERENT buccal-row orientation transforms (arch-aware, not a uniform flip)", () => {
    const upper = buildArchGraphic(cache, UPPER_ARCH).querySelector(".perio-tooth-row-buccal")!;
    const lower = buildArchGraphic(cache, LOWER_ARCH).querySelector(".perio-tooth-row-buccal")!;
    expect(upper.getAttribute("transform")).not.toBe(lower.getAttribute("transform"));
  });

  it("the palatal row is the mirror of the SAME oriented buccal row (orientation preserved in the clone)", () => {
    // The upper palatal inner group keeps the crown-down orientation transform,
    // and the palatal container adds only the MIRROR_AXIS_Y reflection on top,
    // so the two rows stay locked together after the flip.
    const svg = buildArchGraphic(cache, UPPER_ARCH);
    const inner = svg.querySelector(".perio-tooth-row-palatal-inner")!;
    expect(inner.getAttribute("transform") || "").toMatch(/matrix\(1 0 0 -1 0 80\)/);
    const palatal = svg.querySelector(".perio-tooth-row-palatal")!;
    expect(palatal.getAttribute("transform") || "").toMatch(/matrix\(1 0 0 -1 0 200\)/);
  });
});

describe("Task 1: browser-responsive SVG (no pinned intrinsic size)", () => {
  const cache = buildCache();

  it("the arch <svg> sets NO fixed width/height (so CSS width:100% can scale it)", () => {
    const svg = buildArchGraphic(cache, UPPER_ARCH);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("height")).toBeNull();
  });

  it("keeps the viewBox + preserveAspectRatio so the aspect ratio is preserved when scaled", () => {
    const svg = buildArchGraphic(cache, UPPER_ARCH);
    expect(svg.getAttribute("viewBox")).toBeTruthy();
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMinYMid meet");
  });
});

describe("Task 1: tighter + bigger teeth", () => {
  it("TOOTH_GAP is tightened to 2 (denser row)", () => {
    expect(TOOTH_GAP).toBe(2);
  });

  it("PERIO_DISPLAY_SCALE bumps the per-unit display scale above 1 (bigger teeth)", () => {
    expect(PERIO_DISPLAY_SCALE).toBeGreaterThan(1);
  });
});
