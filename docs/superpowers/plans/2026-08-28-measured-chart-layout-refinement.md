# Measured Chart Layout Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the measured odontogram read as two continuous clinical arches with subtle interactive hit areas while preserving all existing anatomy, overlays, accessibility, and interaction behavior.

**Architecture:** Keep the existing measured two-arch DOM and implement the refinement with selectors gated by `.tooth-grid[data-anatomy="measured"]`. Add a CSS contract test first, then adjust only measured spacing, arch background, tile chrome, placeholder visibility, occlusal hierarchy, selection/focus, and dark-mode rules. Classic CSS and all renderer/SVG code remain unchanged.

**Tech Stack:** CSS, React/TypeScript DOM integration, Vitest/jsdom, Playwright browser QA, Vite production build.

**Approved design:** `docs/superpowers/specs/2026-08-28-measured-chart-layout-refinement-design.md`

## Global Constraints

- Apply the visual refinement only when `#toothGrid` has `data-anatomy="measured"`; classic anatomy must remain visually unchanged.
- Do not modify tooth SVGs, clinical overlay geometry, state, exports, FDI numbering, or public APIs.
- Preserve the existing listbox/option ARIA structure, `tabindex`, labels, click, keyboard, multi-select, note, touch, read-only, and bridge behavior.
- Keep rectangular layout/hit regions even when their default border and background are transparent.
- Keep side-view anatomy visually dominant; make occlusal rows secondary but fully legible on hover/selection.
- Keep non-applicable occlusal placeholders in grid flow but visually absent.
- Avoid tile shadows, persistent card borders, large rounded containers, and decorative effects.
- Preserve the existing untracked `.learnings/`, `.playwright-cli/`, and `output/` directories and the two line-ending-only parity working-tree entries.

---

### Task 1: Lock the measured-only visual contract

**Files:**
- Create: `src/__tests__/measured-chart-layout.test.ts`
- Read: `src/index.css`

**Interfaces:**
- Consumes: the existing `.tooth-grid[data-anatomy="measured"]`, `.tooth-arch`, `.tooth-tile`, `.occl-view`, `.placeholder`, `.active`, and `:focus-visible` selectors.
- Produces: a source-level CSS contract that fails until measured-specific layout rules exist and guards classic isolation.

- [ ] **Step 1: Write the failing CSS contract test**

