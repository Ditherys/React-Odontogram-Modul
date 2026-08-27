# Tasks 1–2 checkpoint report

## Implementation

- Added `src/__tests__/measured-chart-layout.test.ts`, a source-level contract covering classic tile chrome, measured arch spacing, measured-only hit-area chrome, placeholders, focus/selection, and occlusal hierarchy.
- Updated only measured selectors in `src/index.css`: continuous two-arch spacing via `--measured-tooth-gap`, arch isolation and wash, measured tile state affordances, placeholder alignment, occlusal hierarchy, labels, and dark-mode treatment.
- No DOM, SVG anatomy, renderer, clinical overlay, classic-mode, state, export, or public API changes.

## TDD evidence

RED command:

```text
npx vitest run src/__tests__/measured-chart-layout.test.ts --no-file-parallelism --maxWorkers=1
```

Result: failed as expected, 4 of 5 tests failed because the measured spacing variable and measured-only tile/placeholder/focus/occlusal rules were absent. The test needed the repository’s established `const testFileUrl = import.meta.url` capture for Windows/Vitest URL resolution; this was test harness compatibility only.

GREEN command:

```text
npx vitest run src/__tests__/measured-chart-layout.test.ts --no-file-parallelism --maxWorkers=1
```

Result: 1 file passed, 5 tests passed.

## Regression verification

```text
npx vitest run src/__tests__/measured-anatomy.test.tsx src/__tests__/tooth-details-selection.test.tsx src/__tests__/bridgeOverlay.test.ts src/__tests__/a11y.test.ts src/__tests__/touch.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=60000
```

Result: 5 files passed, 51 tests passed.

```text
npm test -- --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Result: 192 files passed, 1 skipped; 1,963 tests passed, 2 skipped.

## Self-review

- `git diff --check` reported no whitespace errors.
- Classic `.tooth-tile` baseline remains unchanged; all new chrome/layout rules are gated by `data-anatomy="measured"`.
- No prohibited files were staged or changed; pre-existing package-lock, parity, generated/support-directory changes remain untouched.

## Concerns

- The full suite emits an existing React context stack trace during a test but exits successfully; no new failure was reported.
- The contract test uses the repository’s required import-meta URL capture due to Windows/Vitest behavior.
