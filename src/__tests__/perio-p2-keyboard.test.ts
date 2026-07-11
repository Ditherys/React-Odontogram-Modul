// Periodontal-arc sub-project P2, Task 3: keyboard auto-advance + navigation
// on the full-mouth perio-chart grid. P2 Task 2 (committed) shipped the grid
// itself, bound to the P1 data core via plain `change`/`click` listeners.
// THIS task adds a delegated `keydown` handler (see `PerioChart.tsx`) so a
// clinician can chart a full mouth with single keystrokes: a digit on a PD
// cell commits + auto-advances to `nextPerioCell`'s cell; arrow keys move
// focus; Space/Enter toggles BOP. All value writes still go through the
// EXISTING `setPerioSite` path — this suite never bypasses it.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import PerioChart from "../PerioChart";
import {
  __resetChartStateForTest,
  setNumberingSystem,
  getToothPerio,
  getToothCal,
  setPerioSite,
  setReadOnly,
  nextPerioCell,
  prevPerioCell,
} from "../odontogram";

const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function openGrid() {
  return render(createElement(PerioChart, { open: true, onClose: () => {} }));
}

function pd(toothNo: number, site: string): HTMLInputElement {
  return document.getElementById(`perio-fg-pd-${toothNo}-${site}`) as HTMLInputElement;
}
function gm(toothNo: number, site: string): HTMLInputElement {
  return document.getElementById(`perio-fg-gm-${toothNo}-${site}`) as HTMLInputElement;
}
function bop(toothNo: number, site: string): HTMLInputElement {
  return document.getElementById(`perio-fg-bop-${toothNo}-${site}`) as HTMLInputElement;
}

beforeEach(() => {
  cleanup();
  document.body.innerHTML = "";
  __resetChartStateForTest();
  setNumberingSystem("FDI");
  setReadOnly(false);
});

afterEach(() => {
  cleanup();
  setReadOnly(false);
});

describe("P2 Task 3: nextPerioCell / prevPerioCell — pure charting order", () => {
  it("advances MB -> B -> DB within a tooth (pd row)", () => {
    expect(nextPerioCell({ toothNo: 18, site: "MB", row: "pd" })).toEqual({ toothNo: 18, site: "B", row: "pd" });
    expect(nextPerioCell({ toothNo: 18, site: "B", row: "pd" })).toEqual({ toothNo: 18, site: "DB", row: "pd" });
  });

  it("after DB, advances to the next tooth's MB, in arch order (upper then lower)", () => {
    expect(nextPerioCell({ toothNo: 18, site: "DB", row: "pd" })).toEqual({ toothNo: 17, site: "MB", row: "pd" });
    // last upper-arch tooth (28) DB -> first lower-arch tooth (48) MB
    expect(nextPerioCell({ toothNo: 28, site: "DB", row: "pd" })).toEqual({ toothNo: 48, site: "MB", row: "pd" });
  });

  it("end of the buccal group (last tooth's DB) wraps into the lingual group's first tooth/site", () => {
    expect(nextPerioCell({ toothNo: 38, site: "DB", row: "pd" })).toEqual({ toothNo: 18, site: "ML", row: "pd" });
  });

  it("end of the pd row (last tooth's DL) wraps into the gm row's first tooth/site", () => {
    expect(nextPerioCell({ toothNo: 38, site: "DL", row: "pd" })).toEqual({ toothNo: 18, site: "MB", row: "gm" });
  });

  it("the very last cell (last tooth's DL, gm row) has no next cell", () => {
    expect(nextPerioCell({ toothNo: 38, site: "DL", row: "gm" })).toBeNull();
  });

  it("an unrecognized cell returns null", () => {
    expect(nextPerioCell({ toothNo: 18, site: "XX", row: "pd" })).toBeNull();
  });

  it("prevPerioCell is the exact reverse of nextPerioCell", () => {
    const cur = { toothNo: 26, site: "L", row: "pd" as const };
    const next = nextPerioCell(cur)!;
    expect(prevPerioCell(next)).toEqual(cur);
    expect(prevPerioCell({ toothNo: 18, site: "MB", row: "pd" })).toBeNull();
  });
});

