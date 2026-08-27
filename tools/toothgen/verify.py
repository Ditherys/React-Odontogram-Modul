"""Verify generated anatomy, clinical contracts, and frozen authored geometry."""

from __future__ import annotations

import math
import re
import sys
import hashlib
import xml.dom.minidom as minidom
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import roots  # noqa: E402
from build import ASSETS, SOURCE, curve_extent, tooth_base_d  # noqa: E402
from spec import PRIMARY_SPECS, SPECS, display_targets  # noqa: E402

TOL_FRAC = 0.015
TOL_LEN = 1.0
TOL_OCCL = 0.15

DEFAULT_SET = "all"

# A canal may be no wider than this fraction of the root at the same height.
# Generous against LUMEN_HALF_FRAC on purpose: several lumen layers overlap at
# the chamber, and the check is here to catch a canal that fills its root, not
# to re-assert the generator's own constant.
TOL_LUMEN_WIDTH = 0.80

# Apical widening tolerated per quarter unit through the cervical region.
TOL_CERVICAL_STEP = 0.03

# Direction change tolerated along the root shaft, in degrees per unit of
# contour, with the apical tip excluded because a root tip turns sharply by
# nature. The drawn templates measure 3.8 to 8.5 here.
TOL_SHAFT_TURN = 15.0
TIP_EXCLUDED = 3.5


def shaft_turn(base_d: str, apex: float, cej: float, chord: float = 1.0):
    """The sharpest direction change along the root outline.

    A kink is a discontinuity in DIRECTION, not in width, and nothing here
    measured direction: the contour checks ask only whether the outline widens
    again apically. Template 15 passed all of them while a clinician read a kink
    straight off the chart, and a first attempt at repairing it passed them
    while making the outline visibly worse. Measured over a chord rather than
    between adjacent sampled points, because at point spacing a wobble of a
    twentieth of a unit reads as eighty degrees and nothing is learnt.
    """

    pts = roots._polylines(base_d)[0]
    walk = [pts[0]]
    run = 0.0
    for a, b in zip(pts, pts[1:]):
        run += ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        if run >= chord:
            walk.append(b)
            run = 0.0

    worst, worst_at = 0.0, None
    for a, b, c in zip(walk, walk[1:], walk[2:]):
        if not (apex + TIP_EXCLUDED < b[1] < cej + 0.5):
            continue
        v1 = (b[0] - a[0], b[1] - a[1])
        v2 = (c[0] - b[0], c[1] - b[1])
        l1 = (v1[0] ** 2 + v1[1] ** 2) ** 0.5
        l2 = (v2[0] ** 2 + v2[1] ** 2) ** 0.5
        if l1 < 0.3 or l2 < 0.3:
            continue
        cosine = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)
        angle = math.degrees(math.acos(max(-1.0, min(1.0, cosine))))
        if angle > worst:
            worst, worst_at = angle, b[1]
    return worst, worst_at


def lumen_extremes(txt: str, base_d: str, apex: float, cej: float):
    """How far the lumen reaches past the apex, and how wide it gets.

    Nothing measured lumen before this: verify.py passed on assets in which the
    pulp stood outside the root apex on the canine and a canal came out wider
    than the root containing it. The guard did not fail, it did not look
    (odontogram-66a, odontogram-0ak).
    """

    subs: list = []
    roots._lumen_paths(txt, lambda d: subs.extend(roots._polylines(d)) or None)
    if not subs:
        return None, None

    base = roots._polylines(base_d)
    overhang = apex - min(p[1] for s in subs for p in s)

    widest = 0.0
    for i in range(1, 20):
        y = cej - (cej - apex) * i / 20
        lumen_spans = roots.spans_at(subs, y)
        base_spans = roots.spans_at(base, y)
        if not lumen_spans or not base_spans:
            continue
        base_w = sum(b - a for a, b in base_spans)
        if base_w > 0.2:
            widest = max(widest, sum(b - a for a, b in lumen_spans) / base_w)
    return overhang, widest


