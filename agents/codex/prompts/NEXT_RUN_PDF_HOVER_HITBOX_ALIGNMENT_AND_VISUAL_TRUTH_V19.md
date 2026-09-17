# NEXT RUN — PDF HOVER / HITBOX ALIGNMENT + VISUAL TRUTH V19

Repository: `thanks-cohn/framechute`
Target branch: `main`

## Mission

Use Substrate's new PDF visual-scene diagnostics to **finally eliminate the visible mismatch between PDF text, hover boxes, hit targets, selected fields, and editable fields**.

The user-facing requirement is simple:

> If text is visibly here, its hover field must be here. If the user clicks this text, Substrate must select and edit this exact text in place.

No more boxes floating above, below, beside, or loosely near the text they supposedly represent.

This run is about **visual truth and hit-test truth**, not broad feature work.

The correct result should feel boring:

`visible text == hover target == click target == selected field == editable field`

within documented sub-pixel / small-pixel tolerances appropriate to browser glyph ink.

---

## Current foundation

Substrate now has:

- stable three-row PDF toolbar
- PDF.js canvas rendering
- DOM text/edit layer
- canonical PDF geometry helpers
- semantic page model
- stable source/edit object identity
- live/save mask parity
- current-version manifest and reopen reconciliation
- `PDF_DIAGNOSTIC_MODES = OFF / DEBUG / DEEP`
- `capturePdfPageGeometry(...)`
- `capturePdfPageDomObservations(...)`
- `capturePointerHitTest(...)`
- `capturePdfVisualScene(...)`
- `compareVisualRectangles(...)`
- first-divergence analysis
- bounded interaction/mutation journals
- Copy Page Diagnostics with visual-scene output

Use those systems. Do not replace them with ad-hoc logging.

---

# Primary bug class to solve

The user can visibly see PDF text at one location, but the hover rectangle / hit target / editable field can appear offset or can correspond to the wrong text.

Examples of unacceptable behavior:

- visible glyphs at Y=500 while hover box appears at Y=470
- hovering sentence B highlights the DOM field for sentence A
- box is close to the text but clearly not superimposed on it
- hitbox covers a whole neighboring line or large empty region
- double click/select opens a field above or below the clicked glyphs
- selected/editable field changes origin when focus/contenteditable starts
- zoom/fit/scroll changes cause text and hitboxes to drift apart
- untouched source text has a wildly oversized hover region

We now have enough diagnostics to prove exactly which projection diverges.

---

# First action: reproduce and measure before fixing

Before changing geometry, reproduce the current issue in DEBUG or DEEP mode and record:

- visible glyph ink rect
- DOM layout rect
- hit-target rect
- hover-outline rect
- selected-field rect
- editable-field rect
- expected viewport rect
- pointer client coordinates
- `elementFromPoint` / `elementsFromPoint`
- chosen PDF object ID
- nearest visible glyph object ID
- canvas rect
- text-layer rect
- surface rect / scroll
- viewport transform
- zoom / fit mode
- CSS transform ancestry

For each broken object, answer in diagnostics:

1. Is the hitbox superimposed on the visible glyph ink?
2. What percentage of the glyph ink is covered by the hitbox?
3. What percentage of the hitbox is meaningful glyph area?
4. What are the center and edge deltas?
5. Is it aligned, near-but-misaligned, oversized, undersized, partial-overlap, or disjoint?
6. What is the first transform / geometry stage where expected and actual diverge?

Do not patch anything until the first divergence is identified.

---

# Core design law

## Every interactive PDF text projection must derive from one canonical geometry lineage.

There must not be one calculation for rendering source text, another unrelated calculation for hover, another for selection, and another for editing.

The canonical chain should be explicit:

`PDF source geometry -> viewport-local geometry -> text-layer-local geometry -> client geometry`

and glyph ink is an observed visual projection used to validate that chain.

If the visible PDF.js glyph ink and canonical source box differ because PDF.js text metrics are approximate, the interactive field should use a deterministic policy that stays visually anchored to the glyphs rather than pretending the nominal source box is perfect.

---

# Required implementation work

## 1. Build one canonical interactive text rectangle helper

Create or consolidate a helper whose responsibility is:

> Given the PDF text object, current viewport, observed DOM/glyph metrics, and object state, return the authoritative interactive rectangle used for hover, hit testing, selection, and edit initiation.

Example conceptual name:

`resolvePdfInteractiveTextRect(...)`

