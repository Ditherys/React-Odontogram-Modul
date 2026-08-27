# Measured Chart Layout Refinement Design

## Scope

Refine only the measured-anatomy odontogram so its upper and lower teeth read
as two continuous clinical arches rather than independent cards. The classic
profile remains visually and structurally unchanged. Tooth SVG geometry,
clinical overlay geometry, state, exports, and public APIs are out of scope.

The intended hierarchy is:

```text
continuous measured dental arches
        -> dominant side-view tooth anatomy
        -> secondary aligned occlusal anatomy
        -> subtle rectangular interaction regions
```

## Existing structure

Measured anatomy already renders two `.tooth-arch` grids under
`.tooth-grid[data-anatomy="measured"]`. Their columns encode template-specific
tooth widths, while each side and occlusal drawing remains inside a shared
`.tooth-tile` interaction element. Classic anatomy uses the historical flat
16-column grid.

The boxed appearance is created by the shared tile border, rounded radius,
opaque background, and visible empty occlusal placeholders. Measured spacing
settings currently target the outer flex container instead of the inner arch
grids, so they do not consistently control adjacent measured teeth.

## Visual design

All new rules are gated by `.tooth-grid[data-anatomy="measured"]`.

### Arch grouping

Each `.tooth-arch` receives a quiet, edge-fading background wash with no outer
card border, rounded shell, or shadow. The wash groups all 16 teeth into one
clinical band while allowing the existing gum and tooth artwork to remain the
dominant continuous anatomy.

The two arches retain separate DOM containers and receive a deliberate vertical
gap. Upper and lower alignment, measured columns, and bridge-overlay coordinate
measurement remain unchanged.

### Tooth interaction regions

Measured tooth tiles keep their rectangular layout boxes, padding, minimum
heights, event listeners, and focusability. Their default border becomes
transparent and their background becomes transparent, preventing each tile from
reading as a card without changing hit-area geometry.

Hover uses a restrained accent wash. Active/selected tiles retain the configured
selection colour and border style, but use a smaller radius and lighter fill.
Keyboard focus remains a solid, high-contrast outline and halo above adjacent
tiles. Pointer-active scaling and reduced-motion behavior remain available.

### Anatomical spacing

Measured column widths remain the source of anatomical mesiodistal sizing.
Inter-tooth spacing moves to a measured-specific CSS custom property consumed by
the inner `.tooth-arch` grids:

- close: no visible gap;
- normal: a narrow 1–2 px separation;
- wide: a restrained 6 px separation.

The outer measured grid gap is reserved for separation between upper and lower
arches. This keeps spacing controls meaningful without turning wider spacing
into isolated cards.

### Side and occlusal hierarchy

Side-view anatomy stays full contrast and keeps its existing hit area. Tooth
labels remain close to their associated side-view row.

Occlusal tiles are slightly smaller and lower contrast by default. A hover or
selected state restores full contrast so surface interaction stays clear.
Additional row spacing separates occlusal drawings from side-view anatomy, and
additional inter-arch space prevents the opposing occlusal rows from merging.

Non-applicable anterior occlusal placeholders remain in CSS grid flow to
preserve column alignment, but are visually absent: no border, background,
hover affordance, or visible empty SVG region.

## Accessibility and interaction invariants

The refinement does not change DOM structure or the engine's interaction
wiring. It preserves:

- the grid `listbox` and multiselect semantics;
- side-view `option` roles, `aria-selected`, labels, and `tabindex`;
- click, keyboard, Ctrl/Cmd multi-select, double-click notes, and touch handlers;
- minimum tile heights and rectangular hit regions;
- keyboard focus visibility in light and dark modes;
- read-only, wisdom-hidden, occlusal-hidden, pinch, and mobile arch-toggle
  behavior;
- bridge overlay positioning and pointer transparency.

Occlusal placeholder cells remain non-interactive and absent from the
accessibility tree, as they are today.

## Responsive and theme behavior

Dark mode uses an equivalently subdued arch wash and transparent default tiles.
Hover, selection, and focus maintain sufficient contrast without adding shadows
or persistent borders.

Coarse-pointer rules keep their current hit-area sizing. Narrow layouts may
compress the measured columns but must not introduce horizontal card chrome or
make placeholder cells visible. The close/normal/wide settings remain available
at every viewport.

## Implementation boundary

The expected production change is confined to `src/index.css`. No changes are
planned for SVG assets, `buildGrid`, tooth state, rendering, exports, or public
interfaces. A runtime change is permitted only if browser inspection proves a
CSS-only invariant cannot be met; that would require revising this design first.

## Testing and visual QA

Test-first coverage will lock the measured-only CSS contract:

- selectors are gated by `data-anatomy="measured"`;
- classic base tile styling remains present and unmodified;
- measured tiles use transparent default chrome;
- measured arch grids consume measured-specific spacing values;
- placeholders are visually absent without `display:none` removing grid space;
- focus and selection rules remain explicit;
- occlusal hierarchy rules are measured-only.

Existing measured-anatomy, selection, keyboard, touch, accessibility, bridge,
and build tests will be rerun. Browser QA will compare classic and measured
profiles and inspect:

- default light and dark charts;
- hover, keyboard focus, single selection, and multi-selection;
- close, normal, and wide spacing;
- occlusal visibility and anterior placeholder regions;
- representative bridge and mixed clinical states;
- desktop and narrow/coarse-pointer layouts.

Acceptance requires zero changes to clinical SVG registration and no loss of
clickable area, focus visibility, keyboard semantics, touch behavior, or
side/occlusal alignment.
