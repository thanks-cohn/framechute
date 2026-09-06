# Quick Actions utility architecture (Part 1)

FrameChute's utility layer follows **select → act → save/result**. Clicking a block selects it; Shift/Ctrl/Command-click adds or removes blocks, and right-click selects without beginning a drag. The contextual bar only asks the action registry for actions applicable to the current selection.

## Extension points

- `actions/action-registry.js` owns registration, applicability, invocation, progress, cancellation, and bounded batch execution. Part 2 actions should register here rather than add another menu dispatch switch.
- `actions/selection-model.js` is object-agnostic and supports single, homogeneous batch, and mixed selections. Utility blocks register through `FrameChuteWorkspace`, so creation, movement, duplication, capture, FCX export, and restore use the built-in lifecycle.
- `actions/native-save.js` normalizes names and serializes before creating/truncating a writable destination. Native Save As remains separate from FCX **Export Workspace**.
- `framechute:add-result-object` is the result bridge. Extraction/generation dispatches a Blob and `web-drop.js` creates a normal image object that is immediately selectable and editable.
- `actions/image-operations.js` bakes non-destructive crop/size/rotation/flip/straighten/background/format state only when saving or generating a result.
- `actions/data-utilities.js` provides local CSV tables and eagerly decoded ZIP/CBZ entry browsing guarded by advertised per-entry, cumulative expanded-size, and entry-count limits.

## Part 1 delivered

- Image: visual non-destructive crop, resize/batch resize, rotate, flip, straighten, basic perspective, color transparency, privacy blur/pixelate, annotation, alpha-margin trim/background fill, PNG/JPEG/WebP conversion/compression, metadata-stripping re-encode, stitching, contact sheets, icon generation, comparison, images-to-PDF, and native Save As.
- Video: current decoded frame extraction into a first-class image result.
- Files: rename/batch sequential rename, workspace duplicate, and ZIP creation from a selection.
- PDF: page rotate/delete/duplicate/reorder/extract, insert/merge, pages-to-PNG results, margin crop, and conservative structural compression with native Save and Save As.
- CSV: quoted parsing/serialization, editable cells, add row, sort, filter/find, exact duplicate removal, and Save As CSV.
- ZIP/CBZ: bounded local listing, common document/media routing into durable result objects, CBZ URL cleanup, and a real Save As fallback for unsupported entries.

## Honest Part 1 limits / Part 2 backends

Browser canvas cannot safely demux or encode arbitrary media, so extract-audio and permanent trim/mute/speed remain disabled until a packaged local backend exists. True move is not advertised because the browser cannot atomically move arbitrary handles; Copy To is provided and never deletes the source. Perspective correction is an intentionally modest trapezoid-oriented v1. Aggressive PDF image recompression is not claimed. No action fakes a successful conversion.