The helper must return:

- source object ID
- coordinate space
- canonical source rect
- expected viewport rect
- observed glyph ink rect when available
- chosen interactive rect
- derivation method
- confidence
- tolerances
- transform ancestry / source fields needed to explain the choice

Do not use browser-client coordinates as persistent PDF geometry.

Do not mutate saved PDF geometry merely because DOM glyph ink differs slightly.

This helper is a presentation/hit-test authority, not a serializer rewrite.

---

## 2. Hover outline must be based on the same interactive rect

The visual hover field must no longer simply inherit whatever accidental dimensions the transparent `.pdf-text-item` span happens to have if those dimensions visibly disagree with the glyphs.

The hover outline should visibly cover the text it represents.

Policy:

- cover all visible glyph ink for that object
- allow only a small intentional padding for usability
- never extend far enough to swallow unrelated adjacent lines or columns
- no unexplained vertical offset
- no giant empty rectangles

The hover presentation may use a dedicated child/overlay/pseudo-element if necessary, provided it:

- has `pointer-events:none`
- does not alter document layout
- does not move the PDF
- derives from the exact same interactive rect as hit testing

Do not reintroduce page/margin overlays.

---

## 3. Hit testing must match what the user sees

A pointer over visible text should select the object whose visible glyph ink / interactive rectangle contains or is nearest to that pointer.

If raw DOM event targeting disagrees with visible glyph truth, resolve the PDF target using the visual scene / canonical interactive geometry rather than blindly trusting `event.target.closest('.pdf-text-item')`.

Use a deterministic policy such as:

1. objects whose interactive rect contains the pointer
2. among them, objects whose glyph ink contains the pointer
3. otherwise nearest glyph / smallest distance
4. stable tie-break by paint order / object ID

But do not make selection fuzzy enough to grab unrelated text.

Instrument the result so diagnostics can show:

- raw DOM target
- resolved visual target
- reason for resolution
- distance to glyph ink
- competing candidate IDs

---

## 4. Selected field and editable field must remain anchored

When the user clicks/double-clicks text:

- selected field starts at the interactive rect
- entering `contenteditable` must not move it
- focus must not move it
- `Range.selectNodeContents` must not move it
- toolbar visibility must not move it
- field geometry must not jump to another line

Add explicit before/after checks at:

- pointerdown
- click
- dblclick
- selection
- before contenteditable
- after contenteditable
- before focus
- after focus
- after selection creation

If movement exceeds tolerance, emit a deterministic issue and fail the relevant test.

---

## 5. Initial source text boxes must be visually sane

For untouched source text, improve the initial DOM hitbox geometry if necessary so the box starts reasonably aligned with the visible PDF text even before hover.

Current PDF.js text item metrics may need normalization around:

- baseline / top conversion
- height
- scale
- rotation
- width
- text transform
- line-height

Do not make the canvas itself move to fit the DOM layer.

The canvas is the visual source of truth for untouched source text.

The text layer must align to it.

---

## 6. Respect rotation and zoom

The solution must work at minimum for:

- 25%
- 50%
- 100%
- 125%
- 150%
- 200%
- fit page
- fit width
- scrolled surfaces
- resized PDF frames
- DPR 1 and DPR >1

Do not hard-code values that only fix 100% zoom.

Do not confuse CSS pixels with device pixels or PDF points.

---

## 7. Preserve PDF-space edit truth

The visual alignment fix must not corrupt serialization.

Keep these rules:

- persisted edit geometry remains in PDF points
- live hover/hit geometry may use observed client/viewport geometry
- conversions back to PDF points must go through known transforms
- save/reopen must remain visually equivalent
- no arbitrary client-coordinate values stored into edit records

---

# Diagnostics improvements required in this run

When DEBUG/DEEP is active, Copy Page Diagnostics should make the bug understandable from JSON alone.

For the hovered/clicked/selected/edited object, include a compact dossier such as:

```json
{
  "objectId": "source:p1:text:12",
  "text": "example",
  "pointer": {"x": 512, "y": 431},
  "glyphInk": {"x": 470, "y": 420, "width": 96, "height": 14},
  "interactiveRect": {"x": 468, "y": 418, "width": 100, "height": 18},
  "hoverRect": {"x": 468, "y": 418, "width": 100, "height": 18},
  "selectedRect": {"x": 468, "y": 418, "width": 100, "height": 18},
  "editableRect": {"x": 468, "y": 418, "width": 100, "height": 18},
  "coverageOfGlyph": 1,
  "iou": 0.76,
  "centerDelta": {"x": 0, "y": 0},
  "classification": "contains-glyphs",
  "resolvedTargetReason": "glyph-contained-pointer"
}
```