# Re-taken on 2026-08-10 for odontogram-66a: the lumen repair moves lumen `d`
# attributes on all nine templates, which is an intended, reviewed correction,
# not drift. The previous set was captured on 2026-08-09 from
# origin/feat/tooth-anatomy-9-templates and is recorded in that bead.
# Re-taken on 2026-08-11 for odontogram-3y9: `root_frac` on all nine permanent
# templates is now Dirk's reading off the Odontographie plates, and the two
# display constants changed with it - `ROOT_DISPLAY_SCALE` 0.60 -> 0.75 (less
# root compression, as he asked) and the new `LENGTH_SPREAD` 0.45. Both move
# geometry on every template, primary ones included, and both are intended,
# reviewed corrections rather than drift. `OCCL_MARGIN` went 7.5 -> 8.0 in the
# same change because the longer crown region pushed gum past the old viewBox
# bottom. The previous set was taken on 2026-08-10 and is recorded below.
# Re-taken on 2026-08-11 for odontogram-qyc: `gum-base` and `bone-base` are no
# longer warped out of the source drawings, they are DRAWN by tools/toothgen/
# gum.py in each template's final coordinates. That was the only way to make the
# gingiva read as one line across the arch - a papilla is shared between two
# teeth, and two hand-drawn halves have no way to agree on its height. The same
# change levels the bone block and absorbs the viewBox rounding into the shift,
# so the occlusal plane lands exactly OCCL_MARGIN above the written bottom;
# both move geometry on every template. Intended, reviewed corrections. SVG
# fingerprint parity is byte-identical throughout - the fingerprint reads id,
# opacity and class, never geometry.
# 31 and 71 re-taken again the same day: the lower incisors now stand in a 31 px
# column instead of 44, so their gum papilla moves with the joint. That change
# is what puts the lower canine in the embrasure between the upper lateral and
# the upper canine, which is where the mouth puts it.
# Re-taken TWICE on 2026-08-11 for odontogram-5ca. First, `width_frac` was set
# from the standard mean mesiodistal crown diameters, since the values it had
# carried no source and did not agree with each other. Then the measurement the
# generator fits those targets against turned out to be broken: it flattened
# the outline through the Bezier ANCHORS instead of the curve, so a molar read
# 24.6 units wide where it is 40.0, and the templates drawn with the longest
# curves - the premolars and molars - had been scaled up by a third to make
# that undersized number match. Both are intended, reviewed corrections. Every
# template scales horizontally, so every digest moves.
# Re-taken again on 2026-08-11 for odontogram-3y9: LENGTH_SPREAD 0.45 -> 0.30.
# The apex line was still 15.1 px ragged, essentially all of it the canine
# standing proud of the second molars; at 0.30 it is 9.6 px and the canine is
# still visibly the longest tooth, which is what "almost equal" asked for. One
# constant, every template's length moves. Intended, reviewed correction.
# Re-taken on 2026-08-28 after the canonical-anatomy overhaul was reviewed in
# the running full-mouth, primary-dentition, periodontal, and mixed-clinical
# views. The intentional changes are: 16 explicit permanent and 10 explicit
# primary classes, class-specific crown/root maps, distinct upper/lower
# premolar and molar topology, cervical bulbosity in every primary class, and
# registered root/pulp/filling/periodontal transforms. The obsolete generated
# class 46 is replaced by the explicit mandibular first-molar class 36. Every
# generated side and occlusal class is frozen below; a new class may no longer
# remain silently unfingerprinted.
AUTHORED_GEOMETRY_SHA256 = {
    "11": "cf09e92f1425d10c42c627d3a2f32b93f63684a2a0be0d70032b2a547a08fd59",
    "12": "0ba93b77e54887e9553186b222877c383727528054f006d0f136e5962cfbccfc",
    "13": "7e3b59295959da4cefa4481168e496cb2cd8aa82a9d969a9350a4df594be47c6",
    "14": "47e6e48c9a163af9ef739fdbe79827220179eac33545ac865878a5480eb004d1",
    "15": "1394c297657b2c179980da1ca58377421fdcdac24adae1567b5e3bc3110a558b",
    "16": "b9fb7b6277cd44c17965c31691263a524b05f542b5f5901225044c65ffd6473f",
    "17": "d526945e31103fa6cf511954847ec927471022a558892a661054d15550417dab",
    "18": "069d1452d1011f9a9fc0e7d856598327c26d523897302732b6928150801e38d7",
    "31": "f17a53e3e5fece266156285138799b8d52738d63b5ed3a62b558c43f7f1307b9",
    "32": "e79111a270e3a359296eca506803ecf25af933837f08115c1fdc5a7d914d6ab9",
    "33": "d01c21aa8dc214f78b3edc6df043cf64cf631cbc34c5781d7e64c8ba6271d6ec",
    "34": "09d375eccf506705c9467efa8ea29ec32793dd5d031137f1ea3c3adafe4cfbbf",
    "35": "2e74f1777600142eb964219d4f08b505c460ac3b7e055bbb70fa8abad6ba9f52",
    "36": "7fc2a473e26cc90b7823c2830f78342de8f1c00ca451bb16d888328a7f105c3a",
    "37": "19272b3dad6dc0f8109ee99c76fb3834babdaf6c87902c21365fc9baea7543c5",
    "38": "46510963dc0204a5a2175da287db3e044c93e404e7c58aa7cfda1743c06df4b0",
    "51": "e6f7d91a0a2f93d9a73076127a4c21ec7df50858116f61e065377eb3626eee7c",
    "52": "6c5c7eb28d764c434fd689b1c02a2ced727b32e58e8883dea5eac37367813c46",
    "53": "199873929c0c0884d22fcb1aa24989b2ebea1d9e972d20c435f36471e8fdc90e",
    "54": "37f1dfb57bf57d9a180705f85c4178aaebd32520e4f2933c0acf841ce3edc506",
    "55": "149a569c747c8fa2eabc68964ca502a83db458e916b82f5bd2a4641ccd8fcd93",
    "71": "0f6eaa4d65f2b86007814d99b06e459abc8b7b3ddc23c668a64dc9a6f3dcd480",
    "72": "0e5254bd52a2c48831fe9791b40d25037596a645f4d9cbca9d66fb9b7869d8a6",
    "73": "b22450089777698365502bfe848c435405211ae5e9d951a8e9b55e11bdbf56fc",
    "74": "b1340b73a8817d3c7b1dab227d0a22918cf042e887ec358d26b0622efb8c7cb2",
    "75": "232a284ffb0f0fc433aaff80b9adfda8782d8933c688f101c96627a1dee7a70a",
}

