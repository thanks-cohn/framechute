# PR #55 Stabilization Debug Map (V10)

This file is a navigation aid for Codex. It is intentionally explicit about where the user-visible regressions originate and which invariants must survive reconciliation with the latest `main`.

Also read the focused companion map:

`agents/codex/debug/IMAGE_DRAG_INTERCHANGE_V10.md`

That file is authoritative for internal image-drag semantics across workspace, DOCX, and PDF.

## Branch / sequencing law

PR #55 (`codex/implement-docx-editing-and-context-menu`) was created before PR #54 merged. Before making substantive fixes, reconcile this branch with the latest `main` and preserve the merged PR #54 drag-ownership/document-image insertion work. Do not resolve conflicts by restoring pre-#54 `workspace.js` behavior.

The merged #54 behavior that must survive:
- internal FrameChute image drags do not trigger the global ingest overlay;
- internal/OS images can be dropped into DOCX;
- internal/OS images can be dropped into PDF;
- the original workspace image remains;
- native HTML drag survives the normal post-`dragstart` pointer-cancel transition and ends at the correct drag lifecycle boundary.

## Debug anchor: internal image drag must be universal, not workspace-only

Files after reconciling latest `main`:
- `src/drag-ownership.mjs`
- `src/web-drop.js`
- `src/drop-local-sources.js`
- `src/workspace.js`
- `src/documents/pdf-document.js`

User-visible regressions:
- picking up an image that already exists inside FrameChute can still trigger the global `Drop into FrameChute` overlay;
- a DOCX embedded image can be dragged out and accidentally materialize as a new workspace frame, but cannot reliably be moved/reordered inside the same DOCX;
- PDF can receive images, but its editable images are not yet symmetric first-class drag sources that can move inside PDF or be dragged back out to workspace/DOCX.

Root architectural problem: not every image-bearing surface begins the same internal drag ownership session. Browser-native `<img>` dragging can therefore look external to the global ingest router. A destination-specific drop handler is not enough; the source also needs a canonical image descriptor and real Blob provider.

Required laws:

```text
Any image originating inside FrameChute -> internal drag -> global ingest overlay NEVER
Any drag over a DOCX/PDF editing surface -> Drop into FrameChute overlay NEVER
DOCX/PDF same-document image movement -> direct manipulation, NO replacement overlay
```

Do not solve this by inventing another DOCX/PDF drop overlay. The user wants to grab an image and move it up/down or around the document directly.

Same-container semantics:
- workspace -> workspace = move same workspace object;
- DOCX -> same DOCX = move/reorder same embedded image at drop caret, preserving relationship/part when possible;
- PDF editable image -> same PDF = update same image object's geometry.

Cross-container semantics are non-destructive copies by default:
- workspace -> DOCX/PDF leaves workspace source;
- DOCX/PDF -> workspace creates exactly one image object from canonical bytes and leaves document source;
- DOCX <-> PDF inserts exactly once and leaves source.

Do not create a workspace image when the user is merely repositioning an image inside the same document. Do not route any internal image through generic external ingest.

Read `IMAGE_DRAG_INTERCHANGE_V10.md` for the complete acceptance matrix and PDF/DOCX source-byte details.

## Debug anchor: detached context submenus

Files:
- `src/layer-menu.js`
- `src/editor-context-menu.js`
- `src/editor-context-menu.css`

Symptom: child menus appear halfway across / near the far-right side of the viewport instead of next to the row that opened them.

Likely cause: mixed containing blocks / mixed coordinate systems. The generic menu and editor menu currently combine `position: fixed`, nested positioned elements, `getBoundingClientRect()`, `offsetTop`, and viewport clamping.

Required invariant:

```text
triggerRect = trigger.getBoundingClientRect()
preferredLeft = triggerRect.right + gap
preferredTop = triggerRect.top
```

Use one reusable `positionSubmenu(trigger, submenu)` primitive. Prefer a fixed-position submenu portaled to `document.body`, or another design that uses one coordinate system exclusively. Gap should be roughly 0-8px. If right overflow occurs, flip directly to the trigger's left. If bottom overflow occurs, shift upward only enough to remain visible. Nested menus must remain visually attached. Keyboard ArrowRight/ArrowLeft/Escape must preserve focus and geometry.