Keep this bounded to current/near interaction objects. Do not dump the entire document.

---

# New / strengthened invariant codes

Reuse existing codes where appropriate and add stable codes only when necessary.

At minimum enforce:

- `SOURCE_DOM_SHOULD_COVER_SOURCE_GLYPH`
- `HOVER_BOX_SHOULD_COVER_HIT_GLYPH`
- `POINTER_TARGET_DOES_NOT_MATCH_VISIBLE_GLYPH`
- `SELECTED_FIELD_SHOULD_REMAIN_ANCHORED_TO_SOURCE`
- `EDITABLE_FIELD_SHOULD_REMAIN_ANCHORED_TO_SELECTED_FIELD`
- `EDIT_FIELD_TELEPORTED_FROM_SOURCE`
- `PDF_OBJECT_GLYPH_RECT_MISMATCH`

Useful additional code if not already represented:

- `PDF_INTERACTIVE_RECT_GLYPH_MISMATCH`

Do not create dozens of overlapping codes.

---

# Acceptance tolerances

Use measured tolerances, not perfection fantasies.

Suggested starting acceptance policy:

- visible glyph coverage by interactive rect: >= 98%
- visible glyph coverage by hover rect: >= 98%
- pointer target mismatch with nearer visible glyph: 0 allowed for clear non-overlapping cases
- selected/editable origin drift after activation: <= 1 CSS px
- canvas/text-layer origin drift: <= 1 CSS px
- zoom-equivalent geometry should scale proportionally rather than accumulate offset

If a font/browser metric makes 98% impractical in a specific case, document the evidence and use a narrow justified tolerance. Do not loosen globally to hide bugs.

---

# Tests required

Add deterministic tests for the geometry policy and browser-facing smoke tests where feasible.

Must cover:

1. aligned glyph + hitbox -> no issue
2. vertically shifted hitbox -> detected and corrected
3. horizontally shifted hitbox -> detected and corrected
4. oversized box swallowing adjacent line -> constrained
5. two neighboring text objects -> pointer resolves to visually correct object
6. focus/contenteditable/selection do not move field
7. toolbar remains stable and does not shift page origin
8. zoom changes preserve alignment
9. scrolling preserves client-space hit truth
10. existing replacement edit remains anchored to its source/current field
11. search-highlight text remains selectable without corrupting edit hit-testing
12. terminal-fragment masking behavior remains intact
13. save/reopen parity remains intact

Run the full existing Node test suite.

Do not treat syntax-only GitHub Actions as sufficient proof.

---

# Performance contract

Normal users should not pay for deep visual diagnostics.

## OFF

- no pointermove geometry journal
- no Range glyph scanning
- no canvas TextMetrics diagnostics
- no ancestry walk
- ordinary lightweight PDF interaction only

## DEBUG

- bounded current-page/object observations
- hover/click/select traces
- no whole-document scans

## DEEP

- explicit user/agent-triggered detailed glyph and ancestry diagnostics
- still bounded to current page / interaction set

The actual alignment fix must work in OFF mode. Diagnostics are for proof, not required for correctness.

---

# Non-negotiable UX rules

1. The PDF page must not move when text is hovered or selected.
2. The toolbar must remain the stable three-row implementation.
3. Hover boxes must visually sit on the text they describe.
4. Clicking visible text must resolve to that visible text.
5. Editing must begin in place.
6. No arbitrary magic offsets.
7. No margin/page-guide overlays.
8. No regression to source-mask/live-save parity.
9. No giant invisible hit regions.
10. No old/historical text becoming hit-testable.

---

# Finish condition

Do not finish this task merely because tests pass.

The task is complete when the implementation and diagnostics together can answer, for a hovered/clicked piece of text:

> Where are the visible glyphs?
> Where is the hover/hit field?
> Do they overlap correctly?
> If not, exactly how far are they apart?
> Which object did the pointer resolve to?
> Where did the first geometry divergence occur?

and, for normal aligned cases, the user visually sees the hover/selected/edit field directly over the text with no gross discrepancy.

Product law:

> **The box must describe the thing the human sees, not merely the thing the DOM happened to calculate.**
