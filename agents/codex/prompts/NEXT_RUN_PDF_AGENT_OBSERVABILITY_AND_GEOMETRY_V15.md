# NEXT RUN — PDF AGENT OBSERVABILITY + GEOMETRY INFRASTRUCTURE V15

## Purpose

Stop guessing about PDF layout bugs.

FrameChute already has a semantic page model, PDF-space geometry, live overlays, masks, image wrapping, and native serialization. The recurring problem is that a human can look at the page and immediately see that something is wrong, while Codex or another agent must infer the bug indirectly from several partially disconnected coordinate systems, CSS states, and rendering paths.

This run makes the PDF subsystem **agent-observable**.

The goal is that an agent can answer, from structured diagnostics alone:

- What object is this?
- Where is it in the original PDF?
- Where should it appear in the live viewport?
- Where does the browser actually render it?
- What visible ink does the text actually occupy?
- What source text does it replace?
- What mask owns it?
- What is above/below/left/right of it?
- What does it collide with?
- What is its layer/z-order?
- What changes when it is idle, hovered, selected, or actively edited?
- What will Save erase?
- What will Save draw?
- Why does the saved/reopened PDF differ from the live editor?

No more reasoning from screenshots alone.

This is infrastructure first. Do not spend this run adding typography/fancy fonts or broad new editor features.

---

# Read first

Read latest `main` and especially:

- `docs/PDF-ARCHITECTURE.md`
- `src/documents/pdf-geometry.js`
- `src/documents/pdf-layout.js`
- `src/documents/pdf-document.js`
- `src/workspace.js`
- `src/workspace.css`
- `tests/pdf-layout.test.mjs`
- `tests/pdf-text-model.test.mjs`
- `tests/pdf-source-mask.test.mjs`
- `agents/codex/prompts/NEXT_RUN_PDF_PREMIUM_SEMANTIC_EDITOR_AND_READER_V14.md`

Preserve the current semantic page model and runtime/save architecture unless a change is necessary to make the geometry model truthful and inspectable.

---

# Core principle

**Coordinates are not enough unless they describe the thing the user actually sees.**

A CSS box, a PDF text box, and the actual visible glyph ink are not the same object.

For every relevant object, distinguish:

1. PDF source bounds,
2. canonical semantic bounds,
3. expected viewport/CSS layout bounds,
4. actual DOM layout bounds,
5. actual visible text/glyph ink bounds where measurable,
6. mask/erase bounds,
7. serialized output bounds.

The diagnostic model must make those differences explicit.

An agent should be able to understand the page without seeing a screenshot.

---

# P0 — Current-version boundary: history must never leak into the document

This is a hard product invariant.

FrameChute may retain edit history, undo snapshots, prior semantic states, or future explicit document versions. That historical data is **not part of the currently opened document**.

Once an edit is committed, the current version becomes the user's truth.

When a PDF is saved and later reopened:

- it must open as a **clean current-version slate**,
- it must look exactly like the version the user remembers saving,
- deleted/replaced/obsolete text must not exist in the active render tree,
- dead source runs must not reappear on hover, selection, focus, rerender, zoom, page navigation, or edit mode,
- old replacement fields must not become active merely because a pointer passes over their former location,
- old masks, stale overlays, and superseded geometry must not participate in hit-testing or layout,
- diagnostics must clearly distinguish current objects from historical objects.

If historical versions are intentionally retained, they must be quarantined behind an explicit **Previous Versions** / version-history boundary.

Conceptually:

```
CURRENT DOCUMENT
  current source state
  current semantic objects
  current edits
  current masks
  current render/save plan

PREVIOUS VERSIONS
  immutable historical snapshots
  never rendered
  never hit-tested
  never included in current layout
  only materialized after explicit user action
```

Do not use "history exists internally" as a reason for historical text to remain addressable in the active page.

Undo history is also not the current document. It may keep data necessary to restore a prior state, but that data must remain inert until Undo/Redo is explicitly invoked.

### Save + reopen compaction

Treat Save + reopen as a strong correctness boundary.

The reopened document must reconstruct only the **current committed state**.

If the underlying PDF still physically contains superseded source bytes for preservation reasons, those bytes must remain semantically dead and visually inaccessible in the active document unless the user explicitly opens a previous version.

No hover state, text-layer regeneration, source-index lookup, search result, selection event, or diagnostic observer may accidentally resurrect superseded text.

Add diagnostics such as:

- `CURRENT_STATE_CONTAINS_SUPERSEDED_OBJECT`
- `HISTORICAL_OBJECT_RENDERED`
- `HISTORICAL_OBJECT_HIT_TESTABLE`
- `SAVE_REOPEN_RESURRECTED_TEXT`
- `STALE_OVERLAY_ACTIVE`

