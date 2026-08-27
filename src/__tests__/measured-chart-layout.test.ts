// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFileUrl = import.meta.url;
const css = readFileSync(
  fileURLToPath(new URL("../index.css", testFileUrl)),
  "utf8",
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  expect(match, `missing CSS rule: ${selector}`).toBeTruthy();
  return match![1];
}

describe("measured odontogram continuous-arch layout", () => {
  it("keeps classic tile chrome as the compatibility baseline", () => {
    expect(rule(".tooth-tile")).toMatch(/border:\s*1px solid var\(--line\)/);
    expect(rule(".tooth-tile")).toMatch(/border-radius:\s*14px/);
  });

  it("moves measured tooth spacing onto each anatomy-width arch grid", () => {
    expect(rule('.tooth-grid[data-anatomy="measured"]')).toContain("--measured-tooth-gap");
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-arch'))
      .toMatch(/gap:\s*var\(--measured-tooth-gap\)/);
    expect(rule('.tooth-grid[data-anatomy="measured"][data-screen-spacing="close"]'))
      .toContain("--measured-tooth-gap:0px");
    expect(rule('.tooth-grid[data-anatomy="measured"][data-screen-spacing="wide"]'))
      .toContain("--measured-tooth-gap:6px");
  });

  it("removes default card chrome only from measured tooth hit areas", () => {
    const measured = rule('.tooth-grid[data-anatomy="measured"] .tooth-tile');
    expect(measured).toMatch(/border-color:\s*transparent/);
    expect(measured).toMatch(/background:\s*transparent/);
    expect(measured).toMatch(/border-radius:\s*6px/);
  });

  it("keeps placeholders aligned but visually absent", () => {
    const placeholder = rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.placeholder');
    expect(placeholder).toMatch(/visibility:\s*hidden/);
    expect(placeholder).not.toMatch(/display:\s*none/);
  });

  it("keeps measured focus, selection, and occlusal hierarchy explicit", () => {
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.active'))
      .toContain("border-color:");
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile:focus-visible'))
      .toContain("outline:");
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view:not(.placeholder)'))
      .toMatch(/opacity:\s*\.72/);
    expect(rule('.tooth-grid[data-anatomy="measured"] .tooth-tile.occl-view.active'))
      .toMatch(/opacity:\s*1/);
  });
});