OCCLUSAL_GEOMETRY_SHA256 = {
    "14_occl": "f2500415ae8771cd00080fce231756b3ec102499ce06248bbf79844af852cb47",
    "15_occl": "4f871133093b0329a5f15e42dee72510e32e3b0554076974e89776991c77a9ba",
    "34_occl": "e4e3b1d9d85e18651a4da5205e68c9387660632f0a6d74630e88bf269bfd5f47",
    "35_occl": "7cd7b1ead8e9665a17ebe90868e8b71312c7e20e7169f0ddbaf6bf35d09c2fb5",
    "16_occl": "712d785fade7b52b874cea0e8131e52aecb19e429e795435b68b8b177f99ad51",
    "17_occl": "4f21c6148e61729c1487edaf209761643f152e3c2d16f8c222062fe7bde01dca",
    "18_occl": "7f04c849dd4ccf2d02a982b69f5e74f85f9f14952830915c7973d40b80b694f6",
    "36_occl": "9676924bbddd5692b6381617ae45093033c6648ce147e2437056431f13d352f2",
    "37_occl": "f2d8c6614d6a0f03235cf761caf39495923bfeeaae9a549403364a5f488b8646",
    "38_occl": "51b58a76ee5a753d75b370b45a4a28a0b079e8b3491a95bf15398c350d70bf8d",
    "54_occl": "bdafd335e2c8dcaa3f9ceca3fab19c0593ef007f0b03c94523f0da7516d1364b",
    "55_occl": "db5b4737fd1969634fae8bd81eaaf6ee6618680797e3653fe909a5ffc9032e15",
    "74_occl": "fda6c114c49d4638861c5be0b5da81d9030a1fe1c926f6ac43f7a46bba537eda",
    "75_occl": "ceb1d198929ca3c3dc8b285e0353c3375d6b16440e737a2de897984641cd2a29",
}

GEOMETRY_ATTRIBUTES = (
    "d",
    "points",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "fx",
    "fy",
    "r",
    "rx",
    "ry",
    "width",
    "height",
    "transform",
)

