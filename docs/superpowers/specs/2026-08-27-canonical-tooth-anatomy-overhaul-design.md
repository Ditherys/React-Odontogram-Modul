# Canonical Tooth Anatomy Overhaul Design

## Scope and outcome

The measured anatomy profile will become a reproducible, class-specific clinical SVG system. The classic profile remains unchanged. Each generated measured asset will preserve the renderer's clinical IDs, transform all anatomy-dependent layers together, namespace paint servers, and retain the FDI/state contract.

The design deliberately models left/right counterparts by mirroring. It does not create one source drawing per FDI number, and it does not collapse clinically different maxillary/mandibular or first/second/third classes into one displayed template.

## Audit map

```text
tools/toothgen/spec.py anatomy classes and FDI assignments
        ↓
tools/toothgen/source/*.svg canonical authored donor geometry (manual-edit boundary)
        ↓
build.py + roots.py + graft.py + gum.py + fillings.py class transforms
occlusal.py occlusal class transforms
        ↓
src/assets/teeth-svgs/measured/*.svg generated assets (never hand-edit)
        ↓
src/odontogram.ts AnatomyProfile maps/orientation/template selection
src/perioGraphic.ts CEJ/root restoration and furcation rendering
        ↓
Python anatomy/geometry verification + Vitest renderer/parity/export tests
```

The six SVGs directly under `src/assets/teeth-svgs/` are the legacy/classic runtime assets. The six SVGs under `tools/toothgen/source/` are canonical measured donor drawings. Files under `src/assets/teeth-svgs/measured/` are generator output and must not be edited manually.

## Considered approaches

1. Keep nine measured templates and adjust only dimensions. This is lowest risk but keeps the known false equivalences: maxillary and mandibular canines, all single-rooted premolars, all mandibular molars, and shared second/third molars.
2. Create hand-authored SVG source files for every class. This maximizes direct control but duplicates hundreds of clinical-layer paths, makes layer registration error-prone, and would amount to an unsupported redraw without supplied source plates.
3. Use explicit anatomy classes with a small canonical donor set plus documented class transforms, and generate separate permanent/primary/occlusal assets. This is selected. It keeps authored paths as the provenance boundary, applies class morphology to every registered layer, and makes the FDI mapping explicit and testable.

## Permanent canonical classes

Side-view classes are `11, 12, 13, 14, 15, 16, 17, 18, 31, 32, 33, 34, 35, 36, 37, 38`. Contralateral teeth mirror the class. Each class stores arch, family, sequence, roots, furcation, measurements, source donor, and morphology parameters in `spec.py`.

- Maxillary anterior: central incisor, lateral incisor, canine.
- Maxillary premolars: first premolar (representative bifurcated/two-root form) and predominantly single-rooted second premolar.
- Maxillary molars: first, second, and simplified/variable third molar, all represented with three root components; posterior classes become progressively smaller and more convergent.
- Mandibular anterior: central incisor, lateral incisor, canine. The central remains the narrowest permanent tooth; the mandibular canine is narrower/shorter than the maxillary canine.
- Mandibular premolars: first and second as separate single-root classes. The first has the stronger buccal-cusp/lingual-cusp imbalance; the second has a broader, more molar-like crown.
- Mandibular molars: first, second, and simplified/variable third molar, each with mesial and distal roots; the first is broad/more divergent, the second more regular/convergent, and the third shorter/more convergent.

## Premolar decisions

- FDI 14/24: `14`, two close buccal/palatal root projections in buccal view, a continuous cervical trunk, two canal branches, and a furcation in the middle-root region. `root_converge` is retained only as a named view-projection parameter and verified against minimum root separation; the palatal tip remains subtly shorter.
- FDI 15/25: `15`, a separately generated predominantly single-rooted maxillary second-premolar class, using a continuous grafted single-root contour rather than a collapsed two-root source.
- FDI 34/44: `34`, its own mandibular first-premolar class, single rooted, narrower crown with greater buccal-cusp dominance.
- FDI 35/45: `35`, its own mandibular second-premolar class, single rooted with a broader, more molar-like crown.

## Molar decisions

- FDI 16/26, 17/27, 18/28 use `16`, `17`, `18`. All retain maxillary three-root topology. The first has the broadest crown and greatest divergence; the second has smaller, closer roots; the third is simplified and most convergent but not forced into a fused single root.
- FDI 36/46, 37/47, 38/48 use `36`, `37`, `38`. All retain mandibular two-root topology. The first is broad and divergent; the second is more symmetric/convergent; the third is shorter and more convergent.
- The palatal maxillary root remains woven into relevant contours/lumens instead of being a detached decorative appendage.

