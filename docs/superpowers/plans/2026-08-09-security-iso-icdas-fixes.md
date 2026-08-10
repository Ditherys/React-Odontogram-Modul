# Security, ISO 3950, ICDAS, and Persistence Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved design spec (`docs/superpowers/specs/2026-08-08-security-iso-icdas-fixes-design.md`): opt-in localStorage persistence, plugin-SVG XSS sanitization, CSP for the demo build, SNOMED dev-server hardening, npm audit fixes, ISO 3950 deciduous tooth codes in FHIR export, and ICDAS/CARS coding on FHIR caries components.

**Architecture:** All committed work happens in this worktree (`engine-odontogram-fixes`, branch `security-iso-icdas-fixes`). New modules (`src/persistence.ts`, `src/pluginSanitize.ts`, `src/fhir/iso3950.ts`) plug into existing seams (`onStateChange`, `applyPluginOverlays`, `registry/fhir.ts` emitter). FHIR-output changes intentionally alter `fhir-golden.json`; the SVG fingerprint golden must stay byte-identical.

**Tech Stack:** React 18 + TypeScript, Vite 7, Vitest 4 (jsdom), DOMPurify (new runtime dep), plain-Node `snomed/server.mjs`.

## Global Constraints

- Work ONLY in `/Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine-odontogram-fixes` — the main worktree (`…/engine`) must never be modified, with ONE exception: Task 6 edits `…/engine/snomed/server.mjs`, which is **gitignored** (`.gitignore: snomed/`) and therefore cannot exist on any branch; editing it changes no git state.
- `src/__tests__/parity/svg-fingerprints.json` must remain **byte-identical** in every task. Only `fhir-golden.json` / `roundtrip-golden.json` may change, and only in Tasks 4–5, with a diff review before commit.
- Payload version stays `"2.20"` — no payload shape change anywhere in this plan.
- Only ONE new runtime dependency is allowed: `dompurify` (bundled, NOT added to `vite.lib.config.ts` `rollupOptions.external`).
- Never run `npm audit fix --force`.
- The 3 failing `App.test.tsx` tests reported earlier belong to the MAIN worktree's uncommitted settings-tab reorganization. This worktree predates that change; its suite must be green from the baseline on. Do NOT touch `src/SettingsModal.tsx` or the settings test files here (merge-conflict surface with parallel work on main).
- Every `git` command in Tasks 1–5 and 7–9 runs inside the worktree. Commit at the end of every task.
- All user-facing strings in README/CHANGELOG in English first (source of truth).

---

### Task 1: localStorage persistence module

**Files:**
- Create: `src/persistence.ts`
- Create: `src/__tests__/persistence.test.ts`
- Modify: `src/App.tsx` (re-export block, near line 13 `export { startIntroTour } from "./tour";`)
- Modify: `src/__tests__/public-api-exports.test.ts` (add new names)
- Possibly modify: `src/__tests__/App.test.tsx` `vi.mock('../odontogram', …)` factory — only if `onStateChange` / `getStatusChart` / `importStatus` are missing from it

**Interfaces:**
- Consumes (from `src/odontogram.ts`): `onStateChange(cb: () => void): () => void` (line ~1015), `getStatusChart(): Any` (line ~5970, returns `{version:"2.20", globals, teeth, case?, plan?}` — a fresh object per call), `importStatus(data: Any)` (line ~8326, needs live DOM; wrap in try/catch).
- Produces: `enablePersistence(options?: PersistenceOptions): void`, `disablePersistence(): void`, `clearPersistedState(): void`, `isPersistenceEnabled(): boolean`, `export type PersistenceOptions`.

- [ ] **Step 1: Baseline** — Run `npm ci`, then `npm test` and `npm run lint`. Expected: all tests pass, lint 0 errors. If the baseline is red, STOP and report — do not proceed on a broken baseline.

