import { useCallback, useEffect, useId, useRef, useState } from "react";
import { t } from "./i18n/useI18n";
import { optionsFor } from "./registry/uiOptions";
import {
  PERIO_SITES,
  type PerioSite,
  isUpperTooth,
  formatToothLabel,
  getPerioChart,
  getToothPerio,
  getToothCal,
  getPerioSummary,
  setPerioSite,
  getToothMobility,
  setToothMobility,
  furcationEntrances,
  setFurcation,
  getToothFurcation,
  setPlaque,
  getToothPlaque,
  isPerioRowHidden,
  getReadOnly,
  onStateChange,
  nextPerioCell,
  prevPerioCell,
  type PerioCellCoord,
} from "./odontogram";
import {
  loadTemplateCache,
  buildArchGraphic,
  archToothLayout,
  perioCurve,
  buildPerioCurveLayer,
  PERIO_MM_PX,
  TOOTH_GAP,
  type TemplateDocCache,
  type ArchLayout,
  type PerioCurveSite,
} from "./perioGraphic";

// Width of the sticky left-hand row-label column (px). The arch graphic and
// every number row share ONE CSS grid whose first track is this label column,
// so the tooth columns (tracks 2..N+1) start at the same x in every row.
const ROW_LABEL_WIDTH = 132;

// Provisional per-tooth column width (px) used until the tooth-template cache
// loads and the real, per-tooth arch-layout widths are applied
// (`applyArchColumns`). Wide enough to hold a 3-site cell so the grid is fully
// usable for charting even when the graphic never loads (e.g. no network in a
// unit test) — the graphic + column alignment is a presentation enhancement,
// never a hard dependency for data entry.
const PROVISIONAL_COL_WIDTH = 46;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Mirrors `ALL_TEETH` in odontogram.ts (not exported — same duplication
// precedent as `bridgeOverlay.ts`'s UPPER_ARCH/LOWER_ARCH). Array-adjacent ==
// visually adjacent within an arch; the two arches never mix.
const UPPER_ARCH: readonly number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH: readonly number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Literal (not `PERIO_SITES.slice(...)`) so this module never touches the
// "./odontogram" import at module-eval time — several existing tests mount
// <App/> (which always renders <PerioChart open={false}/> in its tree) with
// a hand-curated `vi.mock("../odontogram", ...)` that doesn't necessarily
// forward every export; every real odontogram.ts call in this file is
// deferred until the `open`-gated effect/handlers actually run (see below),
// so a closed PerioChart never touches the (possibly partially-mocked)
// module at all. Order matches PERIO_SITES' own canonical MB/B/DB/ML/L/DL.
const BUCCAL_SITES: readonly PerioSite[] = ["MB", "B", "DB"];
const LINGUAL_SITES: readonly PerioSite[] = ["ML", "L", "DL"];

// SP-perio P2b Task 4: the 4 fixed O'Leary plaque-index surfaces (mirrors
// VALID_PLAQUE_SURFACE in odontogram.ts — literal here for the same
// module-eval-safety reason as BUCCAL_SITES above). Order = the clockwise
// M/D + B/L quadrant order the 4-quadrant plaque mark reads in.
const PLAQUE_SURFACES: readonly string[] = ["mesial", "distal", "buccal", "lingual"];

// Glickman furcation grade -> Roman-numeral face on the cycle control.
// Index 0 (no involvement) shows the em-dash placeholder, 1-4 show I-IV.
const FURCATION_ROMAN = ["–", "I", "II", "III", "IV"];

type PerioSiteData = ReturnType<typeof getToothPerio>;
type PerioSummaryData = ReturnType<typeof getPerioSummary>;

const EMPTY_PERIO: PerioSiteData = { pd: {}, gm: {}, bop: [], sup: [] };
const EMPTY_SUMMARY: PerioSummaryData = {
  chartedSites: 0,
  bleedingSites: 0,
  bopPercent: 0,
  worstCal: null,
  worstCalTooth: null,
  maxPd: null,
  avgPd: null,
  avgCal: null,
  maxFurcation: null,
  plaquePercent: 0,
};

type ToothCellRefs = {
  pd: Partial<Record<PerioSite, HTMLInputElement>>;
  gm: Partial<Record<PerioSite, HTMLInputElement>>;
  bop: Partial<Record<PerioSite, HTMLInputElement>>;
  cal: Partial<Record<PerioSite, HTMLSpanElement>>;
  mobility: HTMLSelectElement | null;
  // SP-perio P2b Task 4: per-entrance furcation cycle buttons (keyed by
  // entrance string — only the furcated-position entrances exist) and the
  // 4 O'Leary plaque-surface toggle buttons.
  furcation: Partial<Record<string, HTMLButtonElement>>;
  plaque: Partial<Record<string, HTMLButtonElement>>;
};

type GridHandlers = {
  onPd: (toothNo: number, site: PerioSite, raw: string) => void;
  onGm: (toothNo: number, site: PerioSite, raw: string) => void;
  onBop: (toothNo: number, site: PerioSite, checked: boolean) => void;
  onMobility: (toothNo: number, value: string) => void;
  onFurcation: (toothNo: number, entrance: string) => void;
  onPlaque: (toothNo: number, surface: string) => void;
};

// T3 curve overlay: gather the ordered per-site {pd,gm} readings for one row
// (buccal MB/B/DB or lingual ML/L/DL) plus each site's x. The 3 sites of a
// tooth spread evenly across that tooth's width (reusing the SAME per-tooth
// x/width `archToothLayout` gives the arch teeth, so the curve tracks them):
// site j lands at x + width*(j+0.5)/3 → the 1/6, 1/2, 5/6 fractions. Reads
// getToothPerio (active chart) → status/plan aware + live-updates.
function collectCurveInput(
  layout: ArchLayout,
  siteKeys: readonly PerioSite[],
): { sites: PerioCurveSite[]; xs: number[] } {
  const sites: PerioCurveSite[] = [];
  const xs: number[] = [];
  for (const tooth of layout.teeth) {
    const perio = getToothPerio(tooth.toothNo);
    siteKeys.forEach((site, j) => {
      const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
      sites.push({
        site,
        pd: charted ? perio.pd[site] : undefined,
        gm: Object.prototype.hasOwnProperty.call(perio.gm, site) ? perio.gm[site] : undefined,
      });
      xs.push(tooth.x + (tooth.width * (j + 0.5)) / 3);
    });
  }
  return { sites, xs };
}

// Draw (or redraw) both curve rows of ONE arch band into the arch SVG the T2
// `buildArchGraphic` produced. Stale curve layers are removed first, so this
// is safe to call on every state change. The palatal curve is computed in the
// SAME buccal-space (cejY at the shared baseline) then wrapped in the SAME
// vertical-mirror transform T2 mirrors the palatal teeth with (matrix
// 1 0 0 -1 0 2*mirrorAxisY), keeping the curve locked to the palatal teeth.
function drawArchCurves(cache: TemplateDocCache, container: HTMLElement | null, teeth: readonly number[]): void {
  if (!container) return;
  const svg = container.querySelector("svg.perio-tooth-arch");
  if (!svg) return;
  svg.querySelectorAll(".perio-curve").forEach((el) => el.remove());

  const layout = archToothLayout(cache, teeth);
  const opts = { cejY: layout.cejY, mmPx: PERIO_MM_PX };

  const buccalIn = collectCurveInput(layout, BUCCAL_SITES);
  const buccalCurve = perioCurve(buccalIn.sites, { ...opts, siteX: (i) => buccalIn.xs[i] });
  const buccalLayer = buildPerioCurveLayer(buccalCurve, { width: layout.totalWidth, className: "perio-curve perio-curve-buccal" });
  svg.appendChild(buccalLayer);

  const lingualIn = collectCurveInput(layout, LINGUAL_SITES);
  const lingualCurve = perioCurve(lingualIn.sites, { ...opts, siteX: (i) => lingualIn.xs[i] });
  const lingualLayer = buildPerioCurveLayer(lingualCurve, { width: layout.totalWidth, className: "perio-curve perio-curve-palatal" });
  lingualLayer.setAttribute("transform", `matrix(1 0 0 -1 0 ${2 * layout.mirrorAxisY})`);
  svg.appendChild(lingualLayer);
}

function mkEl<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function mkRowLabelCell(text: string): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-row-label");
  cell.textContent = text;
  return cell;
}

