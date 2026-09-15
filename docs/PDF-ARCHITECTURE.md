# PDF subsystem inventory and architecture

This inventory records the Milestone 1 boundary; it is not a new file format.

## Current paths

- `documents/pdf-document.js` owns PDF.js loading/rendering/text extraction and
  pdf-lib byte transformations/serialization. Original bytes remain the source
  for native PDF output; overlays compile to ordinary PDF text/images.
- `documents/pdf-geometry.js` is the sole PDF-point ↔ PDF.js viewport boundary.
  Workspace edits remain in PDF points and never store CSS pixels or zoom.
- `workspace.js` is the PDF object controller: current page/view state,
  selection, history, drop ownership, save integration, and compact controls.
- `workspace.html` and `workspace.css` provide the toolbar, page surface, canvas,
  selectable text/edit overlay, and reader panels.
- `pdf-popdowns.js` keeps toolbar popovers usable outside clipped objects.
- `live-state.js`, workspace capture/restore, and native document save preserve
  page/edit state and reconnect the original file without making the PDF depend
  on FrameChute metadata.

## State ownership

Each runtime owns immutable source `model.bytes`, a PDF.js document, PDF-space
`edits`, one coalesced edit history, current render task, and ephemeral viewer
state (page, zoom/fit mode, search, and panels). Workspace capture persists the
useful viewer/edit state; final PDF serialization never writes proprietary
viewer state.

## Preservation boundary

Rendering and text inspection use PDF.js. Editing starts from the original
bytes and uses pdf-lib. An untouched PDF is not rewritten. Operations that do
rewrite bytes must be explicit (page operations, crop, compression, or saving
edits); unknown structures must not be intentionally flattened or rasterized.
Encryption-preserving edits and cryptographic-signature guarantees are not yet
supported and must not be implied by the UI.