# Geometry is not only expressible as an XML attribute. SVG 2 / CSS also accept
# several of these as CSS properties, so `style="transform: scale(2)"` moves a
# contour just as `transform="scale(2)"` does. Hashing attributes alone would
# leave that route unguarded and let authored anatomy drift while the frozen
# digest still matched. Only the geometry-bearing declarations are taken from
# `style`: the rest of it is paint, and paint is not what these digests freeze.
GEOMETRY_STYLE_PROPERTIES = frozenset(GEOMETRY_ATTRIBUTES)


def geometry_style(value: str) -> str:
    """The geometry-bearing declarations of a `style` attribute, normalized."""

    kept = []
    for declaration in value.split(";"):
        name, separator, setting = declaration.partition(":")
        if not separator:
            continue
        name = name.strip().lower()
        if name in GEOMETRY_STYLE_PROPERTIES:
            kept.append(f"{name}:{' '.join(setting.split())}")
    return ";".join(kept)


def clinical_ids(txt: str) -> list[str]:

    without_defs = re.sub(r"<defs>.*?</defs>", "", txt, flags=re.S)
    return re.findall(r'id="([^"]+)"', without_defs)


def geometry_digest(txt: str) -> str:

    root = ET.fromstring(txt)
    parts: list[str] = []

    def walk(node: ET.Element, inside_defs: bool = False) -> None:
        local_name = node.tag.rsplit("}", 1)[-1]
        blocked = inside_defs or local_name == "defs"
        if not blocked:
            values = "|".join(
                f"{name}={node.attrib[name]}"
                for name in GEOMETRY_ATTRIBUTES
                if name in node.attrib
            )
            styled = geometry_style(node.attrib.get("style", ""))
            if styled:
                values = f"{values}|style[{styled}]" if values else f"style[{styled}]"
            parts.append(f"{local_name}|{values}")
        for child in node:
            walk(child, blocked)

    walk(root)
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def root_count(base_d: str, apex: float, cej: float) -> int:

    subs = roots._polylines(base_d)
    counts = []
    for f in (0.25, 0.35, 0.45, 0.55):
        y = apex + (cej - apex) * f
        sp = roots.spans_at(subs, y)

        merged = 1
        for a, b in zip(sp, sp[1:]):
            if b[0] - a[1] > 0.25:
                merged += 1
        counts.append(merged if sp else 0)
    return max(set(counts), key=counts.count)