- [ ] **Step 2: Write the failing test** — `src/__tests__/persistence.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const stateChangeCallbacks = new Set<() => void>();
const unsubscribeSpy = vi.fn();
const importStatusSpy = vi.fn();
let statusPayload: Record<string, unknown> = {};

vi.mock("../odontogram", () => ({
  onStateChange: vi.fn((cb: () => void) => {
    stateChangeCallbacks.add(cb);
    return () => { stateChangeCallbacks.delete(cb); unsubscribeSpy(); };
  }),
  getStatusChart: vi.fn(() => JSON.parse(JSON.stringify(statusPayload))),
  importStatus: importStatusSpy,
}));

import {
  enablePersistence, disablePersistence, clearPersistedState, isPersistenceEnabled,
} from "../persistence";

const KEY = "react-advanced-odontogram";
const fireStateChange = () => { for (const cb of stateChangeCallbacks) cb(); };

beforeEach(() => {
  disablePersistence();
  localStorage.clear();
  stateChangeCallbacks.clear();
  vi.clearAllMocks();
  statusPayload = { version: "2.20", globals: { edentulous: false }, teeth: { "11": { toothSelection: "implant" } } };
});

describe("persistence lifecycle", () => {
  it("is disabled by default", () => { expect(isPersistenceEnabled()).toBe(false); });

  it("saves a versioned wrapper on state change after enable", () => {
    enablePersistence();
    expect(isPersistenceEnabled()).toBe(true);
    fireStateChange();
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.version).toBe(1);
    expect(typeof stored.savedAt).toBe("string");
    expect(stored.payload).toEqual(statusPayload);
  });

  it("restores the saved payload via importStatus on enable", () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: "2026-08-09T00:00:00Z", payload: statusPayload }));
    enablePersistence();
    expect(importStatusSpy).toHaveBeenCalledWith(statusPayload);
  });

  it("does not restore and reports when the wrapper version is unknown", () => {
    const onError = vi.fn();
    localStorage.setItem(KEY, JSON.stringify({ version: 99, payload: {} }));
    enablePersistence({ onError });
    expect(importStatusSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it("reports corrupt JSON without throwing and continues working", () => {
    const onError = vi.fn();
    localStorage.setItem(KEY, "{not json");
    expect(() => enablePersistence({ onError })).not.toThrow();
    expect(onError).toHaveBeenCalled();
    fireStateChange(); // saving still works after a failed restore
    expect(JSON.parse(localStorage.getItem(KEY)!).version).toBe(1);
  });

  it("strips the plan chart unless includePlan is set", () => {
    statusPayload.plan = { "11": { toothSelection: "none" } };
    enablePersistence();
    fireStateChange();
    expect(JSON.parse(localStorage.getItem(KEY)!).payload.plan).toBeUndefined();
    disablePersistence();
    enablePersistence({ includePlan: true });
    fireStateChange();
    expect(JSON.parse(localStorage.getItem(KEY)!).payload.plan).toEqual(statusPayload.plan);
  });

  it("uses a custom key when provided", () => {
    enablePersistence({ key: "my-chart" });
    fireStateChange();
    expect(localStorage.getItem("my-chart")).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("skips oversized payloads and reports instead of throwing", () => {
    const onError = vi.fn();
    statusPayload.teeth = { "11": { note: "x".repeat(4 * 1024 * 1024 + 1) } };
    enablePersistence({ onError });
    fireStateChange();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it("disablePersistence unsubscribes and stops saving", () => {
    enablePersistence();
    disablePersistence();
    expect(isPersistenceEnabled()).toBe(false);
    expect(unsubscribeSpy).toHaveBeenCalled();
    fireStateChange();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("enable is idempotent — re-enabling replaces the old subscription", () => {
    enablePersistence();
    enablePersistence({ key: "second" });
    fireStateChange();
    expect(localStorage.getItem("second")).not.toBeNull();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("clearPersistedState removes the stored entry", () => {
    enablePersistence();
    fireStateChange();
    clearPersistedState();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails** — `npx vitest run src/__tests__/persistence.test.ts`. Expected: FAIL (cannot resolve `../persistence`).

- [ ] **Step 4: Implement `src/persistence.ts`:**

```ts
// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Opt-in localStorage persistence for the odontogram case state. Disabled by
// default; a host app explicitly calls enablePersistence() (after the
// odontogram has mounted — restore goes through importStatus(), which repaints
// the live DOM). Every localStorage/JSON failure is caught and routed to the
// optional onError callback (or console.warn) — this module never throws.

import { onStateChange, getStatusChart, importStatus } from "./odontogram";

export type PersistenceOptions = {
  /** localStorage key. Default: "react-advanced-odontogram". */
  key?: string;
  /** Persist the plan chart too (payload's `plan` field). Default: false. */
  includePlan?: boolean;
  /** Called on any storage/parse error instead of console.warn. */
  onError?: (err: Error) => void;
};

const DEFAULT_KEY = "react-advanced-odontogram";
const MAX_BYTES = 4 * 1024 * 1024;
const WRAPPER_VERSION = 1;

let unsubscribe: (() => void) | null = null;
let activeKey = DEFAULT_KEY;
let activeOptions: PersistenceOptions = {};

function reportError(err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const handler = activeOptions.onError;
  if (handler) {
    try { handler(e); } catch { /* an error handler must not take the app down */ }
  } else {
    console.warn("odontogram persistence:", e.message);
  }
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; } // SecurityError in locked-down iframes
}

function save(): void {
  const storage = getStorage();
  if (!storage) { reportError(new Error("localStorage is not available")); return; }
  try {
    const payload = getStatusChart();
    if (!activeOptions.includePlan && payload && typeof payload === "object") {
      delete (payload as Record<string, unknown>).plan;
    }
    const json = JSON.stringify({ version: WRAPPER_VERSION, savedAt: new Date().toISOString(), payload });
    if (json.length > MAX_BYTES) {
      reportError(new Error(`persisted payload exceeds ${MAX_BYTES} bytes — save skipped`));
      return;
    }
    storage.setItem(activeKey, json);
  } catch (err) { reportError(err); } // QuotaExceededError et al.
}

function restore(): void {
  const storage = getStorage();
  if (!storage) return;
  let raw: string | null = null;
  try { raw = storage.getItem(activeKey); } catch (err) { reportError(err); return; }
  if (raw === null) return;
  try {
    const wrapper = JSON.parse(raw) as { version?: unknown; payload?: unknown };
    if (!wrapper || typeof wrapper !== "object" || wrapper.version !== WRAPPER_VERSION || !wrapper.payload) {
      reportError(new Error("persisted state has an unrecognized wrapper format — ignored"));
      return;
    }
    importStatus(wrapper.payload);
  } catch (err) { reportError(err); }
}

/**
 * Turn on localStorage persistence: restores a previously saved case (if any),
 * then saves on every state change. Idempotent — calling again replaces the
 * previous subscription and options. Call AFTER the odontogram has mounted.
 */
export function enablePersistence(options: PersistenceOptions = {}): void {
  disablePersistence();
  activeOptions = options;
  activeKey = options.key ?? DEFAULT_KEY;
  restore();
  unsubscribe = onStateChange(save);
}

