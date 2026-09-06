# Internal drag overlay suppression + image edit Undo/Redo

## Context

Two small but important UX correctness issues remain on current `main` after the DOCX image/drop hardening work.

### Issue A — moving existing FrameChute objects triggers the external drop overlay

When the user grabs or moves an image/object already inside FrameChute, the global `Drop file inside FrameChute` overlay appears even though no new file is being imported.

The current global ingestion code in `src/web-drop.js` unconditionally adds `workspace.is-drop-target` on workspace `dragenter` and `dragover`. Existing images can also start browser-native drag behavior unless explicitly prevented, which can make an internal move look like an external URL/file drag.

This must be corrected without breaking the new DOCX nested image-drop ownership behavior.

### Issue B — image editing has Undo but no proper Redo

`src/image-edit/paint-runtime.js` already snapshots paint state before a brush/bucket/erase action and has a bounded `runtime.history` plus an Undo button. There is no redo stack, no Redo button, and no standard keyboard shortcuts.

Image Editing is supposed to be reversible. A user should be able to make an edit, undo it, and redo it without losing the working image state.

---

# Product rules

> Internal movement is not ingestion.

> Image Editing is reversible while you work.

---

# 1. External file-drop overlay must appear only for real ingestion drags

The global `Drop file inside FrameChute` overlay must NOT appear while the user is:

- grabbing/moving an existing image
- grabbing/moving any existing workspace object
- dragging an internal FrameChute control or handle
- resizing an object
- selecting/marqueeing
- interacting with image editing tools
- moving video/audio/media already in the workspace

It SHOULD still appear for real external ingest drags that the workspace can accept, including supported files and supported URL/text drags from outside FrameChute.

## Required implementation behavior

### A. Prevent accidental native dragging of workspace media

Where FrameChute movement is pointer-based, visible internal media should not also initiate native HTML drag behavior.

At minimum ensure relevant workspace images/media use `draggable = false` / equivalent where native browser drag is not an intended FrameChute feature.

Do not disable legitimate external drag/drop ingestion.

### B. Gate the global overlay

Refactor the unconditional `workspace` `dragenter` / `dragover` overlay logic in `src/web-drop.js` behind a helper that determines whether the current drag is a legitimate ingestion candidate.

Do not add `workspace.is-drop-target` merely because *some* drag event crossed the workspace.

The helper should inspect `DataTransfer.items`, `DataTransfer.files`, and supported textual/URL drag types as appropriate.

Internal FrameChute direct-manipulation gestures must fail this ingestion test.

### C. Preserve DOCX nested drop ownership

The recently merged DOCX behavior remains authoritative:

- external image drag over a `.docx-editor` is claimed by the DOCX editor
- DOCX drop target styling may appear
- global workspace drop styling is suppressed
- drop inserts the image into the DOCX exactly once
- no duplicate standalone workspace image is created

Do not regress this while fixing the global overlay.

### D. Clear stale overlay state robustly

If an ingest drag leaves/cancels/drops, `is-drop-target` must clear reliably.

Do not allow `dragDepth` bookkeeping to leave the overlay stuck because nested child enter/leave events became unbalanced.

Prefer robust target/ownership logic over simply incrementing/decrementing a counter if the current counter is the source of stale state.

## Acceptance cases

1. Grab existing FrameChute image and move it around → no `Drop file inside FrameChute` overlay.
2. Grab existing video/object → no global ingest overlay.
3. Resize existing object → no global ingest overlay.
4. Drag image file from OS into empty workspace → global drop overlay appears and import works once.
5. Drag image file from OS over DOCX editor → DOCX target owns the drag, global overlay is hidden, exactly one DOCX image is inserted.
6. Drag supported URL/image URL from outside FrameChute into workspace → ingestion remains functional.

---

# 2. Image Editing needs first-class Undo AND Redo

Current `paint-runtime.js` has a bounded undo history. Extend this into a normal two-stack edit history.

## UI

In the image paint toolbar expose compact controls:

`Undo`  `Redo`

Keep them near Brush / Bucket / Erase controls and before Done.

Buttons must reflect availability:

- Undo disabled when there is nothing to undo
- Redo disabled when there is nothing to redo

Do not make them fake-enabled controls.

## Behavior

Use bounded history to avoid runaway RAM usage.

Recommended model:

- `undoStack`
- `redoStack`
- maximum depth roughly aligned with the existing history limit (24 is fine unless there is a reason to tune it)

Before every mutating paint action:

1. capture current overlay state into Undo
2. perform mutation
3. clear Redo because a new branch of history has begun

Undo:

1. capture current state into Redo
2. restore the latest Undo state

Redo:

1. capture current state into Undo
2. restore the latest Redo state

This applies to at least:

- brush stroke
- erase stroke
- bucket fill

A continuous pointer stroke counts as one undoable operation, not hundreds of history entries for every pointermove.

## Keyboard shortcuts

While Image Editing is active and focus is not in a text/input field:

- Ctrl+Z / Cmd+Z → Undo
- Ctrl+Shift+Z / Cmd+Shift+Z → Redo
- Ctrl+Y → Redo where conventional

Do not hijack these shortcuts globally when image editing is not active.

Do not interfere with text editing inside DOCX/text fields.

## Mode toggling

Turning `Image Editing [ OFF ]` must continue to preserve edits.

Turning editing ON again during the same live object/session should retain usable Undo/Redo history if the runtime still exists.

Do not discard the paint layer simply because editing mode was toggled OFF.

Snapshot/FCX persistence must continue preserving the current edited image result. Persisting the entire undo/redo stack across a full reload is NOT required for this pass unless it falls out naturally without large storage cost.

## Resource discipline

Image snapshots can be expensive for large images.

Keep history bounded and release history state when the image object/runtime is actually destroyed.

Do not create unbounded full-resolution history arrays.

## Acceptance cases

1. Draw one stroke → Undo restores prior image → Redo restores stroke.
2. Draw stroke A, stroke B → Undo twice → Redo twice returns to exact latest state.
3. Undo once, then make a new stroke → Redo is cleared.
4. Bucket fill is undoable/redoable.
5. Erase is undoable/redoable.
6. One long pointer stroke produces one undo step.
7. Image Editing OFF/ON does not destroy edits and does not unnecessarily destroy live-session history.
8. Keyboard shortcuts work only while image editing is active and do not steal input from DOCX/text fields.

---

# Testing

Add focused tests where practical for history-stack semantics and drag-ingestion classification helpers.

Run:

- focused tests for new helpers/history behavior
- `node --test tests/*.test.mjs`
- `node --check` on changed JS modules
- `git diff --check`
- Chrome Web Store packaging/release gate

Manual/browser acceptance is important for drag/drop because synthetic drag events do not perfectly reproduce Chromium native drag behavior. Record what was and was not manually verified.

# Scope discipline

Keep this a compact correctness pass.

Do NOT use this task to implement FrameChute tabs, URL sleeping tabs, bottomless history, FrameSnap, Warp, or unrelated office-suite work.

Preserve the current spatial rule:

> The viewport moves. The artwork does not.
