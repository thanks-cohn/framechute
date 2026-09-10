# PDF Editor Parity Audit V1

## Purpose

This audit compares the **actual PDF implementation on `codex/implement-docx-editing-and-context-menu`** with the now-considerably-more-developed DOCX editor and defines what it will take for PDF editing to feel equally deliberate, standardized, and dependable.

This document is descriptive and architectural. It does **not** claim that the missing PDF capabilities listed below already exist.

## Executive finding

The DOCX side is now an editor with a coherent object/selection/history model. The PDF side is still primarily a PDF viewer plus page utilities and a useful text-replacement overlay.

The PDF foundation is not bad. In fact, several choices are correct and should be preserved:

- PDF.js renders source pages locally.
- pdf-lib performs native PDF mutations and serialization.
- editable geometry is stored in **PDF page coordinates**, not viewport CSS pixels.
- replacement text has an explicit source mask independent from the moved/resized replacement geometry.
- free text and replacement text already share some layout primitives.
- Save / Save As writes a real PDF rather than trapping edits in workspace-only state.

The missing piece is a **general PDF page-object editor contract**. Today most code paths assume an edit means text. That prevents images, shapes, richer text controls, unified selection, and unified undo/redo from composing cleanly.

The shortest route to DOCX-level usefulness is **not** to build Acrobat. It is to make FrameChute-created PDF objects first-class and boringly reliable.

---

# What works today

## Rendering and coordinates

`src/documents/pdf-document.js` renders the page with PDF.js and computes the viewer scale from the PDF page size. The existing `viewportRectToPdf()` and `pdfRectToViewport()` helpers are the right architectural seam: object geometry should remain in PDF points and only be projected into CSS pixels for display.

This directly protects the PDF editor from the earlier class of bug where resizing the document frame appeared to mutate text-field positions. A view resize must only alter the projection, never the stored PDF geometry.

## Text editing

The current editor supports two practical text object types:

- **replacement text**: covers the original source glyph rectangle and redraws replacement text;
- **free text**: draws a new text field without a source mask.

Current useful behavior includes:

- select a text/replacement edit;
- edit text;
- move the field;
- resize the field;
- nudge with arrow keys;
- change point size;
- choose among packaged PDF standard fonts;
- delete/duplicate an edit;
- undo/redo edit-array changes;
- save the result to a valid PDF.

The replacement system is intentionally cover-and-redraw. It is not arbitrary content-stream surgery and should continue to be described honestly that way.

## Page utilities

The current PDF path also supports:

- add page;
- rotate page;
- delete page;
- duplicate page;
- move/reorder page;
- extract page;
- insert/merge another PDF;
- crop margins;
- conservative re-save/compression;
- export rendered page images.

These utilities are valuable. The problem is that they currently sit beside the editable-object model rather than participating in one transaction/history model.

---

# Confirmed gaps

## P0: PDF cannot currently insert/drop images

This is the clearest parity gap.

The current PDF right-click model contains `Insert Image…` and `Paste Text / Paste Image`, but those commands are explicitly disabled. `renderPdfPage()` renders source PDF content plus text/replacement edit overlays only. `serializeEditedPdf()` draws text only. There is no active `kind: "image"` serialization branch in the current PDF model.

Therefore the following must **not** be claimed as current behavior yet:

- external OS image -> PDF;
- workspace image -> PDF;
- DOCX image -> PDF;
- paste image -> PDF;
- inserted PDF image -> move/resize/delete/undo/save.

The older `IMAGE_DRAG_INTERCHANGE_V10.md` contains an aspirational/stale sentence saying the PDF editor already represents inserted images as canonical `kind:"image"` edits. The executable branch is authoritative: that support is not present yet.

## P0: PDF has no general editable-object contract

`normalizePdfEdit()` and `serializeEditedPdf()` are text-centric. A mature PDF editor needs a discriminated object union, for example:

```js
// names may differ; semantics should not
{
  kind: "replacement-text" | "text" | "image",
  id,
  page,
  x,
  y,
  width,
  height,
  rotation,
  ...kindSpecificData
}
```

For images, geometry and image bytes should not be conflated. Use an asset reference:

```js
{
  kind: "image",
  id,
  page,
  assetId,
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1
}
```

with a separate canonical asset store:

```js
runtime.assets = new Map([
  [assetId, { mime: "image/png", bytes: Uint8Array }]
]);
```

This prevents repeated copies of large image bytes in every history snapshot and lets one serializer embed each asset once per output PDF.

