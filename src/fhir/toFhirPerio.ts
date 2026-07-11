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

/** Verified LOINC codes (task-3-brief.md) — used exactly as specified. */
const LOINC = {
  panel: { code: "74029-0", display: "Periodontal panel" },
  pd: { code: "32910-2", display: "Probing depth" },
  recession: { code: "32911-0", display: "Gingival recession" },
  cal: { code: "32912-8", display: "Clinical attachment level (calculated)" },
} as const;

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
 * Site qualifier for one probing component: tooth (FDI) + probe site. NOTE:
 * FHIR R4's Observation.component has no standard `bodySite` element (it was
 * added in R5) — task-3-brief.md deliberately asks for one anyway, since
 * this engine's FHIR export already isn't a strict-conformance profile (see
 * the LOCAL_SYSTEM-based finding codes throughout). Rather than assigning
 * this CodeableConcept directly to `component.bodySite` (R4-illegal, see
 * `attachSiteBodySite` below), it is carried via HL7's R4 backport extension
 * so the emitted Observation stays schema-valid R4. No standard site-level
 * SNOMED/LOINC code is used for the probe-site half; it rides on
 * LOCAL_SYSTEM like every other engine-local code.
 */
function siteBodySiteCC(tooth: string, site: PerioSite): CodeableConcept {
  return {
    coding: [
      { system: FDI_SYSTEM, code: tooth },
      { system: LOCAL_SYSTEM, code: `perio-site:${site}`, display: SITE_DISPLAY[site] },
    ],
    text: `Tooth ${tooth} – ${SITE_DISPLAY[site]}`,
  };
}

/** Attach the tooth+probe-site CodeableConcept to a component via the R4
 *  backport extension (see COMPONENT_BODYSITE_EXTENSION_URL above), rather
 *  than the R5-only `component.bodySite` field. */
function attachSiteBodySite(component: Any, tooth: string, site: PerioSite): void {
  component.extension = [
    { url: COMPONENT_BODYSITE_EXTENSION_URL, valueCodeableConcept: siteBodySiteCC(tooth, site) },
  ];
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Build the periodontal-panel Observation for one tooth, or `undefined`
 * when the tooth has no charted perio sites. Pure; tolerant of malformed
 * `rec.perio` (never throws) — unrecognized site keys and non-numeric
 * values are silently skipped rather than propagated.
 *
 * `sup` (suppuration on probing) is intentionally NOT emitted here — out of
 * scope per task-3-brief.md (only PD/recession/CAL/BOP are specified). A
 * future task may add it, likely facing the same no-dedicated-LOINC
 * situation as per-site BOP below.
 */
function buildToothPerioObservation(subjectRef: string, tooth: string, rec: ToothRecord): Observation | undefined {
  const perio = rec.perio;
  const pd = perio && typeof perio.pd === "object" ? (perio.pd as Record<string, unknown>) : undefined;
  if (!pd) return undefined;
  const gm = perio && typeof perio.gm === "object" ? (perio.gm as Record<string, unknown>) : {};
  const bop = Array.isArray(perio?.bop) ? (perio!.bop as unknown[]).filter((v): v is string => typeof v === "string") : [];

  const chartedSites = PERIO_SITES.filter((s) => Object.prototype.hasOwnProperty.call(pd, s) && isFiniteNumber(pd[s]));
  if (chartedSites.length === 0) return undefined;

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
