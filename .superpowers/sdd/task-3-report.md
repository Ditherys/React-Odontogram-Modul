# Task 3 report: measured DOM and interaction invariants

## Implementation

Extended the existing real measured-grid characterization test in `src/__tests__/measured-anatomy.test.tsx` with assertions that upper tooth 11 remains an accessible option (`role=option`, `tabindex=0`, non-empty `aria-label`) and that exactly six occlusal placeholders remain layout-only (no `data-tooth`, `role`, or `tabindex`). No production code was changed.

## Tests

- `npx vitest run src/__tests__/measured-anatomy.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=60000`
  - 5 passed, 1 pre-existing timeout failure. The measured-grid test containing the new assertions passed. `switching back to classic restores the flat uniform grid` timed out at 60,000 ms.
- `npm test -- --no-file-parallelism --maxWorkers=1 --testTimeout=30000`
  - Started as required, but was stopped after more than 10 minutes due to prolonged processing. It reported unrelated pre-existing `tier2-rewire.test.tsx` timeouts (5 failures, approximately 35–42 seconds each) before stopping; no failure was attributed to the new assertions.

## TDD / characterization rationale

The brief explicitly describes these as preserved behavior assertions against the real measured `buildGrid` output; therefore they are characterization coverage and may pass immediately. The focused run confirmed the new test passes without a production change.

## Files and commit

- Changed: `src/__tests__/measured-anatomy.test.tsx`
- Commit: `8d2394b test: preserve measured chart hit areas`
- Report: `.superpowers/sdd/task-3-report.md`

## Self-review and concerns

The diff contains only the requested 13 test assertions and preserves classic mode, DOM behavior, and production code. Unrelated worktree changes were not staged. Initial concern about slow/timing-out DOM tests was resolved by the repeat run and completed full suite documented below.

## Verification follow-up

Systematic-debugging Phase 1 was applied after the initial checkpoint. The captured focused failure was a 60,000 ms timeout in the pre-existing `switching back to classic restores the flat uniform grid` test; the new measured-grid test passed. The initial full run was stopped prematurely and also showed unrelated `tier2-rewire.test.tsx` timeout failures. The Task 3 commit was inspected and contains only the 13 requested assertions; no production code or test code was changed during investigation.

The working hypothesis was that shared-machine contention and the suite's known long DOM-test runtime caused timing-only failures. A second exact focused run (unchanged command) reproduced no failure: `npx vitest run src/__tests__/measured-anatomy.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=60000` completed with 6 passed, 0 failed in 135.90s. This supports the timing hypothesis. The exact full command was then allowed to finish: `npm test -- --no-file-parallelism --maxWorkers=1 --testTimeout=30000` completed successfully with 192 test files passed, 1 skipped and 1,963 tests passed, 2 skipped (1,281.97s). Its output also included provider-context stack traces from tests, but the final suite was green. No code changes were needed.