Acceptance: center, right-edge, bottom-edge and nested submenu cases all remain attached to their trigger; no submenu appears detached across the screen.

## Debug anchor: Advanced OFF must omit advanced timing commands

File:
- `src/layer-menu.js`
- `src/actions/context-menu-model.mjs`

Commands that must not exist in the rendered menu while Advanced is OFF:
- Create/Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing...

Do not merely disable them. Prefer model/construction gating so Simple/Advanced-OFF users are never presented with those concepts.

## Debug anchor: Sync With capability

Files:
- `src/actions/context-menu-model.mjs`
- `src/layer-menu.js`

User law: `Sync with...` and `Make independent` exist ONLY for playable video or audio objects. Never show them on images, PDFs, DOCX, WEBX, text, SVG, canvas, gallery/static image objects, or generic workspace objects.

`supportsMediaSync()` must therefore be capability based and include real audio as well as video. Do not gate sync merely by Advanced mode or generic object presence.

Acceptance: right-click video => Sync available; right-click audio => Sync available; right-click any static/document object => no Sync entry and no sync separators.

## Debug anchor: PR #55 DOCX reconciliation

Files:
- `src/workspace.js`
- `src/documents/docx-document.js`
- `src/documents/rich-text-runs.js`
- `src/actions/context-menu-model.mjs`
- `src/editor-context-menu.js`

Preserve #55's useful DOCX work while fixing these hazards:

1. Find/Replace must never rewrite `editor.innerHTML` with raw string replacement. Operate on text nodes / canonical runs so search text cannot corrupt tags, hrefs, image relationship metadata, or other structure.
2. Parsed `strike`, `color`, and `highlight` must render back into the editor and survive editor -> canonical model -> OOXML serialization.
3. Numbering IDs are document-local. Do not assume universal `numId` 1=bullet and 2=number. Reuse compatible existing numbering definitions or allocate non-colliding definitions/IDs.
4. Preserve #54's DOCX image-drop ownership and actual-image-byte path when reconciling `workspace.js`.
5. Make existing embedded DOCX images deliberate internal drag sources. Moving an image within the same DOCX must reinsert/reorder the same semantic image at the drop caret instead of creating a new workspace frame. Dragging it across a container boundary uses the canonical embedded bytes and follows the non-destructive cross-container copy law in `IMAGE_DRAG_INTERCHANGE_V10.md`.

Acceptance: a mixed-format DOCX containing lists, links, images, strike/color/highlight and paragraph properties can be opened, edited, saved, and reopened without unrelated structural loss. Embedded images can also be moved directly up/down within the document and copied out/in across FrameChute surfaces without invoking generic ingest or any document overlay. Add regression tests for the structural hazards even if Word/LibreOffice is unavailable in CI.

## Debug anchor: PDF explicit newlines / indentation

Files:
- `src/workspace.js` PDF `keydown` + `focusout` editor handlers
- `src/documents/pdf-document.js` `wrapPdfText`, `layoutPdfText`, serialization
- `src/workspace.css` `.pdf-edit-text` / `.pdf-text-edit`

Current hazard: Enter can place `\n` in the editable DOM but the field can remain one-line tall and both preview/export clip lines to field height. Tab is currently converted to four literal spaces, destroying the distinction between a tab and spaces.

Required canonical behavior:
- Enter stores an explicit `\n`.
- Tab stores an explicit `\t`, not spaces.
- Literal spaces remain literal spaces.
- Preview and serializer share the same text layout interpretation.
- When an explicit newline requires more vertical room, grow the editable field downward while keeping its visual top fixed, unless the user explicitly resized it to a clipping constraint that should be respected.
- Wrapping must preserve leading whitespace and explicit blank lines.

PDF coordinates are bottom-left based. If a text field grows downward, preserve `top = y + height`, increase height, then recompute `y = top - newHeight`.

