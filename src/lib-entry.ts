// Part of React Odontogram Modul - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Vite library BUILD entry (not the types entry — that is `src/index.ts`).
//
// It pulls in the component's global stylesheet as a side effect so the library
// build extracts it to a single `dist/style.css` (consumers import it once —
// see the README), then re-exports the full public API from `src/index.ts`.
//
// This file is excluded from declaration emit (`tsconfig.build.json`) precisely
// so its CSS side-effect import never leaks into a shipped `.d.ts`.
import "./index.css";

export { default } from "./index";
export * from "./index";