## P0: PDF selection is text-only

Current selection state is effectively `selectedPdfIndex` and `.pdf-text-item.is-selected`.

That needs to become object selection by stable ID, independent of type:

```text
selectedPdfObjectId
       ↓
text / replacement / image
       ↓
contextual controls + delete + duplicate + move + resize
```

Do not make a parallel selection system for images. Generalize the existing PDF edit selection.

## P0: drop ownership is not destination-first for PDF images

Global image-drop handlers on the workspace currently create ordinary FrameChute image objects. A PDF surface must claim a supported image drop **before** it bubbles into generic workspace ingest.

Required arbitration order:

```text
1. Is pointer over DOCX/PDF?
   yes -> global Drop into FrameChute presentation is forbidden

2. Is source an internal FrameChute image?
   yes -> global ingest presentation is forbidden everywhere

3. Can local document destination accept it?
   yes -> perform document move/copy directly

4. Only external material over blank/general workspace reaches generic ingest
```

This should reuse the common internal drag ownership descriptor rather than creating a PDF-only drag side channel.

## P0: history is split between edit objects and page mutations

Current PDF undo/redo snapshots `runtime.edits`. Page operations serialize the current PDF, mutate bytes, replace the PDF runtime, and reset edits. This means the mental model is inconsistent:

```text
move text -> undoable as edit history
add/delete/move page -> separate structural mutation path
```

For parity, a user should be able to think **Undo means undo my last PDF edit**.

Do not solve this by keeping multiple invisible undo stacks that can disagree. Introduce one document transaction/history layer capable of restoring both page structure and editable objects.

A practical bounded design is acceptable. For example, structural transactions may snapshot serialized base bytes while ordinary object moves store compact object-state deltas.

## P1: PDF text controls are much narrower than DOCX

The current PDF toolbar exposes font family and point size for selected replacement/free text. To feel standardized, add at least:

- explicit text color;
- bold/italic choice through known font-family variants where possible;
- alignment for multiline free-text boxes;
- consistent literal point-size behavior;
- duplicate/delete in the visible contextual tool surface;
- rotation control;
- object position/size fields only if they remain simple and useful.

Arbitrary system-font support is a separate problem. pdf-lib's built-in standard fonts are reliable and should remain the initial guaranteed set. Custom fonts require embedding a font file (and normally fontkit or an equivalent parser/subsetter) and should not be faked by naming a CSS font that the saved PDF cannot embed.

## P1: toolbar/menu state should follow selected PDF object type

The PDF surface should have the same clarity the DOCX editor is gaining:

```text
no object selected
  -> Add Text · Image · Paste · Page tools

text selected
  -> Font · Size · Color · Align · Rotate · Duplicate · Delete

image selected
  -> Replace · Crop/fit if supported · Rotate · Opacity · Duplicate · Delete

page context
  -> Add/Rotate/Delete/Duplicate/Move/Extract/Insert PDF/Crop
```

The top-level FrameChute toolbar remains stable; document-specific controls occupy a defined contextual region rather than forcing unrelated permanent controls to jump around.

## P1: PDF image editing needs Save/Reopen fidelity

V1 image insertion must guarantee:

1. image bytes are canonical and retained;
2. image geometry is in PDF coordinates;
3. live preview projects those coordinates through the current PDF.js viewport;
4. Save embeds and draws the image into the PDF with pdf-lib;
5. reopening the saved PDF shows the image as normal PDF content;
6. while the current edit session/workspace is retained, the inserted image remains a first-class editable FrameChute PDF object.

Once edits are flattened into an ordinary saved PDF, recovering FrameChute-specific editability on a fresh unrelated open is a separate source-object extraction problem. Do not promise it unless implemented.

---

# P0 implementation: inserted PDF images

This is the first feature to build.

## 1. Extend the PDF edit-object model

In `src/documents/pdf-document.js`:

- preserve existing text/replacement normalization;
- add `normalizePdfImageEdit()` or a type-aware `normalizePdfObject()`;
- validate finite PDF coordinates and positive dimensions;
- give every new object a stable ID;
- preserve rotation and opacity;
- keep asset identity separate from geometry.

## 2. Add a PDF asset store

In the PDF runtime:

```js
{
  handle,
  model,
  objects,
  assets,
  history,
  structurallyDirty
}
```

For V1, guarantee PNG and JPEG. Browser-decodable formats such as WebP/GIF may be normalized to PNG before insertion if that path is deterministic. Do not silently label WebP bytes as PNG.