def check_occlusal(out_dir: Path, failures: list[str]) -> None:
    """The occlusal templates: the proportion the generator was asked for, and
    every clinical layer of the drawing it came from.

    odontogram-vlw AC3 asks for the coordinate transformation to be verified
    here, not merely produced. AC4 asks for the clinical layer ids, hidden
    defaults and activation paths to survive it - an x-scale should preserve all
    of them, and this is what says so rather than assuming it.
    """

    from occlusal import OCCL_SPECS, outline_extent

    print(f"\n{'Occl':9s} {'Ratio b/m':>18s}  {'id/Tags':>8s}  {'hidden':>8s}")
    print("-" * 50)
    for spec in OCCL_SPECS:
        f = out_dir / f"{spec.key}.svg"
        if not f.exists():
            failures.append(f"{spec.key}: file is missing")
            continue
        txt = f.read_text()
        src = (SOURCE / f"{spec.src}.svg").read_text()

        w, h, _ = outline_extent(txt)
        ratio = h / w
        ok_r = abs(ratio - spec.ratio) <= 0.02

        ids_ok = clinical_ids(txt) == clinical_ids(src)

        # Cusp/fissure paths are intentionally generated class anatomy. Remove
        # only those marked/known baseline interiors before checking structural
        # tag parity; every clinical surface and all surrounding structure must
        # still match the canonical source exactly.
        def without_baseline(value: str) -> str:
            value = re.sub(
                r'<g[^>]+data-toothgen-anatomy="primary-cusps"[^>]*>.*?</g>',
                "",
                value,
                flags=re.S,
            )
            for group_id in ("cusps", "fissure", "fissure1"):
                value = re.sub(
                    rf'(<g id="{group_id}"[^>]*>).*?(</g>)',
                    rf"\1\2",
                    value,
                    count=1,
                    flags=re.S,
                )
            return value

        tags_ok = re.findall(r"<(\w+)", without_baseline(txt)) == re.findall(
            r"<(\w+)", without_baseline(src)
        )

        cusp_attr = re.search(r'<svg[^>]+data-cusp-count="(\d+)"', txt)
        groove_attr = re.search(r'<svg[^>]+data-groove-pattern="([^"]+)"', txt)
        marker = "primary-cusps" if spec.primary else "cusps"
        cusp_group = re.search(
            rf'<g[^>]+data-toothgen-anatomy="{marker}"[^>]*>(.*?)</g>',
            txt,
            re.S,
        )
        groove_marker = "primary-grooves" if spec.primary else "grooves"
        groove_group = re.search(
            rf'<g[^>]+data-toothgen-anatomy="{groove_marker}"[^>]*>(.*?)</g>',
            txt,
            re.S,
        )
        anatomy_ok = (
            cusp_attr is not None
            and int(cusp_attr.group(1)) == spec.cusp_count
            and cusp_group is not None
            and len(re.findall(r"<path\b", cusp_group.group(1))) == spec.cusp_count
            and groove_attr is not None
            and groove_attr.group(1) == spec.groove_pattern
            and groove_group is not None
            and len(re.findall(r"<path\b", groove_group.group(1))) >= 1
        )

        all_ids = re.findall(r'\bid="([^"]+)"', txt)
        ids_unique = len(all_ids) == len(set(all_ids))
        paint_refs = set(re.findall(r'url\(#([^)]+)\)', txt))
        paint_ok = paint_refs.issubset(set(all_ids))
        # A layer switched off in the drawing must still be switched off here,
        # or a finding would render on a tooth nobody charted it on.
        hidden_ok = txt.count("display: none") == src.count("display: none")
        geometry_ok = geometry_digest(txt) == OCCLUSAL_GEOMETRY_SHA256.get(spec.key)

        mark = lambda b: "OK" if b else "!!"  # noqa: E731
        print(
            f"{spec.key:9s} {mark(ok_r)} {ratio:5.2f} (target {spec.ratio:.2f})  "
            f"{mark(ids_ok and tags_ok and anatomy_ok and ids_unique and paint_ok):>8s}  "
            f"{mark(hidden_ok):>8s}"
        )
        if not ok_r:
            failures.append(
                f"{spec.key}: outline ratio {ratio:.2f} instead of {spec.ratio:.2f}"
            )
        if not ids_ok:
            failures.append(f"{spec.key}: clinical id order differs from its drawing")
        if not tags_ok:
            failures.append(
                f"{spec.key}: non-anatomy element tags differ from its drawing"
            )
        if not anatomy_ok:
            failures.append(
                f"{spec.key}: generated cusp/groove topology does not match its spec"
            )
        if not ids_unique:
            failures.append(f"{spec.key}: duplicate SVG ids within the asset")
        if not paint_ok:
            failures.append(f"{spec.key}: unresolved paint-server reference")
        if not hidden_ok:
            failures.append(
                f"{spec.key}: {txt.count('display: none')} hidden defaults against "
                f"the drawing's {src.count('display: none')}"
            )
        if not geometry_ok:
            failures.append(f"{spec.key}: authored occlusal geometry changed")


INDEX_CSS = ASSETS.parents[2] / "index.css"


def check_columns(specs, failures):
    """`ToothSpec.col_px` has to name a column the grid actually has.

    The gum puts its papilla half a column plus half a gap from the tooth's
    centre, which is what makes two neighbours peak on the same point without
    either knowing the other (see tools/toothgen/gum.py). That only holds while
    the number in the spec is the number in the stylesheet, and nothing else
    ties the two together - so widening a column in src/index.css and leaving
    the spec alone would silently walk every papilla off its joint. This is the
    check that says so.
    """
    try:
        css = INDEX_CSS.read_text()
    except OSError:
        failures.append(f"cannot read {INDEX_CSS}")
        return
    # Both arches, because they no longer have the same columns: the lower
    # incisors stand in 31 px where the upper ones stand in 44.
    decls = re.findall(r"grid-template-columns:([^;]+);", css, re.S)
    if not decls:
        failures.append("grid-template-columns not found in src/index.css")
        return
    have = {
        float(v)
        for d in decls
        for v in re.findall(r"minmax\([^,]+,\s*([\d.]+)px\)", d)
    }
    if not have:
        failures.append("no minmax() columns found in src/index.css")
        return
    print(f"\nGrid columns in src/index.css: {sorted(have)}")
    for s in specs:
        if s.col_px not in have:
            failures.append(
                f"{s.key}: col_px {s.col_px:g} is not a column the grid has "
                f"({sorted(have)}); the papilla would miss the joint"
            )


