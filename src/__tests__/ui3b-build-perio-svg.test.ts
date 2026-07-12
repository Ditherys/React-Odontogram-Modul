// UI-3b Task 4: `buildPerioSvg()` — the full perio chart (teeth graphic +
// numeric rows + 2017 classification) built headlessly, as ONE standalone
// vector SVG, from state (not the mounted `PerioChart` DOM).
//
// `buildPerioSvg()` awaits the SAME `loadTemplateCache()` `perioGraphic.ts`
// exports (memoized fetch+parse of the 4 tooth templates) that
// `PerioChart.tsx` itself awaits — jsdom has no real network, so this suite
// stubs `global.fetch` to serve the real on-disk SVG assets, the EXACT same
// seam `perio-graphic-rows.test.ts`/`ui1-dynamic-scale.test.ts` already use
// (keyed only by the trailing `NN.svg` filename, robust to however Vite
// rewrites the asset URL in the test env) — no new cache mechanism invented.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildPerioSvg } from "../perioExport";
import { __resetChartStateForTest, setPerioSite } from "../odontogram";
import { t } from "../i18n/useI18n";

const testFileUrl = import.meta.url;
function svgFor(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../assets/teeth-svgs/${name}`, testFileUrl)), "utf8");
}

beforeEach(() => {
  __resetChartStateForTest();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const m = String(url).match(/(\d+\.svg)(?:\?.*)?$/);
      if (!m) throw new Error(`unexpected fetch: ${String(url)}`);
      return { ok: true, status: 200, text: async () => svgFor(m[1]) } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-3b T4: buildPerioSvg", () => {
  // Runs FIRST, deliberately: `loadTemplateCache()` memoizes its promise at
  // MODULE scope (only a FAILED load resets it for a retry — see its own
  // doc comment in perioGraphic.ts) — once a later test in this file loads
  // the real templates successfully, that cache stays resolved for the rest
  // of the file, so a stubbed-failure assertion must run before any
  // successful load populates it.
  it("returns null gracefully when the tooth-template cache cannot be loaded", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, text: async () => "" }) as unknown as Response),
    );
    const built = await buildPerioSvg();
    expect(built).toBeNull();
  });

  it("returns a serialized SVG with positive dimensions", async () => {
    setPerioSite(11, "MB", { pd: 4 });
    const built = await buildPerioSvg();
    expect(built).not.toBeNull();
    expect(built!.xml.startsWith("<?xml") || built!.xml.includes("<svg")).toBe(true);
    expect(built!.width).toBeGreaterThan(0);
    expect(built!.height).toBeGreaterThan(0);
  });

  it("emits <text> for charted numeric values", async () => {
    // PD 7 is a DISTINCTIVE probe value: the mm-guide grid only ever labels
    // 5/10/15, and permanent tooth numbers containing 7 (17/27/37/47)
    // serialize as ">17<" etc. (never ">7<"), so a ">7<" text node can ONLY
    // come from the charted PD value actually rendering — guards against a
    // false-positive where a grid/tooth-number label coincidentally matches.
    setPerioSite(11, "MB", { pd: 7 });
    const built = await buildPerioSvg();
    expect(built!.xml).toContain("<text");
    expect(built!.xml).toContain(">7<"); // the charted PD value rendered as text
  });

  it("localizes the 2017-classification block labels + values (not raw enums)", async () => {
    const built = await buildPerioSvg();
    // Labels come through i18n, exactly like PerioSidebar's panel — the raw
    // English literal "Diagnosis:" and the raw enum value "health" must NOT leak.
    expect(built!.xml).toContain(t("perio.class.diagnosis"));
    expect(built!.xml).toContain(t("perio.class.dx.health")); // blank chart → healthy, localized
    expect(built!.xml).not.toContain(">Diagnosis: health<");
  });
});
