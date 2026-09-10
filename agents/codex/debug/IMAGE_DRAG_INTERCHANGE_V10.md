# FrameChute Image Drag Interchange Debug Map (V10)

This is a focused companion to `PR55_STABILIZATION_MAP_V10.md`. Read it before touching image drag/drop during the PR #55 reconciliation.

## The user-visible law

An image is an image object regardless of where it currently lives.

```text
OS/browser image -> FrameChute workspace
FrameChute image -> DOCX
FrameChute image -> PDF
DOCX embedded image -> another position in the same DOCX
DOCX embedded image -> FrameChute workspace
DOCX embedded image -> PDF
PDF editable image -> another position in the same PDF
PDF editable image -> FrameChute workspace
PDF editable image -> DOCX
```

The drag system must identify the source semantically and let the destination decide what the drop means. Do not let the browser's default `<img>` drag behavior masquerade as an external file ingest.

## P0 simplification: remove the global `Drop into FrameChute` overlay UI

The user has repeatedly reported that the global `Drop into FrameChute` overlay itself creates confusion, false positives, and drag arbitration bugs. Treat this as a product simplification, not another conditional CSS patch.

**For this stabilization pass, retire/remove the global full-workspace `Drop into FrameChute` overlay presentation entirely.**

Keep drag/drop functionality. Remove the global overlay as a visual/stateful participant in drag ownership.

Required behavior:

```text
Hover/drag over DOCX frame or editor -> global overlay impossible
Hover/drag over PDF frame or editor  -> global overlay impossible
Pick up any image already in FrameChute -> global overlay impossible
Move/reorder an internal image -> global overlay impossible
Drag internal image across workspace/documents -> global overlay impossible
External OS/browser image -> drop handling still works, without the global overlay
```

If a destination needs feedback, use local destination-scoped feedback only, such as a DOCX/PDF drop-target outline, and only while that destination owns the drag. Do not replace the global overlay with another full-workspace modal layer.

This is intentionally stronger than `shouldShowGlobalIngest()` suppression. Codex should separate **drop capability** from **global overlay presentation** so a misclassified drag can no longer flash a giant ingest UI.

Search for all code/CSS that creates, toggles, or styles the overlay (`is-drop-target`, `Drop into FrameChute`, global drag depth, ingest overlay pseudo-elements, etc.). Remove or neutralize only the overlay presentation/state coupling while preserving actual external drop ingestion.

### Acceptance for overlay retirement

- Drag an internal workspace image around for at least 10 seconds: no overlay, no flash.
- Drag a DOCX embedded image inside/outside the DOCX: no overlay, no flash.
- Drag a PDF editable image inside/outside the PDF: no overlay, no flash.
- Drag an external OS image over blank workspace, DOCX, and PDF: no global overlay; destination handling still works.
- Merely hovering the pointer over a DOCX/PDF frame with no drag can never create overlay state.
- Canceled drags leave no stale `is-drop-target`/drag-depth state.

## Current failure: internal image origin is not uniformly registered

Relevant files after reconciling latest `main`:
- `src/drag-ownership.mjs`
- `src/web-drop.js`
- `src/drop-local-sources.js`
- `src/workspace.js`
- `src/documents/pdf-document.js`

The current ownership helpers were written to suppress the global overlay when a drag is registered as internal. The DOCX renderer creates ordinary `<img data-docx-relationship>` nodes, and the PDF renderer creates `.pdf-image-edit` DOM, but these document-local image nodes are not all guaranteed to call the same `beginInternalDrag(...)` primitive before native HTML drag begins.

Even after removing the overlay presentation, this ownership bug still matters because an embedded `<img>` can otherwise be mistaken for new external material and routed to generic workspace ingest. So remove the overlay **and** fix semantic drag ownership. Do not treat overlay removal as permission to leave duplication/routing bugs underneath.

## Build one internal image drag descriptor

Extend/reuse the existing drag ownership session rather than inventing DOCX/PDF-specific side channels.

The session should be able to describe at least:

```js
{
  kind: "image",
  originKind: "workspace" | "docx" | "pdf",
  originBlock,
  originObjectId,
  sourceBlobProvider,
  mode: "native-drag"
}
```

Names can differ, but the semantics must exist. `sourceBlobProvider` must return actual image bytes, never marker text or rendered screenshots unless the source truly has no better canonical bytes.

The DataTransfer marker should identify this as a FrameChute-internal image drag even if browser event ordering temporarily makes the in-memory session unavailable. Preserve the #54 native `dragstart -> pointercancel -> drop/dragend` lifecycle fix.

## Destination semantics

Use destination ownership, not source DOM quirks.

### Same-container drag = MOVE

- DOCX image -> another location in the same DOCX: move/reinsert the same semantic image at the caret/drop position. Preserve the existing relationship/part when possible. Do not call the generic workspace ingest path. Do not create a second FrameChute frame.
- PDF editable image -> another location in the same PDF: update that image edit object's PDF geometry. Do not duplicate it and do not create a workspace frame.
- Workspace image -> workspace: move the existing FrameChute object using workspace manipulation; do not ingest it as a new file.

