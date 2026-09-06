# NEXT RUN — FrameChute primitive-first snowballing pass (V4)

This is the **single authoritative prompt for the next Codex run**. Work from current `main`. Do not read the older prompt stack unless this file leaves a concrete implementation detail genuinely ambiguous. Where older prompts conflict, this file wins.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Mission for this run

Do **not** approach the list below as twenty unrelated feature tickets.

The goal is to make FrameChute **snowball**: implement/refactor the smallest set of reusable primitives that make today's bugs disappear and make tomorrow's features cheap to add.

Prefer:

```text
one camera/world primitive
one selection primitive
one floating-panel primitive
one image-edit state/history primitive
one color-sampling primitive
one composition/export primitive
one PDF text-field model
one context-menu model
```

over separate one-off handlers for every command.

Core law:

> Build the substrate once, then let many features become thin compositions of it.

Additional invariants:

> Internal manipulation must never look like external ingestion.
>
> The viewport/camera moves. The artwork does not.
>
> UI chrome floats above the workspace and does not scale with artwork.
>
> If a user can point at the thing they mean, do not force them to type a code for it.
>
> If I just changed it, Ctrl/Cmd+Z should make sense.
>
> What the user sees before export should match what gets saved.

---

# P0 correctness blockers

## 1. Internal movement must NEVER show `Drop into FrameChute`

This remains a hard invariant.

Moving/resizing/selecting an existing FrameChute object, moving an image inside PDF/DOCX, menu-grab movement, future camera gestures, and selection/marquee gestures must never activate the global external-ingest overlay, even briefly.

Only genuine external OS/browser file/URL drags may show it.

Keep one explicit internal-vs-external drag ownership primitive and route all drag/drop surfaces through it rather than adding per-feature exceptions.

Hard test:

```text
Drag an existing image around for 10 seconds
→ global Drop into FrameChute never appears
```

## 2. PDF Save / Save As must be reliable

Treat broken PDF Save / Save As as a correctness bug, not polish.

Build/repair a single PDF serialization + destination-save path so:

```text
visible PDF edit state
→ serialize once through canonical model
→ Save updates current writable target when available
→ Save As chooses a destination
→ saved file contains the visible edits
```

If Save cannot overwrite the current source, say so and route to Save As. Never report success when bytes were not written.

---

# FOUNDATION A — world space, camera, centering, zoom, expandable workspace

Create or consolidate a reusable **workspace camera/world-space primitive** instead of manipulating every object's CSS ad hoc.

Required conceptual separation:

```text
WORLD
object x/y/width/height/z
workspace origin/extents

CAMERA
zoom
scroll/pan/focal point
visible viewport

UI CHROME
toolbar
Quick Actions
Settings
media dock
context menus/popovers
```

The three layers must not leak into each other.

## Camera behavior

Add/prepare canonical workspace zoom:

```text
Ctrl/Cmd +    zoom in
Ctrl/Cmd -    zoom out
Ctrl/Cmd 0    100%
```

If browser shortcut conflicts require another implementation detail, intercept only inside the FrameChute workspace/window and keep accessibility sane.

Zoom changes the camera, never stored object coordinates or source dimensions.

Prefer zoom around pointer/focal point; otherwise center of visible workspace.

Add reusable camera commands:

```text
Center Work / Fit Workspace
Fit Selection
100%
```

Opening a first object/new work should feel centered in front of the user, not arbitrarily glued to the top-left.

## Expand beyond current viewport

Dragging a top-level object against/past any edge should extend usable workspace rather than push/clamp it back.

Left/top growth requires real origin/prepend + scroll compensation so artwork does not jump.

Passive resize, scroll, toolbar changes, zoom, menus, rerender, restore, or opening/closing floating panels must never rewrite object world coordinates.

Persist world origin/extents/camera state in FCX where appropriate.

If the full camera refactor is too large for this run, land the shared model/helpers plus one vertical slice (zoom + centering OR edge expansion) rather than another one-off positioning hack.

---

# FOUNDATION B — reusable floating chrome / popover primitive