/** Sync ONE tooth's already-built cells from the given perio/CAL snapshot —
 *  the R3 (perf) targeted-update primitive. Never creates/destroys DOM
 *  nodes, only updates value/checked/disabled/text on existing ones, so it
 *  is cheap to call after every single-site edit AND in a loop over all 32
 *  teeth for a full resync (dual-state switch / external edits). Mirrors
 *  the P1 tooth-panel's `syncPerioRow` value-sync contract (omit-when-empty:
 *  an uncharted site renders blank, `?? ""`). */
function syncToothCells(
  cells: ToothCellRefs,
  toothNo: number,
  perio: PerioSiteData,
  cal: Map<string, number>,
  readOnly: boolean,
): void {
  const hidden = isPerioRowHidden(toothNo);
  for (const site of PERIO_SITES) {
    const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
    const pdInput = cells.pd[site];
    if (pdInput) {
      pdInput.value = charted ? String(perio.pd[site]) : "";
      pdInput.disabled = readOnly || hidden;
    }
    const gmInput = cells.gm[site];
    if (gmInput) {
      gmInput.value = charted && Object.prototype.hasOwnProperty.call(perio.gm, site) ? String(perio.gm[site]) : "";
      gmInput.disabled = readOnly || hidden || !charted;
    }
    const bopInput = cells.bop[site];
    if (bopInput) {
      bopInput.checked = perio.bop.includes(site);
      bopInput.disabled = readOnly || hidden || !charted;
    }
    const calSpan = cells.cal[site];
    if (calSpan) {
      const calVal = cal.get(site);
      calSpan.textContent = calVal === undefined ? "" : String(calVal);
    }
  }
  if (cells.mobility) {
    cells.mobility.value = getToothMobility(toothNo);
    cells.mobility.disabled = readOnly || hidden;
  }
  // SP-perio P2b Task 4: furcation cycle buttons — face + grade + pressed
  // state from the active chart's per-entrance grade (getToothFurcation).
  // Buttons only exist for furcated-position + present teeth (built once,
  // see buildFurcationCell), so `hidden` here is belt-and-braces.
  const furc = getToothFurcation(toothNo);
  for (const entrance of Object.keys(cells.furcation)) {
    const btn = cells.furcation[entrance];
    if (!btn) continue;
    const grade = furc[entrance] ?? 0;
    btn.textContent = FURCATION_ROMAN[grade];
    btn.dataset.grade = String(grade);
    btn.setAttribute("aria-pressed", grade > 0 ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }
  // SP-perio P2b Task 4: plaque toggles — present/absent mark + pressed state
  // from the active chart's plaque surface set (getToothPlaque). Disabled on
  // a non-present tooth (mirrors the PD/GM disable gate).
  const plaque = getToothPlaque(toothNo);
  for (const surface of Object.keys(cells.plaque)) {
    const btn = cells.plaque[surface];
    if (!btn) continue;
    const present = plaque.includes(surface);
    btn.dataset.present = present ? "1" : "0";
    btn.setAttribute("aria-pressed", present ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }
}

/** One arch band's built grid plus the placeholder cell the tooth-row graphic
 *  SVG is injected into (spans all tooth columns, between the buccal and
 *  palatal number rows). */
type BuiltArch = { grid: HTMLDivElement; archCell: HTMLDivElement };

/** Build ONE tooth's field cell for a given field/site-set — the SAME cell +
 *  `data-perio` locator + `change`-listener wiring P2 shipped, just factored
 *  out of the old single loop so it can be reused by the buccal-aspect rows
 *  (built ABOVE the graphic) and the palatal-aspect rows (built BELOW it).
 *  Every id / `dataset.perio` is byte-identical to before — the keyboard +
 *  sync code locates cells by these, unchanged; only WHERE the cell sits in
 *  the DOM moves. */
function buildFieldCell(
  toothNo: number,
  field: "pd" | "gm" | "cal" | "bop",
  sites: readonly PerioSite[],
  aspect: "buccal" | "palatal",
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell");
  cell.dataset.perioAspect = aspect;
  cell.dataset.perioField = field;
  const group = mkEl("div", "perio-fullgrid-sitegroup");
  for (const site of sites) {
    if (field === "cal") {
      const span = mkEl("span", "perio-fullgrid-cal");
      span.id = `perio-fg-cal-${toothNo}-${site}`;
      group.appendChild(span);
      cells.cal[site] = span;
    } else if (field === "bop") {
      const input = mkEl("input", "perio-fullgrid-bop");
      input.type = "checkbox";
      input.id = `perio-fg-bop-${toothNo}-${site}`;
      input.title = t(`perio.site.${site}`);
      input.dataset.perio = `${toothNo}:${site}:bop`;
      input.addEventListener("change", () => handlers.onBop(toothNo, site, input.checked));
      group.appendChild(input);
      cells.bop[site] = input;
    } else if (field === "pd") {
      const input = mkEl("input", "perio-fullgrid-input");
      input.type = "number";
      input.min = "1";
      input.max = "15";
      input.step = "1";
      input.id = `perio-fg-pd-${toothNo}-${site}`;
      input.title = t(`perio.site.${site}`);
      input.dataset.perio = `${toothNo}:${site}:pd`;
      input.addEventListener("change", () => handlers.onPd(toothNo, site, input.value));
      group.appendChild(input);
      cells.pd[site] = input;
    } else {
      const input = mkEl("input", "perio-fullgrid-input");
      input.type = "number";
      input.min = "-10";
      input.max = "20";
      input.step = "1";
      input.id = `perio-fg-gm-${toothNo}-${site}`;
      input.title = t(`perio.site.${site}`);
      input.dataset.perio = `${toothNo}:${site}:gm`;
      input.addEventListener("change", () => handlers.onGm(toothNo, site, input.value));
      group.appendChild(input);
      cells.gm[site] = input;
    }
  }
  cell.appendChild(group);
  return cell;
}

/** SP-perio P2b Task 4: build ONE tooth's FURCATION cell — a compact
 *  cycle-button per {@link furcationEntrances} entrance (Glickman none->I->
 *  II->III->IV->none on click, via `setFurcation`). A tooth with NO furcated
 *  entrance for its position, OR one whose perio rows are hidden (missing /
 *  implant / under-gum / extraction — `isPerioRowHidden`), gets an EMPTY cell
 *  (no controls at all — furcation involvement only exists on a present,
 *  furcated tooth). The cell still occupies the tooth's grid column so the row
 *  stays column-aligned with the teeth. */
function buildFurcationCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-furcation");
  cell.dataset.perioField = "furcation";
  const entrances = furcationEntrances(toothNo);
  if (entrances.length === 0 || isPerioRowHidden(toothNo)) return cell; // empty placeholder
  const group = mkEl("div", "perio-fullgrid-sitegroup");
  for (const entrance of entrances) {
    const btn = mkEl("button", "perio-fullgrid-furc");
    btn.type = "button";
    btn.id = `perio-fg-furc-${toothNo}-${entrance}`;
    btn.dataset.furcEntrance = entrance;
    btn.title = t(`furcation.entrance.${entrance}`);
    btn.setAttribute("aria-label", t(`furcation.entrance.${entrance}`));
    btn.addEventListener("click", () => handlers.onFurcation(toothNo, entrance));
    group.appendChild(btn);
    cells.furcation[entrance] = btn;
  }
  cell.appendChild(group);
  return cell;
}

/** SP-perio P2b Task 4: build ONE tooth's PLAQUE cell — a 4-quadrant mark of
 *  toggle buttons (mesial/distal/buccal/lingual), each flipping O'Leary plaque
 *  presence for that surface via `setPlaque` on click. Built for EVERY tooth
 *  (the 4 surfaces are the same fixed set regardless of position) and disabled
 *  on a non-present tooth via `syncToothCells`, mirroring the PD/GM rows. */
function buildPlaqueCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-plaque");
  cell.dataset.perioField = "plaque";
  const group = mkEl("div", "perio-fullgrid-plaque-quad");
  for (const surface of PLAQUE_SURFACES) {
    const btn = mkEl("button", `perio-fullgrid-plaque perio-fullgrid-plaque-${surface}`);
    btn.type = "button";
    btn.id = `perio-fg-plaque-${toothNo}-${surface}`;
    btn.dataset.plaqueSurface = surface;
    btn.title = t(`surface.${surface}`);
    btn.setAttribute("aria-label", t(`surface.${surface}`));
    btn.addEventListener("click", () => handlers.onPlaque(toothNo, surface));
    group.appendChild(btn);
    cells.plaque[surface] = btn;
  }
  cell.appendChild(group);
  return cell;
}

