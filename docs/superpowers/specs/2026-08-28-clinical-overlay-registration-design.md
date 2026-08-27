# Clinical Overlay Registration Design

## Scope and governing invariant

This pass registers every remaining clinical layer to the measured tooth template that renders it. Public FDI keys, clinical enum values, SVG IDs, persistence, exports, and the classic anatomy profile remain compatible.

The governing pipeline is:

```text
canonical tooth anatomy
        -> generator-owned class/root/CEJ/occlusal transforms
        -> generated template geometry + anatomical metadata
        -> renderer-owned clinical semantics and deliberate layer order
        -> shared live/export placement
```

Clinical state may select and style geometry, but it must not invent a second independent tooth coordinate system.

## Audit matrix

| Family | State and renderer | SVG layers | Current registration | Risk and action |
|---|---|---|---|---|
| Base/substrate | `toothSelection`, `toothSubstrate`; `applyStateToSvgSingle` | `tooth-base`, variants, `implant-base` | Class-transformed measured paths | Preserve; use as the containment and suppression envelope. |
| Pulp/diagnosis | `pulpDx`, healthy-pulp setting | healthy/inflamed pulp groups | Root-topology transforms follow tooth anatomy | Fix RCT coexistence bug; verify lumen containment and root count. Decorative inflammation marks are not canal lumen. |
| Endodontics | `endo`, resorption, apical diagnosis | filling, incomplete, medical, glass/metal pin, resection, resorption, periapical | Generator root transforms and root grafting | Add strict per-layer containment/topology checks; posts and fillings must remain within the transformed root/canal. |
| Crowns/prosthetics | restoration type/material/status | material crown/inlay/onlay/veneer groups | Same class transform as crown; material paths share geometry | Verify crown overlap/margins; keep material and status styling separate from geometry. |
| Bridges | `restorationType`, `bridgePillar`, missing substrate | crown + material connector + cross-tile bars | Per-unit connector paths are transformed, but bars use tile fractions; crown abutments can omit connector | Add explicit derived bridge role, activate connectors on abutments, regenerate proximal connector tabs, and anchor bars to active connector DOM geometry. |
| Surface restorations | filling surfaces/material/defects | mesial/distal/occlusal/incisal/facial/lingual combinations | Class-transformed paths; occlusal generation reconnects combinations | Verify containment and side/occlusal state parity; prove clinical mesial/distal semantics under mirroring. |
| Caries | surface/root/recurrent/depth/ICDAS | crown caries, root caries, subcaries and depth groups | Crown transforms; root caries follows root transforms | Verify crown containment and cervical/root proximity; retain recurrent caries registration to the selected restoration surface. |
| Implant/peri-implant | implant selection, prosthesis, peri-implant state | implant fixture, implant crown/prosthesis, peri-implant | Separate implant layer; natural anatomy is currently gated | Add suppression combinations and implant-axis/platform metadata checks; use implant-specific periodontal anchors. |
| Missing/extracted/root remnant | tooth selection/substrate/status | missing marker, radix/broken/under-gum | Renderer gating plus transformed substrate paths | Prove stale pulp/root/restoration suppression; keep retained-root distinct from an absent tooth. |
| Periodontal | probing, recession, CAL, CEJ, bone, plaque/BOP, mobility, furcation | generated tooth/implant row plus curves and marks | Tooth contour is template-specific; CEJ constants and site x positions remain partly fixed | Move CEJ/platform/site anchors into generated metadata and consume them in row geometry; retain validated fallbacks for classic assets. |
| Fracture/wear | broken substrate, filling fracture, cervical/edge wear | broken variants, dormant fracture groups, wear groups | Broken/wear paths are transformed; dormant fracture groups have no authoring state | Verify active states against incisal/cusp/CEJ/root geometry. Preserve dormant IDs without inventing a new public state. |
| Orthodontics | appliance/drift/vertical states | ortho groups | Mostly crown-relative transformed layers | Verify viewBox and mirroring; no semantic redesign. |
| Gum/bone/CEJ | base display and periodontal chart | gum/bone/parodontal groups and chart curves | Generator transform plus chart baselines | Register chart anchors to template metadata and keep clinical millimetre scale independent of decorative anatomy. |
| Plan/status | status and plan chart | same clinical groups plus plan styling | Geometry reused; status is styling | Preserve this separation and test identical active geometry across status/plan. |
| Occlusal | same tooth clinical state rendered in posterior occlusal asset | occlusal crown, surfaces, restorations, caries, crown/bridge | Class-specific generated assets | Verify ID parity and surface combinations in both views. |

