// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

import { destroyOdontogram, initOdontogram, setNumberingSystem, clearSelection, setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible, registerPlugins, setPluginState, getPluginState, getToothStateSummary, getOdontogramSummary, formatToothLabel, onStateChange, setReadOnly, getReadOnly, setNotesEnabled, getNotesEnabled, setIcdasEnabled, getIcdasEnabled, setPulpDetailLevel, getPulpDetailLevel, setSecondaryCariesMode, getSecondaryCariesMode, setRootCariesMode, getRootCariesMode, setRadiographicDepthMode, getRadiographicDepthMode, setCariesDepthEnabled, getCariesDepthEnabled, setWearDetailLevel, getWearDetailLevel, setDiscolorationDetailLevel, getDiscolorationDetailLevel, setSurfaceNotation, getSurfaceNotation, exportFhir, exportImage, exportSvg, setImportFormat, openPerioOverlay, closePerioOverlay, isPerioOverlayOpen, getPerioViewMode, setPerioViewMode, getPerioRowVisibility, setPerioRowVisibility, getPerioIndexNameMode, setPerioIndexNameMode, getPdfSettings, setPdfSettings, isDualStateConfirmPending, acceptDualStateConfirm, cancelDualStateConfirm, hasAnyPerioData, getChartMode, setChartMode, getStatusChart, getPlanChart, setPlanChart, getPlanChanges, exportStatus, importStatus, exportPdf, exportPerioImage, exportPerioSvg, getFillingDefectEnabled, setFillingDefectEnabled, getFillingComplexity, setFillingComplexity, getFissureSealingEnabled, setFissureSealingEnabled, getFillingMaterialAvailability, setFillingMaterialAvailability } from "./odontogram";
export { clearSelection, setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible, registerPlugins, setPluginState, getPluginState, getToothStateSummary, getOdontogramSummary, formatToothLabel, onStateChange, setReadOnly, getReadOnly, setNotesEnabled, getNotesEnabled, setIcdasEnabled, getIcdasEnabled, setPulpDetailLevel, getPulpDetailLevel, setSecondaryCariesMode, getSecondaryCariesMode, setRootCariesMode, getRootCariesMode, setRadiographicDepthMode, getRadiographicDepthMode, setCariesDepthEnabled, getCariesDepthEnabled, setWearDetailLevel, getWearDetailLevel, setDiscolorationDetailLevel, getDiscolorationDetailLevel, setSurfaceNotation, getSurfaceNotation, exportFhir, exportImage, exportSvg, setImportFormat, getPerioViewMode, setPerioViewMode, getPerioRowVisibility, setPerioRowVisibility, getPerioIndexNameMode, setPerioIndexNameMode, getPdfSettings, setPdfSettings, isDualStateConfirmPending, acceptDualStateConfirm, cancelDualStateConfirm, initOdontogram, destroyOdontogram, setNumberingSystem, getChartMode, setChartMode, getStatusChart, getPlanChart, setPlanChart, getPlanChanges, openPerioOverlay, closePerioOverlay, isPerioOverlayOpen, hasAnyPerioData, exportStatus, importStatus, exportPdf, exportPerioImage, exportPerioSvg, getFillingDefectEnabled, setFillingDefectEnabled, getFillingComplexity, setFillingComplexity, getFissureSealingEnabled, setFissureSealingEnabled, getFillingMaterialAvailability, setFillingMaterialAvailability };
export { default as PerioChart } from "./PerioChart";
export type { PulpDetailLevel, SecondaryCariesMode, RootCariesMode, RadiographicDepthMode, ToothDetailLevel, SurfaceNotation, PerioViewMode, PerioRowId, PerioIndexNameMode } from "./odontogram";
export type { OdontogramSummary, OdontogramSummarySection } from "./odontogram";
export type { FhirExportOptions } from "./fhir/types";
export { startIntroTour } from "./tour";
export {
  enablePersistence, disablePersistence, clearPersistedState, isPersistenceEnabled,
} from "./persistence";
export type { PersistenceOptions } from "./persistence";
import SettingsModal from "./SettingsModal";
export type { FillingComplexity } from "./SettingsModal";
import PerioChart from "./PerioChart";
import PerioSidebar from "./PerioSidebar";
import DualStateConfirm from "./DualStateConfirm";
import ExportOptionsModal from "./ExportOptionsModal";
import { type OdontogramThemeConfig } from "./theme";
export type { OdontogramThemeConfig };
import type { OdontogramPlugin, PluginLayer } from "./plugin";
export type { OdontogramPlugin, PluginLayer };

// Composable-UI foundation: the provider owns all state/effects, the four
// surfaces render the shell's JSX regions, and the hook + context-value type let
// hosts build their own surfaces. `App` (below) is now a thin composition of
// these under `OdontogramProvider`.
import { OdontogramProvider, useOdontogramUi, type OdontogramProviderProps } from "./OdontogramContext";
export { OdontogramProvider, useOdontogramUi } from "./OdontogramContext";
export type { OdontogramUiContextValue } from "./OdontogramContext";
import OdontogramTopbar from "./surfaces/OdontogramTopbar";
import OdontogramChartSurface from "./surfaces/OdontogramChartSurface";
import ToothInfoSurface from "./surfaces/ToothInfoSurface";
import ToothControlsSurface from "./surfaces/ToothControlsSurface";
export { default as OdontogramTopbar } from "./surfaces/OdontogramTopbar";
export { default as OdontogramChartSurface } from "./surfaces/OdontogramChartSurface";
export { default as ToothInfoSurface } from "./surfaces/ToothInfoSurface";
export { default as ToothControlsSurface } from "./surfaces/ToothControlsSurface";

