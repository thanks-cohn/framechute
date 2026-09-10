# PDF Export Cleanliness V1

## Why this is P0

A saved PDF must never contain editing chrome, selection geometry, resize handles, hover outlines, or visible residue that makes a former FrameChute edit box appear printed into the document.

The user has reproduced a saved PDF where a pale broken/rectangular trace remains around the area that was edited in FrameChute. This is unacceptable export fidelity even if the text itself survives.

This is a separate P0 from `PDF_TEXT_DATA_SAFETY_V1.md`:

- **data safety:** typed text must never disappear when focus changes, a field moves/resizes, a page rerenders, or a save occurs;
- **export cleanliness:** the saved PDF must contain the intended document content, not FrameChute editing affordances or masking residue.

## What the current code actually does

The blue/dashed editor outline is CSS-only. `workspace.css` uses outlines on `.pdf-text-item:hover` / `.pdf-text-edit.is-selected`, but `serializeEditedPdf()` does not read DOM styles or capture the editor surface.

Therefore the visible trace in the saved PDF is not literally the browser outline being rasterized.

The current replacement serializer uses a cover-and-redraw model:

```js
if (edit.kind === "replacement") {
  page.drawRectangle({ ...sourceMaskForEdit(edit), color: rgb(1, 1, 1) });
}
```

`sourceMaskForEdit()` currently returns almost exactly the stored source rectangle. That has two failure modes:

1. **glyph/antialias remnants:** the mask can be fractionally too tight and leave pale pieces of the original glyphs or renderer antialiasing around its edges;
2. **background seams:** a solid white rectangle cannot be invisible when the original background is not exactly white or contains artwork/gradients.

The first failure is consistent with the reproduced white-page artifact. The second is a structural limitation of the current masking strategy and must not be hidden.

## P0 laws

1. **UI chrome is display-only.** Selection outlines, hover outlines, resize/move handles, caret states, and any other FrameChute editing affordance must never enter PDF serialization.
2. **Source masking is immutable.** Moving or resizing replacement text must never move/resize the original source mask. Source geometry is captured once in PDF coordinates.
3. **Normal white-page replacement must be visually clean.** The source mask needs a small PDF-coordinate bleed so glyph antialiasing is fully covered without depending on viewport scale.
4. **No stroked mask.** Export masks are fill-only; no border color/width/operator may be emitted for FrameChute masking.
5. **Never silently destroy neighboring content.** Bleed must be intentionally small and bounded. Do not solve one artifact by covering a large surrounding rectangle.
6. **Complex backgrounds are not solved by pretending white is transparent.** If the replaced source sits over a non-uniform background, the editor must either use a real background-aware/content-removal strategy or honestly warn that seamless replacement is not yet guaranteed.
7. **Save reads the canonical PDF model only.** Never serialize editor DOM pixels or selection state.

## Near-term implementation

### 1. Add a tiny source-mask bleed in PDF points

The exact value should be regression-tested, but begin in the neighborhood of roughly 0.75-1.25 PDF points rather than CSS pixels. It must be applied to the fixed source rectangle, not to replacement geometry.

Conceptually:

```js
const bleed = boundedSourceMaskBleed(edit);
return {
  x: sourceX - bleed,
  y: sourceY - bleed,
  width: sourceWidth + bleed * 2,
  height: sourceHeight + bleed * 2
};
```

Because it is expressed in PDF coordinates, zooming/resizing the FrameChute object cannot change the physical saved mask.

### 2. Derive the source rectangle from the original PDF text object

Where possible, derive/capture the original source glyph bounds from PDF.js text content and the PDF viewport conversion exactly once when the replacement is created. Do not re-derive source geometry from the replacement DOM after the replacement has been moved or resized.

### 3. Keep mask and edit geometry separate in the model

A replacement edit should continue to distinguish:

```text
sourceX/sourceY/sourceWidth/sourceHeight  -> area being covered
x/y/width/height                         -> replacement field
```

Moving/resizing changes only the second group.

### 4. Treat background-aware replacement as a later, explicit capability

The current white-cover model can be dependable on plain white page regions after mask cleanup, but it cannot be guaranteed invisible over arbitrary photographs, gradients, vector artwork, colored boxes, or textured backgrounds.

Longer-term options include:

- controlled content-stream surgery for supported text operators;
- true redaction/removal followed by redraw;
- a background reconstruction strategy only when it can be proven faithful.

Do not screenshot/rasterize an arbitrary page region and claim original-PDF object fidelity.

## Required regression tests

### Pure geometry

- source mask remains fixed after replacement move/resize;
- mask bleed expands all four edges by the expected PDF-point amount;
- bleed is independent of viewport scale;
- free text (`kind: "text"`) creates no source mask;
- no edit-state value can request a visible export border.

### Save/reopen

Create a small white PDF containing dark source text, replace it, save, reopen it, and verify:

- replacement text remains searchable/textual;
- source mask coordinates remain fixed;
- no annotation or editing-border object was created;
- the PDF parses successfully after save.

### Visual/browser regression

A browser/PDF.js test should render the saved output at multiple zoom levels (for example 75%, 100%, 150%, and 200%) and compare a crop around the old source bounds.

Acceptance on a plain white region:

- no blue/gray/dashed box;
- no resize-handle artifacts;
- no visible source-glyph fragments at the mask perimeter;
- no new seam that changes with zoom.

Also test the exact user flow:

```text
open PDF
-> create/replace text
-> type multiline content
-> use Enter
-> use Tab/repeated spaces
-> move field
-> resize field
-> save
-> reopen in an external/browser PDF viewer
```

Both P0s must pass simultaneously: **all text survives and no edit-box residue is printed into the PDF.**

## Release gate

Do not describe PDF text replacement as dependable until both:

- `PDF_TEXT_DATA_SAFETY_V1.md`, and
- `PDF_EXPORT_CLEANLINESS_V1.md`

have executable regression coverage and the critical browser save/reopen flow has been exercised.
