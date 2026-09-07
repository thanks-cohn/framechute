# FrameChute next run — drag ownership + DOCX/PDF image insertion V8

Start from the latest `main` after merged PR #53. Treat this file as the single authoritative prompt for this run.

## Why this run exists

Several related drag/drop problems have survived repeated passes because FrameChute still has competing drag systems instead of one explicit ownership model.

The user-facing failures are:

1. **Picking up / moving an existing FrameChute image still causes the global “Drop into FrameChute” overlay to appear. This must stop completely.**
2. **Dragging an image into DOCX used to work and has regressed / become unreliable. Restore it.**
3. **Dragging an image into PDF must also work, using the same underlying drag ownership primitive rather than another one-off patch.**

Do not solve these independently. Fix the ownership model so these three behaviors become consequences of the same architecture.

---

# Product law

There are three fundamentally different drag intents:

```text
A. INTERNAL WORKSPACE MANIPULATION
existing FrameChute object is being picked up / moved
→ never show global ingest overlay
→ object moves normally

B. INTERNAL DOCUMENT INSERTION
existing FrameChute image is dragged onto DOCX/PDF editor surface
→ document editor claims the drop locally
→ copy image into document exactly once
→ original workspace image remains
→ global ingest overlay never appears

C. EXTERNAL INGESTION
OS/browser file is dragged into FrameChute
→ global “Drop into FrameChute” overlay is allowed on workspace
→ if DOCX/PDF surface claims the image, use local document affordance instead
```

The global overlay is for **external ingestion only**.

> **Existing FrameChute objects are already inside FrameChute. Moving them is not ingestion.**

Do not merely call `workspace.classList.remove("is-drop-target")` after the overlay has already been activated. The global dragenter/dragover path must know that the active gesture is internal and refuse to activate the overlay at all.

Do not solve this by disabling internal image dragging globally. Internal image → DOCX/PDF insertion must remain possible.

---

# P0.1 — canonical internal drag session / ownership primitive

Audit all relevant drag/pointer paths, especially:

- `src/drop-local-sources.js`
- `src/workspace.js`
- image/object movement code
- any web-drop / media-drop routing modules
- DOCX editor drop handlers
- PDF editor surface handlers

Create or consolidate a reusable primitive for the active drag session. A dedicated helper/module is preferred if that makes ownership explicit, e.g. conceptually:

```js
beginInternalDrag({ block, kind: "image", sourceBlobProvider })
isInternalFrameChuteDrag(event)
claimDocumentDrop("docx" | "pdf")
endInternalDrag()
```

Exact names are your choice.

The primitive must reliably distinguish:

- internal FrameChute object gesture
- external file/browser gesture
- document-local claimed drop

If HTML5 `DataTransfer` is used, add a FrameChute-specific payload/marker such as `application/x-framechute-object` or equivalent. If the existing movement system is pointer-based, keep a shared in-memory drag session as the canonical source of truth and use DataTransfer only where useful.

The lifecycle must clean up on all plausible termination paths:

- successful drop
- pointerup
- pointercancel
- dragend
- Escape/cancel
- window blur where appropriate
- removed source object

No stale internal-drag state.

### Hard acceptance

Grab/move an existing image around the workspace continuously for at least 10 seconds, including across blank workspace and other objects:

**The global “Drop into FrameChute” overlay never appears, not even for one frame.**

Repeat the gesture multiple times. Same result.

External OS file drag over blank workspace must still show the normal ingest affordance.

---

# P0.2 — restore existing FrameChute image → DOCX

DOCX must accept two image sources:

1. **external image files** dragged from OS/browser-supported file source
2. **existing FrameChute image objects** dragged from the workspace

The existing DOCX code currently focuses on `DataTransfer.files` / `DataTransferItem.kind === "file"`. That is insufficient for an existing FrameChute image object. Use the canonical internal drag session to resolve the source block and retrieve real image bytes.

Prefer the existing shared source bridge where possible, e.g. `FrameChuteWorkspace.sourceBlob(block)`, or add a more precise reusable image-byte accessor if needed.

### DOCX behavior

When the pointer/drag enters the editable DOCX surface with a valid image source:

- DOCX claims the drag locally.
- Show a **local DOCX insertion affordance**, not the global FrameChute ingest overlay.
- On drop, insert exactly one image at/near the drop caret or nearest valid paragraph/list/table-cell target.
- Keep the original workspace image object unchanged and in place.
- Mark the DOCX dirty.
- Ensure the image becomes a real DOCX media part + relationship through the canonical DOCX image path (`addDocxImage` or improved equivalent), not a DOM-only image.
- Save / Save As must serialize it.
- Reopen the saved DOCX and the image must still be present.

Do not let both the DOCX handler and generic workspace drop handler process the same gesture.

### Supported source formats

At minimum:

- PNG
- JPEG/JPG

Preserve current WebP/GIF support where already honest. If DOCX can carry the media type directly, retain it. Do not invent unsupported conversion behavior.

### DOCX acceptance

1. Drag OS PNG into DOCX → exactly one image inserted.
2. Drag OS JPEG into DOCX → exactly one image inserted.
3. Drag existing FrameChute image into DOCX → exactly one image inserted.
4. Original workspace image remains.
5. Global ingest overlay never appears during the internal drag.
6. Save As → reopen generated DOCX → inserted image survives.
7. No duplicate media relationships / duplicate DOM insertions from one drop.

If current shared undo/redo can safely cover DOCX image insertion, wire it in. If it cannot be made coherent in this run, do not fake it; state that explicitly in the handoff and leave the insertion model structured enough to add history next.

---

# P0.3 — existing FrameChute image / OS image → PDF

Add the same two source paths to PDF:

1. external OS image file → PDF
2. existing FrameChute image object → PDF

The PDF editor must claim valid image drops locally and suppress the global ingest overlay.

## Canonical PDF image edit model

Do not implement this as a temporary DOM overlay that disappears on save.

Extend the canonical PDF edit state so inserted images are real edit records. Conceptually each inserted PDF image needs at least:

```js
{
  id,
  kind: "image",
  page,
  x,
  y,
  width,
  height,
  mime,
  bytesOrAssetRef
}
```

Use PDF-space coordinates as the canonical geometry, just as text-edit geometry is canonical. The preview and serializer must consume the same state.

If preserving raw bytes directly in each history snapshot is expensive, build a small per-document asset table keyed by stable asset ID and keep geometry/history records lightweight.

## PDF image decoding / embedding

At minimum support PNG and JPEG/JPG natively.

If an internal FrameChute image is WebP/GIF or another format pdf-lib cannot directly embed, either:

- normalize the locally owned Blob to PNG through a safe local canvas path, or
- reject that format with a clear status message.

Do not taint a canvas with cross-origin remote image elements. Resolve FrameChute-owned bytes first.

## Drop geometry

Drop position should correspond naturally to the pointer location on the active PDF page.

- Convert viewport/drop coordinates to PDF-space coordinates.
- Preserve aspect ratio by default.
- Choose a sensible initial size bounded by page dimensions rather than inserting enormous off-page images.

## PDF editing after insertion

An inserted PDF image must be:

- selectable
- movable
- resizable with a visible bottom-right resize handle or the established document-object handle system
- deletable with Delete/Backspace
- duplicable if the existing PDF object command model already supports it cleanly
- undoable/redone through the PDF canonical history primitive

At minimum the following must be coherent history actions:

- insert image
- delete image
- move image
- resize image

One continuous move/resize gesture should become one undo step, not hundreds.

Keyboard expectations:

```text
Ctrl/Cmd+Z       Undo
Ctrl/Cmd+Shift+Z Redo
Ctrl+Y           Redo where supported
Delete/Backspace Delete selected inserted image
Escape           Deselect/cancel current manipulation
```

## PDF serialization

Extend `serializeEditedPdf` / the canonical PDF serializer so image edit records are embedded into the saved PDF.

The serializer must:

- embed each distinct asset efficiently
- draw it on the correct page
- use canonical PDF coordinates/size
- preserve all unrelated original pages/content

Save / Save As → reopen in FrameChute and a normal PDF viewer → inserted image remains on the correct page in the same position and size.

### PDF acceptance

1. Drag OS PNG into PDF → exactly one image appears at the drop location.
2. Drag OS JPEG into PDF → exactly one image appears at the drop location.
3. Drag existing FrameChute image into PDF → exactly one image appears.
4. Original workspace image remains in place.
5. Global ingest overlay never appears for the internal drag.
6. Select inserted image → move it → resize it → Delete/Undo/Redo behave coherently.
7. Save As → reopen PDF → image survives at the same page/geometry.
8. One source drag must never create both a new workspace image and a PDF image.