# Adjacent filling surfaces that a clinician charts as ONE restoration. MO, OD
# and MOD are cut through the occlusal surface, so the proximal box and the
# occlusal part are one piece of material and have to be drawn as one shape.
FILLING_PAIRS = (("mesial", "occlusal"), ("occlusal", "distal"))


def _segments(d: str):
    return [
        (a, b) for sub in roots._polylines(d) for a, b in zip(sub, sub[1:])
    ]


def _crosses(p1, p2, p3, p4) -> bool:
    def side(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    d1, d2 = side(p3, p4, p1), side(p3, p4, p2)
    d3, d4 = side(p1, p2, p3), side(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def _inside(pt, segs) -> bool:
    x, y = pt
    n = 0
    for (ax, ay), (bx, by) in segs:
        if (ay > y) != (by > y):
            t = (y - ay) / (by - ay)
            if ax + t * (bx - ax) > x:
                n += 1
    return n % 2 == 1


def shapes_meet(d1: str, d2: str) -> bool:
    """Do two filled outlines share any point - i.e. is their union ONE region?

    Exact for these shapes and free of dependencies: two filled regions overlap
    exactly when their outlines cross, or when one lies wholly inside the other.
    Deliberately NOT an area or a bounding-box test - the shapes this was
    written for had overlapping bounding boxes for years while missing each
    other entirely, and a guard that does not measure what the clinician looks
    at passes while the drawing gets worse (odontogram-9cl).
    """
    s1, s2 = _segments(d1), _segments(d2)
    for a, b in s1:
        for c, e in s2:
            if _crosses(a, b, c, e):
                return True
    return _inside(s1[0][0], s2) or _inside(s2[0][0], s1)


def check_fillings(out_dir: Path, failures):
    """Every MO and OD pair, on every template, must be one connected shape."""
    for f in sorted(out_dir.glob("*.svg")):
        txt = f.read_text()
        for a, b in FILLING_PAIRS:
            da = re.search(rf'<path id="filling-composite-{a}" d="([^"]+)"', txt)
            db = re.search(rf'<path id="filling-composite-{b}" d="([^"]+)"', txt)
            if not da or not db:
                continue
            if not shapes_meet(da.group(1), db.group(1)):
                failures.append(
                    f"{f.stem}: filling {a[0].upper()}{b[0].upper()} is two "
                    f"separate shapes; it has to read as one restoration"
                )



def main(argv):
    argv = list(argv)
    which = DEFAULT_SET
    for flag in ("--primary", "--all"):
        if flag in argv:
            which = flag[2:]
            argv.remove(flag)

    specs = []
    if which in ("permanent", "all"):
        specs += SPECS
    if which in ("primary", "all"):
        specs += PRIMARY_SPECS

    out_dir = Path(argv[1]) if len(argv) > 1 else ASSETS
    failures = []
    occl_offsets = []

    print(f"Checking {out_dir}\n")
    hdr = (
        f"{'Tpl':4s} {'Roots':>10s}  {'Root fraction':>20s}  {'Length':>14s}  "
        f"{'Lumen apex':>11s} {'Lumen width':>11s}  {'id/Tags':>8s}"
    )
    print(hdr)
    print("-" * len(hdr))

    for s in specs:
        f = out_dir / f"{s.key}.svg"
        if not f.exists():
            failures.append(f"{s.key}: file is missing")
            continue
        txt = f.read_text()
        try:
            minidom.parseString(txt)
        except Exception as e:
            failures.append(f"{s.key}: invalid XML ({e})")
            continue

        all_ids = re.findall(r'\bid="([^"]+)"', txt)
        if len(all_ids) != len(set(all_ids)):
            failures.append(f"{s.key}: duplicate SVG ids within the asset")
        paint_refs = set(re.findall(r'url\(#([^)]+)\)', txt))
        if not paint_refs.issubset(set(all_ids)):
            missing = sorted(paint_refs - set(all_ids))
            failures.append(
                f"{s.key}: unresolved paint-server reference(s) {missing}"
            )
        declared_roots = re.search(r'<svg[^>]+data-root-count="(\d+)"', txt)
        if declared_roots is None or int(declared_roots.group(1)) != s.roots:
            failures.append(
                f"{s.key}: data-root-count does not match the anatomy spec"
            )

        src = (SOURCE / f"{s.src_template}.svg").read_text()
        ids_ok = clinical_ids(src) == clinical_ids(txt)
        tags_ok = re.findall(r"<(\w+)", src) == re.findall(r"<(\w+)", txt)
        # A template with no recorded digest is not yet frozen, which is a
        # state, not a fault. The digests exist to report geometry that moved
        # when nobody meant it to; they are not a gate a new drawing has to pass
        # before it may exist (odontogram-0ak).
        frozen = AUTHORED_GEOMETRY_SHA256.get(s.key)
        geometry_ok = frozen is None or geometry_digest(txt) == frozen

        base_d = tooth_base_d(txt)
        x0, apex, x1, inc = curve_extent(base_d)
        vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', txt).group(1).split()]

        mm = re.search(r"<!-- toothgen:.*?\bcej=([-\d.]+)", txt)
        if not mm:
            failures.append(f"{s.key}: toothgen metadata block is missing")
            continue
        cej = float(mm.group(1))

        n_sub = len(roots._polylines(base_d))
        if n_sub != 1:
            failures.append(
                f"{s.key}: tooth-base contains {n_sub} subpaths; "
                f"the contour must be continuous"
            )

        if s.roots == 1:
            subs = roots._polylines(base_d)
            # A lumen may fall into several lobes inside the chamber, but below
            # the cervical line a single-rooted tooth has ONE canal. Anything
            # else is the twin structure of a two-rooted source surviving the
            # conversion, which is what template 15 shipped with
            # (odontogram-ay4).
            # Counted as a RUN over consecutive millimetre depths. A single
            # height with two spans is a shape - a post with a shoulder, one
            # mark of a hatch pattern - while surviving twin canals persist over
            # several units, which is how template 15 read: four spans holding
            # from the cervical line to four units below it.
            def lumen_spans(d):
                sub = roots._polylines(d)
                run = best = 0
                worst = 0
                depth = 1.0
                while cej - depth > apex + 1.0:
                    n = len(roots.spans_at(sub, cej - depth))
                    run = run + 1 if n > 1 else 0
                    best = max(best, run)
                    worst = max(worst, n)
                    depth += 1.0
                if best >= 2:
                    multi.append(worst)
                return None

            multi: list[int] = []
            roots._lumen_paths(txt, lumen_spans)
            if multi:
                failures.append(
                    f"{s.key}: {len(multi)} lumen layer(s) hold up to "
                    f"{max(multi)} spans over consecutive depths below the "
                    f"cervical line; the twin canals of the two-rooted source "
                    f"survive"
                )

            # The cervical region on its own fine grid. The coarse sweep below
            # starts at 8 % of root length and steps in whole units, so it
            # walked straight over template 15's step, which sat within the
            # first unit and measured 0.058 per quarter unit. Every other
            # single-rooted template measures 0.000 there, so the threshold is
            # read off a clean separation rather than guessed.
            prev_w, cerv_at = None, None
            y = cej
            while y > cej - 4.0 and y > apex:
                sp = roots.spans_at(subs, y)
                if len(sp) == 1:
                    w = sp[0][1] - sp[0][0]
                    if prev_w is not None and w > prev_w + TOL_CERVICAL_STEP:
                        cerv_at = y
                    prev_w = w
                y -= 0.25
            if cerv_at is not None:
                failures.append(
                    f"{s.key}: contour widens apically at CEJ-{cej - cerv_at:.2f}; "
                    f"a step sits in the cervical region"
                )

            turn, turn_at = shaft_turn(base_d, apex, cej)
            if turn > TOL_SHAFT_TURN:
                failures.append(
                    f"{s.key}: the root outline turns {turn:.0f} degrees at "
                    f"CEJ-{cej - turn_at:.1f}; the shaft is not continuous"
                )

            prev, step_at = None, None
            for k in range(24):
                y = cej - (cej - apex) * (0.01 + 0.95 * k / 23)
                sp = roots.spans_at(subs, y)
                if len(sp) != 1:
                    continue
                w = sp[0][1] - sp[0][0]
                if prev is not None and w > prev + 0.12:
                    step_at = y
                prev = w
            if step_at is not None:
                failures.append(
                    f"{s.key}: root widens apically again at y={step_at:.1f}; "
                    f"the contour contains a step"
                )

            raw = roots.spans_at(subs, (apex + cej) / 2)
            if len(raw) > 1:
                failures.append(
                    f"{s.key}: root splits into {len(raw)} spans at half height; "
                    f"the former two-root seam remains"
                )

        overhang, lumen_w = lumen_extremes(txt, base_d, apex, cej)
        if overhang is None:
            failures.append(f"{s.key}: no lumen layer found")
        else:
            if overhang > 0:
                failures.append(
                    f"{s.key}: lumen stands {overhang:.2f} outside the root apex"
                )
            if lumen_w > TOL_LUMEN_WIDTH:
                failures.append(
                    f"{s.key}: lumen reaches {lumen_w:.0%} of the root width; "
                    f"a canal is drawn as wide as the root that contains it"
                )

        n = root_count(base_d, apex, cej)
        if s.roots > 1:
            furc = roots.find_furcation(base_d, apex, cej)
            root_trunk = (cej - furc) / (cej - apex)
            # A zero-height split looks like detached root pieces; an extremely
            # long trunk hides the clinically useful furcation. These broad
            # bounds tolerate normal class variation and protect topology, not
            # harmless subpixel shape changes.
            if not 0.08 <= root_trunk <= 0.38:
                failures.append(
                    f"{s.key}: furcation/root-trunk fraction {root_trunk:.1%} "
                    "falls outside the credible display range 8%-38%"
                )
        frac = (cej - apex) / (inc - apex)
        length = inc - apex
        occl_offsets.append((s.key, vb[1] + vb[3] - inc))

        _, want_frac, _ = display_targets(s)

        ok_n = n == s.roots
        ok_f = abs(frac - want_frac) <= TOL_FRAC
        ok_l = True
        mark = lambda b: "OK" if b else "!!"  # noqa: E731
        ok_lo = overhang is not None and overhang <= 0
        ok_lw = lumen_w is not None and lumen_w <= TOL_LUMEN_WIDTH
        print(
            f"{s.key:4s} {mark(ok_n)} {n} (target {s.roots})  "
            f"{mark(ok_f)} {frac:5.1%} (target {want_frac:.0%}, anatomical {s.root_frac:.0%})  "
            f"{length:8.1f}  "
            f"{mark(ok_lo)} {overhang if overhang is not None else 0:+6.2f} "
            f"{mark(ok_lw)} {lumen_w if lumen_w is not None else 0:8.0%}  "
            f"{mark(ids_ok and tags_ok):>8s}"
        )
        if not ok_n:
            failures.append(f"{s.key}: {n} roots instead of {s.roots}")
        if not ok_f:
            failures.append(
                f"{s.key}: root fraction {frac:.1%} instead of {want_frac:.0%}"
            )
        if not ids_ok:
            failures.append(
                f"{s.key}: clinical id order differs from the source template"
            )
        if not tags_ok:
            failures.append(f"{s.key}: element tags differ from the source template")
        if not geometry_ok:
            failures.append(f"{s.key}: authored geometry changed")

    check_occlusal(out_dir, failures)
    check_fillings(out_dir, failures)
    check_columns(specs, failures)

    if occl_offsets:
        vals = [v for _, v in occl_offsets]
        spread = max(vals) - min(vals)
        print(
            f"\nOcclusal plane above viewBox bottom: {min(vals):.2f} .. {max(vals):.2f} "
            f"(spread {spread:.2f})"
        )
        if spread > TOL_OCCL:
            failures.append(
                f"occlusal plane spreads by {spread:.2f}; crowns do not align"
            )

    print()
    if failures:
        print(f"{len(failures)} problem(s):")
        for x in failures:
            print("  !!", x)
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
