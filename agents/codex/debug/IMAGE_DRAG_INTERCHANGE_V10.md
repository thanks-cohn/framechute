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

## P0 presentation law: DOCX/PDF and internal-image movement are overlay-free

The user does NOT want another overlay, drop panel, modal wash, giant highlight, or replacement drag UI while moving images inside documents.

Required behavior:

```text
Hover/drag over DOCX frame or editor -> NO Drop into FrameChute overlay
Hover/drag over PDF frame or editor  -> NO Drop into FrameChute overlay
Pick up any image already in FrameChute -> NO Drop into FrameChute overlay
Move/reorder an image inside DOCX -> direct movement only
Move/reposition an image inside PDF -> direct movement only
```

Do not "fix" the old global overlay by replacing it with a new DOCX/PDF overlay or a large local drop-target layer. The document should simply accept and move the image. A subtle cursor/dropEffect is sufficient if feedback is needed; do not add another visual overlay system.

The global workspace overlay may remain only for genuinely external material over blank/general workspace if the existing product still wants it. It must never activate over DOCX/PDF surfaces and never activate for a drag whose source already belongs to FrameChute.

This means overlay eligibility must be constrained by BOTH source and destination:

```text
source is internal FrameChute object -> overlay forbidden everywhere
destination is DOCX/PDF surface      -> overlay forbidden regardless of source
genuinely external drag + blank workspace -> existing workspace ingest UI may remain
```

### Acceptance

- Drag an internal workspace image around for at least 10 seconds: no global overlay, no flash.
- Drag a DOCX embedded image up/down inside the DOCX: image moves at the caret/drop location; no overlay; no workspace frame is spawned.
- Drag a PDF editable image around inside the PDF: same image geometry moves; no overlay; no duplicate.
- Drag an external OS image over DOCX/PDF: document may accept the image, but no global or document overlay appears.
- Drag an external OS image over blank workspace: existing external-ingest presentation may remain if otherwise desired.
- Canceled drags leave no stale `is-drop-target`/drag-depth state on documents.

## Current failure: internal image origin is not uniformly registered

Relevant files after reconciling latest `main`:
- `src/drag-ownership.mjs`
- `src/web-drop.js`
- `src/drop-local-sources.js`
- `src/workspace.js`
- `src/documents/pdf-document.js`

The current ownership helpers suppress the global overlay only when a drag is registered as internal. The DOCX renderer creates ordinary `<img data-docx-relationship>` nodes, and the PDF renderer creates `.pdf-image-edit` DOM, but these document-local image nodes are not all guaranteed to call the same `beginInternalDrag(...)` primitive before native HTML drag begins.

If an embedded `<img>` starts the browser's ordinary native image drag without a FrameChute internal session/marker, the global workspace router can mistake it for new external material. That is why the overlay can appear and why dropping a DOCX image can accidentally create a new workspace frame instead of moving the existing document image.

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

This is the user's immediate goal.

- DOCX image -> another location in the same DOCX: move/reinsert the same semantic image at the caret/drop position. Preserve the existing relationship/part when possible. Do not call generic workspace ingest. Do not create a second FrameChute frame.
- PDF editable image -> another location in the same PDF: update that same image edit object's PDF geometry. Do not duplicate it and do not create a workspace frame.
- Workspace image -> workspace: move the existing FrameChute object using workspace manipulation; do not ingest it as a new file.

A same-container move should be one undoable action where the document has history.

### Cross-container drag = COPY by default

Cross-container interchange is useful, but secondary to making same-document movement boring and reliable.

- workspace -> DOCX/PDF: original workspace image remains;
- DOCX/PDF -> workspace: create exactly one workspace image from canonical bytes; document source remains;
- DOCX -> PDF or PDF -> DOCX: insert exactly one image in the destination; source remains.

Do not silently delete the source across format boundaries.

## DOCX image source details

The DOCX model already knows embedded image relationships/parts. For an `<img data-docx-relationship data-docx-part ...>`:

