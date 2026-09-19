# Critical bug: PDF/DOCX demand Reconnect after leaving SUBSTRATE even when source files are still in place

Status: Confirmed user-visible reproduction; code-path diagnosis from current main (root cause has not yet been runtime-verified)
Severity: Launch-blocking persistence / workflow continuity
Scope: PDF and DOCX first; audit other file-backed frames separately

## Actual user report

A user opens and works with PDFs or DOCX in SUBSTRATE, leaves/closes the extension, then returns and is required to Reconnect the same documents. Moving the files out of potentially restricted Chrome locations into an ordinary subdirectory **does not fix the issue**. Image sources reportedly restore more reliably. The user expects open-once, return-and-continue document behavior without repeated picking or reconnection.

Do not dismiss or close this as a file location problem, and do not suggest relocating documents as the fix.

## Relevant implementation findings (main as inspected 2026-09-19)

- src/workspace.js:187-192 storedReadableHandle(source) returns null unless a remembered handle exists **and** hasReadPermission(handle) reports granted.
- src/workspace.js:1304-1312 PDF restore reads embeddedBlob/base64 only when available, else readable handle, else shows Reconnect; src/workspace.js:1299-1301 captures original PDF bytes in embeddedBlob only when no source record or structurally dirty.
- src/workspace.js:1858-1859 DOCX capture sets embeddedBlob to null when a source record exists. Its restore attempts an embedded blob, else a readable handle, else shows Reconnect, even though an intermediate editor state may already exist.
- src/file-access.js persists synthetic **images** as actual blobs in IndexedDB, whereas other synthetic file blobs are transient; native handles are persisted, but their file bytes are not guaranteed to be.
- src/workspace-ingestion.js: openFiles obtains native handles via showOpenFilePicker, then passes only File objects into routeFiles, potentially losing the persistent handle on the general Open File route.
- src/reconnect-all.js offers a manual permission request/reconnect workflow, which is a recovery feature and not acceptable as normal reopen behavior.
- docs/CODEX_DURABLE_PERSISTENCE.md already identifies IndexedDB-vs-external durable storage and that handles alone cannot serve as complete content recovery. Check implemented behavior independently; documentation is not evidence that the fix shipped.
- src/live-state.js:captureState only captures the PDF page and returns {} for DOCX. Verify that background live autosave also preserves actual document content/unsaved edits via the canonical workspace capture path rather than silently restoring only a source reference.

These are implementation risk factors, not proof that every reproduction shares one exact root cause. Instrument restore reason, source ingestion path, available persistent bytes, handle lookup, and permission state.

## Required user-visible behavior

1. After the user opens a PDF/DOCX once, returning to SUBSTRATE in the same browser profile should restore a recoverable working copy and its current editing state without asking to select the same original again, subject to clear storage/quota guarantees. Preserve current page, layout, edits, unsaved changes, and existing frame geometry.
2. Keep a robust persisted working copy for normal-sized documents (e.g. browser-managed IndexedDB/OPFS) at ingest/open, not only a path or a permission-dependent FileSystemHandle. If a durable external project folder is configured, follow its existing storage contract. Do not silently claim success if persistence failed. Do not make a full duplicate of large media by default; expose explicit storage choices and size/quota warnings.
3. On restore, prefer verified current edit state/working copy, then any still-granted original source, then explicit recoverable fallbacks. Distinguish missing bytes, storage failure, permission needed to write original, actual missing file, corrupt file, and user-denied access. Only show manual Reconnect after all safe recovery paths fail.
4. FileSystemHandle permission to **write to the original file** is distinct from the ability to continue editing a persistent working copy. Browser permission prompts may be unavoidable for overwriting the original after permission loss; do not promise to bypass browser security. Permit explicit Save As/export of the local working copy regardless.
5. Never overwrite the original automatically or replace it with stale working-copy bytes. Detect external-source modification and resolve conflicts visibly. Do not lose unsaved edits, embedded DOCX image relationships, or PDF editor overlays.
6. General Open File picker, document-specific pickers, drag-and-drop, generated document, imported workspace, and relink workflows should converge on the same canonical source/working-copy persistence contract, including stable IDs.
7. Avoid unrelated editor refactors, PDF rendering changes, CSS/frame changes, format rewrites, or permission broadening. Build a focused PR with tests before merge.

## Regression / acceptance tests

- Open a regular PDF and DOCX from an ordinary user subdirectory, edit, close extension, reopen browser/extension: both render immediately with current edits. Do not pick them again.
- Repeat for general Open File and drag-and-drop paths (native handles and synthetic File objects); image recovery must remain intact.
- Force remembered handle queryPermission to return prompt or denied after restart while cached working copy remains available: document still opens and edits locally. Confirm original-file Save requests permission appropriately or falls back to Save As; never silently fails.
- Close the extension before a delayed workspace autosave; verify last acknowledged save/checkpoint survives and incomplete writes are reported. Test profile crash, browser restart, and quota error without false success.
- Delete browser site/extension storage: if durable external content is configured, restore it using the documented recovery path; if no durable copy exists, report honest recovery limits. Do not claim universal persistence across deliberate storage deletion.
- Reopen DOCX with embedded images and PDF with live edits; verify media, formatting, page number, selections, and save/export fidelity.
- Confirm large-file handling does not silently exhaust storage or create mandatory giant duplicates and preserves fallback/reference-only options where explicit.

**Release criterion:** Reconnecting an unchanged original PDF/DOCX after an ordinary extension close/reopen is an exceptional recovery action, never the expected workflow.
