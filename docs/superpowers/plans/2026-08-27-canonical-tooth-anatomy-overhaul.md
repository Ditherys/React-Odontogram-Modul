# Canonical Tooth Anatomy Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broad shared measured-tooth groups with explicit, reproducible permanent, primary, and occlusal anatomy classes while preserving every clinical SVG/state contract.

**Architecture:** `spec.py` is the explicit FDI-to-class source of truth. Canonical SVG donors are transformed at generator level into class assets; the renderer chooses permanent or primary assets and mirrors contralateral teeth without changing saved-state semantics.

**Tech Stack:** Python 3 standard library SVG generator, React/TypeScript, Vitest/jsdom, Vite, Playwright CLI.

## Global Constraints

- Work in the current checkout; do not create a branch or worktree.
- Do not hand-edit generated `src/assets/teeth-svgs/measured/*.svg` files.
- Preserve clinical IDs and saved FDI/state semantics.
- Keep classic assets and unrelated UI/business behavior unchanged.
- Apply TDD: observe each new invariant fail before implementation.

---

### Task 1: Generator output contract and anatomy mapping

**Files:**
- Modify: `tools/toothgen/spec.py`
- Modify: `tools/toothgen/build.py`
- Modify: `tools/toothgen/verify.py`
- Create: `tools/toothgen/test_anatomy.py`

**Interfaces:**
- Produces: `PERMANENT_SPECS`, `PRIMARY_SPECS`, `tooth_to_template(primary=False)`, and generated asset directory constants.

- [ ] Write unit tests that assert the 16 permanent and 10 primary canonical keys, complete FDI coverage, root counts, premolar decisions, molar decisions, and default generated-output path.
- [ ] Run `python -m unittest tools.toothgen.test_anatomy -v`; confirm failures identify the nine-class mapping and legacy output default.
- [ ] Expand `ToothSpec` with explicit arch/family/sequence and class morphology fields; replace broad assignments with canonical classes.
- [ ] Point build/verify defaults at `src/assets/teeth-svgs/measured` while keeping canonical source/legacy paths separate.
- [ ] Re-run the unit tests and `python tools/toothgen/spec.py`.

### Task 2: Class-specific side anatomy generation

**Files:**
- Modify: `tools/toothgen/build.py`
- Modify: `tools/toothgen/roots.py`
- Modify: `tools/toothgen/graft.py`
- Test: `tools/toothgen/test_anatomy.py`

**Interfaces:**
- Produces: one generated side asset for each permanent and primary class, all with stable clinical IDs.

- [ ] Add failing tests for canine length/width ordering, incisor width ordering, premolar topology, molar topology/divergence ordering, primary pulp/root spread, continuous contours, and lumen containment.
- [ ] Implement smooth class crown/root coordinate maps composed with the existing CEJ warp and applied through `rewrite_svg` to every layer.
- [ ] Keep 14 as a close two-root buccal projection; generate 15/34/35 as distinct continuous single-root classes.
- [ ] Generate maxillary molars 16/17/18 with three roots and mandibular 36/37/38 with two roots, varying divergence and crown form by sequence.
- [ ] Generate primary 51/52/53/54/55/71/72/73/74/75 with primary pulp and root-spread transforms.
- [ ] Run focused Python tests and the generator twice; compare output hashes for determinism.

### Task 3: Class-specific occlusal anatomy

**Files:**
- Modify: `tools/toothgen/occlusal.py`
- Modify: `tools/toothgen/verify.py`
- Test: `tools/toothgen/test_anatomy.py`

**Interfaces:**
- Produces: permanent occlusal keys `14,15,34,35,16,17,18,36,37,38` and primary keys `54,55,74,75`.

- [ ] Add failing tests for complete posterior FDI mapping, per-class outline ratios, class distinction, required clinical IDs, and surface registration.
- [ ] Expand `OcclSpec` and generate each permanent/primary posterior class with restrained outline/groove/cusp transforms.
- [ ] Preserve mesial/distal/buccal/lingual/occlusal surface IDs and filling continuity.
- [ ] Run focused tests and `verify.py` occlusal checks.

### Task 4: Runtime permanent/primary template selection

**Files:**
- Modify: `src/odontogram.ts`
- Modify: `src/perioGraphic.ts`
- Modify: `src/index.css`
- Modify: `src/__tests__/anatomy-profile.test.ts`
- Modify: `src/__tests__/measured-anatomy.test.tsx`

**Interfaces:**
- Produces: explicit profile maps for permanent side/occlusal and primary side/occlusal assets; preserves `toothSelection: "milktooth"`.

- [ ] Add failing Vitest cases for the 16-class map, left/right mirroring, molar mapping, primary asset choice, clinical layer activation after switching, and stable FDI/state serialization.
- [ ] Import and register all generated assets and replace handwritten mapping duplication with explicit exported map construction.
- [ ] Cache both dentitions; swap the SVG clone when selection crosses permanent/primary without replacing the tile/event/accessibility node.
- [ ] Derive CEJ/implant anchors from generated metadata or checked constants for every class.
- [ ] Update measured column widths and template CSS selectors from class specifications.
- [ ] Run focused renderer, accessibility, periodontal, bridge, implant, restoration, and export tests.

### Task 5: Verification, fingerprints, and documentation

**Files:**
- Modify: `tools/toothgen/verify.py`
- Modify: `tools/toothgen/check_roundtrip.py`
- Modify: `tools/toothgen/README.md`
- Modify: `src/__tests__/parity/svg-fingerprints.json` only if renderer fingerprints intentionally change
- Modify: generated `src/assets/teeth-svgs/measured/*.svg` via generator only

**Interfaces:**
- Produces: deterministic generated assets and strict anatomical/clinical verification.

- [ ] Add verifier checks for duplicate forbidden IDs, malformed XML/paths, class topology, furcation presence, lumen/root containment, clinical ID order, paint-server uniqueness, CEJ alignment, and no detached contour pieces.
- [ ] Generate all assets twice and prove byte identity.
- [ ] Inspect geometry differences, then update dated geometry digests for intentional reviewed changes.
- [ ] Update toothgen documentation with the final canonical map, source reasoning, generated/manual-edit boundary, and exact commands.
- [ ] Run Python generator, verifier, and round-trip commands.

### Task 6: Full application and visual verification

**Files:**
- Artifacts: `output/playwright/`

**Interfaces:**
- Validates the running Vite application and exports without altering product behavior.

- [ ] Run full Vitest, lint, typecheck/build, and library build.
- [ ] Start Vite and use Playwright CLI to inspect the complete permanent and primary dentitions, both arches/views, and representative caries/restoration/crown/bridge/implant/endo/perio states.
- [ ] Capture screenshots under `output/playwright/`; check root overlap, clipping, mirroring, seams, gum/bone/CEJ alignment, and occlusal readability.
- [ ] Fix each observed regression with a failing automated invariant where practical, then repeat focused and visual checks.
- [ ] Run fresh final verification and document remaining dentist-review uncertainty.
