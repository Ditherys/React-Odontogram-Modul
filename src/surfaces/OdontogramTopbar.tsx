// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Composable surface — the `<header className="topbar">` region.
//
// The header dropdown open flags (`languageOpen`/`exportOpen`/`importOpen`),
// their DOM refs, and the outside-click effect are strictly region-local UI
// state, so they live here rather than in the shared provider. Everything else
// comes from `useOdontogramUi()`.

import { useEffect, useRef, useState } from "react";
import { useOdontogramUi } from "../OdontogramContext";
import { startIntroTour } from "../tour";
import { setImportFormat } from "../odontogram";
import type { Language } from "../i18n/translations";
// Brand logo — `?inline` forces a base64 data URI so it is bundled into the
// library (self-contained, no runtime asset fetch).
import brandLogoUrl from "../assets/react-module-logo.png?inline";

const LANGUAGE_OPTIONS: { value: Language; labelKey: string }[] = [
  { value: "hu", labelKey: "language.hu" },
  { value: "en", labelKey: "language.en" },
  { value: "de", labelKey: "language.de" },
  { value: "es", labelKey: "language.es" },
  { value: "it", labelKey: "language.it" },
  { value: "sk", labelKey: "language.sk" },
  { value: "pl", labelKey: "language.pl" },
  { value: "ru", labelKey: "language.ru" },
  { value: "pt-br", labelKey: "language.pt-br" },
  { value: "zh", labelKey: "language.zh" },
  { value: "ar", labelKey: "language.ar" },
  { value: "fr", labelKey: "language.fr" },
];

