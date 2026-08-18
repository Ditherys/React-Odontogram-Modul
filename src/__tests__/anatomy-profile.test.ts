// Stage A — tooth-anatomy profile abstraction (classic only). Verifies the
// session flag accessors and that the active profile resolves to the classic
// (uniform16) profile, including the fallback when an unrealized value is set.
import { describe, it, expect, afterEach } from "vitest";
import {
  getToothAnatomy,
  setToothAnatomy,
  activeAnatomyProfile,
} from "../odontogram";

describe("tooth-anatomy profile (Stage A)", () => {
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

  it("activeAnatomyProfile falls back to the classic (uniform16) profile", () => {
    // "measured" is not realized in Stage A → falls back to classic.
    setToothAnatomy("measured");
    expect(activeAnatomyProfile().layout).toBe("uniform16");
    setToothAnatomy("classic");
    expect(activeAnatomyProfile().layout).toBe("uniform16");
  });
});