Quick Actions, color pickers, transparency Apply/Cancel, Settings-like panels, future PDF controls, and similar UI should reuse one **floating-panel/popover positioning primitive**.

Properties:

- fixed to application viewport, not transformed with workspace zoom,
- draggable where appropriate,
- sensible max height with internal scrolling,
- clamps/repositions to remain usable on narrow windows,
- can remember last position when useful,
- closing it never changes selection or artwork,
- opening/closing it never changes workspace geometry,
- keyboard/focus/Escape behavior is consistent.

## Quick Actions

Quick Actions must:

```text
Quick Actions                         ×
```

- have **no Clear button**,
- `×` hides only the panel,
- global Settings ON/OFF remains authoritative,
- individual image right-click override remains possible,
- stop behaving like a viewport-height fixed sidebar,
- not grow absurdly when workspace zoom changes,
- preferably migrate onto the shared floating-panel primitive.

---

# FOUNDATION C — selection primitives: objects, rectangular regions, polygons

Do not build separate incompatible selection systems for every feature.

Create/extend a generic selection substrate with distinct selection kinds:

```text
Object Selection
Region Selection (rectangle)
Polygon / Point Selection (future masking/compositing)
PDF Inner Selection (document-local objects)
```

They may share geometry/helpers/history while remaining semantically separate.

## Object Select Mode

Top toolbar:

```text
Select Mode [OFF/ON]
```

Simple mode too.

Multi-select ordinary top-level objects without triggering move/edit/global ingest overlay. Support click + modifiers; workspace marquee if safe.

## Region selection / export

Add or scaffold a rectangular **Region / Frame** tool:

```text
drag rectangle over workspace
→ adjust/reposition
→ Export Region…
```

Output:

```text
PNG
JPEG
WebP
PDF
```

Workspace zoom is only viewing convenience. Export is based on world-region bounds + requested output scale, not current zoom level.

Reuse the same composition renderer as Take Snapshot/True Stitch when possible.

## Polygon / point selection primitive

Do not fully build an advanced masking suite unless time allows, but structure region geometry so later users can:

```text
click points around wanted area
→ close polygon
→ Keep Region / Keep In Front / Send Outside Behind
```

This is the future basis for priority masks, advanced stitching/composition, cutouts, comics, explainers, and annotations.

---

# FOUNDATION D — canonical image-edit state + history + color sampling

The image editor should have one canonical non-destructive state/history model shared by live preview and Save/Export.

Do not keep adding hidden WeakMap transforms that only appear at export.

Canonical state should be able to represent, at minimum:

```text
rotate / straighten / flip
crop/trim
transparent-color rule(s)
background fill
blur/pixel regions
annotations
perspective
paint overlay
future masks/polygons
```

Rules:

- stable base source, not recursive re-rasterization,
- preview and export use the same state,
- stale async renders cannot overwrite newer state,
- object URL cleanup,
- one committed gesture/action = one undo step,
- redo clears only when a new branch is committed,
- edits survive relevant workspace/FCX state.

## Shared color-sampling primitive

Create one intrinsic-coordinate color sampler reusable by:

```text
Eyedropper
Bucket
Make color transparent
future gradient/fill tools
```

It must sample the visible/composited image correctly under resize/rotation/transform.

## Image Editing toolbar

Keep/restore obvious controls:

```text
Brush
Bucket
Eraser
Eyedropper
Color
Size [slider + px value]
Undo
Done
```

Brush size must be a live slider with numeric px value.

Bucket remains real contiguous fill; expose tolerance compactly if practical.

Color swatch opens a reusable visual picker:

```text
2D saturation/value field
hue control
current/previous swatches
Eyedropper
optional hex/RGB precision input
```

Typing a code is optional, never the primary workflow.

## Make color transparent

Rebuild on the shared sampler + canonical edit state:

```text
Make color transparent
→ click image pixel
→ preview/highlight exact pixels/regions affected
→ tolerance slider adjusts same calculation used by Apply
→ small floating Apply / Cancel popover
→ Apply = one undo step
```

Cancel leaves image untouched.

If safe, add `All matching` vs `Connected area only`; do not block the reliable all-matching path for it.

