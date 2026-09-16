# Codex Request: PDF Bounded Layout Foundation

## Mission

Continue FrameChute's PDF elevation by introducing a **page-wide bounded layout model**.

The purpose is to give the PDF subsystem a reliable understanding of what occupies space on each page so future editing can avoid collisions, accidental erasure, text overwriting, and blind rectangle painting.

This is infrastructure for a world-class PDF reader/editor. It is not a request to add dozens of visible features at once.

Read this together with:

- `docs/CODEX-PDF-ELEVATION.md`
- `docs/PDF-ARCHITECTURE.md`

Inspect the current repository before changing anything. Preserve the PDF functionality that already works.

---

# Core idea

Every meaningful visible or interactive PDF element should be representable as one or more **bounded regions in PDF page space**.

Examples:

- source text runs
- reconstructed text lines
- reconstructed paragraphs/blocks where confidence permits
- FrameChute replacement text fields
- free text
- inserted images
- source images
- vector graphics / drawing regions where detectable
- annotations
- links
- form fields
- page margins / page boxes
- crop bounds
- headers / footers when inferable
- tables / cells when inferable
- opaque or unsupported content regions

The system does not need perfect semantic reconstruction to be useful.

It does need a consistent answer to:

> What occupies this rectangle, what owns it, what may overlap it, and what would be damaged if an edit covered it?

---

# Architectural principle

Do not make the PDF editor reason directly from DOM/CSS geometry.

Use standard PDF page coordinates as the canonical layout space.

A page layout map should be independent of:

- zoom
- browser viewport
- devicePixelRatio
- FrameChute object size
- page display scale

Rendered CSS rectangles are projections of the page model, not the source of truth.

---

# Required page-region model

Create a compact region representation suitable for indexing and collision checks.

A region should carry enough information to support future editing decisions.

Suggested shape:

```js
{
  id,
  page,
  kind,
  bounds: { x, y, width, height },
  source,
  ownerId,
  zOrder,
  confidence,
  editable,
  protected,
  text,
  metadata
}
```

Do not copy this shape blindly if a better fit exists in the current architecture.

Important concepts:

## Stable identity

Where possible, regions need stable IDs across rerenders at different zoom levels.

Do not use transient DOM nodes as identity.

## Kind

At minimum distinguish categories such as:

- `source-text`
- `text-line`
- `text-block`
- `replacement-text`
- `free-text`
- `source-image`
- `inserted-image`
- `annotation`
- `link`
- `form-field`
- `vector-content`
- `unknown-content`

## Ownership

A derived line may own several source text runs.

A replacement field may own:

- its replacement geometry
- its source erasure region
- its current field erasure region

An inserted image owns its image rectangle.

This ownership distinction matters when deciding whether an overlap is expected or destructive.

## Confidence

Semantic reconstruction is probabilistic.

Represent confidence rather than pretending every inferred paragraph/table/header is certain.

Low-confidence regions may still be useful for collision warnings while remaining non-editable.

---

# Spatial index

Provide a page-level query surface.

At minimum support:

- regions intersecting rectangle
- regions contained by rectangle
- nearest region above
- nearest region below
- nearest region left
- nearest region right
- horizontal overlap
- vertical overlap
- distance between regions
- collision classification

The first implementation can use a simple array scan if performance is acceptable.

Do not prematurely add a complicated tree dependency.

Design the API so an R-tree / interval index could replace the implementation later without changing editing code.

Example conceptual calls:

```js
layout.intersections(page, rect)
layout.neighbors(page, rect)
layout.classifyOverlap(regionA, regionB)
```

---

# Reconstruct text hierarchy conservatively

PDF text often arrives as positioned runs rather than paragraphs.

Build a conservative hierarchy:

```
glyph/run -> line -> block
```

Start with reliable spatial heuristics.

## Line reconstruction

Group source text items into a line when they have compatible:

- baseline
- orientation
- font size
- vertical overlap
- horizontal spacing

Account for rotated pages/text.

## Block reconstruction

Group lines only when spacing/alignment strongly suggests a common block.

Useful signals:

- similar left edge
- similar right edge
- consistent line spacing
- compatible font metrics
- small vertical gaps

Do not merge across:

- columns
- tables
- large gaps
- unrelated headings
- sidebars

False separation is preferable to destructive false merging.

## Preserve source mapping

Every inferred line/block must retain references to the underlying source PDF text items.

Future editing must always be able to answer:

> Which original source regions does this semantic region represent?

---

# Collision model

Add a first-class concept of collision.

Not all overlap is bad.

Examples:

- replacement text overlapping its own erase mask: expected
- inserted image overlapping text with Wrap Text OFF: intentional
- inserted image overlapping text with Wrap Text ON: requires layout response
- replacement mask overlapping neighboring source text: potentially destructive
- annotation highlight overlapping source text: expected
- two editable replacement fields overlapping: likely conflict

Provide classifications such as:

- `owned`
- `intentional-overlay`
- `safe`
- `warning`
- `destructive`

The names may change, but the distinction must exist.

Editing code should ask the layout model instead of blindly deciding from raw rectangles.

---

# Replacement-text behavior

This stage should directly improve the architecture behind FrameChute's core PDF text-editing feature.

Current desired behavior remains:

- detect original source text
- infer initial font size once
- let the user control font size explicitly
- never silently resize font because the box changed
- erase original source content cleanly
- render replacement text
- save a normal interoperable PDF

The new layout model must make this safer.

## Source ownership

When editing a text item/line:

- identify its source region(s)
- know neighboring regions above/below/left/right
- distinguish owned source text from unrelated neighbors

## Erasure

A replacement field must not accidentally erase neighboring text solely because its field grew.

For the initial bounded-layout milestone:

- retain the current explicit replacement masks
- detect collisions with unrelated source regions
- expose those collisions to editing logic
- avoid silently expanding destructive erasure into unrelated regions

Do not implement automatic paragraph reflow unless the layout model is strong enough.

A warning/constraint is better than corrupting content.

## Future-ready behavior

The architecture should make these later improvements possible without another rewrite:

- protect neighboring lines
- restore covered source regions
- push/reflow neighboring lines
- paragraph-aware text replacement
- column-aware reflow
- table-aware editing

Do not implement all of those now.

Set the stage correctly.

---

# Image behavior

Inserted images must participate in the same region system.

Each image needs:

- PDF-space bounds
- stable ID
- page
- wrap state
- ownership
- collision query support

## Wrap Text ON

The current line-level Wrap Text behavior should become layout-driven.

The engine should be able to query:

> Which text lines intersect this image region?

and derive wrap edits only from those regions.

Do not rely on random DOM overlap checks.

## Wrap Text OFF

Overlap is intentional.

The layout model should classify it as such rather than treating it as an error.

---

# Unknown content matters

A world-class editor must know when it does **not** understand something.

PDF pages may contain:

- vector lettering
- flattened text
- scanned images
- masks
- patterns
- clipping paths
- complex groups
- unusual transforms

Where exact semantics are unavailable, create conservative occupied regions when feasible.

The purpose is not to edit everything immediately.

The purpose is to avoid assuming blank space where visible content actually exists.

If the renderer cannot cheaply infer those bounds yet, document the limitation rather than inventing confidence.

---

# Page boundaries

Every spatial operation must respect:

- MediaBox
- CropBox
- page rotation
- current page coordinate transform

No region or destructive edit may extend beyond the effective page bounds after clamping.

Keep all canonical geometry in PDF points.

---

# Reader/editor separation

The layout map belongs to the document/page model, not the viewer UI.

Reader functions can consume it for:

- text selection
- search result highlighting
- link hit testing
- future accessibility/navigation

Editor functions can consume it for:

- collision checking
- replacement ownership
- image wrapping
- erasure safety
- selection
- snapping
- alignment

Do not build two competing region systems.

---

# Visual debugging mode

Add a developer-only way to inspect the inferred page map.

This can be:

- a debug flag
- console helper
- temporary developer overlay

It should be able to visualize region rectangles and kinds without shipping permanent visual clutter to normal users.

This is important because spatial inference bugs are difficult to reason about from serialized data alone.