```ts
// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../index.css", import.meta.url)),
  "utf8",
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  expect(match, `missing CSS rule: ${selector}`).toBeTruthy();
  return match![1];
}

describe("measured odontogram continuous-arch layout", () => {
  it("keeps classic tile chrome as the compatibility baseline", () => {
    expect(rule(".tooth-tile")).toMatch(/border:\s*1px solid var\(--line\)/);
    expect(rule(".tooth-tile")).toMatch(/border-radius:\s*14px/);
  });

  it("moves measured tooth spacing onto each anatomy-width arch grid", () => {
    expect(rule('.tooth-grid[data-anatomy="measured"]')).toContain("--measured-tooth-gap");
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-arch'))
      .toMatch(/gap:\s*var\(--measured-tooth-gap\)/);
    expect(rule('.tooth-grid[data-anatomy="measured"][data-screen-spacing="close"]'))
      .toContain("--measured-tooth-gap:0px");
    expect(rule('.tooth-grid[data-anatomy="measured"][data-screen-spacing="wide"]'))
      .toContain("--measured-tooth-gap:6px");
  });

  it("removes default card chrome only from measured tooth hit areas", () => {
    const measured = rule('.tooth-grid[data-anatomy="measured"] .tooth-tile');
    expect(measured).toMatch(/border-color:\s*transparent/);
    expect(measured).toMatch(/background:\s*transparent/);
    expect(measured).toMatch(/border-radius:\s*6px/);
  });

  it("keeps placeholders aligned but visually absent", () => {
    const placeholder = rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.placeholder');
    expect(placeholder).toMatch(/visibility:\s*hidden/);
    expect(placeholder).not.toMatch(/display:\s*none/);
  });

  it("keeps measured focus, selection, and occlusal hierarchy explicit", () => {
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.active'))
      .toContain("border-color:");
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile:focus-visible'))
      .toContain("outline:");
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view:not(.placeholder)'))
      .toMatch(/opacity:\s*\.72/);
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view.active'))
      .toMatch(/opacity:\s*1/);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest run src/__tests__/measured-chart-layout.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the measured spacing variable and measured-only tile, placeholder, focus, selection, and occlusal rules do not exist.

- [ ] **Step 3: Commit the failing contract test**

```powershell
git add src/__tests__/measured-chart-layout.test.ts
git commit -m "test: define measured chart layout contract"
```

---

### Task 2: Implement continuous measured arches

**Files:**
- Modify: `src/index.css:268-472`
- Test: `src/__tests__/measured-chart-layout.test.ts`

**Interfaces:**
- Consumes: `data-anatomy`, `data-screen-spacing`, measured `.tooth-arch` containers, and existing tile state classes.
- Produces: `--measured-tooth-gap` and measured-only visual rules without DOM or renderer changes.

- [ ] **Step 1: Move measured spacing into the arch grids**

Update the existing measured layout rules so the outer flex gap separates arches and the inner grid gap separates teeth:

```css
.tooth-grid[data-anatomy="measured"]{
  --measured-tooth-gap:2px;
  display:flex;
  flex-direction:column;
  gap:22px;
  padding:8px 4px;
}
.tooth-grid[data-anatomy="measured"] .tooth-arch{
  display:grid;
  justify-content:center;
  gap:var(--measured-tooth-gap);
  position:relative;
  isolation:isolate;
  padding:4px 2px;
}
.tooth-grid[data-anatomy="measured"][data-screen-spacing="close"]{
  --measured-tooth-gap:0px;
  gap:22px;
}
.tooth-grid[data-anatomy="measured"][data-screen-spacing="normal"]{
  --measured-tooth-gap:2px;
  gap:22px;
}
.tooth-grid[data-anatomy="measured"][data-screen-spacing="wide"]{
  --measured-tooth-gap:6px;
  gap:22px;
}
```

- [ ] **Step 2: Add one subtle arch-level wash**

Add a non-interactive, square-edged pseudo-element behind each measured arch:

```css
.tooth-grid[data-anatomy="measured"] .tooth-arch::before{
  content:"";
  position:absolute;
  inset:18px -4px 6px;
  z-index:-1;
  pointer-events:none;
  background:linear-gradient(
    90deg,
    transparent,
    rgba(148,163,184,.055) 7%,
    rgba(148,163,184,.055) 93%,
    transparent
  );
}
```

Do not add a border, radius, or shadow to `.tooth-arch`.

- [ ] **Step 3: Remove measured tile card chrome while retaining state affordances**

Add measured-only rules after the shared selection/focus rules so specificity and source order are deliberate:

```css
.tooth-grid[data-anatomy="measured"] .tooth-tile{
  border-color:transparent;
  border-radius:6px;
  background:transparent;
  padding:2px 1px;
}
.tooth-grid[data-anatomy="measured"] .tooth-tile::after{
  inset:-1px;
  border-radius:7px;
}
.tooth-grid[data-anatomy="measured"] .tooth-tile:not(.placeholder):hover{
  background:rgba(59,123,255,.055);
}
.tooth-grid[data-anatomy="measured"] .tooth-tile.active{
  border-color:rgba(var(--odon-select-rgb, 59,123,255),.55);
  background:rgba(var(--odon-select-rgb, 59,123,255),.045);
}
.tooth-grid[data-anatomy="measured"] .tooth-tile:focus-visible{
  outline:2px solid var(--accent);
  outline-offset:1px;
  box-shadow:0 0 0 3px rgba(59,123,255,.2);
  z-index:6;
}
```

- [ ] **Step 4: Make occlusal rows secondary and placeholders absent**

```css
.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view:not(.placeholder){
  min-height:68px;
  opacity:.72;
  transition:transform .05s ease, background .12s ease, opacity .12s ease;
}
.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view .tooth-svg{
  height:68px;
}
.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view .tooth-svg svg{
  width:56px;
  height:56px;
}
.tooth-grid[data-anatomy="measured"] .upper-arch .tooth-tile.occl-view{
  margin-top:8px;
}
.tooth-grid[data-anatomy="measured"] .lower-arch .tooth-tile.occl-view{
  margin-bottom:8px;
}
.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view:not(.placeholder):hover,
.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view.active{
  opacity:1;
}
.tooth-grid[data-anatomy="measured"] .tooth-tile.placeholder{
  visibility:hidden;
  pointer-events:none;
  border-color:transparent;
  background:transparent;
}
```

- [ ] **Step 5: Keep measured labels close to the dominant side views**

```css
.tooth-grid[data-anatomy="measured"] .upper-arch .tooth-label-cell{
  padding:0 0 2px;
}
.tooth-grid[data-anatomy="measured"] .lower-arch .tooth-label-cell{
  padding:2px 0 0;
}
```

- [ ] **Step 6: Add measured-specific dark-mode treatment**

Place these after the existing dark tile/selection rules:

```css
.dark .tooth-grid[data-anatomy="measured"] .tooth-arch::before{
  background:linear-gradient(
    90deg,
    transparent,
    rgba(148,163,184,.045) 7%,
    rgba(148,163,184,.045) 93%,
    transparent
  );
}
.dark .tooth-grid[data-anatomy="measured"] .tooth-tile{
  border-color:transparent;
  background:transparent;
}
.dark .tooth-grid[data-anatomy="measured"] .tooth-tile:not(.placeholder):hover{
  background:rgba(96,165,250,.09);
}
.dark .tooth-grid[data-anatomy="measured"] .tooth-tile.active{
  border-color:rgba(96,165,250,.55);
  background:rgba(96,165,250,.065);
}
```

- [ ] **Step 7: Run the contract test and verify GREEN**

Run:

```powershell
npx vitest run src/__tests__/measured-chart-layout.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 8: Run focused anatomy, selection, bridge, accessibility, and touch tests**