export default function OdontogramTopbar() {
  const {
    t,
    lang,
    setLang,
    isDark,
    toggleDark,
    currentNumbering,
    settingsOpen,
    setSettingsOpen,
    exportPngOn,
    exportJpgOn,
    exportSvgOn,
    exportPdfOn,
    hasPerio,
    importStatusOn,
    importFhirOn,
    setPdfOpen,
  } = useOdontogramUi();

  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const importRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if(!languageRef.current?.contains(target)){
        setLanguageOpen(false);
      }
      if(!exportRef.current?.contains(target)){
        setExportOpen(false);
      }
      if(!importRef.current?.contains(target)){
        setImportOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={brandLogoUrl} alt="" aria-hidden="true" />
          <div>
            <div className="title">{t("app.title")}</div>
            <div className="subtitle">{`${t("app.subtitleLang")} ${t("app.subtitleNumbering." + currentNumbering)} ${t(isDark ? "app.subtitleMode.dark" : "app.subtitleMode.light")}`}</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-theme" onClick={() => startIntroTour()} title={t("intro.start")} aria-label={t("intro.start")}>
            {/* Play-in-circle: reads as "start the guided tour". */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M10 8.5v7l6-3.5-6-3.5z"/></svg>
          </button>
          <div id="languageMenu" className="topbar-group dropdown" ref={languageRef}>
            <button className="btn-theme" onClick={() => setLanguageOpen((open) => !open)} aria-haspopup="menu" aria-expanded={languageOpen} title={t("language.label")} aria-label={t("language.label")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
            </button>
            {languageOpen && (
              <div className="dropdown-menu" role="menu" aria-label={t("language.label")}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className="dropdown-item"
                    role="menuitemradio"
                    aria-checked={lang === opt.value}
                    onClick={() => {
                      setLang(opt.value);
                      setLanguageOpen(false);
                    }}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="btn-theme"
            onClick={toggleDark}
            title={isDark ? t("theme.light") : t("theme.dark")}
            aria-label={isDark ? t("theme.light") : t("theme.dark")}
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
          <div className="topbar-group">
            <button id="btnSettingsMenu" className="btn-theme" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" aria-expanded={settingsOpen} title={t("settings.title")} aria-label={t("settings.title")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
          {/* Hidden export buttons kept for host capture + wireControls wiring */}
          <button id="btnStatusExport" hidden aria-hidden="true" tabIndex={-1}>{t("topbar.exportStatus")}</button>
          <button id="btnStatusFhirExport" hidden aria-hidden="true" tabIndex={-1}>{t("topbar.exportFhir")}</button>
          <button id="btnStatusPngExport" hidden aria-hidden="true" tabIndex={-1}>{t("topbar.exportPng")}</button>
          <button id="btnStatusJpgExport" hidden aria-hidden="true" tabIndex={-1}>{t("topbar.exportJpg")}</button>
          <button id="btnStatusSvgExport" hidden aria-hidden="true" tabIndex={-1}>{t("export.menu.svg")}</button>
          <button id="btnPerioSvgExport" hidden aria-hidden="true" tabIndex={-1}>{t("export.menu.perioSvg")}</button>
          <button id="btnPerioPngExport" hidden aria-hidden="true" tabIndex={-1}>{t("export.menu.perioPng")}</button>
          <button id="btnPerioJpgExport" hidden aria-hidden="true" tabIndex={-1}>{t("export.menu.perioJpg")}</button>
          <div className="topbar-group dropdown" ref={exportRef}>
            <button id="btnExportMenu" className="btn-theme" onClick={() => setExportOpen((o) => !o)} aria-haspopup="menu" aria-expanded={exportOpen} title={t("topbar.export")} aria-label={t("topbar.export")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
            {exportOpen && (
              <div className="dropdown-menu" role="menu" aria-label={t("topbar.export")}>
                <button className="dropdown-item" role="menuitem" onClick={() => { (document.getElementById("btnStatusExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.statusJson")}</button>
                <button className="dropdown-item" role="menuitem" onClick={() => { (document.getElementById("btnStatusFhirExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.fhir")}</button>
                {/* Image + PDF items gated by per-format availability
                    (General → Export). Status/FHIR JSON export always stay. */}
                {exportPngOn && <button className="dropdown-item" role="menuitem" onClick={() => { (document.getElementById("btnStatusPngExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.png")}</button>}
                {exportJpgOn && <button className="dropdown-item" role="menuitem" onClick={() => { (document.getElementById("btnStatusJpgExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.jpg")}</button>}
                {exportSvgOn && <button className="dropdown-item" role="menuitem" onClick={() => { (document.getElementById("btnStatusSvgExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.svg")}</button>}
                {exportSvgOn && <button className="dropdown-item" role="menuitem" disabled={!hasPerio}
                  onClick={() => { (document.getElementById("btnPerioSvgExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.perioSvg")}</button>}
                {exportPngOn && <button className="dropdown-item" role="menuitem" disabled={!hasPerio}
                  onClick={() => { (document.getElementById("btnPerioPngExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.perioPng")}</button>}
                {exportJpgOn && <button className="dropdown-item" role="menuitem" disabled={!hasPerio}
                  onClick={() => { (document.getElementById("btnPerioJpgExport") as HTMLButtonElement | null)?.click(); setExportOpen(false); }}>{t("export.menu.perioJpg")}</button>}
                {exportPdfOn && <button className="dropdown-item" role="menuitem"
                  onClick={() => { setExportOpen(false); setPdfOpen(true); }}>{t("export.menu.pdf")}</button>}
              </div>
            )}
          </div>
          <button id="btnStatusImport" hidden aria-hidden="true" tabIndex={-1}>{t("topbar.importStatus")}</button>
          <div className="topbar-group dropdown" ref={importRef}>
            <button id="btnImportMenu" className="btn-theme" onClick={() => setImportOpen((o) => !o)} aria-haspopup="menu" aria-expanded={importOpen} title={t("topbar.import")} aria-label={t("topbar.import")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 8l5-5 5 5M12 3v12"/></svg>
            </button>
            {importOpen && (
              <div className="dropdown-menu" role="menu" aria-label={t("topbar.import")}>
                {importStatusOn && <button className="dropdown-item" role="menuitem" onClick={() => { setImportFormat("status"); (document.getElementById("btnStatusImport") as HTMLButtonElement | null)?.click(); setImportOpen(false); }}>{t("import.menu.statusJson")}</button>}
                {importFhirOn && <button className="dropdown-item" role="menuitem" onClick={() => { setImportFormat("fhir"); (document.getElementById("btnStatusImport") as HTMLButtonElement | null)?.click(); setImportOpen(false); }}>{t("import.menu.fhir")}</button>}
              </div>
            )}
          </div>
          {/* Hidden file picker backing both import menu items. */}
          <input id="statusImportInput" type="file" accept="application/json" hidden />
        </div>
      </header>
  );
}