describe("P2 Task 3: digit keydown commits + auto-advances (PD)", () => {
  it("dispatching keydown '3' on a PD cell sets the value AND moves focus to the next site's PD cell", () => {
    openGrid();
    const cell = pd(18, "MB");
    cell.focus();
    expect(document.activeElement).toBe(cell);

    fireEvent.keyDown(cell, { key: "3" });

    expect(getToothPerio(18).pd.MB).toBe(3);
    expect(document.activeElement).toBe(pd(18, "B"));
  });

  it("chains across an entire tooth (MB,B,DB) then to the next tooth", () => {
    openGrid();
    pd(18, "MB").focus();
    fireEvent.keyDown(pd(18, "MB"), { key: "5" });
    expect(document.activeElement).toBe(pd(18, "B"));
    fireEvent.keyDown(pd(18, "B"), { key: "4" });
    expect(document.activeElement).toBe(pd(18, "DB"));
    fireEvent.keyDown(pd(18, "DB"), { key: "3" });
    expect(document.activeElement).toBe(pd(17, "MB"));

    expect(getToothPerio(18).pd).toEqual({ MB: 5, B: 4, DB: 3 });
  });

  it("digit '0' un-charts the site via the existing setPerioSite semantics, and still advances", () => {
    openGrid();
    const cell = pd(26, "MB");
    fireEvent.change(cell, { target: { value: "4" } });
    expect(getToothPerio(26).pd.MB).toBe(4);

    cell.focus();
    fireEvent.keyDown(cell, { key: "0" });

    expect(getToothPerio(26).pd.MB).toBeUndefined();
    expect(document.activeElement).toBe(pd(26, "B"));
  });
});

describe("P2 Task 3: GM digit entry (leading '-' for recession-negative)", () => {
  it("a bare digit on GM commits a positive reading and advances", () => {
    openGrid();
    // Chart pd on both B and DB so the DB gm cell nextPerioCell lands on is
    // enabled (gm is only editable for an already-charted site).
    fireEvent.change(pd(14, "B"), { target: { value: "3" } });
    fireEvent.change(pd(14, "DB"), { target: { value: "5" } });
    const cell = gm(14, "B");
    cell.focus();

    fireEvent.keyDown(cell, { key: "2" });

    expect(getToothPerio(14).gm.B).toBe(2);
    expect(document.activeElement).toBe(gm(14, "DB"));
  });

  it("'-' then a digit commits a negative (coronal/pseudopocket) reading", () => {
    openGrid();
    fireEvent.change(pd(14, "B"), { target: { value: "3" } });
    fireEvent.change(pd(14, "DB"), { target: { value: "5" } });
    const cell = gm(14, "B");
    cell.focus();

    fireEvent.keyDown(cell, { key: "-" });
    expect(cell.dataset.pendingSign).toBe("-"); // primed, not yet committed
    expect(getToothPerio(14).gm.B).toBeUndefined();

    fireEvent.keyDown(cell, { key: "2" });

    expect(getToothPerio(14).gm.B).toBe(-2);
    expect(getToothCal(14).get("B")).toBe(1); // CAL = pd(3) + gm(-2)
    expect(document.activeElement).toBe(gm(14, "DB"));
  });

  // Regression test for review Finding 1 (Medium, silent clinical data
  // corruption): a primed '-' must NOT survive a non-keyboard focus change
  // (e.g. a mouse click to another cell fires no keydown on the primed
  // input at all, so the old keydown-only clearing never ran). Before the
  // fix, refocusing the SAME gm cell later and typing a plain digit would
  // silently compose a negative value even though '-' was never pressed
  // this time.
  it("a primed '-' does NOT survive a non-keyboard focus change (blur/focusout clears it)", () => {
    openGrid();
    fireEvent.change(pd(14, "B"), { target: { value: "3" } });
    fireEvent.change(pd(14, "DB"), { target: { value: "5" } });
    const cell = gm(14, "B");
    const other = gm(14, "DB");
    cell.focus();

    fireEvent.keyDown(cell, { key: "-" });
    expect(cell.dataset.pendingSign).toBe("-"); // primed, not yet committed

    // Leave the cell via a plain focus change — NO keydown fires on `cell`.
    other.focus();
    fireEvent.focusOut(cell, { relatedTarget: other });

    expect(cell.dataset.pendingSign).toBeUndefined(); // prime must be cleared

    // Return to the SAME cell and type a plain digit — must commit POSITIVE.
    cell.focus();
    fireEvent.keyDown(cell, { key: "7" });

    expect(getToothPerio(14).gm.B).toBe(7);
  });
});

