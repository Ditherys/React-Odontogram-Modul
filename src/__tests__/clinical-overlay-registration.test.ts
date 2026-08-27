import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import {
  __renderActiveLayers,
  __setShowHealthyPulpForTest,
} from "../odontogram";

function measuredSvg(name: string): string {
  return readFileSync(
    fileURLToPath(new NodeURL(`../assets/teeth-svgs/measured/${name}.svg`, import.meta.url)),
    "utf8",
  );
}

function activeIds(name: string, toothNo: number, state: Record<string, unknown>): string[] {
  return __renderActiveLayers(measuredSvg(name), toothNo, state).map((layer) => layer.id);
}

afterEach(() => __setShowHealthyPulpForTest(true));

describe("clinical overlay registration and suppression", () => {
  it.each([
    ["11", 11],
    ["14", 14],
    ["16", 16],
    ["54", 14],
  ] as const)("suppresses vital pulp during RCT on template %s", (template, toothNo) => {
    __setShowHealthyPulpForTest(true);
    const ids = activeIds(template, toothNo, {
      toothSelection: template === "54" ? "milktooth" : "tooth-base",
      endo: "endo-filling",
    });
    expect(ids).toContain("endo-filling");
    expect(ids).not.toContain("tooth-healthy-pulp");
    expect(ids).not.toContain("milktooth-healthy-pulp");
    expect(ids).not.toContain("tooth-inflam-pulp");
    expect(ids).not.toContain("milktooth-inflam-pulp");
  });

  it("keeps a post, root filling, prepared substrate, and crown registered in one state", () => {
    const ids = activeIds("14", 14, {
      toothSelection: "tooth-base",
      toothSubstrate: "crownprep",
      endo: "endo-metal-pin",
      restorationType: "crown",
      restorationMaterial: "zircon",
    });
    expect(ids).toEqual(expect.arrayContaining([
      "tooth-crownprep",
      "endo-filling",
      "endo-metal-pin",
      "zircon-crown",
    ]));
    expect(ids).not.toContain("tooth-base");
    expect(ids).not.toContain("tooth-healthy-pulp");
  });

  it("renders a bridge abutment as a crown plus connector without losing RCT", () => {
    const ids = activeIds("15", 15, {
      toothSelection: "tooth-base",
      toothSubstrate: "crownprep",
      endo: "endo-filling",
      restorationType: "crown",
      restorationMaterial: "gold",
      bridgePillar: true,
    });
    expect(ids).toEqual(expect.arrayContaining([
      "endo-filling",
      "gold-crown",
      "gold-bridge-connector",
    ]));
  });

  it("a pontic has a crown and connector but no natural root, pulp, or endodontics", () => {
    const ids = activeIds("14", 14, {
      toothSelection: "none",
      endo: "endo-metal-pin",
      rootCaries: "active-cavitated",
      restorationType: "bridge",
      restorationMaterial: "emax",
    });
    expect(ids).toEqual(expect.arrayContaining(["emax-crown", "emax-bridge-connector"]));
    expect(ids).not.toEqual(expect.arrayContaining([
      "tooth-base", "tooth-healthy-pulp", "endo-filling", "endo-metal-pin", "caries-root",
    ]));
  });

  it("an implant suppresses natural root/pulp/endo while keeping crown-fixture connection", () => {
    const ids = activeIds("16", 16, {
      toothSelection: "implant",
      endo: "endo-metal-pin",
      rootCaries: "active-cavitated",
      restorationType: "crown",
      restorationMaterial: "metal-ceramic",
    });
    expect(ids).toEqual(expect.arrayContaining([
      "implant-base", "implant-connector", "metal-ceramic-crown",
    ]));
    expect(ids).not.toEqual(expect.arrayContaining([
      "tooth-base", "tooth-healthy-pulp", "endo-filling", "endo-metal-pin", "caries-root",
    ]));
  });

  it("clears stale clinical anatomy for a missing tooth and distinguishes an extraction socket", () => {
    const stale = {
      toothSelection: "none",
      endo: "endo-filling",
      rootCaries: "active-cavitated",
      caries: ["caries-mesial"],
      fillingSurfaceMaterials: { mesial: "amalgam" },
      restorationType: "none",
      restorationMaterial: "none",
    };
    const missing = activeIds("14", 14, stale);
    expect(missing).not.toEqual(expect.arrayContaining([
      "tooth-base", "tooth-healthy-pulp", "endo-filling", "caries-root",
      "caries-mesial", "filling-amalgam-mesial",
    ]));
    const socket = activeIds("14", 14, { ...stale, extractionWound: true });
    expect(socket).toContain("no-tooth-after-extraction");
    expect(socket).not.toContain("tooth-base");
  });

  it("keeps a retained root distinct and supports root-level treatment", () => {
    const ids = activeIds("15", 15, {
      toothSelection: "tooth-base",
      toothSubstrate: "radix",
      endo: "endo-filling",
      rootCaries: "active-cavitated",
    });
    expect(ids).toEqual(expect.arrayContaining(["tooth-radix", "endo-filling", "caries-root"]));
    expect(ids).not.toContain("tooth-base");
    expect(ids).not.toContain("tooth-healthy-pulp");
  });

  it("keeps a fracture and root-canal overlay visible together", () => {
    const ids = activeIds("13", 13, {
      toothSelection: "tooth-base",
      toothSubstrate: "broken",
      brokenIncisal: true,
      endo: "endo-filling",
    });
    expect(ids).toEqual(expect.arrayContaining(["tooth-broken-incisal", "endo-filling"]));
    expect(ids).not.toContain("tooth-base");
  });

  it("registers recurrent caries to a filling boundary and subcrown caries to a crown", () => {
    const recurrent = activeIds("16", 16, {
      toothSelection: "tooth-base",
      caries: ["caries-mesial"],
      cariesSeverity: { mesial: 4 },
      fillingSurfaceMaterials: { mesial: "composite" },
    });
    expect(recurrent).toEqual(expect.arrayContaining(["filling-composite-mesial", "subcaries-mesial"]));
    expect(recurrent).not.toContain("caries-mesial");

    const subcrown = activeIds("16", 16, {
      toothSelection: "tooth-base",
      toothSubstrate: "crownprep",
      restorationType: "crown",
      restorationMaterial: "emax",
      caries: ["caries-subcrown"],
    });
    expect(subcrown).toEqual(expect.arrayContaining(["emax-crown", "caries-subcrown"]));
  });
});

describe("side/occlusal and mirrored clinical semantics", () => {
  it.each(["mesial", "distal", "occlusal"] as const)(
    "activates the same %s filling surface in both posterior views",
    (surface) => {
      const state = {
        toothSelection: "tooth-base",
        fillingSurfaceMaterials: { [surface]: "composite" },
      };
      const layer = `filling-composite-${surface}`;
      expect(activeIds("16", 16, state)).toContain(layer);
      expect(activeIds("16_occl", 16, state)).toContain(layer);
    },
  );

  it("preserves clinical mesial/distal layer IDs for a mirrored counterpart", () => {
    const mesial = activeIds("14", 24, {
      toothSelection: "tooth-base",
      fillingSurfaceMaterials: { mesial: "gic" },
    });
    const distal = activeIds("14", 24, {
      toothSelection: "tooth-base",
      fillingSurfaceMaterials: { distal: "gic" },
    });
    expect(mesial).toContain("filling-gic-mesial");
    expect(mesial).not.toContain("filling-gic-distal");
    expect(distal).toContain("filling-gic-distal");
    expect(distal).not.toContain("filling-gic-mesial");
  });
});