/**
 * Build ONE arch band, re-laid into the reference (periodontalchart-online.com)
 * structure: the buccal-aspect number rows sit ABOVE the tooth graphic and the
 * palatal-aspect rows BELOW it, PD innermost on each side (nearest the teeth),
 * with the tooth-number header just above the graphic and a mobility row at the
 * foot. Everything shares ONE CSS grid (`132px` label column + one column per
 * tooth), so the tooth graphic (spanning `archCell`, tracks 2..N+1) and every
 * number column line up in the same coordinate space — the columns are widened
 * to the real per-tooth arch-layout widths once the template cache loads
 * (`applyArchColumns`). Reuses the P2 cell wiring via `buildFieldCell`; built
 * ONCE per active session (not React-controlled) — see the calling `useEffect`.
 */
function buildArch(teeth: readonly number[], registry: Map<number, ToothCellRefs>, handlers: GridHandlers): BuiltArch {
  const arch = mkEl("div", "perio-fullgrid-arch");
  arch.style.gridTemplateColumns = `${ROW_LABEL_WIDTH}px repeat(${teeth.length}, ${PROVISIONAL_COL_WIDTH}px)`;
  const isUpper = teeth.length > 0 && isUpperTooth(teeth[0]);

  // Initialise every tooth's cell registry up front — the buccal rows built
  // below reference these before the header row (which used to create them).
  for (const toothNo of teeth) {
    registry.set(toothNo, { pd: {}, gm: {}, bop: {}, cal: {}, mobility: null, furcation: {}, plaque: {} });
  }

  const buccalLabel = t("perio.buccal");
  const lingualLabel = isUpper ? t("perio.palatal") : t("perio.lingual");

  // Append one full field row (label cell + one field cell per tooth).
  const appendFieldRow = (
    field: "pd" | "gm" | "cal" | "bop",
    sites: readonly PerioSite[],
    aspect: "buccal" | "palatal",
    label: string,
  ) => {
    arch.appendChild(mkRowLabelCell(label));
    for (const toothNo of teeth) {
      arch.appendChild(buildFieldCell(toothNo, field, sites, aspect, registry.get(toothNo)!, handlers));
    }
  };

  // --- Plaque row (whole-tooth O'Leary index), at the very top ---
  arch.appendChild(mkRowLabelCell(t("plaque.label")));
  for (const toothNo of teeth) {
    arch.appendChild(buildPlaqueCell(toothNo, registry.get(toothNo)!, handlers));
  }

  // --- Buccal-aspect rows, ABOVE the graphic (PD innermost / nearest teeth) ---
  appendFieldRow("bop", BUCCAL_SITES, "buccal", `${buccalLabel} ${t("perio.bop")}`);
  appendFieldRow("cal", BUCCAL_SITES, "buccal", `${buccalLabel} ${t("perio.cal")}`);
  appendFieldRow("gm", BUCCAL_SITES, "buccal", `${buccalLabel} ${t("perio.gm")}`);
  appendFieldRow("pd", BUCCAL_SITES, "buccal", `${buccalLabel} ${t("perio.pd")}`);

  // --- Furcation row, nearest the teeth (just above the graphic) ---
  arch.appendChild(mkRowLabelCell(t("furcation.label")));
  for (const toothNo of teeth) {
    arch.appendChild(buildFurcationCell(toothNo, registry.get(toothNo)!, handlers));
  }

  // --- Tooth-number header row, just above the tooth graphic ---
  arch.appendChild(mkRowLabelCell(""));
  for (const toothNo of teeth) {
    const header = mkEl("div", "perio-fullgrid-header-cell");
    header.setAttribute("data-perio-tooth-header", String(toothNo));
    header.textContent = formatToothLabel(toothNo);
    arch.appendChild(header);
  }

  // --- Tooth-row graphic cell: spans all tooth columns (buccal teeth on top,
  //     palatal teeth mirrored below), filled by the graphic effect once the
  //     template cache loads. An empty sticky label cell keeps the label
  //     column continuous. ---
  arch.appendChild(mkRowLabelCell(""));
  const archCell = mkEl("div", "perio-fullgrid-graphic-cell");
  archCell.dataset.perioArch = isUpper ? "upper" : "lower";
  archCell.style.gridColumn = "2 / -1";
  arch.appendChild(archCell);

  // --- Palatal-aspect rows, BELOW the graphic (PD innermost / nearest teeth) ---
  appendFieldRow("pd", LINGUAL_SITES, "palatal", `${lingualLabel} ${t("perio.pd")}`);
  appendFieldRow("gm", LINGUAL_SITES, "palatal", `${lingualLabel} ${t("perio.gm")}`);
  appendFieldRow("cal", LINGUAL_SITES, "palatal", `${lingualLabel} ${t("perio.cal")}`);
  appendFieldRow("bop", LINGUAL_SITES, "palatal", `${lingualLabel} ${t("perio.bop")}`);

  // --- Mobility row: one select per tooth, no site subdivision. ---
  arch.appendChild(mkRowLabelCell(t("perio.mobility")));
  const mobilityOptions = optionsFor("mobility").map((o) => ({ value: o.value, label: t(o.labelKey) }));
  for (const toothNo of teeth) {
    const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-mobility");
    const select = mkEl("select", "perio-fullgrid-mobility-select");
    select.id = `perio-fg-mobility-${toothNo}`;
    for (const opt of mobilityOptions) {
      const optionEl = mkEl("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      select.appendChild(optionEl);
    }
    select.addEventListener("change", () => handlers.onMobility(toothNo, select.value));
    cell.appendChild(select);
    arch.appendChild(cell);
    registry.get(toothNo)!.mobility = select;
  }

  return { grid: arch, archCell };
}

/** Widen an already-built arch grid's tooth columns to the real per-tooth
 *  arch-layout widths (viewBox width + `TOOTH_GAP`, baked in — NO CSS
 *  column-gap — so the cumulative column edges match the arch SVG's per-tooth
 *  x positions exactly, with no progressive drift). Called once the template
 *  cache loads, so a tooth's number columns sit directly under/over that
 *  tooth in the graphic. */
function applyArchColumns(grid: HTMLElement | null, teeth: readonly number[], cache: TemplateDocCache): void {
  if (!grid) return;
  const layout = archToothLayout(cache, teeth);
  if (layout.teeth.length === 0) return;
  const cols = layout.teeth.map((tooth) => `${(tooth.width + TOOTH_GAP).toFixed(3)}px`).join(" ");
  grid.style.gridTemplateColumns = `${ROW_LABEL_WIDTH}px ${cols}`;
}

/**
 * Full-screen perio-chart overlay (periodontal-arc sub-project P2). Task 1
 * shipped the shell (dialog contract, open/close API) with an empty
 * `#perioOverlayGrid` placeholder; THIS task (Task 2) fills it with the full-mouth
 * grid + a summary bar, bound to the P1 data core
 * (`setPerioSite`/`getToothPerio`/`getToothCal`/`getPerioSummary`/
 * `getPerioChart`). Keyboard auto-advance between cells is Task 3 — plain
 * `change` listeners are enough here.
 *
 * The 32-tooth x 6-site grid (~450+ interactive cells) is built with plain
 * DOM (`buildArch`), NOT JSX/React state, and updated via targeted
 * `syncToothCells` calls rather than a full React re-render (R3 perf) — see
 * `syncOneTooth`/`fullResync` below. Only the compact summary bar is
 * React-controlled (`useState`), since re-rendering ~4 numbers on every edit
 * is cheap. `suppressResyncRef` prevents the grid's own edits from ALSO
 * triggering a redundant full resync via the `onStateChange` subscription
 * (setPerioSite/setToothMobility both fire it synchronously) — external
 * edits (dual-state chart-mode switch, or another consumer editing perio
 * data while the overlay is open) still trigger the full resync normally.
 *
 * Layers OVER the odontogram, which it never unmounts: `position: fixed`,
 * full-screen, high z-index (`.perio-overlay` in `index.css`). Mirrors
 * `SettingsModal`'s dialog contract — `role="dialog"` + `aria-modal`, Esc
 * closes, backdrop click closes, focus trap + focus-restore on close — on a
 * single element (`#perioOverlay` itself is the dialog; there is no separate
 * backdrop element, unlike `SettingsModal`).
 *
 * **"Dental Chart" graphical redesign, Task 1 (presentation only):** the
 * optional `inline` prop selects a second chrome for the SAME body (grid +
 * summary bar) — a plain panel (`#perioInlinePanel`) meant to fill the chart
 * area in place of the hidden-but-mounted odontogram, instead of the
 * fixed-position modal dialog. `open`/`onClose` are the MODAL chrome's
 * contract and are ignored when `inline` is true (the caller controls
 * mount/unmount of an inline instance directly via conditional rendering,
 * the same way any other React content area would be swapped) — there is
 * nothing to "close" in an embedded panel. Dialog-only concerns (focus
 * trap/restore, Esc-to-close, backdrop click, `role="dialog"`) do not apply
 * to the inline chrome at all.
 */
export default function PerioChart({
  open = false,
  onClose,
  inline = false,
}: {
  open?: boolean;
  onClose?: () => void;
  inline?: boolean;
}) {
  const active = inline || open;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The tooth-row graphic containers (`archCell`s) and the grid elements are
  // created inside the plain-DOM grid build (`buildArch`), NOT rendered as JSX
  // — the graphic sits INSIDE the number-row grid now (buccal rows above it,
  // palatal below), so these refs are assigned by the grid-building effect and
  // read by the graphic effect (which runs after it on the same commit).
  const archUpperRef = useRef<HTMLDivElement | null>(null);
  const archLowerRef = useRef<HTMLDivElement | null>(null);
  const gridUpperRef = useRef<HTMLDivElement | null>(null);
  const gridLowerRef = useRef<HTMLDivElement | null>(null);
  const archCacheRef = useRef<TemplateDocCache | null>(null);
  const registryRef = useRef<Map<number, ToothCellRefs> | null>(null);
  const suppressResyncRef = useRef(false);
  // Static default, NOT getPerioSummary() — this hook runs on every mount
  // regardless of `open` (PerioChart is always in <App/>'s tree, just
  // returns null while closed), so calling into "./odontogram" here would
  // defeat the point of deferring every real module call to the
  // `open`-gated effect below. Replaced with the real summary as soon as
  // that effect's first fullResync() runs.
  const [summary, setSummary] = useState<PerioSummaryData>(EMPTY_SUMMARY);

  const fullResync = useCallback(() => {
    const registry = registryRef.current;
    if (!registry) return;
    const chart = getPerioChart();
    const readOnly = getReadOnly();
    for (const [toothNo, cells] of registry) {
      const perio = chart[String(toothNo)] ?? EMPTY_PERIO;
      syncToothCells(cells, toothNo, perio, getToothCal(toothNo), readOnly);
    }
    setSummary(getPerioSummary());
  }, []);

  const syncOneTooth = useCallback((toothNo: number) => {
    const registry = registryRef.current;
    if (!registry) return;
    const cells = registry.get(toothNo);
    if (!cells) return;
    syncToothCells(cells, toothNo, getToothPerio(toothNo), getToothCal(toothNo), getReadOnly());
    setSummary(getPerioSummary());
  }, []);

  // Move focus to a `nextPerioCell`/`prevPerioCell` coordinate's INPUT, if it
  // exists and is currently enabled (an uncharted/hidden/read-only cell is
  // `disabled` — never steal focus onto an element that can't accept it; a
  // real browser silently refuses `.focus()` on a disabled control anyway,
  // this guard just makes that explicit/verifiable rather than incidental).
  const focusPerioCell = useCallback((coord: PerioCellCoord | null) => {
    if (!coord) return;
    const registry = registryRef.current;
    if (!registry) return;
    const cells = registry.get(coord.toothNo);
    if (!cells) return;
    const el = cells[coord.row][coord.site];
    if (el && !el.disabled) el.focus();
  }, []);

  // Task 3: keyboard auto-advance + navigation, delegated on the grid
  // container (the ~450+ cells are plain DOM, not JSX — see the class-level
  // doc comment — so this is one native `keydown` listener, not a per-cell
  // React handler). Cells are located via `data-perio="{toothNo}:{site}:{row}"`
  // (set in `buildArch`). ALL value writes still go through `setPerioSite`
  // (never a second mutation path) — this only decides WHAT to write and
  // WHERE to move focus next; `syncOneTooth` re-syncs the edited cell from
  // state exactly like the existing `change`-event handlers do.
  //
  // PD digit: a single 2-9 keystroke commits `pd` immediately (0 un-charts —
  // `setPerioSite`'s own P1 semantics, no special-casing needed here) and
  // advances to `nextPerioCell`. A `1` keystroke commits an interim `pd` of
  // 1, primes `dataset.pendingTens` (mirrors `dataset.pendingSign` below —
  // NOT `.value`, for the same jsdom/browser value-sanitization reason), and
  // withholds the advance so a FOLLOWING `0`-`5` digit can compose 10-15
  // (deferred P2 fix — PD 10-15 were previously unreachable via single-digit
  // auto-advance). Any other key while primed (not `0`-`5`) clears the prime
  // — the already-committed value of 1 stands — and is NOT swallowed: it
  // falls through to be handled normally below (arrow keys navigate, a
  // digit 6-9 overwrites+advances as a fresh single-digit entry, anything
  // else is a no-op at the current cell). GM digit: same auto-advance,
  // except a leading `-` keystroke first primes the field — tracked ONLY
  // via a `dataset.pendingSign`
  // marker on the input, NOT its `.value` (a bare `-` is not a valid
  // `<input type="number">` value, so the browser's, and jsdom's, own
  // value-sanitization algorithm silently resets it back to `""` the
  // instant it's assigned, making `.value` an unreliable place to stash an
  // in-progress sign) — so the FOLLOWING digit composes a negative reading;
  // a bare digit with no primed `-` commits a positive reading. Any other
  // key on a gm cell (arrows, Tab, etc.) clears a stale prime, so navigating
  // away via a KEY without finishing the digit never leaks a sign into a
  // later, unrelated entry; the delegated `focusout` handler below (see
  // `handleGridFocusOut`) covers the same case for a NON-keyboard focus
  // change (e.g. a mouse click to another cell), which this keydown handler
  // alone cannot see. Arrow keys move focus only — never write state.
  // Space/Enter on a BOP cell toggles it. `getReadOnly()` is checked
  // explicitly up front (belt-and-braces on top of the cells' own `disabled`
  // attribute, which already blocks real browser focus/keydown on a
  // read-only grid) so the no-op is verifiable even when a test dispatches a
  // keydown directly at a DOM node.
  const handleGridKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (getReadOnly()) return;
      const target = e.target as HTMLElement | null;
      const coordStr = target?.dataset?.perio;
      if (!coordStr) return;
      const [toothStr, siteStr, rowStr] = coordStr.split(":");
      const toothNo = Number(toothStr);
      const site = siteStr as PerioSite;

      if (rowStr === "bop") {
        if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
          e.preventDefault();
          const checkbox = target as HTMLInputElement;
          const next = !checkbox.checked;
          suppressResyncRef.current = true;
          setPerioSite(toothNo, site, { bop: next });
          suppressResyncRef.current = false;
          syncOneTooth(toothNo);
        }
        return;
      }

      const row = rowStr as "pd" | "gm";
      const cur: PerioCellCoord = { toothNo, site, row };
      const input = target as HTMLInputElement;
      const isDigit = /^[0-9]$/.test(e.key);

      // Any key other than the `-`/digit pair that composes a gm reading
      // cancels a pending sign (see the doc comment above).
      if (row === "gm" && input.dataset.pendingSign && e.key !== "-" && !isDigit) {
        delete input.dataset.pendingSign;
      }

      // PD tens-composition (see doc comment above): a primed '1' composes
      // with a following 0-5 digit into 10-15. Any other key just clears
      // the prime and falls through unswallowed to the rest of this
      // handler (arrow keys / a fresh digit / anything else).
      if (row === "pd" && input.dataset.pendingTens === "1") {
        if (/^[0-5]$/.test(e.key)) {
          e.preventDefault();
          delete input.dataset.pendingTens;
          suppressResyncRef.current = true;
          setPerioSite(toothNo, site, { pd: Number(`1${e.key}`) });
          suppressResyncRef.current = false;
          syncOneTooth(toothNo);
          focusPerioCell(nextPerioCell(cur));
          return;
        }
        delete input.dataset.pendingTens;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusPerioCell(nextPerioCell(cur));
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusPerioCell(prevPerioCell(cur));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusPerioCell({ toothNo, site, row: "pd" });
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusPerioCell({ toothNo, site, row: "gm" });
        return;
      }

      if (row === "gm" && e.key === "-") {
        e.preventDefault();
        input.dataset.pendingSign = "-";
        return;
      }

      if (isDigit) {
        e.preventDefault();
        if (row === "pd" && e.key === "1") {
          suppressResyncRef.current = true;
          setPerioSite(toothNo, site, { pd: 1 });
          suppressResyncRef.current = false;
          syncOneTooth(toothNo);
          input.dataset.pendingTens = "1";
          return; // withhold advance — a following 0-5 digit may compose 10-15
        }
        suppressResyncRef.current = true;
        if (row === "pd") {
          setPerioSite(toothNo, site, { pd: Number(e.key) });
        } else {
          const composed = input.dataset.pendingSign === "-" ? `-${e.key}` : e.key;
          delete input.dataset.pendingSign;
          setPerioSite(toothNo, site, { gm: Number(composed) });
        }
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
        focusPerioCell(nextPerioCell(cur));
      }
    },
    [focusPerioCell, syncOneTooth],
  );

  // Review fix (P2 Task 3, Finding 1 — silent negative-value bug): a primed
  // `-` (`dataset.pendingSign`, see the doc comment above `handleGridKeyDown`)
  // must be cleared on ANY loss of focus from the gm cell that primed it, not
  // only by a subsequent keydown on that same input. Without this, priming
  // `-` then leaving the cell via a non-keyboard focus change (mouse click on
  // another cell — no keydown fires on the primed input at all) leaves the
  // marker stuck on that DOM node; returning to the SAME cell later and
  // typing a plain digit would then silently compose a NEGATIVE value even
  // though no `-` was pressed this time — clinically wrong (gm sign flips
  // recession vs. pseudopocket meaning). Delegated via `focusout` (bubbles,
  // unlike `blur`) on the grid container, mirroring the delegated `keydown`
  // handler. Only ever clears the marker — never touches the cell's value or
  // calls `setPerioSite`.
  //
  // Deferred fix (P2 follow-up, Task 1): the SAME stale-prime bug applies to
  // a primed PD `dataset.pendingTens` — clear it here too, or leaving a
  // primed PD cell via a non-keyboard focus change and later returning to
  // type a plain digit would silently compose it as a tens-completion.
  const handleGridFocusOut = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.dataset?.pendingSign) delete target.dataset.pendingSign;
    if (target?.dataset?.pendingTens) delete target.dataset.pendingTens;
  }, []);

  // Capture the opener + move focus into the dialog when it opens; restore
  // focus to the opener when it closes/unmounts. MODAL-ONLY — an inline panel
  // is embedded page content, not a dialog, so mounting it must never steal
  // focus the way opening a modal legitimately does.
  useEffect(() => {
    if (inline || !open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [inline, open]);

  // Build the grid fresh each time this becomes active — either the modal
  // opens, or an inline instance mounts (its DOM is fully torn down when
  // inactive — `if (!active) return null` below — so `scrollRef` is a
  // brand-new node each time) — and subscribe to onStateChange for the
  // lifetime of this active session only.
  useEffect(() => {
    if (!active) return;
    const container = scrollRef.current;
    if (!container) return;
    const registry = new Map<number, ToothCellRefs>();
    const handlers: GridHandlers = {
      onPd: (toothNo, site, raw) => {
        const trimmed = raw.trim();
        suppressResyncRef.current = true;
        setPerioSite(toothNo, site, { pd: trimmed === "" ? null : Number(trimmed) });
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onGm: (toothNo, site, raw) => {
        const trimmed = raw.trim();
        if (trimmed === "") return; // no explicit gm edit -> no-op (gm has no "unset" signal)
        suppressResyncRef.current = true;
        setPerioSite(toothNo, site, { gm: Number(trimmed) });
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onBop: (toothNo, site, checked) => {
        suppressResyncRef.current = true;
        setPerioSite(toothNo, site, { bop: checked });
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onMobility: (toothNo, value) => {
        suppressResyncRef.current = true;
        setToothMobility(toothNo, value);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      // SP-perio P2b Task 4: cycle the Glickman grade none->I->II->III->IV->
      // none for one entrance. The current grade is read from the ACTIVE
      // chart (getToothFurcation) so a dual-state switch cycles the right
      // chart; the write always goes through setFurcation (no new mutation
      // path). grade 4 wraps to `null` (clears the entrance).
      onFurcation: (toothNo, entrance) => {
        const cur = getToothFurcation(toothNo)[entrance];
        const next = cur === undefined ? 1 : cur >= 4 ? null : cur + 1;
        suppressResyncRef.current = true;
        setFurcation(toothNo, entrance, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      // SP-perio P2b Task 4: toggle one O'Leary plaque surface via setPlaque.
      onPlaque: (toothNo, surface) => {
        const present = getToothPlaque(toothNo).includes(surface);
        suppressResyncRef.current = true;
        setPlaque(toothNo, surface, !present);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
    };
    container.innerHTML = "";
    const upper = buildArch(UPPER_ARCH, registry, handlers);
    const lower = buildArch(LOWER_ARCH, registry, handlers);
    container.appendChild(upper.grid);
    container.appendChild(lower.grid);
    registryRef.current = registry;
    gridUpperRef.current = upper.grid;
    gridLowerRef.current = lower.grid;
    archUpperRef.current = upper.archCell;
    archLowerRef.current = lower.archCell;
    fullResync();
    container.addEventListener("keydown", handleGridKeyDown);
    container.addEventListener("focusout", handleGridFocusOut);

    const unsubscribe = onStateChange(() => {
      if (suppressResyncRef.current) return;
      fullResync();
    });
    return () => {
      container.removeEventListener("keydown", handleGridKeyDown);
      container.removeEventListener("focusout", handleGridFocusOut);
      unsubscribe();
      registryRef.current = null;
      gridUpperRef.current = null;
      gridLowerRef.current = null;
      archUpperRef.current = null;
      archLowerRef.current = null;
    };
  }, [active, fullResync, syncOneTooth, handleGridKeyDown, handleGridFocusOut]);

  // "Dental Chart" graphical redesign, Task 2: the tooth-row graphic — draws
  // the perio arch by reusing the odontogram's own `tooth-base` artwork
  // (see `perioGraphic.ts`). Fully READ-ONLY (no pointer handlers) and
  // independent of the grid-building effect above — it fetches + parses the
  // 4 tooth templates once (`loadTemplateCache()`, memoized at module scope
  // in `perioGraphic.ts`, so re-opening/re-mounting this component never
  // re-fetches) and, once loaded, builds one composite arch SVG per arch
  // band into its own container. A load failure (e.g. no network) is
  // swallowed — this graphic is a presentation enhancement over the
  // existing data grid, never a hard dependency for charting to work.
  //
  // "Dental Chart" graphical redesign, Task 3: the curve overlay (CEJ +
  // gingival-margin + pocket-base line + a filled band) is drawn OVER each
  // arch SVG here, driven by the per-site PD/GM data via `perioCurve` /
  // `buildPerioCurveLayer` (see `drawArchCurves`). It reuses the SAME layout
  // constants (`archToothLayout` / `ROW_BASELINE_Y` / `MIRROR_AXIS_Y`) T2 laid
  // the teeth out with, so it can never drift out of alignment. A dedicated
  // `onStateChange` subscription (NOT gated by `suppressResyncRef` — the grid
  // suppress flag only exists to skip a redundant *grid* fullResync on the
  // grid's own edit; the curve genuinely must redraw on every edit, grid or
  // external) recomputes the curves from the active chart, so they live-update
  // and reflect the status/plan chart. All still READ-ONLY — no pointer
  // handlers, all data via the P1 API.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const redraw = () => {
      const cache = archCacheRef.current;
      if (!cache) return;
      drawArchCurves(cache, archUpperRef.current, UPPER_ARCH);
      drawArchCurves(cache, archLowerRef.current, LOWER_ARCH);
    };
    loadTemplateCache()
      .then((cache) => {
        if (cancelled) return;
        archCacheRef.current = cache;
        // Align the number-row columns to the real per-tooth arch widths so a
        // tooth's cells sit directly under/over that tooth (resolves the
        // T2-deferred "grid doesn't line up column-for-column with the teeth").
        applyArchColumns(gridUpperRef.current, UPPER_ARCH, cache);
        applyArchColumns(gridLowerRef.current, LOWER_ARCH, cache);
        const upperContainer = archUpperRef.current;
        const lowerContainer = archLowerRef.current;
        if (upperContainer) {
          upperContainer.innerHTML = "";
          upperContainer.appendChild(buildArchGraphic(cache, UPPER_ARCH));
        }
        if (lowerContainer) {
          lowerContainer.innerHTML = "";
          lowerContainer.appendChild(buildArchGraphic(cache, LOWER_ARCH));
        }
        redraw();
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("perio tooth-row graphic: failed to load tooth templates", err);
      });
    const unsubscribe = onStateChange(() => {
      if (!cancelled) redraw();
    });
    return () => {
      cancelled = true;
      unsubscribe();
      archCacheRef.current = null;
    };
  }, [active]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [onClose],
  );

  if (!active) return null;

  const worstCalText =
    summary.worstCal === null
      ? "–"
      : `${summary.worstCal}${summary.worstCalTooth !== null ? ` (${formatToothLabel(summary.worstCalTooth)})` : ""}`;

  // Shared body (grid + summary bar) — identical in both chrome variants,
  // only the wrapping id/class differs (`#perioInlineGrid` vs
  // `#perioOverlayGrid`) so the two never collide with each other or with the
  // P1 tooth-panel's always-present `#perioGrid`.
  const gridBody = (
    <div id={inline ? "perioInlineGrid" : "perioOverlayGrid"} className="perio-overlay-body" aria-label={t("perio.chart.title")}>
      <div className="perio-fullgrid-summary" role="status">
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.avgPd")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-avgpd">
            {summary.avgPd === null ? "–" : summary.avgPd}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.avgCal")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-avgcal">
            {summary.avgCal === null ? "–" : summary.avgCal}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.bopPercent")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-bop">
            {summary.bopPercent}%
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.charted")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-charted">
            {summary.chartedSites}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.worstCal")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-cal">
            {worstCalText}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.maxPd")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-maxpd">
            {summary.maxPd === null ? "–" : summary.maxPd}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.maxFurcation")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-maxfurc">
            {summary.maxFurcation === null ? "–" : FURCATION_ROMAN[summary.maxFurcation]}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("plaque.percent")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-plaque">
            {summary.plaquePercent}%
          </span>
        </span>
      </div>
      <div className="perio-fullgrid-scroll" ref={scrollRef}></div>
    </div>
  );

  if (inline) {
    // Plain embedded panel — no dialog semantics, no close button, no
    // backdrop/Esc/focus-trap (see the class-level doc comment). Reuses the
    // existing `.chart`/`.chart-header`/`.chart-title` card look (index.css)
    // so it visually matches the odontogram card it's replacing in place.
    return (
      <section id="perioInlinePanel" className="chart perio-inline-panel" aria-label={t("perio.chart.title")}>
        <div className="chart-header">
          <div className="chart-title">{t("perio.chart.title")}</div>
        </div>
        {gridBody}
      </section>
    );
  }

  return (
    <div
      ref={dialogRef}
      id="perioOverlay"
      className="perio-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="perio-overlay-panel">
        <div className="perio-overlay-header">
          <h2 className="perio-overlay-title" id={titleId}>
            {t("perio.chart.title")}
          </h2>
          <button
            type="button"
            className="perio-overlay-close"
            onClick={onClose}
            aria-label={t("perio.close")}
            title={t("perio.close")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {gridBody}
      </div>
    </div>
  );
}