## 3. Render an image edit layer

Generalize the current text edit layer into an object layer or add a sibling `.pdf-object-layer` that shares the exact PDF viewport projection.

For each `kind:"image"` object on the current page:

- render an `<img class="pdf-image-edit">`;
- position it from `pdfRectToViewport()`;
- provide the same selection outline language as text objects;
- bottom-right resize handle;
- direct move handle or direct-drag body;
- Delete/Backspace;
- Duplicate;
- keyboard nudging;
- rotation if exposed;
- no global FrameChute drop overlay during direct manipulation.

Same-PDF drag must update the same object ID. It must never create a workspace image or duplicate the PDF object.

## 4. Add all insertion routes to one insertion primitive

Build one function conceptually like:

```js
insertPdfImage({ block, page, blobOrBytes, mime, clientPoint })
```

All of these should delegate to it:

- toolbar `Image` picker;
- right-click `Insert Image…`;
- OS file drop onto PDF;
- clipboard image paste;
- FrameChute workspace image -> PDF;
- DOCX image -> PDF;
- another PDF editable image -> PDF.

Cross-container drag is COPY by default. Same-PDF drag is MOVE.

## 5. Serialize images natively

In `serializeEditedPdf()`:

- collect image assets used by objects;
- embed PNG/JPEG with pdf-lib once per asset;
- `page.drawImage(...)` with the object's PDF coordinates and dimensions;
- support rotation/opacity if those controls are exposed;
- retain text behavior unchanged.

No screenshot/rasterization of the entire page should be used to fake image insertion.

## 6. Make insertion undoable

Image insert, move, resize, rotate, duplicate, replace, and delete must each be one logical history transaction.

Continuous pointermove should not create hundreds of history entries. Snapshot/push once at pointerdown, mutate live during the gesture, commit at pointerup.

---

# P1 implementation: unify the PDF editor state

After inserted images work reliably, replace the text-specific naming and state with general document objects.

Suggested migration:

```text
runtime.edits         -> runtime.objects
selectedPdfIndex      -> selectedPdfObjectId
selectPdfEdit()       -> selectPdfObject()
selectedPdfEdit()     -> selectedPdfObject()
pushPdfHistory()      -> pushPdfTransaction()/history transaction API
```

Keep compatibility readers for existing workspace snapshots that still contain `state.edits`.

The goal is one conceptual loop:

```text
PDF source bytes
   + editable page objects
   + page structure
        ↓
     live render
        ↓
  user transaction
        ↓
  same canonical state
        ↓
     Save PDF
```

---

# P1/P2: unify page operations with history

Page operations currently serialize and replace the runtime. This is serviceable for utilities but not editor-grade history.

Required behavior:

- Add Page -> Undo restores previous page set.
- Delete Page -> Undo restores deleted page and relevant editable objects.
- Move Page -> objects travel with their page.
- Duplicate Page -> decide whether FrameChute edit objects on that page duplicate too; for consistency they should.
- Insert PDF -> one transaction.
- Crop -> one transaction.
- Compress -> probably a document-level transaction, not an object edit.

Object page identity should not be based only on mutable 1-based page number if page reordering becomes rich. Introduce an internal stable page ID or update object page references transactionally when the page list changes.

---

# P2: original/source PDF images

This is much harder than inserted images and should be a separate milestone.

A saved PDF may contain raster imagery through:

- image XObjects;
- Form XObjects containing images;
- nested transforms;
- soft masks / alpha masks;
- clipping paths;
- inline images;
- repeated resources drawn at multiple positions.

Therefore do **not** treat every visible rectangular picture-like region as an editable original image.

Only promote an original PDF image to an editable/extractable object when FrameChute can confidently resolve:

- original encoded raster bytes or a faithful decoded raster;
- MIME/encoding;
- page resource identity;
- full current transformation matrix / page geometry;
- clipping/mask semantics needed for faithful rendering.

Until then, V1's guarantee should be simple:

> **Images inserted into a PDF by FrameChute are first-class during the editing session. Original embedded PDF images remain ordinary source-page content unless confidently promoted.**

Do not screenshot a page rectangle and call it the original embedded image.

---

# P2: large-PDF behavior

The current README correctly notes that huge PDFs do not yet use a Sumatra-like architecture.

Later work should include:

- range loading where the source allows it;
- virtualized page rendering;
- bounded PDF.js page/text caches;
- release canvases/text layers when far from current page;
- avoid keeping multiple fully serialized copies of huge documents in undo history;
- stream/bound image asset handling where practical.