Other reported image utilities must visibly update immediately before export:

```text
Trim transparency
Fill background
Blur / pixelate
Annotate
Straighten
Perspective
```

---

# FOUNDATION E — context-menu model + context-specific menus

Stop growing one giant flat right-click menu.

Build/extend a **declarative context-menu model** where commands declare:

```text
appliesTo(context)
mode visibility (Simple/Advanced)
group/submenu
priority/order
label/state
handler
```

Then render menus from that model rather than scattering DOM hidden/toggled checks everywhere.

## General/image menu

For images, keep these primary actions near the top:

```text
Grab / Move Object
Close Object
Show image only / Restore image frame
Shrink to Fit
Quick Actions [ON/OFF]
```

Group secondary commands into hover/click/focus submenus such as:

```text
Open ›
View ›
Arrange ›
```

Submenus must work with pointer + keyboard, stay inside viewport, and not collapse while moving into child menus.

Simple mode must omit entirely:

```text
Create/Edit timed move
Preview timed move
Return to move start
Remove timed move
Layer timing…
```

`Sync with…` / `Make independent` only for actual playable audio/video in Advanced.

## PDF-specific context menu

Right-clicking **inside a PDF editing surface** should use PDF/document context, not merely the generic top-level object menu.

At minimum expose relevant commands such as:

```text
Add Text Field
Edit Selected Text
Delete Selected Edit Object
Duplicate
Bring Forward / Send Back
Save
Save As
```

Only show commands that actually apply to the clicked PDF context.

---

# FOUNDATION F — PDF text-field model instead of ad hoc replacement spans

Create/extend one canonical PDF edit-object model that can represent replacement fields, newly inserted text fields, and future inserted images.

A text field should have:

```text
page
x/y
width/height
text
font family
font size
rotation
z/order
```

## Add Text Field

Allow explicit creation from PDF context menu/toolbar:

```text
Add Text Field
→ click/drag on page
→ editable field appears there
```

## Text editing behavior

Within a field:

```text
Enter            newline
Ctrl/Cmd+Enter   commit/finish
Space            real space
repeated spaces  preserved reasonably
Tab              indentation / deterministic spaces
```

Width is wrap width; height is actual multiline region; field is movable/resizable.

Serializer must render multiline text line-by-line deterministically rather than passing embedded newlines to a single drawText call and hoping.

## Standard PDF fonts

Offer a dependable built-in list using pdf-lib StandardFonts or equivalent packaged support:

```text
Helvetica
Helvetica Bold
Helvetica Oblique
Times Roman
Times Bold
Times Italic
Courier
Courier Bold
Courier Oblique
```

Exact set may match library availability, but do not show fonts that cannot actually serialize.

Expose font size as an obvious control with practical bounds.

## PDF bottom toolbar

The expanded PDF footer/bottom control surface currently looks bad when crowded.

Refactor it using the same command/popover primitives as other UI:

Primary visible controls, roughly:

```text
Save
Save As
Add Text Field
Font
Font Size
```

Secondary PDF/page commands go under compact dropdowns/popovers/More rather than making a giant stretched footer.

The expanded state must remain intentional and professional at narrow widths.

---

# FOUNDATION G — one composition renderer powering Snapshot, Region Export, True Stitch, future comics

Build toward a single reusable **composition renderer**:

```text
inputs: world-space visual objects + bounds + z/layer order + masks
output: raster blob or PDF page
```

This should be the common substrate for:

```text
Take Snapshot
Snapshot Selection
Region Export
True Stitch
future comic/page export
future explainers/storyboards
```

Do not duplicate separate DOM-to-canvas pipelines if one can be generalized safely.

## Stitch Images…

Select 2+ images and expose:

```text
Stitch Images…
```

Two initial semantics:

### Edge Stitch

Join images by adjacent edges, preserving source pixels and aspect ratio. Use the user's arrangement to infer orientation/alignment where reasonable; provide minimal deterministic choices when ambiguous.

### True Stitch

Flatten selected images according to their **current visible world positions and z/layer order**: what the user sees is the composition.

Both support:

```text
Save As
[ ] Create in Workspace
PNG / JPEG / WebP
```

Use the exact same rendered blob for save + workspace result.

## Future Selection Composite / Priority Mask

Design Stitch/renderer data structures so later a polygon selection can say:

```text
selected region survives/stays in front
unselected region goes behind or masks out
```

Do not implement a fragile special-case now; make the renderer/mask interface capable of supporting it later.

---

# FUTURE PRIMITIVES — shapes, comic/explainer work

Do not build a full comic editor in this run, but avoid architecture that blocks these future ordinary objects:

```text
rectangle
ellipse
line
arrow
triangle/polygon
text box
speech bubble + draggable tail
panel/frame
```

The intended future workflow is:

```text
DOCX script beside workspace
→ create panels
→ place images
→ copy dialogue
→ speech bubbles/text
→ arrows/shapes/brush work
→ Region Export / PDF
```

These should eventually be ordinary objects using shared world-space, selection, layering, grouping, color, stroke, text, and export primitives — not a separate giant Comic Mode implementation.

---

# Existing features to preserve / regressions to avoid

Do not regress:

- native Save/Save As for formats that currently work,
- PDF page operations and source-mask behavior,
- DOCX least-destructive OOXML handling and image relationship ID hardening,
- FCX Open/Export terminology and portable assets,
- frameless media,
- Take Snapshot Tight/Square behavior,
- external file/URL ingestion,
- spatial permanence,
- video/audio playback,
- CSV/archive utilities,
- packaging gate.

---

# Testing strategy: test primitives, not only buttons

Add focused tests for reusable helpers/models so future features inherit confidence.

At minimum, where touched:

```text
camera/world coordinate transforms
zoom focal-point invariance
region bounds math
selection geometry
color sampling / tolerance classification
image edit-state history
context command applicability/grouping
PDF multiline layout/font mapping
composition bounds/z-order
stitch layout
```

Then run:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual smoke checks should cover the thin vertical slices actually completed.

Required if corresponding work was touched:

```text
1. Move existing object → never global Drop into FrameChute.
2. PDF visible edit → Save As → reopen → edit is there.
3. Enter in PDF field creates newline; Ctrl/Cmd+Enter commits.
4. Add Text Field creates a movable/resizable field.
5. Standard PDF font + size visibly change and serialize.
6. Quick Actions floats independently of workspace zoom and has no Clear.
7. Ctrl/Cmd +/- changes workspace camera only; artwork world coordinates remain unchanged.
8. Fit/Center centers work without rewriting x/y.
9. Region Export output is independent of current zoom.
10. Eyedropper samples visible color; Make Transparent previews then applies exactly that rule.
11. Brush Size slider changes width immediately; Bucket remains usable.
12. PDF right-click shows PDF commands; general image menu keeps primary image actions near top.
13. Edge Stitch and/or True Stitch uses shared composition primitive and produces one honest result.
```

---

# Priority order if 30 minutes is not enough

The order is based on **snowball value + correctness** rather than raw feature count:

```text
1. PDF Save / Save As correctness + canonical PDF edit serialization
2. shared world/camera model helpers (with at least centering/zoom vertical slice if safe)
3. canonical image edit-state/history + shared color sampler
4. declarative/context-specific menu model, especially PDF context + image menu cleanup
5. floating-panel primitive + migrate Quick Actions or transparency/color popover onto it
6. PDF text-field model: Add Text Field + multiline + standard fonts/font size
7. shared composition renderer used by Snapshot/Region/True Stitch
8. object/region selection helpers
9. Stitch Images vertical slice
10. polygon/mask interfaces and future shape/comic scaffolding only if time remains
```

If a foundation cannot be safely completed, leave a clean helper/model + tests + one working consumer rather than half-implementing many UI features.

---

# Handoff

At the 30-minute mark, **conclude active implementation and provide a handoff**.

Include exactly:

```text
completed
reusable primitives added/refactored
which user-facing issues those primitives solved
remaining
files changed
tests/results
manual browser results / anything not browser-tested
known risks/issues
exact next steps that now become easier because of the primitives
branch
commit
PR
```