---

# P0.4 — prevent handler competition / duplicate drops

This is a root requirement.

A single gesture has exactly one owner at drop time.

The order should effectively be:

```text
valid DOCX/PDF local target?
→ local editor claims it

else internal workspace object drag?
→ workspace manipulation only

else external ingest?
→ generic FrameChute drop path
```

Use an explicit claim/ownership flag or drag-session state rather than relying on fragile propagation timing alone.

`preventDefault()` / `stopPropagation()` may still be appropriate, but they must not be the only architecture.

---

# P1 — regression tests / automated coverage

Add focused tests for pure/helper logic wherever possible.

At minimum test the classification/ownership decisions as unit-testable functions:

- internal image drag → global ingest false
- external file drag → global ingest true
- internal image over DOCX → DOCX claims
- internal image over PDF → PDF claims
- external image file over DOCX/PDF → corresponding editor may claim
- claimed local drop → generic workspace ingest false

Add serializer tests proving:

- DOCX image relationship/media part survives serialization if coverage does not already prove this path
- PDF inserted PNG/JPEG becomes a real embedded image on the expected page
- PDF image geometry survives serialization/reopen inspection as far as the available test stack can verify

Do not claim browser/manual behavior was tested if no browser was available.

---

# Preserve these foundations

Do not regress merged PR #53 DOCX/PDF standardization work:

- DOCX canonical rich runs
- font family / size
- paragraph style / alignment
- lists
- hyperlinks
- images already present in DOCX
- PDF page operations
- PDF text edit history
- Save / Save As

Also preserve:

- Quick Actions behavior
- image/frame behavior
- toolbar-gated workspace extent behavior
- external generic file ingest
- gallery/video/audio drops

Do not spend this run on WEBX, 3D, Canvas, general media features, or unrelated polish.

---

# Recommended implementation sequence

1. Trace every dragenter/dragover/drop/pointer path and identify who currently toggles `is-drop-target`.
2. Implement the shared internal drag-session / ownership primitive.
3. Make global ingest refuse internal drags at the earliest possible event.
4. Restore DOCX external + internal image insertion through canonical bytes.
5. Add PDF canonical image edit records + local drop insertion.
6. Add PDF move/resize/delete + history.
7. Extend PDF serializer for image edits.
8. Add tests and run validation.
9. Manually exercise the acceptance matrix if a browser is available.

Do not declare the root issue fixed merely because `workspace.classList.remove("is-drop-target")` was added somewhere. The overlay must not be activated for an internal drag in the first place.

---

# Validation

Run, at minimum:

```text
node --test tests/*.test.mjs
node --check on every touched JS/MJS file
git diff --check
bash scripts/package-web-store.sh
```

Also manually test in Chrome/Chromium if the environment permits:

```text
A. move existing image around workspace 10 seconds → NO global drop overlay
B. existing image → DOCX → one insertion, original remains
C. OS PNG → DOCX → one insertion
D. existing image → PDF → one insertion, original remains
E. OS PNG → PDF → one insertion
F. PDF inserted image → move / resize / delete / undo / redo
G. save/reopen DOCX and PDF → inserted images remain
H. external file over blank workspace → normal global ingest still works
```

---

# 30-minute reliability checkpoint

The 30-minute instruction is **not a development cap**. It exists because the execution environment can continue longer and then terminate without producing a useful handoff.

Work aggressively toward the P0s. At approximately the 30-minute mark, **conclude active implementation and provide a handoff** before runtime failure risk becomes unacceptable.

The handoff must be immediately continuation-ready and include:

- completed behavior
- reusable primitives added/refactored
- exact user-facing issues solved
- remaining P0/P1 items
- partially completed code paths
- files changed
- tests and results
- manual checks and whether a browser was actually available
- known regressions/risks
- exact next highest-leverage continuation step, including likely files/functions
- branch
- commit(s)
- PR number/link if created

Do not interpret 30 minutes as “the product work is done.” It is the point at which a reliable handoff must exist so a follow-up run can continue immediately if needed.