The page snapshot should expose a version/state field for every object, e.g. `current`, `superseded`, or `historical`.

Only `current` objects may participate in ordinary rendering, hit-testing, layout, masks, wrapping, search, extraction, and Save.

### Required tests

Add tests where:

1. source text A is replaced by B,
2. B is edited again into C,
3. the document is saved,
4. the saved PDF is reopened,
5. the pointer hovers the former A/B locations,
6. edit mode toggles off/on,
7. the page rerenders at another zoom,
8. search/extraction runs.

At every step, A and B must remain absent from the active document.

If version history is implemented, A/B may appear only after explicit navigation into **Previous Versions**.


# P0 — Canonical object localization records

Introduce a small, serializable diagnostic model for PDF page objects.

Suggested conceptual shape:

```js
{
  id,
  page,
  kind,
  provenance,
  sourceRefs,

  pdf: {
    rect: { x, y, width, height },
    baseline,
    rotation
  },

  semantic: {
    regionId,
    blockId,
    lineId,
    runId,
    readingOrder,
    paintOrder
  },

  viewport: {
    expectedRect: { left, top, width, height },
    scale,
    rotation
  },

  observed: {
    layoutRect: { left, top, width, height },
    inkRects: [{ left, top, width, height }],
    unionInkRect: { left, top, width, height },
    clipRect: { left, top, width, height },
    deltaFromExpected: { x, y, width, height },
    overflow,
    clipped
  },

  save: {
    eraseRects: [...],
    drawRect,
    drawBaseline,
    font,
    fontSize
  },

  state: {
    idle: {...},
    hover: {...},
    selected: {...},
    editing: {...}
  },

  relationships: {
    parentId,
    childIds,
    previousId,
    nextId,
    neighbors,
    collisions
  }
}
```

Exact naming may differ, but the data must remain:

- deterministic,
- JSON-serializable,
- independent of DOM node references,
- stable enough for tests and bug reports,
- cheap enough to generate for one page on demand.

Do not persist DOM nodes, canvas contexts, image base64, or full PDF bytes.

---

# P0 — Explicit geometry spaces

Create/centralize pure helpers so agents and tests can reason about every transform.

We need named conversions for:

- PDF rect → viewport rect
- viewport rect → PDF rect
- viewport local rect → workspace/client rect
- CSS pixels → device pixels
- PDF baseline → viewport baseline
- rotation-aware rect normalization
- CropBox/page-box offset handling

Every diagnostic field must identify its coordinate space.

Never expose ambiguous diagnostic fields named only `x`, `y`, `width`, `height` without a containing coordinate-space object.

Add round-trip invariants:

`PDF → viewport → PDF`

must reproduce the source geometry within an explicit tolerance.

Test at least:

- zoom 25%, 100%, 250%
- rotated pages
- CropBox offsets
- devicePixelRatio 1, 1.25, 2
- page origins/offsets where supported

Stored edit geometry remains PDF points.

---

# P0 — Layout boxes are not glyph ink

This is crucial.

A `getBoundingClientRect()` for a text container can be correct while the actual visible text still protrudes, clips, overlaps, or leaves remnants.

Add a text-ink observation layer.

For live DOM text, use browser geometry such as `Range.getClientRects()` / text-node ranges to capture the actual rendered text fragments when practical.

Where useful, also compare against font metrics (`TextMetrics.actualBoundingBoxAscent`, `actualBoundingBoxDescent`, etc.) for the exact live font.

For source PDF text, preserve the PDF-derived source bounds and baseline separately from the CSS text-layer box.

Diagnostics must distinguish:

- container/layout rect,
- line box,
- baseline,
- actual visible ink union,
- individual ink fragments for wrapped/multiline text.

This is how an agent should detect:

- the final few letters surviving outside a mask,
- ascenders/descenders being clipped,
- text visually overflowing a nominally correct field,
- the field box being correct while the glyphs are not.

---

# P0 — Expected geometry vs observed geometry

The semantic model tells us where an object **should** be.

The browser tells us where it **actually is**.

Add an observation pass after render that maps every rendered PDF object back to its stable semantic/edit ID and records:

- expected local viewport rect,
- actual local DOM layout rect,
- actual visible ink rect(s),
- delta x/y/width/height,
- baseline delta where available,
- clipping status,
- overflow status,
- whether ink is outside the expected owner rect,
- whether actual ink intersects another object's protected area.

Do NOT use observed DOM geometry as canonical editing truth.

Observed geometry is instrumentation. It tells us whether the model, transform, CSS, or paint order is wrong.