/** Stop persisting. The stored entry is left in place (see clearPersistedState). */
export function disablePersistence(): void {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

/** Remove the stored entry for the active (or default) key. */
export function clearPersistedState(): void {
  const storage = getStorage();
  if (!storage) return;
  try { storage.removeItem(activeKey); } catch (err) { reportError(err); }
}

/** True while a state-change subscription is active. */
export function isPersistenceEnabled(): boolean {
  return unsubscribe !== null;
}
```

- [ ] **Step 5: Run test to verify it passes** — `npx vitest run src/__tests__/persistence.test.ts`. Expected: PASS.

- [ ] **Step 6: Export from the public barrel** — in `src/App.tsx`, next to `export { startIntroTour } from "./tour";` add:

```ts
export {
  enablePersistence, disablePersistence, clearPersistedState, isPersistenceEnabled,
} from "./persistence";
export type { PersistenceOptions } from "./persistence";
```

Add the four function names to `src/__tests__/public-api-exports.test.ts` following its existing pattern (`typeof X === "function"` assertions on imports from `"../App"`).

- [ ] **Step 7: Run the App-level suites** — `npx vitest run src/__tests__/App.test.tsx src/__tests__/public-api-exports.test.ts`. If `App.test.tsx` fails with an undefined-export error, add the missing `onStateChange` / `getStatusChart` / `importStatus` stubs to its `vi.mock('../odontogram', …)` factory (most are already there). Expected: PASS.

- [ ] **Step 8: Full suite + commit**

```bash
npm test && npx tsc -b --noEmit
git add src/persistence.ts src/__tests__/persistence.test.ts src/App.tsx src/__tests__/public-api-exports.test.ts src/__tests__/App.test.tsx
git commit -m "feat(persistence): opt-in localStorage persistence API"
```

---

### Task 2: Plugin SVG sanitization (XSS fix)

**Files:**
- Create: `src/pluginSanitize.ts`
- Create: `src/__tests__/plugin-sanitize.test.ts`
- Modify: `src/odontogram.ts:2944-2969` (`applyPluginOverlays`, sink at `:2962` `g.innerHTML = svgContent;`)
- Modify: `package.json` (add `dompurify` to `dependencies`)

**Interfaces:**
- Produces: `sanitizePluginSvg(svgContent: string): string` — returns a sanitized SVG-fragment string ("" when nothing safe remains).
- Consumed by: `applyPluginOverlays` in `src/odontogram.ts` only.

- [ ] **Step 1: Add the dependency** — `npm install dompurify` (v3.x ships its own TypeScript types; only if `import DOMPurify from "dompurify"` later type-errors, also `npm install -D @types/dompurify`). Do NOT add `dompurify` to `vite.lib.config.ts` `rollupOptions.external` — it must be bundled so consumers get the protection without a new peer dep.

- [ ] **Step 2: Write the failing test** — `src/__tests__/plugin-sanitize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizePluginSvg } from "../pluginSanitize";

describe("sanitizePluginSvg", () => {
  it("passes benign SVG fragments through with attributes intact", () => {
    const out = sanitizePluginSvg('<circle cx="10" cy="10" r="4" fill="red" />');
    expect(out).toContain("<circle");
    expect(out).toContain('fill="red"');
  });

  it("strips <script> elements", () => {
    const out = sanitizePluginSvg('<circle r="4" /><script>window.pwned = true<' + '/script>');
    expect(out).not.toContain("script");
    expect(out).toContain("<circle");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizePluginSvg('<image href="x" onerror="window.pwned=true" />');
    expect(out).not.toContain("onerror");
  });

  it("strips foreignObject/iframe/object/embed vectors", () => {
    const out = sanitizePluginSvg('<foreignObject><iframe src="https://evil.example"></iframe></foreignObject><object data="x"></object><embed src="y" />');
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("foreignObject");
    expect(out).not.toContain("object");
    expect(out).not.toContain("embed");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizePluginSvg('<a href="javascript:window.pwned=true"><text>x</text></a>');
    expect(out).not.toContain("javascript:");
  });

  it("returns an empty string for wholly malicious input", () => {
    expect(sanitizePluginSvg("<script>1<" + "/script>")).toBe("");
  });
});
```

- [ ] **Step 3: Run test to verify it fails** — `npx vitest run src/__tests__/plugin-sanitize.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/pluginSanitize.ts`:**

```ts
// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Plugin renderSvg() output is third-party content injected into the live SVG
// via innerHTML — it MUST pass through DOMPurify first. SVG profile only;
// script-capable elements are forbidden outright (foreignObject added on top
// of the spec's list because it can smuggle arbitrary HTML into an SVG).

import DOMPurify from "dompurify";

const PLUGIN_SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "iframe", "object", "embed", "foreignObject"],
} as const;

/** Sanitize a plugin-supplied SVG fragment. Returns "" when nothing safe remains. */
export function sanitizePluginSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, PLUGIN_SVG_CONFIG);
}
```

- [ ] **Step 5: Run test to verify it passes** — `npx vitest run src/__tests__/plugin-sanitize.test.ts`. Expected: PASS.

- [ ] **Step 6: Wire into `applyPluginOverlays`** — in `src/odontogram.ts` add `import { sanitizePluginSvg } from "./pluginSanitize";` next to the existing `./plugin` import (line ~7), then change the sink (lines ~2958-2962):

```ts
      if(!svgContent) continue;

      // Security: plugin output is third-party content — sanitize before the
      // innerHTML sink. An entirely-malicious fragment sanitizes to "" and the
      // overlay is skipped rather than inserted empty.
      const cleanSvg = sanitizePluginSvg(svgContent);
      if(!cleanSvg) continue;

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("data-plugin", plugin.id);
      g.setAttribute("data-layer", plugin.layer);
      g.innerHTML = cleanSvg;
```

- [ ] **Step 7: Full suite (parity must stay byte-identical — no plugins are registered during capture, so `svg-fingerprints.json` must not change)** — `npm test && npx tsc -b --noEmit`. Expected: PASS, `git status` shows no change under `src/__tests__/parity/`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/pluginSanitize.ts src/__tests__/plugin-sanitize.test.ts src/odontogram.ts
git commit -m "fix(security): sanitize plugin renderSvg output with DOMPurify before innerHTML"
```

