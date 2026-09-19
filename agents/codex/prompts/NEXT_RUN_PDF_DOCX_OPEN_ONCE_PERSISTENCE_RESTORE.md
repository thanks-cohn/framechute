# CODEX RUN: PDF/DOCX open-once persistence and automatic recovery

**Priority: release-blocking bug.** Project: SUBSTRATE / FrameChute.
**Task:** Implement a focused, regression-tested fix on a dedicated branch, open a PR, and do not merge it automatically.
**Do not implement archive/IMX proposals, redesign the editor, or broaden browser permissions.**

## User-reproduced defect

The user opens PDFs and DOCX documents in SUBSTRATE, leaves/closes the extension, and on returning has to reconnect the SAME files. This happens even when the originals are in an ordinary subdirectory rather than a restricted Chrome location. Images reportedly restore better. No normal return to the app should require picking the same unchanged PDF/DOCX again.

This is **not** a request to move files, rename the Reconnect button, silently automate a picker, or simply request the browser's permissions again. Chrome may revoke a remembered handle; a persistent **working copy and editing state** should still let the editor reopen independently, while saving over the original remains correctly permission-gated.

## Relevant code to inspect before edits

- `src/workspace.js`: `storedReadableHandle` near lines 187–192 returns null when a handle's read permission is no longer granted; `reconnectSource`; `loadPdfHandle` and `loadPdfBytes` near 839–850; PDF `capture`/`restore` near 1299–1312; `loadDocxHandle` near 1749; DOCX `capture`/`restore` near 1858–1859; `captureWorkspace`, `restoreWorkspace`, `createBlock`; document-specific file picker and generic open-document route near 2194–2215 and 2283–2303.
- `src/file-access.js`: synthetic images persist their Blob in IndexedDB, but synthetic PDF/DOCX and other sources commonly remain transient; native file handles are remembered without a content fallback.
- `src/persistence.js`: IndexedDB `snapshots`, `handles`, and `content` stores.
- `src/live-state.js`: live snapshot capture and restore; note its current `captureState` records only PDF page and returns an empty state for DOCX. Assess how unsaved edits and full working-copy content can be preserved through the *live* path without dangerous async capture races or duplicating files in every snapshot.
- `src/workspace-ingestion.js`: generic Open File obtains native handles and forwards only File objects via routeFiles. Inspect drop, clipboard, generated-document, and file-dialog paths.
- `src/reconnect-all.js`, `src/archive-bridge.js`, `src/archive.js`, `src/filechute-export.js`, and `docs/CODEX_DURABLE_PERSISTENCE.md`: preserve existing optional durable-folder / FCX behaviors. The documentation is aspirational; verify what is actually implemented.
- `bugs/latest/2026-09-19_pdf-docx-reconnect-on-reopen-critical.md`: user report and acceptance requirements.

Search all other callers and relevant tests before changing the persistence contract. Do not assume all currently opened files have a usable native FileSystemHandle.

## Implementation outcome, not a prescribed patch

1. On first open/ingest, preserve a restorable PDF/DOCX source or current working copy in browser-managed persistent storage (or existing opted-in external durable folder), plus stable document ID and complete editor state. Keep original-file handle as an optional link for Save back to source, not as the only path for viewing/editing.
2. Restore after browser/extension close with **no picker and no forced Reconnect**, including when the persisted handle's `queryPermission({mode:"read"})` becomes `prompt` or `denied`, so long as working-copy bytes remain available. Avoid triggering a permission prompt merely to reopen a stored copy.
3. Preserve existing PDF edits/overlay geometry and current page, DOCX edits/formatting/embedded-image parts, workspace frame position/size and clean/dirty state. Inspect how `runtime.serialize`, source bytes, and in-memory model relate; do not lose unsaved edits or write stale bytes. Distinguish autosaved working state from an explicit Save to original file.
4. Apply the same persistence contract to PDF/DOCX opened through document-specific pickers, generic Open File, drag/drop, generated/imported documents, and restore from existing snapshots. Migrate old snapshots/handles without invalidating them. On one-time relink of a legacy snapshot, capture the working copy so subsequent opens work.
5. Respect storage and low-disk constraints: don't indiscriminately copy giant videos/galleries or write a new full document blob on every mouse movement. Debounce/serialize document checkpoints as necessary, store bytes once until changed, monitor browser quota, and report when persistence fails rather than silently claiming that the document will restore. Preserve opt-in durable-folder and exported FCX semantics, and be candid about browser-data deletion.
6. Reading a saved working copy must not imply permanent permission to overwrite an original. For explicit Save to source, ask for write permission within user activation when required; provide Save As if unavailable. Never overwrite an externally changed original without conflict handling. Keep all source files unmodified by mere open/restore/autosave.
7. The Reconnect button remains a last-resort recovery for genuinely unavailable original AND working-copy bytes, not a routine reopen path. Error messaging should distinguish missing original, denied write permission, lost browser storage, failed checkpoint, and unrecoverable corruption.
8. Keep change focused, document the actual root cause(s), and preserve unrelated image, PDF, DOCX rendering, menu/toolbar, and frame behaviors.

## Tests (required before PR)

- Open PDF and DOCX from an ordinary subdirectory; make changes; close extension/restart browser; reopen: both load directly with edits, embedded DOCX images, PDF page, and frame state preserved; no Reconnect.
- Repeat with generic Open File and drag-and-drop pathways. Ensure synthetic source persistence and native handle persistence both work. Verify normal image handling does not regress.
- Force `queryPermission` to return `prompt` or `denied` for stored original handles while the working-copy source exists. Reopening should succeed without requesting permission; explicit Save-to-original must honor browser security.
- A DOCX with embedded media and a PDF with nonstructural live overlays restore correctly and export as valid files. Check that DOCX parts and layout remain intact; don't confuse 'restores text on screen' with actually preserving save fidelity.
- Named workspace snapshot, live autosave, FCX import/export, and configured durable-folder behavior are not degraded. Tests should cover interrupted/failed checkpoint and quota failure; never report a successful durable save when one did not happen.
- Run available project test suite and targeted new automated tests; report actual pass/fail counts and any browser/manual tests that remain unverified. Capture a concise before/after user-facing verification procedure. Do not merge until the PR demonstrates the acceptance criteria.

**Ship gate:** After opening a PDF or DOCX once, a user can leave SUBSTRATE and return to the same document without reconnecting the unchanged original, provided normal browser storage remains intact. This is a practical browser-extension guarantee, not a claim to bypass browser permissions or survive deliberate deletion of every stored copy.