describe("P2 Task 3: arrow-key navigation", () => {
  it("ArrowRight/ArrowLeft move focus within a row (site-by-site, tooth-to-tooth) without writing state", () => {
    openGrid();
    const start = pd(18, "MB");
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(document.activeElement).toBe(pd(18, "B"));

    fireEvent.keyDown(pd(18, "B"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(pd(18, "DB"));

    fireEvent.keyDown(pd(18, "DB"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(pd(18, "B"));

    // No PD was ever set by pure navigation.
    expect(getToothPerio(18).pd).toEqual({});
  });

  it("ArrowDown moves from a charted PD cell to its (now-enabled) GM cell; ArrowUp moves back", () => {
    openGrid();
    fireEvent.change(pd(26, "L"), { target: { value: "4" } });
    const pdCell = pd(26, "L");
    pdCell.focus();

    fireEvent.keyDown(pdCell, { key: "ArrowDown" });
    expect(document.activeElement).toBe(gm(26, "L"));

    fireEvent.keyDown(gm(26, "L"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(pdCell);
  });

  it("ArrowDown to an un-charted (disabled) GM cell does not move focus", () => {
    openGrid();
    const pdCell = pd(26, "DL");
    pdCell.focus();

    fireEvent.keyDown(pdCell, { key: "ArrowDown" });

    expect(document.activeElement).toBe(pdCell);
  });
});

describe("P2 Task 3: Space/Enter toggles BOP", () => {
  it("Space on a focused BOP cell toggles it via setPerioSite", () => {
    openGrid();
    fireEvent.change(pd(26, "MB"), { target: { value: "4" } });
    const bopCell = bop(26, "MB");
    bopCell.focus();

    fireEvent.keyDown(bopCell, { key: " " });
    expect(getToothPerio(26).bop).toEqual(["MB"]);
    expect(bopCell.checked).toBe(true);

    fireEvent.keyDown(bopCell, { key: " " });
    expect(getToothPerio(26).bop).toEqual([]);
    expect(bopCell.checked).toBe(false);
  });

  it("Enter on a focused BOP cell also toggles it", () => {
    openGrid();
    fireEvent.change(pd(26, "MB"), { target: { value: "4" } });
    const bopCell = bop(26, "MB");
    bopCell.focus();

    fireEvent.keyDown(bopCell, { key: "Enter" });
    expect(getToothPerio(26).bop).toEqual(["MB"]);
  });
});

describe("P2 Task 3: clearing a PD cell un-charts (existing change-event path)", () => {
  it("emptying a charted PD cell removes pd/gm/bop/cal for that site", () => {
    openGrid();
    const pdCell = pd(26, "MB");
    fireEvent.change(pdCell, { target: { value: "4" } });
    fireEvent.change(gm(26, "MB"), { target: { value: "2" } });
    fireEvent.click(bop(26, "MB"));
    expect(getToothPerio(26).pd.MB).toBe(4);
    expect(getToothCal(26).get("MB")).toBe(6);
    expect(getToothPerio(26).bop).toEqual(["MB"]);

    fireEvent.change(pdCell, { target: { value: "" } });

    expect(getToothPerio(26).pd.MB).toBeUndefined();
    expect(getToothPerio(26).gm.MB).toBeUndefined();
    expect(getToothPerio(26).bop).toEqual([]);
    expect(getToothCal(26).get("MB")).toBeUndefined();
    expect(document.getElementById("perio-fg-cal-26-MB")!.textContent).toBe("");
  });
});

describe("P2 Task 3: read-only mode disables keyboard entry", () => {
  it("a digit keydown on a PD cell is a no-op when read-only", () => {
    openGrid();
    setReadOnly(true);
    const cell = pd(18, "MB");

    fireEvent.keyDown(cell, { key: "3" });

    expect(getToothPerio(18).pd.MB).toBeUndefined();
    expect(document.activeElement).not.toBe(pd(18, "B"));
  });

  it("PD/GM cells are disabled (not focusable) when read-only, mirroring Task 2's gating", () => {
    setReadOnly(true);
    openGrid();
    expect(pd(18, "MB").disabled).toBe(true);
    setReadOnly(false);
  });
});

describe("P2 Task 3: arch-order sanity (matches the grid's own UPPER/LOWER arrays)", () => {
  it("the first tooth of the pd row is the first upper-arch tooth and the row spans into the lower arch", () => {
    expect(UPPER_ARCH[0]).toBe(18);
    expect(LOWER_ARCH[0]).toBe(48);
    expect(nextPerioCell({ toothNo: UPPER_ARCH[UPPER_ARCH.length - 1], site: "DB", row: "pd" })).toEqual({
      toothNo: LOWER_ARCH[0],
      site: "MB",
      row: "pd",
    });
  });
});