---

### Task 3: CSP meta tag for the demo build

**Files:**
- Modify: `vite.config.ts` (add a build-only `transformIndexHtml` plugin)

**Interfaces:**
- Produces: a `<meta http-equiv="Content-Security-Policy">` tag in `dist/index.html` (production demo build only). Dev server untouched — Vite/React-refresh inject inline scripts in dev, which `script-src 'self'` would break.

- [ ] **Step 1: Add the plugin** — in `vite.config.ts`:

```ts
// Spec policy plus three additive hardenings: `blob:` in img-src (the PNG/JPG
// export path rasterizes the SVG through a blob URL <img>), object-src 'none',
// and base-uri 'self'. Build-only: the dev server needs Vite's inline preamble.
const CSP_CONTENT =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; " +
  "object-src 'none'; base-uri 'self'";

function injectCsp() {
  return {
    name: "inject-csp",
    apply: "build" as const,
    transformIndexHtml() {
      return [{
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CSP_CONTENT },
        injectTo: "head-prepend" as const,
      }];
    },
  };
}
```

and add `injectCsp()` to the existing `plugins: [...]` array.

- [ ] **Step 2: Verify build output contains the tag**

```bash
npm run build && grep -c "Content-Security-Policy" dist/index.html
```

Expected: build succeeds, grep prints `1`.

- [ ] **Step 3: Verify dev server is NOT affected** — `grep -n "apply" vite.config.ts` shows `apply: "build"`; optionally start `npm run dev` briefly and confirm the page loads (Ctrl+C after).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat(security): inject CSP meta tag into the demo production build"
```

---

### Task 4: ISO 3950 deciduous tooth codes in FHIR export

**Files:**
- Create: `src/fhir/iso3950.ts`
- Create: `src/__tests__/iso3950-fhir.test.ts`
- Modify: `src/registry/fhir.ts` (per-tooth loop, line ~105; all `baseObservation(subjectRef, tooth, …)` call sites in that loop use the mapped code)
- Modify: `src/fhir/toFhirPerio.ts` (per-tooth bodySite — `bodySiteCC(tooth, …)` at :151-158 and the per-tooth Observation loop feeding it)
- Modify: `src/registry/fromFhir.ts:32` (inverse mapping on import)
- Possibly regenerate: `src/__tests__/parity/fhir-golden.json` (only if a parity payload case contains a milk tooth)

**Interfaces:**
- Produces: `fdiToDeciduous(fdi: string): string | null`, `deciduousToFdi(code: string): string | null`, `toothBodySiteCode(fdi: string, rec: { toothSelection?: string }): string`.
- Consumed by: `registry/fhir.ts`, `fhir/toFhirPerio.ts`, `registry/fromFhir.ts`.

- [ ] **Step 1: Write the failing test** — `src/__tests__/iso3950-fhir.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fdiToDeciduous, deciduousToFdi, toothBodySiteCode } from "../fhir/iso3950";
import { buildFhirBundle } from "../fhir/toFhir";
import { parseFhirBundle } from "../fhir/fromFhir";
import type { Observation } from "../fhir/types";

const payload = (teeth: Record<string, object>) =>
  ({ version: "2.20", globals: {}, teeth }) as never;

const toothObs = (bundle: { entry?: Array<{ resource?: unknown }> }): Observation[] =>
  (bundle.entry ?? [])
    .map((e) => e.resource as Observation)
    .filter((r) => r?.resourceType === "Observation" && r.bodySite);

describe("ISO 3950 deciduous mapping", () => {
  it("maps every anterior/premolar position and rejects molars", () => {
    const pairs: Array<[string, string]> = [];
    for (let q = 1; q <= 4; q++) for (let p = 1; p <= 5; p++) pairs.push([`${q}${p}`, `${q + 4}${p}`]);
    for (const [fdi, dec] of pairs) {
      expect(fdiToDeciduous(fdi)).toBe(dec);
      expect(deciduousToFdi(dec)).toBe(fdi);
    }
    for (const molar of ["16", "18", "27", "38", "46"]) expect(fdiToDeciduous(molar)).toBeNull();
    for (const bad of ["50", "56", "99", "11a", ""]) expect(deciduousToFdi(bad)).toBeNull();
  });

  it("toothBodySiteCode converts only milk teeth", () => {
    expect(toothBodySiteCode("11", { toothSelection: "milktooth" })).toBe("51");
    expect(toothBodySiteCode("11", { toothSelection: "tooth-base" })).toBe("11");
    expect(toothBodySiteCode("11", {})).toBe("11");
    expect(toothBodySiteCode("16", { toothSelection: "milktooth" })).toBe("16"); // no deciduous molar-3 equivalent
  });
});