Run:

```powershell
npx vitest run src/__tests__/measured-anatomy.test.tsx src/__tests__/tooth-details-selection.test.tsx src/__tests__/bridgeOverlay.test.ts src/__tests__/a11y.test.ts src/__tests__/touch.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=60000
```

Expected: all tests pass without changing SVG fingerprints.

- [ ] **Step 9: Commit the measured CSS implementation**

```powershell
git add src/index.css
git commit -m "style: unify measured odontogram arches"
```

---

### Task 3: Verify DOM and interaction invariants

**Files:**
- Modify: `src/__tests__/measured-anatomy.test.tsx`
- Test: `src/__tests__/measured-anatomy.test.tsx`

**Interfaces:**
- Consumes: the real measured `buildGrid` output.
- Produces: regression coverage proving that visual absence does not remove placeholders from layout and that side tiles remain accessible options.

- [ ] **Step 1: Add assertions to the existing measured-grid test**

Extend `switching to measured rebuilds into a two-arch grid with tooth tiles`:

```ts
const side = upper!.querySelector('.tooth-tile.side-view[data-tooth="11"]') as HTMLElement;
expect(side.getAttribute("role")).toBe("option");
expect(side.getAttribute("tabindex")).toBe("0");
expect(side.getAttribute("aria-label")).toBeTruthy();

const placeholders = upper!.querySelectorAll(".tooth-tile.occl-view.placeholder");
expect(placeholders).toHaveLength(6);
for (const placeholder of placeholders) {
  expect(placeholder.hasAttribute("data-tooth")).toBe(false);
  expect(placeholder.hasAttribute("role")).toBe(false);
  expect(placeholder.hasAttribute("tabindex")).toBe(false);
}
```

These assertions document preserved behavior. The test remains coupled to the real engine rather than a mock.

- [ ] **Step 2: Run the real measured-grid test**

```powershell
npx vitest run src/__tests__/measured-anatomy.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=60000
```