/**
 * Root React component for the Odontogram Editor (aka `OdontogramShell`).
 *
 * Renders the full dental chart UI: top bar with language/numbering/dark-mode
 * controls, the SVG tooth grid, and the right-hand control panel for setting
 * tooth states (caries, fillings, crowns, endo, inflammation, etc.).
 *
 * Since the composable-UI refactor (design/composable-ui.md, Tier 1) this is a
 * THIN composition: it mounts {@link OdontogramProvider} (which owns all state,
 * effects and handlers) and lays out the four surface components + the
 * shell-managed perio bits and modals in the default arrangement. The default
 * composition renders byte-identical DOM to the pre-refactor shell (frozen by
 * `src/__tests__/parity/shell-dom.test.tsx`). A host can instead compose the
 * exported surfaces under its own wrappers inside an `OdontogramProvider`.
 *
 * @example
 * ```tsx
 * // Standalone usage
 * <App />
 *
 * // Controlled by a host application
 * <App
 *   language="en"
 *   onLanguageChange={setLang}
 *   numberingSystem="FDI"
 *   onNumberingChange={setNumbering}
 *   darkMode={isDark}
 *   onDarkModeChange={setDark}
 * />
 * ```
 */
export default function App(props: Omit<OdontogramProviderProps, "children">){
  return (
    <OdontogramProvider {...props}>
      <ShellLayout />
    </OdontogramProvider>
  );
}

/**
 * The default shell layout: the four surfaces plus the shell-managed layout
 * wrappers, perio bits, and modals. Reads everything from the provider via
 * {@link useOdontogramUi}; holds no state of its own.
 */
function ShellLayout(){
  const {
    t,
    viewMode,
    activeView,
    setActiveView,
    isPerioView,
    perioChartAvailable,
    perioOpen,
    confirmOpen,
    settingsState,
    settingsOpen,
    setSettingsOpen,
    pdfOpen,
    setPdfOpen,
  } = useOdontogramUi();

  return (
    <>
      <OdontogramTopbar />

      <main className="layout">
        {/* Hide the perio entry point (view toggle / open button) entirely when
            the Periodontal chart is turned off in Settings. */}
        <div className={"perio-launch-bar" + (perioChartAvailable ? "" : " hidden")}>
          {viewMode === "toggle" ? (
            <div id="appViewToggle" className="chart-mode-toggle" role="tablist">
              <button
                id="appViewOdontogram"
                type="button"
                className={"chart-mode-btn" + (activeView === "odontogram" ? " is-active" : "")}
                role="tab"
                aria-selected={activeView === "odontogram"}
                onClick={() => setActiveView("odontogram")}
              >
                {t("view.odontogram")}
              </button>
              <button
                id="appViewDentalChart"
                type="button"
                className={"chart-mode-btn" + (activeView === "dentalChart" ? " is-active" : "")}
                role="tab"
                aria-selected={activeView === "dentalChart"}
                onClick={() => setActiveView("dentalChart")}
              >
                {t("view.dentalChart")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="openPerioOverlayBtn"
              className="btn btn-ghost"
              onClick={() => openPerioOverlay()}
              title={t("perio.open")}
              aria-label={t("perio.open")}
            >
              {t("perio.open")}
            </button>
          )}
        </div>
        {/* Hide (not unmount) the odontogram column while the Dental Chart
            segment is active in toggle mode, so its wired controls survive. */}
        <div
          className="chart-column"
          style={viewMode === "toggle" && activeView === "dentalChart" ? { display: "none" } : undefined}
        >
        <OdontogramChartSurface />
        <ToothInfoSurface />
        </div>
        {viewMode === "toggle" && activeView === "dentalChart" && (
          <div className="dental-chart-column" dir="ltr">
            <PerioChart inline />
          </div>
        )}
        <aside className="panel">
          {/* Keep the odontogram control panel ALWAYS mounted, toggling only
              its visibility with CSS. Unmounting it on the perio toggle would
              produce fresh DOM nodes whose one-time wireControls() listeners are
              never re-attached, silently breaking odontogram editing after a
              round-trip through Periodontal Status. PerioSidebar stays a plain
              conditional (mounted only in the perio view). */}
          {isPerioView && <PerioSidebar />}
          <ToothControlsSurface />
        </aside>
      </main>

      {viewMode === "popup" && <PerioChart open={perioOpen} onClose={closePerioOverlay} />}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        t={t}
        settings={settingsState}
      />

      <DualStateConfirm
        open={confirmOpen}
        t={t}
        onAccept={acceptDualStateConfirm}
        onCancel={cancelDualStateConfirm}
      />

      <ExportOptionsModal
        open={pdfOpen}
        t={t}
        onClose={() => setPdfOpen(false)}
      />
    </>
  );
}
