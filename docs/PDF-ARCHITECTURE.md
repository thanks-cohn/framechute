# PDF subsystem inventory and architecture

This inventory records the Milestone 1 boundary; it is not a new file format.

## Current paths

- `documents/pdf-document.js` owns PDF.js loading/rendering/text extraction and
  pdf-lib byte transformations/serialization. Original bytes remain the source
  for native PDF output; overlays compile to ordinary PDF text/images.
- `documents/pdf-geometry.js` is the sole PDF-point ↔ PDF.js viewport boundary.
  Workspace edits remain in PDF points and never store CSS pixels or zoom.
- `documents/pdf-layout.js` is the canonical semantic page layer. It lazily
  reconstructs stable source runs, lines, conservative blocks, provenance,
  reading order, spatial queries, collision classes, and analytical free-space
  candidates in PDF points. Paint, spatial, and reading order remain separate.
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

## Semantic layout boundary

`pdf-document.js` adapts PDF.js text items into the layout layer once per page.
Layouts are held in a three-page LRU and invalidated only when that page's edit
signature changes. Derived nodes never contain PDF bytes, canvases, or DOM
references, so inactive layouts are cheap to discard and deterministic to
rebuild. The model treats the absence of PDF.js text as insufficient proof of
free space: free-space query results remain marked uncertain until non-text
operators have also been classified.

Edit-aware text extraction consumes this semantic model. A replacement owns
the source line/run it replaces and inherits that reading position even when
its visible field moves or its drawing operators are appended later. The raw
paint order remains available for rendering and diagnostics. This does not
rewrite content streams or persist a proprietary graph into saved PDFs.

## Preservation boundary

Rendering and text inspection use PDF.js. Editing starts from the original
bytes and uses pdf-lib. An untouched PDF is not rewritten. Operations that do
rewrite bytes must be explicit (page operations, crop, compression, or saving
edits); unknown structures must not be intentionally flattened or rasterized.
Encryption-preserving edits and cryptographic-signature guarantees are not yet
supported and must not be implied by the UI.
