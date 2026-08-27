# Clinical Overlay Registration Implementation Plan

> **Execution:** Use the executing-plans workflow in the current checkout. The user requested continuous audit, implementation, testing, and visual QA. Do not hand-edit generated measured SVGs.

**Goal:** Register every supported clinical overlay to class-specific measured anatomy while preserving the public clinical/state contract.

**Architecture:** Generator-derived geometry and metadata define anatomy anchors; renderer helpers define clinical semantics; live and exported views consume the same registered geometry.

**Tech stack:** Python 3 standard-library SVG tooling, TypeScript, React, Vitest/jsdom, Vite, Playwright CLI.

## Global constraints

- Work in the current checkout, as established by the preceding anatomy overhaul plan.
- Preserve user-owned untracked `.learnings/`, `.playwright-cli/`, and `output/` content.
- Preserve FDI numbering, state payloads, public exports, clinical IDs, accessibility, and classic assets.
- Add a failing focused test before each production fix.
- Regenerate `src/assets/teeth-svgs/measured/*.svg` only through `tools/toothgen/build.py`.
- Do not weaken tolerances to hide real containment or registration failures.

### Task 1: Lock the overlay contract into failing tests

**Files:**
- Create: `src/__tests__/clinical-overlay-registration.test.ts`
- Modify: `src/__tests__/bridgeOverlay.test.ts`
- Modify: `src/__tests__/perio-graphic-toothrow.test.ts`
- Create: `tools/toothgen/test_overlay_geometry.py`

- [ ] Add renderer tests for RCT/pulp suppression, RCT+post+crown, RCT bridge abutment, implant suppression, pontic suppression, missing-state cleanup, and plan/status geometry reuse.
- [ ] Add side/occlusal MO/DO/MOD and mirrored mesial/distal semantic tests.
- [ ] Add bridge tests requiring abutment connector activation and connector-anchored gap bars.
- [ ] Add periodontal tests requiring anatomy-derived CEJ/cervical site anchors.
- [ ] Add Python tests requiring registration metadata, canal/post containment and topology, crown/surface/caries registration, bounded connector tabs, and pontic-compatible required IDs.
- [ ] Run focused tests with one Vitest worker and confirm the intended failures.

### Task 2: Generate and verify anatomy registration metadata

**Files:**
- Modify: `tools/toothgen/build.py`
- Create: `tools/toothgen/overlays.py`
- Modify: `tools/toothgen/verify.py`
- Modify: `tools/toothgen/test_overlay_geometry.py`

- [ ] Derive template, root-count, CEJ, furcation, implant-platform, cervical-span, crown-span, and bridge-band metadata from the transformed geometry/specification.
- [ ] Regenerate proximal bridge connector tabs for every material from the actual crown envelope; keep paths within viewBox and intersecting the crown.
- [ ] Apply the same registration contract to permanent, primary, and occlusal outputs where relevant.
- [ ] Extend verification for canal/root-filling/post containment and correct root topology, distinguishing diagnostic decoration from lumen geometry.
- [ ] Extend verification for crown overlap, surface/caries valid regions, connector intersection/bounds, XML validity, duplicate IDs, and required clinical IDs.
- [ ] Build twice and compare hashes for deterministic output.

### Task 3: Correct clinical semantic activation and layer order

**Files:**
- Modify: `src/registry/restorations.ts`
- Modify: `src/registry/svgLayers.ts`
- Modify: `src/odontogram.ts`
- Test: `src/__tests__/clinical-overlay-registration.test.ts`
- Test: `src/registry/__tests__/restorations.test.ts`
- Test: `src/registry/__tests__/svg-layers.test.ts`

- [ ] Add a compatible restoration-composition helper that takes bridge membership/role without changing persisted state.
- [ ] Activate crown plus connector for bridge abutments, pontics, and bridge units; retain material/status separation.
- [ ] Suppress healthy/inflamed pulp whenever endodontic treatment is active, including primary teeth.
- [ ] Centralize clinical layer priorities and make exceptional promotions explicit.
- [ ] Verify stale overlays are cleared for missing, extraction, implant, retained-root, and tooth-template switches.
- [ ] Run focused renderer and registry tests.

### Task 4: Register bridge span bars to prosthetic geometry

**Files:**
- Modify: `src/bridgeOverlay.ts`
- Modify: `src/odontogram.ts`
- Modify: `src/__tests__/bridgeOverlay.test.ts`

- [ ] Extend tile geometry with optional active connector bounds while keeping existing function signatures compatible.
- [ ] Compute each gap bar from the two facing proximal connector bounds; scale thickness and corner radius to connector geometry.
- [ ] Retain checked fallback behavior for synthetic/legacy DOM without measurable connector paths.
- [ ] Use the same computation for live DOM and SVG/image export.
- [ ] Verify different tooth widths, both arches, mirroring, mixed abutment/pontic spans, and material selection.

### Task 5: Register periodontal graphics to template anchors

**Files:**
- Modify: `src/perioGraphic.ts`
- Modify: `src/PerioChart.tsx`
- Modify: `src/__tests__/perio-graphic-toothrow.test.ts`
- Modify: relevant periodontal tests

- [ ] Read generated CEJ/platform/cervical metadata for measured permanent and primary templates; retain classic fallbacks.
- [ ] Place three periodontal sites within the actual cervical/root span rather than whole-viewBox thirds.
- [ ] Apply mirrored clinical site semantics deliberately.
- [ ] Use implant platform anchors for peri-implant curves and indicators.
- [ ] Verify upper/lower molars, 14/24, primary molars, missing sites, and implant sites.

### Task 6: Complete cross-family and combined-state verification

**Files:**
- Modify: focused Vitest/Python tests as required by observed failures
- Modify: generated measured assets through the build only

- [ ] Verify crown geometry/material parity for anterior, premolar, and molar classes.
- [ ] Verify surface restoration and caries containment, recurrent caries alignment, root-caries cervical proximity, and side/occlusal consistency.
- [ ] Verify implant replacement and crown/fixture connection for anterior, premolar, and molar teeth.
- [ ] Verify missing/extracted/retained-root distinctions and fracture/wear placement.
- [ ] Verify realistic combinations and deliberate visibility: RCT+crown, RCT+post+crown, RCT+bridge, bridge+perio, implant+crown, filling+recurrent caries, crown+recurrent caries, caries+pulp diagnosis, fracture+RCT, and perio+restoration.
- [ ] Verify all mapped FDI teeth and representative primary teeth without duplicate IDs or viewBox clipping.

### Task 7: Regeneration, visual QA, and full release gate

**Files/artifacts:**
- Modify: `tools/toothgen/README.md`
- Modify: `src/__tests__/parity/svg-fingerprints.json` only for reviewed intentional changes
- Create: screenshots under `output/playwright/`

- [ ] Run `python tools/toothgen/build.py`, `verify.py`, and `check_roundtrip.py` (`uv` fallback documented because `uv` is unavailable).
- [ ] Run focused SVG/anatomy/renderer/periodontal/export tests, then the full Vitest suite with one worker, lint, TypeScript/build, and library build.
- [ ] Start Vite and inspect all requested endodontic, crown, bridge, restoration, implant, periodontal, missing, combined, mirrored, occlusal, and primary scenarios with Playwright CLI.
- [ ] Analyze screenshots at original resolution; fix observed defects and add regression coverage where practical.
- [ ] Review intentional SVG fingerprints, update only justified baselines, and rerun the complete gate.
- [ ] Report exact commands/results, audit findings, architecture changes, visual QA, and dentist-review limitations.