Agents must be able to distinguish:

> canonical model wrong

from

> coordinate transform wrong

from

> CSS box wrong

from

> actual glyph ink exceeds the CSS box

from

> mask/layer order wrong

from

> Save plan differs from live plan.

---

# P0 — State-dependent visual truth

The user has repeatedly observed that an object can look different when:

- idle,
- hovered,
- selected,
- actively editing,
- after focus leaves,
- after page rerender,
- after Save + reopen.

That state must become data.

For every editable/rendered object, diagnostics should capture relevant state-dependent properties:

- display / visibility / opacity
- position / transform
- width / height
- overflow / clip-path
- z-index / stacking context
- pointer-events
- font metrics
- borders/handles that alter dimensions
- pseudo-state classes such as selected/editing/wrapped
- mask visibility
- source-text visibility

Add a deterministic diagnostic state harness where tests can request:

`idle → hover → selected → editing → committed → rerendered`

and compare geometry/ink/mask results between states.

A hover state must not secretly change the geometry of the edited text unless explicitly intended.

The agent should be able to answer:

> “This word appears correct only on hover because the hover class changes overflow or stacking order.”

without needing a screenshot.

---

# P0 — Stable IDs everywhere

Every rendered PDF object must be attributable.

Use stable IDs/data attributes for:

- source text runs,
- semantic lines,
- blocks,
- replacement edits,
- free-text edits,
- images,
- source masks,
- field masks,
- wrap-generated replacements,
- generated reflow lines.

Do not rely only on `data-index`.

Suggested attributes:

- `data-pdf-object-id`
- `data-pdf-source-id`
- `data-pdf-line-id`
- `data-pdf-edit-id`
- `data-pdf-mask-owner-id`

Use one identity model across live render, diagnostics, tests, and Save plans.

---

# P0 — Page diagnostic snapshot

Add a pure/on-demand API, e.g.:

`buildPdfPageDiagnosticSnapshot(...)`

The snapshot should include:

- page number and page boxes,
- viewport scale/rotation,
- devicePixelRatio,
- semantic nodes,
- current edits,
- images/obstacles,
- wrap decisions,
- live masks,
- Save masks,
- expected viewport geometry,
- observed DOM layout geometry,
- observed text ink geometry,
- collisions,
- source lineage,
- reading order,
- paint order,
- z/layer order,
- visual state,
- warnings/invariant failures.

It must be JSON-serializable.

Keep one-page snapshots compact. Cap long text strings. Do not include font binaries, image base64, or PDF bytes.

---

# P0 — Diagnostic invariant engine

Add a validator such as:

`validatePdfPageSnapshot(snapshot)`

Return structured issues, not bare booleans.

Example:

```js
{
  code: "LIVE_SAVE_MASK_MISMATCH",
  severity: "error",
  objectIds: ["edit:...", "mask:..."],
  expected: {...},
  actual: {...},
  message: "Live editor hides source run X but Save does not erase the same PDF region."
}
```

Required invariant classes:

## Geometry

- every editable source object has finite PDF geometry,
- PDF→viewport expected geometry is finite,
- PDF→viewport→PDF round-trip stays within tolerance,
- observed layout rect is within tolerance of expected unless intentionally transformed,
- observed ink must be attributable to an owner,
- no NaN/Infinity,
- no negative normalized widths/heights.

## Identity

- every live replacement traces to a stable source/edit ID,
- every mask has an owner,
- every generated wrap has provenance,
- no duplicate stable IDs on one page.

## Source replacement

- if a source run is replaced, old source ink cannot remain visible in either live or Save plan,
- if live hides source text, Save must erase the same owned source area,
- if Save erases an area, diagnostics identify the owner,
- erase regions cannot consume unrelated source ink without an explicit ownership/collision explanation.

## Layout

- same-block reading order stays monotonic,
- lines do not teleport above predecessors,
- unrelated columns remain isolated,
- replacement fields do not silently cover unrelated text,
- source and replacement wrapping agree around images.

## State

- hover/selection/editing must not unexpectedly move content,
- idle and committed geometry must agree within tolerance,
- rerender must reproduce committed geometry,
- focus/blur must not resurrect source text.

## Live/save parity

- live and Save mask plans are directly comparable,
- live and serialized draw geometry are directly comparable,
- replacement text visible in live must be the replacement text drawn by Save,
- differences beyond tolerance produce errors.

---

# P0 — Layering must be inspectable

Record the logical render stack for every page.

At minimum expose:

1. original PDF canvas
2. source erase/mask layer
3. replacement/reflow text
4. inserted images
5. annotations/search highlights
6. selection UI/handles