Acceptance: type first line, Enter, second line => both lines are visibly present and saved/reopened. Type a tab then text => canonical text contains `\t` and export visually respects a deterministic tab-stop rule. Six literal spaces remain six literal spaces.

## Debug anchor: PDF image interchange

Files:
- `src/workspace.js` PDF image drop/selection/move handlers
- `src/documents/pdf-document.js` `kind:"image"` edit rendering/serialization
- `src/drag-ownership.mjs` after reconciliation

Current main already lets PDF receive PNG/JPEG images and stores inserted images as canonical image edit objects containing MIME, bytes/base64 and PDF geometry. Treat those inserted/editable PDF images as first-class internal drag sources, not destination-only decorations.

Required:
- same-PDF image drag updates the same image edit geometry;
- PDF image -> workspace creates exactly one workspace image from the stored image bytes and leaves the PDF image;
- PDF image -> DOCX inserts exactly once and leaves the PDF source;
- PDF image -> another PDF inserts exactly once;
- no global ingest overlay for any of those internal drags;
- no PDF-specific replacement overlay while repositioning;
- save/reopen preserves same-PDF repositioning.

Images that existed in the original PDF before FrameChute editing may only be promoted/extracted when underlying raster bytes and geometry can be resolved confidently. Do not pretend a screenshot of a page region is the original embedded image asset.

## Debug anchor: PDF link annotations must follow text editing

Files to inspect:
- `src/workspace.js` PDF edit/delete/history paths
- `src/documents/pdf-document.js`
- PDF.js annotation extraction/rendering path (search for annotation/link handling; add a small canonical annotation helper if absent)

User law:
- Editing visible linked text should preserve its link target and update the associated clickable annotation rectangle to follow the edited text geometry.
- Deleting linked text should delete the associated link annotation by default.
- Deleting the text + associated link is ONE undoable action.
- Undo restores both.

PDF-specific setting:

```text
Deleting Text Deletes Link  [ ON ]
```

Default ON. If switched OFF, deleting text may leave its original link annotation intentionally. Persist this as PDF-editor preference state; do not make it a transient prompt.

Do not assume text glyphs and PDF link annotations are intrinsically the same object. Build an explicit association using geometry/page/annotation identity and make it conservative when association is ambiguous.

## Debug anchor: PDF-specific Settings menu

Files:
- `src/actions/context-menu-model.mjs`
- `src/editor-context-menu.js`
- likely a new small PDF settings popup/module rather than generic workspace Settings

Right-click inside a PDF surface should expose a `Settings...` command in the PDF-native menu. It opens PDF editor settings, initially including `Deleting Text Deletes Link [ON]`. Do not route this to the generic FrameChute Settings panel.

## Debug anchor: do not regress format-native context routing

Right-click rules:
- PDF editing surface => PDF-specific menu
- DOCX editing surface => DOCX-specific menu
- WEBX editor surface => WEBX-specific menu when implemented
- blank workspace / object chrome => generic menu

The context should be resolved from the physical pointer target, not from whatever happened to be selected earlier.

## Tests Codex should add or strengthen

Add focused tests around pure helpers/models where browser automation is unavailable:
- internal-image drag origin descriptor and global-overlay suppression for workspace/DOCX/PDF sources;
- DOCX/PDF destination suppression of global overlay;
- same-DOCX move vs cross-container copy arbitration;
- same-PDF image move vs cross-container copy arbitration;
- submenu position calculation: right-side, flip-left, bottom clamp;
- Advanced OFF command omission;
- video/audio sync capability and rejection of static/document objects;
- DOCX safe find/replace helper operating only on text content;
- DOCX numbering allocation/reuse;
- PDF newline/tab preservation and growth geometry;
- PDF text/link association + delete preference + undo snapshot semantics.

Also run the existing full suite so #54 drag tests remain green.

## Handoff checkpoint

Use runtime aggressively. At approximately 30 minutes, **conclude active implementation and provide a handoff** containing exact branch/head, commits, files changed, tests, browser/manual checks, what is fully solved, what remains, risks, and the next exact highest-leverage continuation step.
