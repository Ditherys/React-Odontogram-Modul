// Tooth-anatomy profile contract: the classic compatibility profile and the
// explicit measured permanent/primary class maps.
import { describe, it, expect, afterEach } from "vitest";
import {
  getToothAnatomy,
  setToothAnatomy,
  activeAnatomyProfile,
} from "../odontogram";

describe("tooth-anatomy profile", () => {
  afterEach(() => {
    // Restore the default so ordering never leaks between assertions.
    setToothAnatomy("classic");
  });

  it("defaults to classic", () => {
    expect(getToothAnatomy()).toBe("classic");
  });

  it("setToothAnatomy round-trips the flag", () => {
    setToothAnatomy("measured");
    expect(getToothAnatomy()).toBe("measured");
  });

  it("activeAnatomyProfile resolves the layout per the selected profile", () => {
    // The measured profile uses the two-arch layout; classic remains uniform.
    setToothAnatomy("measured");
    expect(activeAnatomyProfile().layout).toBe("twoArch");
    setToothAnatomy("classic");
    expect(activeAnatomyProfile().layout).toBe("uniform16");
  });

  it("the measured profile exposes class-specific permanent and primary maps", () => {
    setToothAnatomy("measured");
    const p = activeAnatomyProfile();
    expect(p.tplNos).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 31, 32, 33, 34, 35, 36, 37, 38]);
    expect(p.occlNos).toEqual([14, 15, 34, 35, 16, 17, 18, 36, 37, 38]);
    expect(p.primaryTplNos).toEqual([51, 52, 53, 54, 55, 71, 72, 73, 74, 75]);
    expect(p.primaryOcclNos).toEqual([54, 55, 74, 75]);
    expect(p.occlusalTemplate).toBeTruthy();
    expect(p.toothTemplate.get(34)?.tpl).toBe(34);
    expect(p.toothTemplate.get(35)?.tpl).toBe(35);
    expect(p.toothTemplate.get(46)?.tpl).toBe(36);
    expect(p.toothTemplate.get(47)?.tpl).toBe(37);
    expect(p.toothTemplate.get(48)?.tpl).toBe(38);
    expect(p.occlusalTemplate!.get(46)?.tpl).toBe(36);
    expect(p.primaryToothTemplate?.get(14)?.tpl).toBe(54);
    expect(p.primaryToothTemplate?.get(34)?.tpl).toBe(74);
    setToothAnatomy("classic");
    // Classic keeps its four templates and no separate occlusal map.
    expect(activeAnatomyProfile().tplNos).toEqual([11, 13, 14, 16]);
    expect(activeAnatomyProfile().occlusalTemplate).toBeUndefined();
  });
});