## Occlusal classes

Occlusal templates are class-specific for `14, 15, 34, 35, 16, 17, 18, 36, 37, 38`. The canonical premolar and molar drawings remain donors, but the generator applies class outline proportions and restrained groove/cusp morphology. Clinical surface IDs remain unchanged and every surface layer receives the same transformation as the crown outline. Detail remains intentionally sparse enough for odontogram scale.

## Primary dentition

Primary classes are `51, 52, 53, 54, 55, 71, 72, 73, 74, 75`, mirrored contralaterally. Their specifications retain shorter/bulbous crowns, cervical constriction, relatively large pulp, and long divergent molar roots. Primary side and occlusal SVGs are generated separately and selected when a saved permanent-position state has `toothSelection: "milktooth"`; stored chart keys and displayed FDI conversion remain unchanged.

Separate assets are required because a primary contour and a permanent contour cannot share a single set of caries/restoration/endo paths and both remain registered. Primary assets therefore preserve the same IDs and renderer behavior while allowing all clinical geometry to follow the primary shape.

## Renderer and compatibility

`AnatomyProfile` exposes explicit permanent and primary maps. The tile keeps its permanent FDI state key. The runtime swaps only the SVG template variant when selection crosses the permanent/primary boundary, then runs the existing activation logic. Orientation/mirroring, keyboard selection, accessibility, bridge overlays, plan/status state, export, and persistence semantics remain unchanged.

CEJ/implant/milk anchors are generated from metadata rather than scattered hand-maintained conditionals. Periodontal root display continues to undo `ROOT_DISPLAY_SCALE` using its reciprocal.

## Verification

Python invariants cover complete FDI mapping, class/root/furcation topology, length/width ordering, lumen containment, continuous contours, generated/source clinical-ID parity, paint-server uniqueness, deterministic output, occlusal ratios, filling continuity, and primary-specific morphology. Vitest covers explicit runtime maps, primary template switching, clinical activation, namespace safety, exports, bridge/implant/perio behavior, and existing fingerprints.

Geometry fingerprints are updated only after generated output is inspected. The verifier keeps strict checks; intentional new baselines receive a dated explanation.

## Anatomical evidence

- Repository measurements cite Wheeler/Ash & Nelson mean dimensions and the historical *Odontographie* plate grid already documented in `spec.py`.
- Niagara College's dental anatomy text distinguishes the bifurcated maxillary first premolar, predominantly single-rooted neighboring classes, three-rooted maxillary molars, two-rooted mandibular molars, cusp patterns, and first/second molar differences: https://ecampusontario.pressbooks.pub/oralfacialonline/chapter/tooth-morphology-part-a/
- The same university resource describes anterior crown/cusp relationships: https://ecampusontario.pressbooks.pub/oralfacialonline/chapter/tooth-morphology/
- A systematic review reports mandibular first premolars as overwhelmingly single-rooted while documenting canal variation: https://pmc.ncbi.nlm.nih.gov/articles/PMC3881342/
- A maxillary first-premolar literature review reports both one- and two-root forms, with two canals common: https://pubmed.ncbi.nlm.nih.gov/27106718/
- Primary anatomy guidance documents short crowns, CEJ constriction, relatively large pulp, and long narrow roots: https://ecampusontario.pressbooks.pub/oralfacialonline/chapter/tooth-morphology-primary-part-b/
- Peer-reviewed odontometry supports arch- and class-specific mesiodistal/buccolingual dimensions: https://pmc.ncbi.nlm.nih.gov/articles/PMC12126891/
- Third molars are explicitly treated as simplified representative morphology because their root/canal anatomy is highly variable: https://pmc.ncbi.nlm.nih.gov/articles/PMC10140078/

No copyrighted illustration is copied. The implementation uses measurements, topology, and morphological descriptions to transform the repository's own canonical vector geometry.

## Scope boundaries and review

The overhaul does not change chart-data meaning, clinical enum values, or classic assets. It does not attempt patient-specific root variants or radiographic realism. A dentist should review the representative maxillary first-premolar projection, third-molar simplifications, and primary molar spread before the measured profile is promoted as a default.
