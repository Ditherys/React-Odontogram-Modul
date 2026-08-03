// Public library API surface (the package's `types` + JS re-export entry).
//
// This file is intentionally CSS-free so the emitted `dist/index.d.ts` contains
// no `import "./x.css"` line (which a consumer's `tsc` could not resolve). The
// stylesheet side-effect lives in `src/lib-entry.ts`, which is the Vite *build*
// entry; this file is the *types* entry. The demo/dev app boots from
// `src/main.tsx` instead.
//
// Re-exports the full public API that already lives on `src/App.tsx` (the
// `OdontogramShell` component + the imperative state functions, `PerioChart`,
// `startIntroTour`, and all public types).
import App from "./App";

// The main component, exported both as a default and under an explicit,
// self-documenting name.
export default App;
export { App as OdontogramShell };

// Everything else already surfaced by App.tsx (state functions, PerioChart,
// startIntroTour, and the public types). `export *` does not re-export a
// default, so it never clashes with the `App` default above.
export * from "./App";