- make the image a deliberate FrameChute drag source;
- begin an internal image drag on `dragstart`;
- resolve its bytes from the DOCX model's part (`model.parts[part]`) and MIME metadata;
- preserve relationship/part when moving within the same DOCX;
- only allocate a new DOCX image relationship when copying in from another source/document;
- dropping elsewhere in the same DOCX must reposition/reinsert the same image DOM/model object at the resolved caret;
- do not spawn a workspace frame when the user is merely moving the picture up/down in the DOCX.

The current `contentEditable=false` choice is fine for preventing text editing inside an image, but it must not mean the image is immovable.

## PDF image source details

The PDF editor already supports image destination behavior for PNG/JPEG and represents inserted images as canonical `kind:"image"` edit objects with MIME, bytes/base64 and PDF geometry. That is enough to make FrameChute-inserted PDF images first-class drag sources immediately.

Required for inserted/editable PDF images:
- drag within same PDF updates the same image object's geometry at the drop point;
- no overlay while doing so;
- drag out to workspace emits the original image Blob and creates one workspace image;
- drag into DOCX emits the image Blob and inserts once;
- drag between PDFs inserts once in the destination;
- source remains for cross-container copy.

For images that already existed in the original PDF before FrameChute editing: promote them to draggable/extractable image objects only when their underlying raster bytes and geometry can be resolved confidently. Do not fake image extraction by screenshotting an arbitrary page region and pretending it is the original embedded asset.

## Drop arbitration order

At every drag event, resolve in this order:

```text
1. Is the pointer over DOCX/PDF?
   YES -> global ingest overlay is forbidden.

2. Is this a FrameChute-internal image drag?
   YES -> global ingest overlay is forbidden everywhere.

3. Can the local destination claim the image?
   YES -> destination performs move/copy directly, with no replacement overlay UI.

4. Only genuinely external drags over non-document workspace may reach generic ingest presentation.
```

Do not infer `external` merely because `DataTransfer.items` contains image-like payloads. Browser-native dragging of an `<img>` can create transferable data for an image that is already internal.

## Acceptance matrix

Exercise all of these, ideally with browser tests plus pure ownership tests:

```text
A. workspace image drag around workspace for 10s
   -> no overlay flash
   -> same object moves
   -> no duplicate

B. workspace image -> DOCX
   -> no overlay over DOCX
   -> inserts exactly once
   -> source workspace image remains

C. workspace image -> PDF
   -> no overlay over PDF
   -> inserts exactly once
   -> source workspace image remains

D. DOCX embedded image -> another place in SAME DOCX
   -> image moves/reorders at drop point
   -> no overlay
   -> no workspace frame created
   -> no duplicate relationship when avoidable
   -> save/reopen keeps new position

E. DOCX embedded image -> workspace
   -> no overlay during internal drag
   -> exactly one workspace image created from real embedded bytes
   -> source DOCX image remains

F. DOCX embedded image -> PDF
   -> no overlay over PDF
   -> exactly one PDF image inserted
   -> source remains

G. PDF inserted/editable image -> another place in SAME PDF
   -> same image edit changes geometry
   -> no overlay
   -> no workspace frame
   -> save/reopen keeps new position

H. PDF inserted/editable image -> workspace
   -> no overlay during internal drag
   -> exactly one workspace image created from its image bytes
   -> source PDF image remains

I. PDF inserted/editable image -> DOCX
   -> no overlay over DOCX
   -> inserts exactly once
   -> source remains

J. external OS image -> DOCX/PDF
   -> document accepts it where supported
   -> no global/document overlay

K. external OS image -> blank workspace
   -> existing external workspace ingest behavior may remain
```

Also verify canceled native drags clean up ownership, and that internal/document drags never leave stale `is-drop-target` state.

## Architectural target

Do not think of this as three bespoke features called "drag image into DOCX", "drag image into PDF", and "drag image out". The reusable primitive is:

```text
IMAGE OBJECT
    -> canonical bytes
    -> origin descriptor
    -> internal drag ownership
    -> destination claims operation
```

For DOCX/PDF same-document movement, the UX should be nearly invisible: pick up image, move it, drop it. No overlay layer is part of that interaction.

That same primitive should later work for WEBX, Canvas, presentations, and other structured surfaces.