Expected: PASS.

- [ ] **Step 3: Commit the invariant coverage**

```powershell
git add src/__tests__/measured-anatomy.test.tsx
git commit -m "test: preserve measured chart hit areas"
```

---

### Task 4: Browser visual and interaction QA

**Files:**
- Modify if needed: `src/index.css`
- Create as untracked QA artifacts only: `output/playwright/measured-chart-*.png`

**Interfaces:**
- Consumes: the running Vite app and real measured grid.
- Produces: visual evidence and any narrowly justified CSS tuning; no DOM, renderer, or SVG changes.

- [ ] **Step 1: Start the app and switch anatomy through Settings**

```powershell
npm run dev -- --host 127.0.0.1
```

Use Playwright to select Settings → Odontogram → Tooth anatomy → Measured. Do not call `setToothAnatomy` without `rebuildGrid`.

- [ ] **Step 2: Capture the default measured chart and classic control**

Capture full `#toothGrid` screenshots for:

- measured light, normal spacing;
- measured dark, normal spacing;
- classic light control.

Confirm classic still has its historical tile cards and measured does not.

- [ ] **Step 3: Verify interaction affordances**

Using real pointer/keyboard input:

- hover one anterior and one molar;
- Tab to a side tile and confirm a visible focus outline;
- select one tooth, then Ctrl-click a second and confirm both remain selected;
- confirm side and occlusal tiles for a selected posterior regain clear emphasis;
- verify tooth labels remain clickable;
- verify no bridge overlay intercepts pointer events.

- [ ] **Step 4: Verify spacing, placeholders, and vertical rhythm**

Capture close, normal, and wide measured spacing. Confirm the setting changes adjacent tooth gaps inside each arch while the upper/lower arch separation stays stable. Confirm anterior occlusal placeholders occupy alignment columns without visible boxes.

- [ ] **Step 5: Verify representative clinical content**

Render a posterior MOD restoration, implant crown, RCT crown, and three-unit bridge. Confirm the quieter layout does not obscure clinical states or disconnect bridge bars.

- [ ] **Step 6: Verify a narrow viewport**

Inspect at approximately 768 px and one coarse-pointer/mobile viewport. Confirm click/focus targets remain usable, the chart does not acquire card chrome, and arch toggle/pinch behavior still works.

- [ ] **Step 7: Add a failing regression test before any functional correction**

If QA reveals a functional bug, reproduce it in the narrowest relevant Vitest test and watch it fail before editing production code. Pure colour/spacing tuning may adjust measured CSS values directly, followed by the full focused test command.

- [ ] **Step 8: Commit any reviewed visual tuning**

```powershell
git add src/index.css src/__tests__
git commit -m "style: polish measured chart interaction states"
```

Skip this commit if QA required no tracked changes.

---

### Task 5: Full verification and handoff

**Files:**
- Verify: entire repository

**Interfaces:**
- Consumes: completed CSS and tests.
- Produces: a verified commit series with no anatomy/overlay fingerprint changes.

- [ ] **Step 1: Confirm scope and whitespace**

```powershell
git diff --check
git diff 911b881..HEAD -- src/odontogram.ts src/assets/teeth-svgs tools/toothgen
```

Expected: no whitespace errors and no anatomy, renderer, asset, or generator changes after the overlay commit.

- [ ] **Step 2: Run TypeScript and lint**

```powershell
npx tsc -b --pretty false
npm run lint
```

Expected: typecheck passes; lint has zero errors. Existing repository warnings may remain unchanged.

- [ ] **Step 3: Run the full test suite**

```powershell
npx vitest run --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all non-skipped tests pass, including the new measured layout contract.

- [ ] **Step 4: Run both production builds**

```powershell
npm run build
npm run build:lib
```

Expected: application and library builds pass, including declaration generation.

- [ ] **Step 5: Review repository state and final commits**

```powershell
git status --short
git log --oneline -5
```

Confirm only known untracked QA/tool artifacts and line-ending-only parity entries remain outside the implementation commits.
