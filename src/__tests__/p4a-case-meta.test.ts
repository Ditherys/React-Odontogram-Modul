import { describe, it, expect, beforeEach } from "vitest";
import {
  getCaseMeta, setCaseAge, setSmokingStatus, setCigarettesPerDay,
  setDiabetesStatus, setHba1c, setToothLossPerio, setMaxRblPercent, resetCaseMeta,
  __resetChartStateForTest, __collectExportPayloadForTest, __hydrateImportedChartsForTest,
  getOdontogramSummary,
} from "../odontogram";

beforeEach(() => __resetChartStateForTest());

describe("case metadata object", () => {
  it("defaults are empty", () => {
    const c = getCaseMeta();
    expect(c.age).toBeNull();
    expect(c.smokingStatus).toBe("unknown");
    expect(c.diabetesStatus).toBe("unknown");
    expect(c.hba1c).toBeNull();
    expect(c.maxRblPercent).toBeNull();
    expect(c.toothLossPerio).toBeNull();
    expect(c.cigarettesPerDay).toBeNull();
  });
  it("sets and clamps numeric fields", () => {
    setCaseAge(54); expect(getCaseMeta().age).toBe(54);
    setCaseAge(999); expect(getCaseMeta().age).toBe(120);   // clamp hi
    setCaseAge(-5); expect(getCaseMeta().age).toBe(0);       // clamp lo
    setHba1c(7.8); expect(getCaseMeta().hba1c).toBe(7.8);
    setMaxRblPercent(150); expect(getCaseMeta().maxRblPercent).toBe(100);
    setToothLossPerio(40); expect(getCaseMeta().toothLossPerio).toBe(32);
    setCigarettesPerDay(12); expect(getCaseMeta().cigarettesPerDay).toBe(12);
  });
  it("non-finite numeric input is a no-op / null", () => {
    setCaseAge(54); setCaseAge(NaN); expect(getCaseMeta().age).toBe(54); // NaN ignored
  });
  it("explicit null clears a numeric field", () => {
    setCaseAge(54); setCaseAge(null); expect(getCaseMeta().age).toBeNull();
    setHba1c(7.2); setHba1c(null); expect(getCaseMeta().hba1c).toBeNull();
    setMaxRblPercent(40); setMaxRblPercent(null); expect(getCaseMeta().maxRblPercent).toBeNull();
  });
  it("validates enum fields", () => {
    setSmokingStatus("current"); expect(getCaseMeta().smokingStatus).toBe("current");
    setSmokingStatus("bogus"); expect(getCaseMeta().smokingStatus).toBe("current"); // invalid ignored
    setDiabetesStatus("present"); expect(getCaseMeta().diabetesStatus).toBe("present");
  });
  it("serializes omit-when-empty and bumps version to 2.17", () => {
    const empty = __collectExportPayloadForTest();
    expect(empty.version).toBe("2.17");
    expect(Object.prototype.hasOwnProperty.call(empty, "case")).toBe(false);
    setCaseAge(54); setSmokingStatus("current"); setMaxRblPercent(45);
    const p = __collectExportPayloadForTest();
    expect(p.case).toMatchObject({ age: 54, smokingStatus: "current", maxRblPercent: 45 });
  });
  it("roundtrips through hydrate", () => {
    setCaseAge(60); setDiabetesStatus("present"); setHba1c(7.2); setToothLossPerio(5);
    const json = JSON.parse(JSON.stringify(__collectExportPayloadForTest()));
    __resetChartStateForTest();
    expect(getCaseMeta().age).toBeNull(); // reset cleared it
    __hydrateImportedChartsForTest(json);
    expect(getCaseMeta().age).toBe(60);
    expect(getCaseMeta().diabetesStatus).toBe("present");
    expect(getCaseMeta().hba1c).toBe(7.2);
    expect(getCaseMeta().toothLossPerio).toBe(5);
  });
  it("hydrate self-heals bad values", () => {
    __hydrateImportedChartsForTest({ version: "2.17", teeth: {}, case: { age: 999, smokingStatus: "bogus", hba1c: "x" } });
    expect(getCaseMeta().age).toBe(120);
    expect(getCaseMeta().smokingStatus).toBe("unknown");
    expect(getCaseMeta().hba1c).toBeNull();
  });
  it("resetCaseMeta clears everything", () => {
    setCaseAge(50); resetCaseMeta(); expect(getCaseMeta().age).toBeNull();
  });
});

// P4a Task 2: the labelled case-context fragment appended to
// getOdontogramSummary().periodontalText.
describe("case metadata summary line", () => {
  it("empty case: periodontalText has no case-context fragment", () => {
    const before = getOdontogramSummary().periodontalText;
    expect(before).not.toContain("54");
    expect(before).not.toContain("smoker");
  });

  it("with case data set, periodontalText includes the case-context fragment", () => {
    setCaseAge(54);
    setSmokingStatus("current");
    setCigarettesPerDay(12);
    setDiabetesStatus("present");
    setHba1c(7.8);
    setMaxRblPercent(45);
    setToothLossPerio(3);
    const { periodontalText } = getOdontogramSummary();
    expect(periodontalText).toContain("54");
    expect(periodontalText).toContain("12");
    expect(periodontalText).toContain("7.8");
    expect(periodontalText).toContain("45");
    expect(periodontalText).toContain("3");
  });

  it("only age set: fragment contains age, not smoking/diabetes text", () => {
    setCaseAge(30);
    const { periodontalText } = getOdontogramSummary();
    expect(periodontalText).toContain("30");
  });
});
