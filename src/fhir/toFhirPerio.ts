import type { Bundle, Observation, CodeableConcept, ToothRecord, OdontogramExportPayload, FhirExportOptions } from "./types";
import { LOCAL_SYSTEM, FDI_SYSTEM } from "./codesystems";
import { PLACEHOLDER_PATIENT_FULLURL, baseObservation } from "./primitives";

/**
 * SP-perio P1 Task 3: per-site periodontal probing (`ToothRecord.perio`, see
 * types.ts) is per-site NUMERIC data (6 fixed probing points per tooth, each
 * carrying PD/GM/BOP/SUP), not the one-enum/boolean-field-per-tooth shape the
 * axis registry (registry/axes.ts + registry/fhir.ts) assumes. It is
 * therefore deliberately NOT routed through AXES/fieldMappings.ts or the
 * axis parity oracle — this is a bespoke builder, called once from
 * buildFhirBundle() (toFhir.ts) AFTER the registry-driven per-tooth
 * Observations, reusing `baseObservation()` (fhir/primitives.ts) for the
 * panel Observation's resourceType/status/category/subject/bodySite so it
 * matches every other Observation's conventions exactly.
 *
 * SNOMED CT is NOT included anywhere in this module (maintainer-verify
 * later against the official SNOMED CT browser, same policy as
 * `SNOMED_CODES` in codesystems.ts) — LOINC-primary only, per task-3-brief.md.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** LOINC (Logical Observation Identifiers Names and Codes) system URL.
 *  Local to this module: perio is the only export currently using LOINC —
 *  every other finding in this engine uses the engine-local LOCAL_SYSTEM only. */
const LOINC_SYSTEM = "http://loinc.org";

/** Verified LOINC codes (task-3-brief.md, task-2-brief.md) — used exactly as
 *  specified. */
const LOINC = {
  panel: { code: "74029-0", display: "Periodontal panel" },
  pd: { code: "32910-2", display: "Probing depth" },
  recession: { code: "32911-0", display: "Gingival recession" },
  cal: { code: "32912-8", display: "Clinical attachment level (calculated)" },
  // SP-perio P2b Task 2.
  furcation: { code: "34015-8", display: "Furcation involvement" },
} as const;

// SP-perio P2b Task 2: furcation entrance labels — the union across every
// tooth position furcationEntrances() (odontogram.ts) can return. Mirrored
// here rather than imported, same policy PERIO_SITES/SITE_DISPLAY below
// follow (fhir/ stays independent of the large odontogram.ts module).
const FURCATION_ENTRANCES = ["mesial", "distal", "buccal", "lingual"] as const;
type FurcationEntrance = typeof FURCATION_ENTRANCES[number];

const FURCATION_ENTRANCE_DISPLAY: Record<FurcationEntrance, string> = {
  mesial: "Mesial",
  distal: "Distal",
  buccal: "Buccal",
  lingual: "Lingual",
};

// SP-perio P2b Task 3: the 4 fixed O'Leary plaque-index surfaces — the SAME
// value set/labels as FURCATION_ENTRANCES above, but kept as an independent
// constant (own bodySite local-code prefix, own gating) since plaque and
// furcation are unrelated axes that only happen to share a surface vocabulary.
const PLAQUE_SURFACES = ["mesial", "distal", "buccal", "lingual"] as const;
type PlaqueSurface = typeof PLAQUE_SURFACES[number];

const PLAQUE_SURFACE_DISPLAY: Record<PlaqueSurface, string> = {
  mesial: "Mesial",
  distal: "Distal",
  buccal: "Buccal",
  lingual: "Lingual",
};

// Mirrors PERIO_SITES in odontogram.ts (buccal MB/B/DB, then lingual/palatal
// ML/L/DL). Duplicated here — rather than importing from the (very large)
// odontogram.ts — so the fhir/ module tree stays independent of it, the same
// way codesystems.ts independently duplicates its own English display text
// instead of importing from i18n/translations.ts.
const PERIO_SITES = ["MB", "B", "DB", "ML", "L", "DL"] as const;
type PerioSite = typeof PERIO_SITES[number];

// English display names per site (FHIR display text is language-neutral,
// same policy LOCAL_VALUE_MAPS uses in codesystems.ts) — mirrors the EN
// `perio.site.*` strings in i18n/translations.ts.
const SITE_DISPLAY: Record<PerioSite, string> = {
  MB: "Mesio-buccal",
  B: "Buccal",
  DB: "Disto-buccal",
  ML: "Mesio-lingual",
  L: "Lingual/palatal",
  DL: "Disto-lingual",
};