describe("FHIR export/import of milk teeth", () => {
  it("emits the deciduous ISO 3950 bodySite code for a milk tooth", () => {
    const bundle = buildFhirBundle(payload({ "11": { toothSelection: "milktooth" } }));
    const obs = toothObs(bundle);
    expect(obs.length).toBeGreaterThan(0);
    expect(obs[0].bodySite?.coding?.[0].code).toBe("51");
    expect(obs[0].bodySite?.coding?.[0].system).toBe("urn:iso:std:iso:3950");
  });

  it("keeps the permanent code for permanent teeth and for milk-flagged molars", () => {
    const bundle = buildFhirBundle(payload({
      "21": { toothSelection: "implant" },
      "16": { toothSelection: "milktooth" },
    }));
    const codes = toothObs(bundle).map((o) => o.bodySite?.coding?.[0].code);
    expect(codes).toContain("21");
    expect(codes).toContain("16");
    expect(codes).not.toContain("51");
  });

  it("round-trips a milk tooth back to its internal FDI key", () => {
    const bundle = buildFhirBundle(payload({ "24": { toothSelection: "milktooth", caries: ["caries-occlusal"] } }));
    const parsed = parseFhirBundle(bundle) as { teeth: Record<string, { toothSelection?: string; caries?: string[] }> };
    expect(parsed.teeth["24"]).toBeDefined();
    expect(parsed.teeth["64"]).toBeUndefined();
    expect(parsed.teeth["24"].toothSelection).toBe("milktooth");
    expect(parsed.teeth["24"].caries).toEqual(["caries-occlusal"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/__tests__/iso3950-fhir.test.ts`. Expected: FAIL (module `../fhir/iso3950` not found).

- [ ] **Step 3: Implement `src/fhir/iso3950.ts`:**

```ts
// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// ISO 3950 deciduous (primary) tooth designation. The engine stores milk teeth
// on their PERMANENT FDI position (11-48) with `toothSelection: "milktooth"`;
// standards-correct interchange requires the deciduous range 51-85 on the
// FHIR bodySite. Only positions 1-5 per quadrant have deciduous equivalents —
// permanent-molar positions (6-8) never represent milk teeth and stay as-is.

const FDI_TO_DECIDUOUS: Record<string, string> = {};
const DECIDUOUS_TO_FDI: Record<string, string> = {};
for (let quadrant = 1; quadrant <= 4; quadrant++) {
  for (let position = 1; position <= 5; position++) {
    const fdi = `${quadrant}${position}`;
    const deciduous = `${quadrant + 4}${position}`;
    FDI_TO_DECIDUOUS[fdi] = deciduous;
    DECIDUOUS_TO_FDI[deciduous] = fdi;
  }
}

/** Permanent FDI (11-15, 21-25, 31-35, 41-45) → deciduous (51-55, 61-65, 71-75, 81-85); null otherwise. */
export function fdiToDeciduous(fdi: string): string | null {
  return FDI_TO_DECIDUOUS[fdi] ?? null;
}

/** Deciduous ISO 3950 code → the engine's permanent FDI storage key; null otherwise. */
export function deciduousToFdi(code: string): string | null {
  return DECIDUOUS_TO_FDI[code] ?? null;
}

/** The bodySite code to emit for a tooth record: deciduous when it is a milk tooth with an equivalent, else the FDI key. */
export function toothBodySiteCode(fdi: string, rec: { toothSelection?: string }): string {
  if (rec?.toothSelection !== "milktooth") return fdi;
  const deciduous = FDI_TO_DECIDUOUS[fdi];
  if (!deciduous) {
    console.warn(`odontogram FHIR export: tooth ${fdi} is flagged milktooth but has no ISO 3950 deciduous equivalent — exporting the permanent code`);
    return fdi;
  }
  return deciduous;
}
```

- [ ] **Step 4: Wire the export side** — in `src/registry/fhir.ts` import `toothBodySiteCode` from `"../fhir/iso3950"`, and in the per-tooth loop (line ~105):

```ts
  for (const [tooth, recRaw] of Object.entries(teeth)) {
    const rec = (recRaw && typeof recRaw === "object" ? recRaw : {}) as ToothRecord;
    const siteTooth = toothBodySiteCode(tooth, rec);
    for (const axis of AXES) for (const obs of emitForAxis(subjectRef, siteTooth, rec, axis)) entries.push({ resource: obs });
```

Then replace `tooth` with `siteTooth` in every remaining `baseObservation(subjectRef, tooth, …)` call inside this loop (radiographicDepth, fillingDefect, tooth-note, customStates blocks). `emitForAxis` uses its `tooth` parameter only for `baseObservation` bodySites, so passing `siteTooth` is safe.

- [ ] **Step 5: Wire the perio export side** — in `src/fhir/toFhirPerio.ts`, locate the per-tooth loops that call `bodySiteCC(tooth, …)` (helper at :151-158) and the per-tooth panel `Observation` builders; compute `const siteTooth = toothBodySiteCode(tooth, rec)` from the same tooth record and pass it to `bodySiteCC`/bodySite construction. (Perio data on milk teeth is rare but the bodySite must be consistent bundle-wide.) Import `toothBodySiteCode` from `"./iso3950"`.

- [ ] **Step 6: Wire the import side** — in `src/registry/fromFhir.ts` import `deciduousToFdi` from `"../fhir/iso3950"` and change line ~32:

```ts
      const rawToothCode = res.bodySite?.coding?.find((c) => typeof c.code === "string")?.code;
      const toothId = rawToothCode ? (deciduousToFdi(rawToothCode) ?? rawToothCode) : undefined;
```

- [ ] **Step 7: Run the new test + FHIR suites** — `npx vitest run src/__tests__/iso3950-fhir.test.ts src/__tests__/fhir.test.ts src/__tests__/fhir-import.test.ts src/registry/__tests__/`. Expected: PASS.

- [ ] **Step 8: Parity check** — `npx vitest run src/__tests__/parity.test.ts`.
  - If PASS: no parity payload case contains a milk tooth; goldens untouched. Continue.
  - If "FHIR bundles match" FAILS: a payload case does contain one — this output change is intentional. Regenerate: `npm run parity:capture`. Then verify the blast radius: `git diff --stat src/__tests__/parity/` MUST list only `fhir-golden.json` (and possibly `roundtrip-golden.json`); `svg-fingerprints.json` MUST be untouched. Inspect `git diff src/__tests__/parity/fhir-golden.json | head -80` — every hunk must be a bodySite code change 11-45 → 51-85 on a milktooth case. Re-run `npx vitest run src/__tests__/parity.test.ts` → PASS.

- [ ] **Step 9: Full suite + commit**

```bash
npm test && npx tsc -b --noEmit
git add src/fhir/iso3950.ts src/__tests__/iso3950-fhir.test.ts src/registry/fhir.ts src/fhir/toFhirPerio.ts src/registry/fromFhir.ts
git add src/__tests__/parity/ 2>/dev/null || true
git commit -m "feat(fhir): emit ISO 3950 deciduous codes (51-85) for milk teeth, with lossless import mapping"
```

---

### Task 5: ICDAS / CARS coding on FHIR caries components

**Files:**
- Modify: `src/fhir/codesystems.ts` (add `ICDAS_DISPLAYS` next to `ICDAS_SYSTEM` at :34-40)
- Modify: `src/registry/fhir.ts` (the `case "set":` severity block, lines ~34-55)
- Create: `src/__tests__/icdas-fhir.test.ts`
- Regenerate: `src/__tests__/parity/fhir-golden.json` (parity payload cases DO include caries with `cariesSeverity` — e.g. matrix.ts line ~270 — so this WILL change)

**Interfaces:**
- Consumes: `ICDAS_SYSTEM = "https://www.icdas.org"` (codesystems.ts:39, currently referenced nowhere), `LOCAL_SYSTEM` (already imported in registry/fhir.ts).
- Produces: each caries component with a numeric severity gains ONE extra `code.coding` entry — `{system: ICDAS_SYSTEM, code: "ICDAS-<n>", display: ICDAS_DISPLAYS[n]}` on an unfilled (primary) surface, `{system: LOCAL_SYSTEM, code: "cars-<n>", display: "CARS score <n>"}` on a filled (recurrent) surface. `valueInteger` unchanged. Import is unaffected (`localCode()` matches the FIRST `LOCAL_SYSTEM` coding, which remains the surface coding at index 0).

- [ ] **Step 1: Write the failing test** — `src/__tests__/icdas-fhir.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFhirBundle } from "../fhir/toFhir";
import { parseFhirBundle } from "../fhir/fromFhir";
import { ICDAS_SYSTEM, LOCAL_SYSTEM } from "../fhir/codesystems";
import type { Observation } from "../fhir/types";

const payload = (teeth: Record<string, object>) =>
  ({ version: "2.20", globals: {}, teeth }) as never;

function cariesComponents(bundle: { entry?: Array<{ resource?: unknown }> }) {
  const obs = (bundle.entry ?? [])
    .map((e) => e.resource as Observation)
    .find((r) => r?.resourceType === "Observation" &&
      r.code?.coding?.some((c) => c.system === LOCAL_SYSTEM && c.code === "caries"));
  return obs?.component ?? [];
}

describe("ICDAS/CARS coding on caries components", () => {
  it("adds an ICDAS coding on a primary (unfilled) surface with severity", () => {
    const bundle = buildFhirBundle(payload({
      "11": { toothSelection: "tooth-base", caries: ["caries-occlusal"], cariesSeverity: { occlusal: 4 } },
    }));
    const comps = cariesComponents(bundle);
    expect(comps).toHaveLength(1);
    expect(comps[0].valueInteger).toBe(4);
    const icdas = comps[0].code?.coding?.find((c) => c.system === ICDAS_SYSTEM);
    expect(icdas?.code).toBe("ICDAS-4");
    expect(icdas?.display).toMatch(/dark shadow/i);
  });

  it("adds a CARS coding instead on a recurrent (filled) surface", () => {
    const bundle = buildFhirBundle(payload({
      "11": {
        toothSelection: "tooth-base", caries: ["caries-occlusal"], cariesSeverity: { occlusal: 3 },
        fillingSurfaces: ["occlusal"], fillingSurfaceMaterials: { occlusal: "amalgam" },
      },
    }));
    const comps = cariesComponents(bundle);
    const cars = comps[0].code?.coding?.find((c) => c.code === "cars-3");
    expect(cars?.system).toBe(LOCAL_SYSTEM);
    expect(comps[0].code?.coding?.some((c) => c.system === ICDAS_SYSTEM)).toBe(false);
  });

  it("adds no scoring coding when the surface has no severity", () => {
    const bundle = buildFhirBundle(payload({
      "11": { toothSelection: "tooth-base", caries: ["caries-mesial"] },
    }));
    const comps = cariesComponents(bundle);
    expect(comps[0].valueBoolean).toBe(true);
    expect(comps[0].code?.coding?.some((c) => c.system === ICDAS_SYSTEM)).toBe(false);
  });

  it("does not disturb the round-trip (severity still imports intact)", () => {
    const bundle = buildFhirBundle(payload({
      "11": { toothSelection: "tooth-base", caries: ["caries-occlusal"], cariesSeverity: { occlusal: 5 } },
    }));
    const parsed = parseFhirBundle(bundle) as { teeth: Record<string, { cariesSeverity?: Record<string, number> }> };
    expect(parsed.teeth["11"].cariesSeverity).toEqual({ occlusal: 5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/__tests__/icdas-fhir.test.ts`. Expected: the two coding assertions FAIL (no ICDAS/CARS coding emitted yet); the no-severity and round-trip tests may already pass.

- [ ] **Step 3: Add `ICDAS_DISPLAYS`** to `src/fhir/codesystems.ts`, directly under `ICDAS_SYSTEM`:

```ts
/** Standard ICDAS II code descriptions, keyed by the 0-6 score. */
export const ICDAS_DISPLAYS: Record<number, string> = {
  0: "ICDAS 0 — Sound tooth surface",
  1: "ICDAS 1 — First visual change in enamel",
  2: "ICDAS 2 — Distinct visual change in enamel",
  3: "ICDAS 3 — Localized enamel breakdown",
  4: "ICDAS 4 — Underlying dark shadow from dentine",
  5: "ICDAS 5 — Distinct cavity with visible dentine",
  6: "ICDAS 6 — Extensive distinct cavity with visible dentine",
};
```

- [ ] **Step 4: Emit the coding** — in `src/registry/fhir.ts`, extend the imports (`import { LOCAL_SYSTEM, ICDAS_SYSTEM, ICDAS_DISPLAYS } from "../fhir/codesystems";`) and change the severity block inside `case "set":` (lines ~46-53):

```ts
      obs.component = arr.map((v) => {
        const comp: Any = { code: valueConcept(axis.valueGroup as string, v), valueBoolean: true };
        if (severity) {
          const surface = String(v).replace("caries-", "");
          const code = severity[surface];
          if (typeof code === "number") {
            comp.valueInteger = code; delete comp.valueBoolean;
            // The scoring-system coding rides on the component's code alongside
            // the surface coding: ICDAS on a primary (unfilled) surface, CARS on
            // a recurrent (filled) one — same predicate as the engine's own
            // primary-vs-recurrent render split. Import is unaffected: localCode()
            // matches the FIRST LOCAL_SYSTEM coding (the surface, index 0).
            const fsm = (rec as Record<string, unknown>).fillingSurfaceMaterials;
            const filled = !!fsm && typeof fsm === "object" && surface in (fsm as Record<string, unknown>);
            const scoring = filled
              ? { system: LOCAL_SYSTEM, code: `cars-${code}`, display: `CARS score ${code}` }
              : { system: ICDAS_SYSTEM, code: `ICDAS-${code}`, display: ICDAS_DISPLAYS[code] ?? `ICDAS ${code}` };
            comp.code = { ...comp.code, coding: [...(comp.code.coding ?? []), scoring] };
          }
        }
        return comp;
      });
```

CAUTION: on a filled surface the surface coding is index 0 and `cars-<n>` is appended after it — never prepend, or `localCode()`'s `find()` would still work but the fhir-golden diff would churn more than necessary.

- [ ] **Step 5: Run the new test + registry caries tests** — `npx vitest run src/__tests__/icdas-fhir.test.ts src/registry/__tests__/caries-fields.test.ts src/registry/__tests__/fhir-registry.test.ts src/registry/__tests__/fromfhir-registry.test.ts`. If `caries-fields.test.ts` asserts an exact `coding` array shape, update those assertions to expect the additional scoring coding. Expected: PASS.

- [ ] **Step 6: Regenerate the FHIR golden (intentional output change)** — `npx vitest run src/__tests__/parity.test.ts` (expect "FHIR bundles match" to FAIL — the matrix has caries+severity payload cases), then:

```bash
npm run parity:capture
git diff --stat src/__tests__/parity/
```

MUST list only `fhir-golden.json` (`roundtrip-golden.json` must be unchanged — the parse side ignores the extra coding; `svg-fingerprints.json` must be untouched). Inspect `git diff src/__tests__/parity/fhir-golden.json | head -60`: every hunk is an added ICDAS/CARS coding entry. Re-run `npx vitest run src/__tests__/parity.test.ts` → PASS.

- [ ] **Step 7: Full suite + commit**

```bash
npm test && npx tsc -b --noEmit
git add src/fhir/codesystems.ts src/registry/fhir.ts src/__tests__/icdas-fhir.test.ts src/registry/__tests__/ src/__tests__/parity/fhir-golden.json
git commit -m "feat(fhir): ICDAS/CARS scoring coding on caries components (ICDAS_SYSTEM wired into export)"
```

---

### Task 6: SNOMED dev-server hardening (main worktree, gitignored — NOT committed)

**Files:**
- Modify: `/Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine/snomed/server.mjs` (ABSOLUTE path — this file exists only in the main worktree and is gitignored; the edit produces no git change anywhere)

**Interfaces:** none consumed/produced by library code — standalone dev tool.

- [ ] **Step 1: Confirm the file is gitignored (safety check before touching the main worktree)**

```bash
cd /Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine && git check-ignore snomed/server.mjs && echo IGNORED
```

Expected: prints `snomed/server.mjs` and `IGNORED`. If NOT ignored, STOP — do not edit anything in the main worktree; report back instead.

- [ ] **Step 2: Apply the hardening.** Edit `snomed/server.mjs`:

(a) Extend the header comment (top of file):

```js
// DEVELOPMENT TOOL ONLY — do not deploy or expose this server publicly.
// It binds to 127.0.0.1, has no authentication, and proxies to tx.fhir.org.
```

(b) Add above the `createServer` call:

```js
// --- request hardening -------------------------------------------------------
const RATE_LIMIT = 30;              // requests
const RATE_WINDOW_MS = 60_000;      // per minute per IP
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB POST cap
const rateHits = new Map();         // ip -> timestamps[]
function rateLimited(ip) {
  const now = Date.now();
  const list = (rateHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  rateHits.set(ip, list);
  return list.length > RATE_LIMIT;
}
```

(c) At the top of the request handler (right after `const url = new URL(...)`):

```js
    const ip = req.socket.remoteAddress || "unknown";
    if (rateLimited(ip)) return send(res, 429, { error: "rate limit exceeded" });
```

(d) Replace the `/api/mapping` POST body read:

```js
      if (req.method === "POST") {
        let body = "", size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > MAX_BODY_BYTES) return send(res, 413, { error: "body too large (max 1 MB)" });
          body += c;
        }
        let parsed;
        try { parsed = JSON.parse(body); }
        catch { return send(res, 400, { error: "invalid JSON" }); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.entries)) {
          return send(res, 400, { error: "unexpected payload shape (expected { entries: [...] })" });
        }
        parsed.savedAt = new Date().toISOString();
        await writeFile(DATA, JSON.stringify(parsed, null, 2));
        return send(res, 200, { ok: true, savedAt: parsed.savedAt });
      }
```

(e) Validate `/api/lookup`'s `code` (SNOMED SCTIDs are 6-18 digit numbers):

```js
      const code = url.searchParams.get("code")?.trim();
      if (!code) return send(res, 400, { error: "code required" });
      if (!/^[0-9]{6,18}$/.test(code)) return send(res, 400, { error: "invalid code (expected 6-18 digits)" });
```

(f) Validate `/api/search`'s `q` (strip control chars, cap at 200):

```js
      let q = url.searchParams.get("q")?.trim();
      if (q) q = q.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
      if (!q) return send(res, 400, { error: "q required" });
```

(g) Bind to loopback only — change the listen call:

```js
server.listen(PORT, "127.0.0.1", () => {
```

- [ ] **Step 3: Verify syntax and behavior**

```bash
node --check /Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine/snomed/server.mjs
PORT=7999 node /Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine/snomed/server.mjs &
sleep 1
curl -s "http://127.0.0.1:7999/api/lookup?code=abc" | grep -c "invalid code"
curl -s -X POST -d '{bad json' "http://127.0.0.1:7999/api/mapping" | grep -c "invalid JSON"
kill %1
```

Expected: `--check` silent; both greps print `1`.

- [ ] **Step 4: Confirm the main worktree's git state is unchanged**

```bash
cd /Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine && git status --short | grep -c snomed
```

Expected: `0` (gitignored — nothing to commit anywhere; that is by design).

---

### Task 7: npm audit fixes (dev dependencies)

**Files:**
- Modify: `package-lock.json` (possibly `package.json` if safe minor/patch range bumps apply)

- [ ] **Step 1: Snapshot** — in the worktree: `npm audit 2>&1 | tail -5` (record the counts).

- [ ] **Step 2: Apply safe fixes only** — `npm audit fix` (NEVER `--force` — a forced vitest/vite major bump would destabilize the toolchain).

- [ ] **Step 3: Verify nothing broke** — `npm test && npm run lint && npm run build`. Expected: all green. If `npm audit fix` changed nothing (`git status` clean), skip the commit and record the remaining advisories for Task 8's CHANGELOG note.

- [ ] **Step 4: Record what remains** — `npm audit 2>&1 | tail -5`; save the before/after counts for the CHANGELOG entry ("Known remaining dev-dependency advisories: N — dev-only, not shipped").

- [ ] **Step 5: Commit (only if the lockfile changed)**

```bash
git add package.json package-lock.json
git commit -m "chore(security): npm audit fix for dev dependencies"
```

---

### Task 8: Documentation, CHANGELOG, version bump

**Files:**
- Modify: `CHANGELOG.md`, `package.json` (version `2.3.0` → `2.4.0`), `README.md` (English + Spanish sections, version badge)
- Modify: every `lang/README-*.md` present (mirror the new English sections, translated)

- [ ] **Step 1: CHANGELOG entry** (Keep a Changelog format, new `## [2.4.0]` section dated 2026-08-09):
  - Added: opt-in localStorage persistence API (`enablePersistence`/`disablePersistence`/`clearPersistedState`/`isPersistenceEnabled`); ISO 3950 deciduous bodySite codes (51-85) for milk teeth in FHIR export with lossless import; ICDAS/CARS scoring coding on FHIR caries components; CSP meta tag in the demo production build.
  - Security: plugin `renderSvg()` output is sanitized with DOMPurify before DOM insertion; SNOMED dev server hardened (loopback bind, input validation, body cap, rate limit — untracked dev tool, not part of the package); npm audit results (numbers from Task 7).
  - Note explicitly: FHIR golden fixture regenerated for the two intentional export changes; SVG render parity unchanged.

- [ ] **Step 2: Bump version** — `package.json` `"version": "2.4.0"`; update the README version badge(s).

- [ ] **Step 3: README.md (EN + ES)** — add:
  - a "State persistence (localStorage)" API section: the four functions + `PersistenceOptions` fields, the "call after mount" requirement, opt-in default, 4 MB guard, error callback;
  - a "Security notes" subsection: plugins run as trusted code but their SVG output is sanitized (DOMPurify) — still only load plugins from sources you trust; host apps should set their own CSP (quote the demo policy);
  - FHIR section updates: deciduous ISO 3950 codes for milk teeth; ICDAS/CARS coding on caries components.

- [ ] **Step 4: Translate into every `lang/README-*.md`** — `ls lang/README-*.md`; add the same sections translated per language (HU, DE, IT, SK, PL, RU, PT-BR, AR, ZH, FR — whatever files exist). Keep structure identical to the English source.

- [ ] **Step 5: Verify + commit**

```bash
npm test
git add CHANGELOG.md package.json README.md lang/
git commit -m "docs: v2.4.0 — persistence API, security notes, ISO 3950 + ICDAS FHIR docs"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full gates in the worktree**

```bash
npm test && npm run lint && npx tsc -b --noEmit && npm run build && npm run build:lib
```

Expected: tests all pass, lint 0 errors, both builds succeed.

- [ ] **Step 2: Parity invariants** — `git diff main --stat -- src/__tests__/parity/` shows at most `fhir-golden.json` (`svg-fingerprints.json` and `roundtrip-golden.json` unchanged vs `main`).

- [ ] **Step 3: Main worktree untouched** — `cd /Users/Zoli/Sites/DentalQuoteCreator/src/modules/odontogram/engine && git status --short` lists exactly the same 9 pre-existing dirty files (App.tsx, SettingsModal.tsx, 5 test files, translations.ts, index.css) and nothing else.

- [ ] **Step 4: Branch log sanity** — `git log --oneline main..security-iso-icdas-fixes` shows the spec commits plus one commit per task. Report the list; merging is the user's decision — do NOT merge.
