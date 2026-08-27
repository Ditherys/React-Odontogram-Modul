// Part of React Advanced Odontogram - https://github.com/ZoliQua/React-Odontogram-Modul
// Created by Zoltan Dul (https://github.com/ZoliQua) 2025-2026

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { AXES } from "../axes";
import { allClearLayers, CLINICAL_GROUP_ORDER, FIXED_CLEAR_LAYERS } from "../svgLayers";

// Use Node's own URL (not the jsdom-provided global URL, which mis-resolves
// relative `file:` URLs against `window.location` under the jsdom test
// environment) so this always resolves relative to this test file on disk.
// (Same workaround as src/__tests__/svg-assets.test.ts and render-seam.test.ts.)
const FILES = ["11", "13", "14", "16", "14_occl", "16_occl"] as const;
const svg = (n: string) => readFileSync(fileURLToPath(new NodeURL(`../../assets/teeth-svgs/${n}.svg`, import.meta.url)), "utf8");
const ALL = FILES.map(svg).join("\n");

describe("AXES svgLayer metadata", () => {
  it("every declared svgLayer id exists in at least one installed SVG", () => {
    for (const ax of AXES) for (const v of ax.values ?? []) {
      const layers = v.svgLayer == null ? [] : Array.isArray(v.svgLayer) ? v.svgLayer : [v.svgLayer];
      for (const id of layers) expect(ALL.includes(`id="${id}"`), `${ax.id}:${v.id} → ${id}`).toBe(true);
    }
  });

  it("every boolean-axis svgLayer exists in an installed SVG", () => {
    for (const ax of AXES) if (ax.svgLayer)
      expect(ALL.includes(`id="${ax.svgLayer}"`), `${ax.id} → ${ax.svgLayer}`).toBe(true);
  });
});

describe("clear-set derivation", () => {
  it("allClearLayers() is exactly today's clear-set (no id added or dropped)", () => {
    // axisClearLayers() only contributes ids already in FIXED_CLEAR_LAYERS
    // (caries/mods/endo/glyph/toothSelection layers) — so the union set must equal it.
    expect(new Set(allClearLayers())).toEqual(new Set(FIXED_CLEAR_LAYERS));
  });
});

describe("clinical layer stacking", () => {
  it("keeps every present top-level clinical family in the centralized order", () => {
    const measuredFiles = ["11", "14", "16", "54", "14_occl", "16_occl"];
    for (const name of measuredFiles) {
      const text = readFileSync(
        fileURLToPath(new NodeURL(`../../assets/teeth-svgs/measured/${name}.svg`, import.meta.url)),
        "utf8",
      );
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const topLevelIds = Array.from(doc.documentElement.children)
        .map((el) => el.getAttribute("id"))
        .filter((id): id is string => !!id);
      const present = CLINICAL_GROUP_ORDER.filter((id) => topLevelIds.includes(id));
      expect(topLevelIds.filter((id) => present.includes(id as typeof present[number])), name)
        .toEqual(present);
    }
  });
});