## Selected architecture

### Generator-owned anatomical registration

`tools/toothgen` remains the only manual-edit boundary for measured SVG geometry. The build derives a compact registration contract from the transformed paths and writes it on each generated SVG: template identity, root count, CEJ/platform/furcation positions, cervical span, and bridge connector band. Root-aware transformations continue to apply to tooth, pulp, endodontic, root-caries, periodontal, and substrate layers together.

Material-specific crown and bridge paths reuse the same derived geometry. Styling remains in the authored SVG/CSS; the generator does not encode clinical status with geometry.

### Renderer-owned clinical semantics

The renderer derives bridge role independently from restoration material:

- natural or implant tooth with `bridgePillar`: abutment;
- absent tooth with bridge restoration: pontic;
- ordinary bridge restoration on a present tooth: bridge unit;
- otherwise: not a bridge member.

All bridge units receive a crown body and proximal connector geometry. A pontic never reactivates natural base, pulp, endodontic, root-caries, or periodontal root anatomy. RCT suppresses healthy/inflamed vital pulp while retaining compatible apical, restoration, crown, bridge, and periodontal states.

### Anatomy-anchored bridge spans

Generated connector paths become short proximal tabs that intersect the crown envelope and stay inside the viewBox. Live and export span bars read the bounding boxes of the active connector paths. The bar joins the facing proximal tabs, scales with their height, and uses a small corner radius. Legacy tile-fraction constants remain only as a compatibility fallback when geometry cannot be measured (for example, a synthetic jsdom fixture).

### Anatomy-anchored periodontal sites

Generated CEJ/cervical/platform metadata replaces measured-profile constant maps. Periodontal site x positions are distributed within the actual cervical span rather than across the entire SVG viewBox. Mirroring reverses visual placement while site labels retain clinical meaning. Implant sites use fixture/platform anchors, and classic assets retain their current checked fallback values.

### Deliberate layer order

The clinical order is centralized as anatomy/background, pulp and endodontics, tooth/substrate, surfaces and restorations, prosthetics, caries/fracture/wear/orthodontics, periodontal indicators, then selection and plan/status styling. Exceptional diagnostic layers that need to remain visible above a resected/root-resorbed tooth are explicitly promoted rather than depending on incidental source order.

## Rejected approaches

1. Hand-adjust every generated SVG. This would be non-deterministic and would lose fixes on the next build.
2. Resize a generic overlay to each viewBox. This preserves the exact defect being fixed: registration to a box rather than anatomy.
3. Replace the state schema with per-overlay coordinates. This would break saved data and move anatomy knowledge into clinical state.
4. Add new fracture/impaction state fields solely because dormant SVG IDs exist. Unsupported geometry remains compatible but is not exposed without an approved clinical/data contract.

## Verification strategy

Python checks validate XML/ID integrity, viewBox bounds, registration metadata, root/canal/post topology and containment, crown-envelope overlap, surface/caries regions, connector/crown intersection, connector bounds, and deterministic generation. Vitest checks semantic suppression, bridge roles, combined states, layer order, mirrored surface meaning, side/occlusal parity, plan/status geometry reuse, periodontal anchors, and live/export bridge equality.

Visual QA covers the requested representative permanent set plus primary anterior/molar examples: single-, two-, and three-root endodontics; anterior/premolar/molar crowns and implants; a three-unit bridge including an RCT abutment; MO/DO/MOD and anterior proximal restorations; recession/bone loss/furcation/peri-implant states; and combined states. Geometry tests use tolerances and region overlap instead of brittle path-string equality.

## Compatibility and review boundary

No public state field or clinical SVG ID is removed. Classic profile paths are not regenerated. Generated fingerprints change only where connector geometry or metadata intentionally changes. The result remains a schematic chart, not patient-specific radiographic anatomy; a dentist should review canal variation, maxillary first-premolar projection, third-molar simplification, primary molar root spread, pontic tissue relationship, and furcation-site conventions.