function loincConcept(entry: { code: string; display: string }): CodeableConcept {
  return { coding: [{ system: LOINC_SYSTEM, code: entry.code, display: entry.display }], text: entry.display };
}

/**
 * Engine-local finding CodeableConcept (no LOINC/SNOMED coding at all) — the
 * same no-dedicated-standard-code treatment `perio-bop`/`plaque-surface`
 * above already get. SP-perio PG-D Task 1: PI/GI have no dedicated LOINC
 * (LOINC only defines whole-mouth plaque/gingival indices, not per-surface
 * graded ones), so both ride on LOCAL_SYSTEM only, mirroring {@link loincConcept}.
 */
function localConcept(code: string, display: string): CodeableConcept {
  return { coding: [{ system: LOCAL_SYSTEM, code, display }], text: display };
}

/**
 * HL7-published R4 backport extension URL for `Observation.component.bodySite`
 * (an R5-only field — see below). Using this extension keeps the export
 * strictly R4-legal: R4 BackboneElements are `additionalProperties: false`,
 * so a bare `component.bodySite` would be rejected by a schema-strict R4
 * validator, whereas `component.extension` is legal on any R4 BackboneElement
 * and this specific URL is HL7's official backport of the exact same field.
 */
const COMPONENT_BODYSITE_EXTENSION_URL =
  "http://hl7.org/fhir/5.0/StructureDefinition/extension-Observation.component.bodySite";

/**
 * Generic tooth+qualifier bodySite CodeableConcept, carried via the R4
 * backport extension (see COMPONENT_BODYSITE_EXTENSION_URL above) rather
 * than the R5-only `component.bodySite` field. `localCode`/`display` supply
 * the engine-local qualifier half (e.g. `perio-site:MB` or
 * `furcation-entrance:mesial`) — no standard SNOMED/LOINC code exists for
 * either qualifier, so both ride on LOCAL_SYSTEM like every other
 * engine-local code.
 */
function bodySiteCC(tooth: string, localCode: string, display: string): CodeableConcept {
  return {
    coding: [
      { system: FDI_SYSTEM, code: tooth },
      { system: LOCAL_SYSTEM, code: localCode, display },
    ],
    text: `Tooth ${tooth} – ${display}`,
  };
}

/** Attach a generic tooth+qualifier bodySite to a component (see
 *  {@link bodySiteCC}). */
function attachBodySite(component: Any, tooth: string, localCode: string, display: string): void {
  component.extension = [
    { url: COMPONENT_BODYSITE_EXTENSION_URL, valueCodeableConcept: bodySiteCC(tooth, localCode, display) },
  ];
}

/** Site qualifier for one probing component: tooth (FDI) + probe site.
 *  Thin wrapper over {@link attachBodySite} preserving the exact
 *  `perio-site:${site}` local-code format every existing perio FHIR test
 *  asserts against. NOTE: FHIR R4's Observation.component has no standard
 *  `bodySite` element (it was added in R5) — task-3-brief.md deliberately
 *  asks for one anyway, since this engine's FHIR export already isn't a
 *  strict-conformance profile (see the LOCAL_SYSTEM-based finding codes
 *  throughout). */
function attachSiteBodySite(component: Any, tooth: string, site: PerioSite): void {
  attachBodySite(component, tooth, `perio-site:${site}`, SITE_DISPLAY[site]);
}

/** Furcation-entrance qualifier for one furcation component: tooth (FDI) +
 *  entrance, via the same R4 backport extension mechanism (see
 *  {@link attachBodySite}). */
function attachFurcationBodySite(component: Any, tooth: string, entrance: FurcationEntrance): void {
  attachBodySite(component, tooth, `furcation-entrance:${entrance}`, FURCATION_ENTRANCE_DISPLAY[entrance]);
}

/** Plaque-surface qualifier for one plaque component: tooth (FDI) + surface,
 *  via the same R4 backport extension mechanism (see {@link attachBodySite}). */