A same-container move should be one undoable action where the document has history.

### Cross-container drag = COPY by default

To preserve the non-destructive law established in PR #54, crossing a document/workspace boundary copies the image by default:

- workspace -> DOCX/PDF: original workspace image remains;
- DOCX/PDF -> workspace: create exactly one workspace image from the canonical image bytes; the document image remains;
- DOCX -> PDF or PDF -> DOCX: insert exactly one image in the destination; source remains.

Do not silently delete the source across format boundaries. A future explicit modifier/command may offer destructive transfer, but do not invent it in this pass.

This gives the user interchangeable drag/drop without surprising data loss while keeping same-document rearrangement as a true move.

## DOCX image source details

The DOCX model already knows embedded image relationships/parts. For an `<img data-docx-relationship data-docx-part ...>`:

- make the image a deliberate FrameChute drag source;
- begin an internal image drag on `dragstart`;
- resolve its bytes from the DOCX model's part (`model.parts[part]`) and MIME metadata;
- preserve relationship/part when moving within the same DOCX;
- only allocate a new DOCX image relationship when copying in from another source/document;
- dropping elsewhere in the same DOCX must reposition/reinsert the same image DOM/model object at the resolved caret, not route to workspace ingestion.

The current `contentEditable=false` choice is fine for preventing text editing inside an image, but it must not mean the image is immovable.

## PDF image source details

The PDF editor already supports image **destination** behavior for PNG/JPEG and represents inserted images as canonical `kind:"image"` edit objects with MIME, bytes/base64 and PDF geometry. That is enough to make FrameChute-inserted PDF images first-class drag sources immediately.

Required for inserted/editable PDF images:
- drag within same PDF updates geometry at the drop point;
- drag out to workspace emits the original image Blob and creates one workspace image;
- drag into DOCX emits the image Blob and inserts once;
- drag between PDFs inserts once in the destination;
- source remains for cross-container copy.

For images that already existed in the original PDF before FrameChute editing: promote them to draggable/extractable image objects only when their underlying raster bytes and geometry can be resolved confidently. Do not fake image extraction by screenshotting an arbitrary page region and pretending it is the original embedded asset. If full original-PDF image extraction cannot be completed safely in this run, make that limitation explicit in the handoff while fully solving inserted/editable PDF images.

## Drop arbitration order

At every drag event, resolve in this order:

```text
1. Is this a FrameChute-internal drag?
   YES -> generic external ingest is forbidden.

2. Is there a local document/workspace destination under the pointer that can claim the image?
   YES -> that destination owns the drop and may show local feedback only.

3. If the drag is internal and no document claims it, is the destination the workspace?
   YES -> either move existing workspace source or materialize one workspace image copy from a document source.

4. Only genuinely external drags reach generic ingest.
```

There is no global ingest-overlay stage in this arbitration model.

Do not infer `external` merely because `DataTransfer.items` contains image-like payloads. Browser-native dragging of an `<img>` can create transferable data for an image that is already internal.

## Acceptance matrix

Exercise all of these, ideally with browser tests plus pure ownership tests:

```text
A. workspace image drag around workspace for 10s
   -> no global overlay exists/flashes
   -> same object moves
   -> no duplicate

B. workspace image -> DOCX
   -> no global overlay
   -> inserts exactly once
   -> source workspace image remains

C. workspace image -> PDF
   -> no global overlay
   -> inserts exactly once
   -> source workspace image remains

D. DOCX embedded image -> another place in SAME DOCX
   -> image moves/reorders at drop point
   -> no workspace frame created
   -> no duplicate relationship when avoidable
   -> save/reopen keeps new position

E. DOCX embedded image -> workspace
   -> no global overlay
   -> exactly one workspace image created from real embedded bytes
   -> source DOCX image remains

F. DOCX embedded image -> PDF
   -> exactly one PDF image inserted
   -> source remains

G. PDF inserted/editable image -> another place in SAME PDF
   -> same image edit changes geometry
   -> no workspace frame
   -> save/reopen keeps new position

H. PDF inserted/editable image -> workspace
   -> exactly one workspace image created from its image bytes
   -> source PDF image remains

I. PDF inserted/editable image -> DOCX
   -> inserts exactly once
   -> source remains

J. external OS image -> workspace/DOCX/PDF
   -> external ingest/drop behavior still works
   -> no global full-workspace overlay
```

Also verify canceled native drags clean up ownership, and that no drag can leave the workspace stuck in stale drop-target state.

## Architectural target

Do not think of this as three bespoke features called "drag image into DOCX", "drag image into PDF", and "drag image out". The reusable primitive is:

```text
IMAGE OBJECT
    -> canonical bytes
    -> origin descriptor
    -> internal drag ownership
    -> destination claims operation
```

The overlay is not part of this primitive.

That same primitive should later work for WEBX, Canvas, presentations, and other structured surfaces.
