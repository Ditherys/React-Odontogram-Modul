# Security, ISO 3950, ICDAS, and Persistence Fixes — Design Spec

Date: 2026-08-08
Branch: `security-iso-icdas-fixes`
Worktree: `../engine-odontogram-fixes`

## Goal

Fix the security, standards-compliance, and persistence gaps identified in the code review without touching the main branch, which remains available for parallel Claude Code work.

## Non-goals

- SNOMED CT mapping completion (explicitly deferred by the user).
- Full dental-software features (audit log, RBAC, DICOM, appointment workflow, etc.) — these are out of scope for a standalone library.
- Refactoring the monolithic `odontogram.ts` core (separate, longer-term effort).

## Approach

### 1. Branch Strategy

- Use `git worktree add ../engine-odontogram-fixes -b security-iso-icdas-fixes`.
- The main worktree remains untouched; Claude Code can continue working on its dirty files (`SettingsModal.tsx`, `App.test.tsx`, etc.) without interference.
- All changes are made on the `security-iso-icdas-fixes` branch inside the worktree.

### 2. localStorage Persistence

- New module: `src/persistence.ts`.
- Public API:
  - `enablePersistence(options?: PersistenceOptions): void`
  - `disablePersistence(): void`
  - `clearPersistedState(): void`
  - `isPersistenceEnabled(): boolean`
- `PersistenceOptions`:
  ```ts
  {
    key?: string;                    // default: "react-advanced-odontogram"
    includePlan?: boolean;           // default: false
    onError?: (err: Error) => void;  // optional error handler
  }
  ```
- Behavior:
  - `enablePersistence()` subscribes to `onStateChange` and saves the payload (status + optionally plan) to `localStorage` on every change.
  - On init or `enablePersistence()` call, it attempts to restore the saved state.
  - Versioned wrapper: `{ version: 1, savedAt: string, payload: ExportPayload }`.
  - Size guard: if payload > 4 MB, skip save and call `onError` or log.
  - Error handling: quota exceeded, JSON parse errors, missing `localStorage` — never throw; log or call `onError`.
- Default: opt-in; host must explicitly enable.
- Backward compatible: no changes to `OdontogramShell` props.

### 3. Security Fixes

#### 3.1 Plugin XSS via DOMPurify

- In `src/odontogram.ts`, sanitize the plugin `renderSvg()` output with DOMPurify before assigning to `innerHTML`.
- DOMPurify config:
  ```ts
  {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
  }
  ```
- Add a test: a plugin that tries to inject a script is neutralized after sanitization.

#### 3.2 Content-Security-Policy

- Add a CSP meta tag to `index.html`:
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'
  ```
- Document in README that host apps should set their own CSP.

#### 3.3 SNOMED Server Hardening (`snomed/server.mjs`)

- Input validation:
  - `code` param: `/^[0-9]{6,18}$/`
  - `q` param: trim, max length 200, strip control characters
- POST body size limit: 1 MB.
- Rate limiting: simple in-memory throttle, 30 requests/minute per IP.
- Explicitly bind to `127.0.0.1` only.
- Add a header comment: "Development tool only — do not use in production."

#### 3.4 NPM Audit

- Run `npm audit fix` for dev dependencies.
- Document any unfixable vulnerabilities.
- Goal: 0 critical/high runtime vulnerabilities.

#### 3.5 Fix Failing Tests

- The 3 failing tests in `App.test.tsx` are caused by the settings tab reorganization.
- Update selectors/assertions to match the new tab structure.

### 4. ISO 3950 Milk Teeth in FHIR Export

- New helper: `src/fhir/iso3950.ts` (or inline in `toFhir.ts`).
- Logic:
  - Internal model remains unchanged: `toothNo` 11-48 with `toothSelection: "milktooth"`.
  - On FHIR export, when `toothSelection === "milktooth"`, convert the FDI code to the ISO 3950 deciduous range:
    - 11-18 → 51-55
    - 21-28 → 61-65
    - 31-38 → 71-75
    - 41-48 → 81-85
  - `bodySite.coding.system` remains the ISO 3950 URI used by the project.
  - Permanent teeth are unchanged.
- Add test: FHIR export of a milk tooth yields the correct 51-85 code.

### 5. ICDAS in FHIR Export

- Modify `src/fhir/toFhir.ts` (or the caries component builder).
- For caries severity components, add `code.coding`:
  ```json
  {
    "system": "http://example.org/icdas",
    "code": "ICDAS-3",
    "display": "ICDAS 3 — Enamel breakdown"
  }
  ```
- Primary caries → ICDAS coding; recurrent caries (CARS) → separate coding with CARS system.
- `valueInteger` remains unchanged; coding is additive.
- Add test: FHIR export of caries includes ICDAS coding.

## Data Flow

- localStorage persistence hooks into `onStateChange` and the existing `exportStatus`/`importStatus` paths.
- FHIR changes are export-only; import path remains tolerant and unchanged.
- DOMPurify sanitization happens at the plugin render boundary, before DOM insertion.

## Error Handling

- Persistence: all localStorage errors are caught; `onError` callback or console warning.
- FHIR export: invalid tooth numbers or severities are skipped, not thrown.
- Plugin sanitization: if DOMPurify fails, the plugin output is dropped and a warning is logged.

## Testing

- Unit tests for `src/persistence.ts` (enable/disable, save/restore, error paths).
- Unit tests for ISO 3950 conversion.
- Unit tests for ICDAS coding in FHIR export.
- Integration test for plugin XSS sanitization.
- Update the 3 failing `App.test.tsx` tests.
- All existing tests must pass.
- `npm run lint` must pass with 0 errors.
- `npm run build` must pass.

## Documentation

- Update README with:
  - localStorage persistence API
  - CSP recommendation
  - ISO 3950 deciduous teeth support in FHIR export
  - ICDAS coding in FHIR export
- Update CHANGELOG.
- Update `snomed/server.mjs` header comment.

## Rollout

1. Create worktree and branch.
2. Implement each section in order: persistence → security → ISO 3950 → ICDAS.
3. Run tests, lint, build after each section.
4. Commit each logical change separately.
5. Final integration test.
6. Present the branch for review; merge decision is the user's.