Do not expose debug labels in normal PDFs.

---

# Performance

FrameChute must remain usable on low-memory machines.

Requirements:

- build layout lazily per page
- cache by page/document revision
- invalidate only pages affected by edits
- do not rebuild all pages on every pointermove
- collision queries during drag/resize must remain lightweight
- avoid full-page bitmap analysis in the baseline implementation
- preserve PDF.js render-task cancellation behavior

---

# Persistence

The canonical PDF file should remain standards-based.

Do not write FrameChute's layout index into the PDF as a proprietary requirement.

Derived layout can be:

- recomputed from the PDF
- cached transiently
- persisted in FrameChute workspace state only when useful and versioned

The saved PDF must stand alone.

---

# Suggested module boundary

Do not force this exact name if the current architecture suggests something better, but prefer a dedicated subsystem such as:

```
src/documents/pdf-layout.js
```

Possible responsibilities:

- region creation
- text-line reconstruction
- block reconstruction
- page spatial index
- overlap classification
- neighbor lookup
- ownership queries
- cache/invalidation

Keep viewport conversion in the existing geometry layer.

Keep serialization in the PDF document/write layer.

Keep UI interactions out of the layout module.

---

# Required tests

Add deterministic tests before wiring aggressive behavior into the editor.

## Region geometry

- rectangle intersection
- containment
- nearest above/below/left/right
- page-bound clamping
- rotated-page coordinates

## Text reconstruction

Fixtures for:

- one normal paragraph
- two columns
- heading + body
- widely separated text
- varied font sizes
- rotated text

Verify lines/blocks are not merged across obvious boundaries.

## Ownership

- one source line maps to its original PDF text items
- replacement region identifies owned source content
- unrelated neighboring text remains unrelated

## Collision classification

Test:

- replacement vs own source
- replacement vs neighboring line
- image wrap ON vs text
- image wrap OFF vs text
- annotation vs text
- two edit fields overlapping

## Regression

Existing PDF behavior must remain intact:

- render
- search
- zoom
- page navigation
- text replacement
- user-controlled font size
- replacement masks
- inserted images
- Wrap Text
- save/reopen
- page operations

---

# Milestone definition

This task is successful when FrameChute can build a trustworthy page-level map and editing code can ask questions such as:

- What text line owns this point?
- What regions are under this replacement field?
- Would enlarging this erase another line?
- Which text lines collide with this image?
- What is immediately below this field?
- Does this overlap belong to the same edit or another object?

The first milestone does **not** need perfect automatic reflow.

It needs the architectural truth required to implement perfect reflow later.

---

# Premium PDF direction

This model should become the foundation for later premium-grade behavior including:

- paragraph-aware reflow
- collision-free replacement editing
- automatic restoration of neighboring source text
- intelligent text-box expansion
- multi-column awareness
- table-aware editing
- guides/snapping/alignment
- image text flow
- semantic selection
- accessibility structure
- OCR integration
- vector-content awareness
- richer annotations
- professional layout editing

Do not implement those features merely to satisfy this section.

Design the bounded-region system so they become incremental features rather than future rewrites.

---

# Instructions to Codex

1. Read this file, `docs/CODEX-PDF-ELEVATION.md`, and `docs/PDF-ARCHITECTURE.md`.
2. Inspect the current PDF code on the branch you are given. The implementation has evolved since the original elevation brief.
3. Produce a short architecture plan based on the actual current code.
4. Implement the bounded page-region/layout foundation in small coherent commits.
5. Add tests before enabling any new destructive automatic behavior.
6. Integrate existing replacement text and inserted-image logic with the layout model where it is safe to do so.
7. Do not regress current PDF text editing, user-controlled font size, replacement masks, Wrap Text, reader controls, DOCX, FrameChute object movement, or native PDF save behavior.
8. Prefer conservative detection and preservation over clever destructive guesses.
9. Keep the saved PDF standards-based and interoperable.
10. Run the focused PDF tests explicitly as well as the repository validation.

The goal is not "more features."

The goal is to give FrameChute a **correct spatial understanding of the PDF page** so every future premium editing feature has a trustworthy foundation.