This is not required before inserted-image parity, but the history architecture should avoid making it impossible later.

---

# Tests required before calling PDF image editing dependable

Add at least:

## `tests/pdf-image-model.test.mjs`

- insert PNG;
- insert JPEG;
- serialize to valid PDF;
- multiple objects can reference one asset without duplicate logical state;
- x/y/width/height/rotation survive normalization;
- invalid geometry rejected or clamped deliberately.

## `tests/pdf-object-history.test.mjs`

- insert image -> undo -> redo;
- move image -> undo returns exact prior geometry;
- resize image -> undo;
- delete image -> undo restores same ID/asset;
- text and image edits share one history sequence.

## `tests/pdf-drop-routing.test.mjs`

- external image over PDF is claimed by PDF;
- global workspace ingest does not create a top-level image;
- internal FrameChute image over PDF never triggers global overlay;
- same-PDF image move never duplicates;
- canceled drag clears ownership/drop state.

## Serializer regression

One PDF containing:

- untouched source content;
- replacement text;
- free text;
- PNG;
- JPEG;
- at least two pages;
- page reorder or other structural mutation.

Save, load with pdf-lib/PDF.js, and verify the resulting document remains parseable and page count/objects are where expected.

## Browser smoke test

Use a representative PDF and perform exactly this sequence:

```text
Open PDF
-> drop PNG onto page
-> move image
-> resize image
-> Delete
-> Undo (image returns)
-> Redo
-> Undo
-> add free text
-> change literal point size
-> move text
-> reorder a page
-> Undo page reorder
-> Save As
-> reopen output
```

No step may spawn an accidental workspace image when the PDF owns the interaction.

---

# Acceptance matrix for image interchange

```text
A. external OS image -> PDF
   -> insert once at pointer coordinates
   -> no global/document overlay

B. workspace image -> PDF
   -> copy once into PDF
   -> source workspace image remains
   -> no overlay

C. DOCX image -> PDF
   -> copy once from canonical embedded bytes
   -> DOCX source remains

D. PDF inserted image -> another location in SAME PDF
   -> same object ID moves
   -> no duplicate
   -> one undoable gesture

E. PDF inserted image -> workspace
   -> exactly one workspace image from canonical bytes
   -> PDF source remains

F. PDF inserted image -> DOCX
   -> exactly one DOCX image inserted
   -> PDF source remains

G. PDF inserted image -> another PDF
   -> exactly one destination image
   -> source remains
```

---

# Recommended implementation order

## Phase 0 — model and invariants

1. Generalize PDF text edits to PDF editable objects.
2. Add stable object IDs.
3. Add canonical image asset store.
4. Add pure tests before UI wiring.

## Phase 1 — inserted images

1. PNG/JPEG image serializer.
2. image preview layer.
3. selection.
4. move/resize/delete/duplicate.
5. undo/redo.
6. toolbar picker + right-click Insert Image.

At the end of this phase, a user should be able to use PDF image insertion without knowing how FrameChute is implemented.

## Phase 2 — drop/paste/interchange

1. external OS image -> PDF;
2. clipboard image -> PDF;
3. workspace image -> PDF;
4. DOCX image -> PDF;
5. same-PDF move;
6. PDF -> workspace/DOCX/other PDF;
7. prove global overlay suppression.

## Phase 3 — editor history and page transactions

Unify object and structural operations behind one PDF undo/redo model.

## Phase 4 — text parity/polish

Add dependable color/alignment/font-variant/rotation controls, contextual toolbar state, and format-native menu polish.

## Phase 5 — source PDF object promotion and huge-file work

Investigate original embedded-image extraction/editability and large-PDF virtualization only after FrameChute-created objects are dependable.

---

# Definition of "PDF parity" for FrameChute

Parity does **not** mean reproducing every Acrobat feature.

For this project, a sufficiently developed PDF editor means:

```text
Open real PDF
Read it comfortably
Add/edit text
Add/drop/paste images
Select objects predictably
Move/resize/delete/duplicate them directly
Undo/redo what you did
Perform normal page operations
Save a valid PDF
Reopen it without surprises
Never confuse a document-local drag with a new workspace object
Never change stored page coordinates merely because the frame/view resized
```

That is the target. Once those guarantees are boring and dependable, the PDF side will feel like the DOCX side: not a full professional suite, but a genuinely useful native file editor rather than a collection of unrelated utilities.
