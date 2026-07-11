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
  isPerioRowHidden,
  getReadOnly,
  onStateChange,
  nextPerioCell,
  prevPerioCell,
  type PerioCellCoord,
} from "./odontogram";

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
};

type ToothCellRefs = {
  pd: Partial<Record<PerioSite, HTMLInputElement>>;
  gm: Partial<Record<PerioSite, HTMLInputElement>>;
  bop: Partial<Record<PerioSite, HTMLInputElement>>;
  cal: Partial<Record<PerioSite, HTMLSpanElement>>;
  mobility: HTMLSelectElement | null;
};

type GridHandlers = {
  onPd: (toothNo: number, site: PerioSite, raw: string) => void;
  onGm: (toothNo: number, site: PerioSite, raw: string) => void;
  onBop: (toothNo: number, site: PerioSite, checked: boolean) => void;
  onMobility: (toothNo: number, value: string) => void;
};

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
}

/** Build one arch band's dense grid (header row + 4 buccal + 4 lingual/
 *  palatal field rows + a mobility row), appending every tooth's cell refs
 *  into `registry` as it goes. Built ONCE per overlay-open (not
 *  React-controlled) — see the perf note on the calling `useEffect`. */
function buildArch(teeth: readonly number[], registry: Map<number, ToothCellRefs>, handlers: GridHandlers): HTMLDivElement {
  const arch = mkEl("div", "perio-fullgrid-arch");
  arch.style.gridTemplateColumns = `132px repeat(${teeth.length}, minmax(64px, 1fr))`;
  const isUpper = teeth.length > 0 && isUpperTooth(teeth[0]);

  // Header row: corner cell + one tooth-number cell per column.
  arch.appendChild(mkRowLabelCell(""));
  for (const toothNo of teeth) {
    const header = mkEl("div", "perio-fullgrid-header-cell");
    header.setAttribute("data-perio-tooth-header", String(toothNo));
    header.textContent = formatToothLabel(toothNo);
    arch.appendChild(header);
    registry.set(toothNo, { pd: {}, gm: {}, bop: {}, cal: {}, mobility: null });
  }

  const buccalLabel = t("perio.buccal");
  const lingualLabel = isUpper ? t("perio.palatal") : t("perio.lingual");

  const fieldRows: { field: "pd" | "gm" | "cal" | "bop"; sites: readonly PerioSite[]; label: string }[] = [
    { field: "pd", sites: BUCCAL_SITES, label: `${buccalLabel} ${t("perio.pd")}` },
    { field: "gm", sites: BUCCAL_SITES, label: `${buccalLabel} ${t("perio.gm")}` },
    { field: "cal", sites: BUCCAL_SITES, label: `${buccalLabel} ${t("perio.cal")}` },
    { field: "bop", sites: BUCCAL_SITES, label: `${buccalLabel} ${t("perio.bop")}` },
    { field: "pd", sites: LINGUAL_SITES, label: `${lingualLabel} ${t("perio.pd")}` },
    { field: "gm", sites: LINGUAL_SITES, label: `${lingualLabel} ${t("perio.gm")}` },
    { field: "cal", sites: LINGUAL_SITES, label: `${lingualLabel} ${t("perio.cal")}` },
    { field: "bop", sites: LINGUAL_SITES, label: `${lingualLabel} ${t("perio.bop")}` },
  ];

  for (const row of fieldRows) {
    arch.appendChild(mkRowLabelCell(row.label));
    for (const toothNo of teeth) {
      const cell = mkEl("div", "perio-fullgrid-cell");
      const group = mkEl("div", "perio-fullgrid-sitegroup");
      const cells = registry.get(toothNo)!;
      for (const site of row.sites) {
        if (row.field === "cal") {
          const span = mkEl("span", "perio-fullgrid-cal");
          span.id = `perio-fg-cal-${toothNo}-${site}`;
          group.appendChild(span);
          cells.cal[site] = span;
        } else if (row.field === "bop") {
          const input = mkEl("input", "perio-fullgrid-bop");
          input.type = "checkbox";
          input.id = `perio-fg-bop-${toothNo}-${site}`;
          input.title = t(`perio.site.${site}`);
          input.dataset.perio = `${toothNo}:${site}:bop`;
          input.addEventListener("change", () => handlers.onBop(toothNo, site, input.checked));
          group.appendChild(input);
          cells.bop[site] = input;
        } else if (row.field === "pd") {
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
      arch.appendChild(cell);
    }
  }

  // Mobility row: one select per tooth, no site subdivision.
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

  return arch;
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
 */
export default function PerioChart({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const scrollRef = useRef<HTMLDivElement | null>(null);
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
  // PD digit: a single 0-9 keystroke commits `pd` immediately (0 un-charts —
  // `setPerioSite`'s own P1 semantics, no special-casing needed here) and
  // advances to `nextPerioCell`. GM digit: same, except a leading `-`
  // keystroke first primes the field — tracked ONLY via a `dataset.pendingSign`
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
  const handleGridFocusOut = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.dataset?.pendingSign) delete target.dataset.pendingSign;
  }, []);

  // Capture the opener + move focus into the dialog when it opens; restore
  // focus to the opener when it closes/unmounts.
  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [open]);

  // Build the grid fresh each time the overlay opens (its DOM is fully
  // unmounted on close — `if (!open) return null` below — so `scrollRef` is
  // a brand-new node each time) and subscribe to onStateChange for the
  // lifetime of this open session only.
  useEffect(() => {
    if (!open) return;
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
    };
    container.innerHTML = "";
    container.appendChild(buildArch(UPPER_ARCH, registry, handlers));
    container.appendChild(buildArch(LOWER_ARCH, registry, handlers));
    registryRef.current = registry;
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
    };
  }, [open, fullResync, syncOneTooth, handleGridKeyDown, handleGridFocusOut]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const worstCalText =
    summary.worstCal === null
      ? "–"
      : `${summary.worstCal}${summary.worstCalTooth !== null ? ` (${formatToothLabel(summary.worstCalTooth)})` : ""}`;

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
        if (e.target === e.currentTarget) onClose();
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
        <div id="perioOverlayGrid" className="perio-overlay-body" aria-label={t("perio.chart.title")}>
          <div className="perio-fullgrid-summary" role="status">
            <span className="perio-fullgrid-summary-item">
              <span className="perio-fullgrid-summary-label">{t("perio.summary.charted")}</span>
              <span className="perio-fullgrid-summary-value" id="perio-fg-summary-charted">
                {summary.chartedSites}
              </span>
            </span>
            <span className="perio-fullgrid-summary-item">
              <span className="perio-fullgrid-summary-label">{t("perio.bopPercent")}</span>
              <span className="perio-fullgrid-summary-value" id="perio-fg-summary-bop">
                {summary.bopPercent}%
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
          </div>
          <div className="perio-fullgrid-scroll" ref={scrollRef}></div>
        </div>
      </div>
    </div>
  );
}