Record actual z-order/stacking context information for DOM elements where possible.

Agents must be able to determine:

- old text survives because a mask is missing,
- mask is behind the wrong layer,
- replacement is drawn twice,
- a field mask covers newly drawn text,
- image is painted correctly but flow geometry is stale,
- selection handles alter clipping/overflow.

Add invariant checks for unsafe layer order.

---

# P0 — Object-local bounding boxes

Every meaningful text object gets localization.

At minimum:

- every source run,
- every semantic line,
- every semantic block,
- every replacement edit,
- every generated reflow line,
- every free-text field,
- every image,
- every mask.

A line may own several runs, but runs retain individual rects.

A block owns lines, but lines retain individual rects.

For parents retain:

- union bounds,
- child bounds,
- optional child-local offsets.

This is required so an agent can identify the exact terminal run or glyph cluster that survives.

---

# P0 — Agent-facing diagnostics command

Add a lightweight developer/advanced action under the PDF surface:

- **Copy Page Diagnostics**
- optionally **Download Page Diagnostics JSON**
- optionally **Show Geometry Overlay**

Do not clutter normal users.

The JSON should be self-contained enough to paste into ChatGPT/Codex and diagnose the page without screenshots.

The optional overlay should label stable IDs and boxes for:

- source runs,
- semantic lines,
- edits,
- masks,
- images,
- observed ink bounds.

It must be non-destructive and off by default.

---

# P0 — Synthetic agent tests

Build a focused corpus that deliberately exercises:

- one text run,
- multiple PDF.js runs on one visual line,
- terminal run at end of line,
- first run at beginning of line,
- tightly packed lines,
- large ascenders/descenders,
- two columns,
- heading/body/footer,
- rotated text,
- CropBox offset,
- inserted image over body text,
- moved replacement,
- resized replacement,
- longer replacement,
- shorter replacement,
- wrapped replacement,
- live vs saved parity,
- hover vs idle,
- selected vs idle,
- editing vs committed,
- rerender after page-away/page-back.

Tests should assert the structured diagnostics, not screenshots.

---

# P1 — Optional visual oracle for debugging only

The architecture must not depend on screenshots, but a visual oracle can still be useful as a final confidence check.

If practical, add a debug-only screenshot comparison or pixel-difference harness for synthetic pages.

It is secondary to the structured model.

The success criterion is:

> coordinates + semantic structure + observed ink + state + layer information should already explain the failure before looking at pixels.

---

# Hard boundaries

Do not:

- add fancy fonts yet,
- redesign the whole PDF toolbar,
- rewrite arbitrary PDF content streams,
- add OCR,
- add AI/cloud dependencies,
- rasterize the document to solve editing,
- make DOM geometry canonical,
- build a giant always-on debug UI.

Keep runtime overhead near zero when diagnostics are disabled.

---

# Manual acceptance

Use a real browser if available.

For a deliberately broken/torture PDF:

1. open page,
2. capture idle diagnostics,
3. hover a replacement,
4. capture hover diagnostics,
5. enter edit mode,
6. capture editing diagnostics,
7. commit,
8. capture committed diagnostics,
9. Save,
10. reopen saved PDF,
11. capture reopened diagnostics.

An agent should be able to explain every visible difference from those JSON snapshots alone.

Specifically verify cases like:

- old terminal text survives after edit,
- old text is hidden live but returns after Save,
- neighboring letters get clipped,
- inserted image causes text mash-up,
- an edit looks different only while hovered/selected,
- superseded text from an earlier edit reappears after Save + reopen,
- dead historical text becomes visible or hit-testable only on hover.

Also verify that Save + reopen reconstructs only the current committed version. Historical objects may exist only behind an explicit Previous Versions/version-history path and must remain inert during ordinary rendering, selection, search, extraction, wrapping, and editing.

For each failure, diagnostics must identify the responsible object IDs and whether the mismatch is semantic geometry, viewport transform, observed ink, mask ownership, state/CSS, layer order, or Save plan.

---

# Tests / quality gates

Run:

- focused PDF geometry/layout/model tests,
- `node --test tests/*.test.mjs`,
- `node --check` on changed JS/MJS,
- `git diff --check`,
- extension validation,
- Chrome Web Store packaging validation.

Open one clean PR against latest `main`.

PR summary must explain:

- the diagnostic object model,
- coordinate spaces,
- ink-vs-box measurement,
- state observation,
- stable IDs,
- live/save comparison,
- invariant engine,
- developer diagnostics UI,
- performance impact,
- manual verification,
- known limitations.

This run succeeds when ChatGPT/Codex can truthfully understand **what/where/when/why** a PDF object is wrong from structured data alone.
