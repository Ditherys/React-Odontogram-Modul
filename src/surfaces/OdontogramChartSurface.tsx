// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
//
// Composable surface — the `<section className="chart">` region (chart header,
// Status|Plan toggle, chart actions, and the `#toothGrid` mount node the engine
// wires imperatively). Presentational: it reads everything from
// `useOdontogramUi()` and holds no state of its own.

import { type CSSProperties } from "react";
import { useOdontogramUi } from "../OdontogramContext";
// Toolbar icons rendered as inline SVG (via `loadInlineIcon`, which parses the
// `data-icon-src` markup) are imported `?raw` so they inline into the JS bundle
// as strings — no runtime fetch. `iconNoSelectionUrl` is rendered as an
// `<img src>` instead, so it stays a URL import.
import icon8Svg from "../assets/icon-svgs/icon_8.svg?raw";
import iconGumSvg from "../assets/icon-svgs/icon_gum.svg?raw";
import iconNoSelectionUrl from "../assets/icon-svgs/icon_no_selection.svg";
import iconOcclSvg from "../assets/icon-svgs/icon_occl.svg?raw";
import iconPulpSvg from "../assets/icon-svgs/icon_pulp.svg?raw";

/** Parse a `#rgb`/`#rrggbb` hex colour to a CSS `"r,g,b"` channel string for
 *  `rgba(var(--odon-select-rgb), α)`. Falls back to the blue default on a
 *  malformed value. */
function hexToRgbCss(hex: string): string {
  let h = (hex || "").replace("#", "").trim();
  if(h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if(h.length !== 6 || !Number.isFinite(n)) return "59,123,255";
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export default function OdontogramChartSurface() {
  const {
    t,
    planModeAvailable,
    screenSpacing,
    screenNumberSize,
    selectionColor,
    selectionBorderStyle,
  } = useOdontogramUi();

  return (
        <section className="chart">
          <div className="chart-header">
            <div>
              <div className="chart-title">{t("chart.title")}</div>
              <div className="chart-hint">{t("chart.hint")}</div>
            </div>
            {/* The Status|Plan toggle is hidden when plan mode is turned off in
                Settings → Odontogram. Hidden via CSS (not unmounted) so
                odontogram.ts's one-time click wiring on these buttons survives
                being toggled off and back on. */}
            <div id="chartModeToggle" className={"chart-mode-toggle" + (planModeAvailable ? "" : " hidden")} role="tablist">
              <button id="chartModeStatus" type="button" className="chart-mode-btn is-active" role="tab" aria-selected="true">{t("chartMode.status")}</button>
              <button id="chartModePlan" type="button" className="chart-mode-btn" role="tab" aria-selected="false">{t("chartMode.plan")}</button>
              <span id="chartModePlanBadge" className="plan-badge hidden">{t("chartMode.planBadge")}</span>
            </div>
            {/* "dashed = proposed" legend. Always rendered — its visibility is
                pure CSS, scoped by the `.chart.plan-mode #proposedLegend`
                selector (src/index.css), which reuses the same `.plan-mode` cue
                the chart card gets from syncChartModeUi() in odontogram.ts.
                No new React state, no new engine call. */}
            <div id="proposedLegend" className="proposed-legend">
              <span className="proposed-legend-swatch" aria-hidden="true"></span>
              {t("chart.proposedLegend")}
            </div>
            <div className="chart-actions">
              <button id="btnOcclView" className="btn btn-toggle btn-icon" aria-pressed="true" title={t("chart.actions.occlusal")} aria-label={t("chart.actions.occlusal")} data-icon-src={iconOcclSvg} data-xline="1"></button>
              <button id="btnWisdomVisible" className="btn btn-toggle btn-icon" aria-pressed="true" title={t("chart.actions.wisdom")} aria-label={t("chart.actions.wisdom")} data-icon-src={icon8Svg} data-xline="1"></button>
              <button id="btnBoneVisible" className="btn btn-toggle btn-icon" aria-pressed="true" title={t("chart.actions.bone")} aria-label={t("chart.actions.bone")} data-icon-src={iconGumSvg} data-xline="1"></button>
              <button id="btnPulpVisible" className="btn btn-toggle btn-icon" aria-pressed="true" title={t("chart.actions.pulp")} aria-label={t("chart.actions.pulp")} data-icon-src={iconPulpSvg} data-xline="1"></button>
              <button id="btnSelectNoneChart" className="btn btn-ghost btn-icon" title={t("chart.actions.clearSelection")} aria-label={t("chart.actions.clearSelection")}>
                <img className="icon-img" src={iconNoSelectionUrl} alt="" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            id="toothGrid"
            className="tooth-grid"
            dir="ltr"
            data-screen-spacing={screenSpacing}
            data-tooth-num={screenNumberSize}
            style={{
              "--odon-select-rgb": hexToRgbCss(selectionColor),
              "--odon-select-border-style": selectionBorderStyle,
            } as CSSProperties}
            aria-label={t("chart.aria.toothGrid")}
          ></div>
        </section>
  );
}