function attachPlaqueBodySite(component: Any, tooth: string, surface: PlaqueSurface): void {
  attachBodySite(component, tooth, `plaque-surface:${surface}`, PLAQUE_SURFACE_DISPLAY[surface]);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Build the periodontal-panel Observation for one tooth, or `undefined`
 * when the tooth has no charted perio sites AND no graded furcation
 * entrance. Pure; tolerant of malformed `rec.perio`/`rec.furcation` (never
 * throws) — unrecognized site/entrance keys and non-numeric/out-of-range
 * values are silently skipped rather than propagated.
 *
 * `sup` (suppuration on probing) is intentionally NOT emitted here — out of
 * scope per task-3-brief.md (only PD/recession/CAL/BOP are specified). A
 * future task may add it, likely facing the same no-dedicated-LOINC
 * situation as per-site BOP below.
 *
 * SP-perio P2b Task 2: furcation involvement rides on the SAME panel
 * Observation, as additional components — a tooth with furcation data but
 * NO charted perio site still gets the panel (built with only furcation
 * components), and a tooth with charted perio sites but no furcation data
 * gets exactly the same output as before this task (byte-identical golden).
 *
 * SP-perio P2b Task 3: O'Leary plaque-index presence rides on the SAME panel
 * too, as additional boolean components — a tooth with ONLY plaque data
 * (no charted perio site, no graded furcation) still gets the panel; a tooth
 * with neither perio, furcation, NOR plaque data gets no panel at all
 * (byte-identical golden, as before). There is no verified per-surface
 * O'Leary LOINC code (LOINC only defines whole-mouth plaque indices), so
 * each plaque component carries no LOINC coding at all — engine-local code
 * only, the same no-dedicated-LOINC treatment per-site BOP gets above.
 *
 * SP-perio PG-D Task 1: the Silness-Löe Plaque Index (`pi`) and Löe-Silness
 * Gingival Index (`gi`) — per-surface GRADED (1-3) axes, deliberately
 * SEPARATE from the O'Leary `plaque` boolean above — ride on the SAME panel
 * too, as additional integer components; a tooth with ONLY pi/gi data still
 * gets the panel, and a tooth with none of perio/furcation/plaque/pi/gi gets
 * no panel at all (byte-identical golden, as before). Neither has a
 * dedicated LOINC, so both use the same engine-local-code-only treatment as
 * per-site BOP and per-surface plaque.
 *
 * SP-perio PG-D Task 2: keratinized gingiva width (`kg`) — a single
 * per-tooth BUCCAL mm scalar, unlike PI/GI's per-surface maps — rides on the
 * SAME panel too, as one additional valueQuantity component; a tooth with
 * ONLY kg data still gets the panel, and a tooth with none of
 * perio/furcation/plaque/pi/gi/kg gets no panel at all (byte-identical
 * golden, as before). No dedicated LOINC, engine-local finding code only,
 * fixed buccal bodySite.
 */
function buildToothPerioObservation(subjectRef: string, tooth: string, rec: ToothRecord): Observation | undefined {
  const perio = rec.perio;
  const pd = perio && typeof perio.pd === "object" ? (perio.pd as Record<string, unknown>) : undefined;
  const gm = perio && typeof perio.gm === "object" ? (perio.gm as Record<string, unknown>) : {};
  const bop = Array.isArray(perio?.bop) ? (perio!.bop as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const chartedSites = pd ? PERIO_SITES.filter((s) => Object.prototype.hasOwnProperty.call(pd, s) && isFiniteNumber(pd[s])) : [];

  const furcationRaw =
    rec.furcation && typeof rec.furcation === "object" ? (rec.furcation as Record<string, unknown>) : undefined;
  const gradedEntrances = furcationRaw
    ? FURCATION_ENTRANCES.filter((e) => {
        const v = furcationRaw[e];
        return isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 4;
      })
    : [];

  const plaqueRaw = Array.isArray(rec.plaque) ? (rec.plaque as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const plaqueSurfaces = PLAQUE_SURFACES.filter((s) => plaqueRaw.includes(s));

  // SP-perio PG-D Task 1: PI/GI graded surfaces — same tolerant parsing as
  // furcation above (unrecognized surface or out-of-range/non-integer grade
  // silently dropped, never throws).
  const piRaw = rec.pi && typeof rec.pi === "object" ? (rec.pi as Record<string, unknown>) : undefined;
  const piEntries: [PlaqueSurface, number][] = piRaw
    ? (PLAQUE_SURFACES.filter((s) => {
        const v = piRaw[s];
        return isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 3;
      }).map((s) => [s, piRaw[s] as number]))
    : [];
  const giRaw = rec.gi && typeof rec.gi === "object" ? (rec.gi as Record<string, unknown>) : undefined;
  const giEntries: [PlaqueSurface, number][] = giRaw
    ? (PLAQUE_SURFACES.filter((s) => {
        const v = giRaw[s];
        return isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 3;
      }).map((s) => [s, giRaw[s] as number]))
    : [];

  // SP-perio PG-E Task 1: peri-implant Mombelli mPI/mBI graded surfaces —
  // same tolerant parsing as PI/GI above (implant-only enforcement lives at
  // the odontogram.ts setter layer, not here — FHIR export is unconditional
  // on whatever is in the payload, same as every other axis).
  const mpiRaw = rec.mpi && typeof rec.mpi === "object" ? (rec.mpi as Record<string, unknown>) : undefined;
  const mpiEntries: [PlaqueSurface, number][] = mpiRaw
    ? (PLAQUE_SURFACES.filter((s) => {
        const v = mpiRaw[s];
        return isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 3;
      }).map((s) => [s, mpiRaw[s] as number]))
    : [];
  const mbiRaw = rec.mbi && typeof rec.mbi === "object" ? (rec.mbi as Record<string, unknown>) : undefined;
  const mbiEntries: [PlaqueSurface, number][] = mbiRaw
    ? (PLAQUE_SURFACES.filter((s) => {
        const v = mbiRaw[s];
        return isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 3;
      }).map((s) => [s, mbiRaw[s] as number]))
    : [];

  // SP-perio PG-D Task 2: keratinized gingiva width — a single per-tooth
  // BUCCAL mm scalar (integer 0-15). Tolerant of malformed/foreign input
  // (non-numeric, out-of-range, null): treated as "not charted", same as
  // every other axis above.
  const kgRaw = rec.kg;
  const kgValue = isFiniteNumber(kgRaw) && Number.isInteger(kgRaw) && kgRaw >= 0 && kgRaw <= 15 ? kgRaw : undefined;

  if (
    chartedSites.length === 0 && gradedEntrances.length === 0 && plaqueSurfaces.length === 0 &&
    piEntries.length === 0 && giEntries.length === 0 && kgValue === undefined &&
    mpiEntries.length === 0 && mbiEntries.length === 0
  ) return undefined;

  const components: Any[] = [];
  for (const site of chartedSites) {
    const pdValue = pd[site] as number;
    const gmRaw = gm[site];
    const gmValue = isFiniteNumber(gmRaw) ? gmRaw : 0;
    // Derived here — a stored CAL never exists (see ToothRecord.perio doc comment).
    const calValue = pdValue + gmValue;

    const pdComponent: Any = {
      code: loincConcept(LOINC.pd),
      valueQuantity: { value: pdValue, unit: "mm" },
    };
    attachSiteBodySite(pdComponent, tooth, site);
    components.push(pdComponent);

    // Recession is emitted ONLY when there is actual recession to report
    // (gm > 0); gm <= 0 (gingiva at or coronal to CEJ) has nothing to state
    // under this LOINC code.
    if (gmValue > 0) {
      const recComponent: Any = {
        code: loincConcept(LOINC.recession),
        valueQuantity: { value: gmValue, unit: "mm" },
      };
      attachSiteBodySite(recComponent, tooth, site);
      components.push(recComponent);
    }

    const calComponent: Any = {
      code: loincConcept(LOINC.cal),
      valueQuantity: { value: calValue, unit: "mm" },
    };
    attachSiteBodySite(calComponent, tooth, site);
    components.push(calComponent);

    // Per-site bleeding-on-probing has NO dedicated LOINC code — LOINC only
    // defines a whole-mouth BOP index (32951-6). Emitted as a plain boolean
    // component under the engine-local system instead, for EVERY charted
    // site (explicit true/false), so "not charted" (no component at all)
    // stays distinguishable from "charted, did not bleed" (valueBoolean: false).
    const bopComponent: Any = {
      code: { coding: [{ system: LOCAL_SYSTEM, code: "perio-bop", display: "Bleeding on probing" }], text: "Bleeding on probing" },
      valueBoolean: bop.includes(site),
    };
    attachSiteBodySite(bopComponent, tooth, site);
    components.push(bopComponent);
  }

  // SP-perio P2b Task 2: one component per graded furcation entrance,
  // LOINC 34015-8, the Glickman grade (1-4) as a plain integer value.
  for (const entrance of gradedEntrances) {
    const grade = furcationRaw![entrance] as number;
    const furcationComponent: Any = {
      code: loincConcept(LOINC.furcation),
      valueInteger: grade,
    };
    attachFurcationBodySite(furcationComponent, tooth, entrance);
    components.push(furcationComponent);
  }

  // SP-perio P2b Task 3: one boolean component per O'Leary plaque-index
  // surface WITH plaque present. No LOINC coding (see doc comment above) —
  // engine-local code only, always `valueBoolean: true` (a clean/not-recorded
  // surface simply has no component at all, mirroring how `plaque` itself
  // stores presence-only membership rather than an explicit false).
  for (const surface of plaqueSurfaces) {
    const plaqueComponent: Any = {
      code: { coding: [{ system: LOCAL_SYSTEM, code: "plaque-surface", display: "Dental plaque present" }], text: "Dental plaque present" },
      valueBoolean: true,
    };
    attachPlaqueBodySite(plaqueComponent, tooth, surface);
    components.push(plaqueComponent);
  }

  // SP-perio PG-D Task 1: one integer component per graded PI surface —
  // Silness-Löe Plaque Index, no dedicated LOINC, engine-local finding code.
  for (const [surface, grade] of piEntries) {
    const piComponent: Any = {
      code: localConcept("plaque-index-silness-loe", "Plaque index (Silness-Löe)"),
      valueInteger: grade,
    };
    attachPlaqueBodySite(piComponent, tooth, surface);
    components.push(piComponent);
  }

  // SP-perio PG-D Task 1: one integer component per graded GI surface —
  // Löe-Silness Gingival Index, same no-dedicated-LOINC treatment as PI above.
  for (const [surface, grade] of giEntries) {
    const giComponent: Any = {
      code: localConcept("gingival-index-loe-silness", "Gingival index (Löe-Silness)"),
      valueInteger: grade,
    };
    attachPlaqueBodySite(giComponent, tooth, surface);
    components.push(giComponent);
  }

  // SP-perio PG-E Task 1: one integer component per graded mPI/mBI surface —
  // Mombelli modified plaque/sulcus bleeding indices (peri-implant), same
  // no-dedicated-LOINC treatment as PI/GI above.
  for (const [surface, grade] of mpiEntries) {
    const c: Any = { code: localConcept("mod-plaque-index-mombelli", "Modified plaque index (Mombelli)"), valueInteger: grade };
    attachPlaqueBodySite(c, tooth, surface);
    components.push(c);
  }
  for (const [surface, grade] of mbiEntries) {
    const c: Any = { code: localConcept("mod-bleeding-index-mombelli", "Modified sulcus bleeding index (Mombelli)"), valueInteger: grade };
    attachPlaqueBodySite(c, tooth, surface);
    components.push(c);
  }

  // SP-perio PG-D Task 2: one valueQuantity (mm) component for keratinized
  // gingiva width, when charted — no dedicated LOINC, engine-local finding
  // code, fixed buccal bodySite (this axis is a single scalar, not per-site/
  // per-surface, so there is nothing to loop over).
  if (kgValue !== undefined) {
    const kgComponent: Any = {
      code: localConcept("keratinized-gingiva-width", "Keratinized gingiva width"),
      valueQuantity: { value: kgValue, unit: "mm", system: "http://unitsofmeasure.org", code: "mm" },
    };
    attachBodySite(kgComponent, tooth, "site:buccal", "Buccal");
    components.push(kgComponent);
  }

  const obs = baseObservation(subjectRef, tooth, loincConcept(LOINC.panel));
  obs.component = components as Observation["component"];
  return obs;
}

/**
 * Append one periodontal-panel Observation per tooth with charted perio
 * sites to `bundle.entry`, mutating it in place. Called from
 * `buildFhirBundle` (toFhir.ts) AFTER the registry-driven per-tooth
 * Observations. A tooth with no charted perio sites (the common case —
 * `rec.perio` is omitted entirely by serializeState() unless at least one
 * site is charted) contributes NO entry, which is what keeps the existing
 * `fhir-golden.json` fixture (built from payloads with no perio data at
 * all) byte-identical after this task.
 *
 * Pure aside from the `bundle.entry` mutation; tolerant of malformed
 * `payload` (never throws), matching `buildFhirBundle`'s own contract.
 */
export function appendPerioObservations(bundle: Bundle, payload: OdontogramExportPayload, options: FhirExportOptions = {}): void {
  const teeth =
    payload && typeof payload === "object" && payload.teeth && typeof payload.teeth === "object" ? payload.teeth : {};
  const subjectRef = options.subject ?? PLACEHOLDER_PATIENT_FULLURL;
  if (!bundle.entry) bundle.entry = [];
  for (const [tooth, recRaw] of Object.entries(teeth)) {
    const rec = (recRaw && typeof recRaw === "object" ? recRaw : {}) as ToothRecord;
    const obs = buildToothPerioObservation(subjectRef, tooth, rec);
    if (obs) bundle.entry.push({ resource: obs });
  }
}
