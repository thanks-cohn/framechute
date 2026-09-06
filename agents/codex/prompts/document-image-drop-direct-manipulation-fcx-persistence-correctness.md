# Codex run: document image direct manipulation, undo/redo, drag ownership, PDF hover correctness, and FCX image persistence

## Context

Work from the latest `main` after PR #47. At the time this request was written, the relevant merged baseline is:

```text
673a9d9c0adbd2d429eab600a9f6d21956baa1fa
```

Do **not** revive or merge superseded PR #46, and do **not** blindly merge stale/conflicted PR #42 as part of this task. This run is a focused correctness/direct-manipulation pass on current `main`.

FrameChute's rule is:

> If an action feels obvious, FrameChute should support it directly.

For documents in particular:

> If you put something into a document, you should be able to grab it, resize it, move it, undo it, redo it, and save it.

And for workspace movement:

> The viewport moves. The artwork does not.

Do not reintroduce passive position clamping or viewport-driven object movement.

## User-reported regressions / missing behavior

The current browser build has the following issues:

1. In edited PDFs, old/source text can visually reappear when hovering over the text region.
2. When an existing FrameChute object is picked up/moved, the global drag/drop ingestion overlay still appears. Internal manipulation must never look like external ingestion.
3. DOCX accepts some image drops, but document drop ownership/overlay behavior is still inconsistent and Ctrl/Cmd+Z does not reliably undo an inserted image.
4. PDF currently does not support dropping an image directly onto a PDF page as a document object.
5. Images placed into DOCX or PDF should be directly manipulable:
   - drag the image body to move it,
   - use a bottom-right resize handle to resize it,
   - preserve aspect ratio by default,
   - persist the resulting geometry,
   - support undo/redo for insert/move/resize/delete.
6. Reopening an exported `.fcx` workspace can restore local video while a local image disappears/fails to restore. `Include Files` must preserve required local image bytes just as reliably as other local media.

Treat these as one coherent correctness pass rather than unrelated one-off fixes.

---

# 1. PDF: source text must never reappear on hover after replacement

Inspect the current PDF render/editor path in:

```text
src/documents/pdf-document.js
src/workspace.js
src/workspace.css
```

Current behavior includes transparent text hitboxes and a hover rule that makes `.pdf-text-item` text visible. This can make the original/source text appear again even though the source mask is present.

Required behavior:

```text
normal PDF
→ canvas text visible

hover ordinary editable text region
→ subtle hitbox/outline only
→ do NOT reveal an additional duplicate text rendering

committed replacement
→ source glyph region remains visually masked
→ only replacement text is visible

hover committed replacement
→ selection affordance / outline / handles only
→ source text NEVER resurrects
```

Requirements:

- Remove any hover behavior that reveals hidden source glyph text.
- Keep text-selection/edit hitboxes usable without painting duplicate text over the canvas.
- Keep live source-mask semantics aligned with Save/Save As serialization.
- Empty replacement must continue to mask source text.
- Undo/redo of text replacement must correctly restore/remove masks and replacement visuals.
- Do not regress keyboard nudge, replacement move/resize, font-size editing, or Save/Save As.

Add focused regression coverage for the presentation/model where practical. CSS-only behavior may need a structural/static assertion plus browser-oriented comments if no DOM browser harness exists.

---

# 2. Internal manipulation must never trigger the global ingestion overlay

FrameChute must distinguish these categories explicitly:

```text
EXTERNAL FILE / URL / OS DRAG
→ global ingest overlay may appear

EXTERNAL IMAGE OVER DOCX/PDF
→ target document owns the drag
→ global overlay hidden

EXISTING FRAMECHUTE OBJECT MOVEMENT
→ no global ingest overlay

IMAGE ALREADY INSIDE DOCX/PDF BEING MOVED/RESIZED
→ no global ingest overlay
```

Audit the existing drag/drop paths, especially:

```text
src/web-drop.js
src/drop-local-sources.js
src/workspace-ingestion.js
src/workspace.js
```

and any drag-overlay/controller code.

Requirements:

- Internal pointer-based movement must not increment external drag depth or show `.is-drop-target` UI.
- If internal image/media elements can initiate native browser drags, disable those accidental native drags where appropriate (`draggable=false`, prevent internal `dragstart`, or use a clear internal-drag marker/ownership contract).
- Preserve real external file and URL drop behavior.
- Preserve DOCX nested drag ownership and make PDF nested drag ownership equally explicit.
- Drag overlay state must clear robustly on `drop`, `dragleave`, cancellation, and ownership handoff.
- A document that owns a valid image drop must prevent the global workspace router from also creating a workspace image object.
- Exactly one insertion per eligible document drop.

Do not solve this by disabling useful external drag/drop globally.

---

# 3. DOCX image insertion must become a real undoable document operation

Current DOCX image insertion is not adequately integrated into document history.

Required behavior:

```text
Drop image into DOCX
→ image is inserted at the intended document location
→ document becomes dirty
→ Ctrl/Cmd+Z removes that insertion
→ Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y restores it
```

Undo/redo must not be limited to insertion. It must cover user-visible document image mutations:

```text
insert image  → undo removes / redo restores
move image    → undo restores prior position
resize image  → undo restores prior dimensions
delete image  → undo restores image
```

Use a bounded history. Avoid unbounded snapshots of giant document packages on every pointermove.

Preferred pattern:

- record one history entry at gesture start / committed gesture end,
- do not push one history state per pointermove,
- new mutation clears redo,
- history is scoped to the active DOCX document,
- keyboard shortcuts are scoped so they do not steal Ctrl+Z from unrelated text inputs/workspaces.

Preserve existing B/I/U/contenteditable behavior. If native contenteditable undo is retained for ordinary text typing, integrate document-image history without breaking native text undo. A practical strategy is to intercept Ctrl+Z only when FrameChute document-image history has the latest applicable mutation or when the selected/active document-image object is involved, while leaving normal editing behavior intact otherwise.

---

# 4. DOCX inserted images: direct move + bottom-right resize

Inserted and supported existing DOCX images should behave as direct-manipulation objects inside the document editor.

Required UX:

```text
click image
→ selected state

drag image body
→ move/reposition image

drag bottom-right handle
→ resize image
```

Requirements:

- Body acts as the grab surface when selected/eligible.
- Bottom-right resize handle is visible when selected.
- Preserve aspect ratio by default.
- Do not start a native browser image drag while moving it.
- Pointer movement should feel local/direct, with no workspace overlay.
- One move gesture = one undo history step.
- One resize gesture = one undo history step.
- Saving the DOCX must preserve image size and position as honestly as the current OOXML model supports.

### DOCX geometry honesty

Do not fake persistence. If arbitrary free-floating OOXML positioning is required, implement the minimum correct anchor/position representation needed for FrameChute-created images instead of merely moving DOM nodes visually and losing the geometry on save.

Preserve existing documents least-destructively. Do not rewrite unrelated OOXML.

For existing inline images where full floating-position conversion would be destructive, it is acceptable to preserve their original inline semantics until the user explicitly moves them; once moved, convert only that image to the minimal supported positioned representation.

Keep unique relationship IDs and unique drawing IDs from the DOCX hardening work.

---

# 5. PDF must accept dropped images directly onto the current page

Add a first-class PDF image insertion model.

The flow should be:

```text
drag external PNG/JPEG/WebP/etc.
→ enter current PDF page
→ PDF owns drag
→ no global overlay
→ drop
→ image appears at pointer position on current page
→ selected immediately
```

Store PDF image placement in **PDF coordinates**, not viewport pixels.

The image must remain stable across:

- PDF rerender,
- page resize,
- zoom/scale changes,
- workspace save/restore,
- native PDF Save/Save As.

Recommended canonical record shape (adapt as needed):

```js
{
  id,
  page,
  x,
  y,
  width,
  height,
  mimeType,
  bytesOrAssetRef,
  rotation
}
```

Keep this separate from text-edit records if that keeps the model clearer.

### PDF serialization

On Save/Save As:

- embed PNG/JPEG bytes using `pdf-lib` or the existing local PDF library path,
- retain PNG transparency where supported,
- embed JPEG appropriately,
- convert unsupported browser-decodable formats to a supported embedded format if necessary,
- draw at the stored PDF-space x/y/width/height,
- do not rasterize the entire PDF just to insert one image,
- preserve unedited pages and unrelated PDF content.

If GIF/WebP cannot be embedded directly, decode/convert locally and document the conversion honestly.

---

# 6. PDF inserted images: direct move + bottom-right resize + undo/redo

Use the same interaction language as DOCX.

Required:

```text
click PDF image
→ selected

drag body
→ move in page

drag bottom-right handle
→ resize
Ctrl/Cmd+Z
→ undo latest image mutation
Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
→ redo
```

Requirements:

- preserve aspect ratio by default,
- constrain/convert geometry through viewport↔PDF coordinate helpers,
- no duplicate workspace object is created,
- no global overlay during internal move/resize,
- one completed move/resize gesture = one history entry,
- delete should be undoable,
- insertion should be undoable immediately after drop,
- image history and existing PDF text replacement history must coexist coherently.

Do not create separate conflicting Ctrl+Z systems. Prefer a unified bounded per-PDF document history that can represent text and image mutations, or a deterministic merged history abstraction.

Preserve existing PDF text editing behavior from PRs #44/#45.

---

# 7. FCX `Include Files`: local images must survive reopen

This is a confirmed persistence gap.

Current relevant implementation:

```text
src/fcx-portable.js
src/web-drop.js
```

There are at least two serialized marker families in current code:

```text
__FLASHFRAME_LOCAL_DROP_V1__
__FLASHFRAME_CUSTOM_BLOCK_V1__
```

Custom image blocks can store local source metadata (including `handleKey`) inside the custom marker payload. The FCX portable exporter currently needs to recognize **all serialized local-source payloads that require an OS handle**, not only one marker family.

Required behavior:

### Include Files

```text
local image in workspace
→ Export Workspace
→ Include Files
→ actual image bytes packaged in assets/
→ Open Workspace
→ synthetic restored handle / equivalent asset source is wired back
→ image renders automatically
→ no original filesystem handle required
```

### State Only

```text
original handle still valid in originating browser profile
→ image may reconnect automatically

original handle unavailable
→ image object remains in workspace
→ clear Reconnect image state
→ object must NOT silently disappear
```

### Generated/data-URL images

Already self-contained image data should stay self-contained and should not be forced through an OS-handle path.

### Robust source discovery

Refactor `sourceReferences(state)` / marker parsing as needed so the portable exporter can discover local sources from every supported serialized block representation.

Do not hardcode a fragile assumption that only text records with one marker can contain file handles.

Add regression tests for at least:

```text
workspace with:
- one local image
- one local video

Export Include Files
→ import into a context without relying on original OS handles
→ both restore
```

Also test State Only missing-handle behavior for the image object: object survives with reconnect state instead of vanishing.

---

# 8. Document drop ownership tests

Add focused tests for ownership and exactly-once behavior.

At minimum cover:

- image external drag over DOCX claims the drop,
- image external drag over PDF claims the drop,
- global workspace ingestion does not also run,
- internal object movement does not show/activate external ingest overlay,
- DOCX drop inserts exactly one image,
- PDF drop inserts exactly one image,
- non-image external files still route normally when the document does not support them.

If the repo's current unit environment cannot simulate full `DataTransfer`, isolate the ownership classification in testable pure helpers and test those thoroughly.

---

# 9. Persistence / FCX for document image state

New PDF/DOCX image state must survive ordinary FrameChute workspace persistence too.

For `.fcx`:

- document runtime image bytes required for dirty, unsaved documents must be included as workspace-owned assets,
- native local source documents should retain reconnect semantics,
- dirty runtime state must reopen with inserted image geometry and undoable current state intact where practical,
- do not require the original dropped image file if the document now owns the inserted image bytes.

The user's mental model is:

> Everything just as it was.

At minimum, reopening a workspace must restore the document's current visible image placement and saved/dirty state correctly.

---

# 10. Interaction details / accessibility

- Selected document image should have a clear but quiet selection outline.
- Resize handle needs an accessible label such as `Resize image`.
- Use pointer events, not mouse-only events.
- Escape may cancel an in-progress move/resize and restore the pre-gesture geometry.
- Delete/Backspace may delete the selected document image only when focus/context makes that unambiguous; if implemented, deletion must be undoable.
- Do not hijack keyboard shortcuts while the user is typing into unrelated inputs.
- Keep Simple mode simple. Do not expose timing/sync controls here.

---

# 11. Preserve current good behavior

Do not regress:

- PR #47 responsive toolbar and snapshot export,
- Tight Bounds / Square snapshot framing,
- object context menu separation between object commands and workspace commands,
- Quick Actions `×` closing the panel without clearing selection/preferences,
- PDF compact toolbar/popdowns and page image export,
- PDF direct replacement-text editing,
- PDF source masking on save/live preview,
- DOCX embedded image rendering and relationship/drawing-ID correctness,
- native Save/Save As,
- `.fcx` Open Workspace / Export Workspace terminology,
- frameless media behavior,
- spatial permanence rule,
- external file/URL ingestion.

Do not reintroduce passive recentering or reachability clamping.

---

# 12. Suggested implementation structure

Prefer small reusable helpers instead of adding more monolithic conditionals to `workspace.js`.

Reasonable candidates if architecture supports them:

```text
src/documents/document-image-history.mjs
src/documents/document-image-interactions.js
src/documents/pdf-image-model.mjs
src/actions/drag-ownership.mjs
src/fcx-portable.js                    # source discovery fix
```

These names are suggestions, not mandates.

Important architectural goals:

- one reusable move/resize gesture pattern where possible,
- canonical PDF geometry in PDF coordinates,
- canonical DOCX geometry in document model/OOXML state,
- bounded history,
- clear drag ownership classifier,
- no duplicate drop pipelines,
- FCX source discovery is marker-aware and extensible.

---

# 13. Testing and validation

Run the full existing test suite and add focused regressions.

Minimum validation:

```bash
node --test tests/*.test.mjs
```

Add focused tests for:

- PDF source text does not become the visible replacement on hover/state mapping,
- PDF image insert model and geometry conversion,
- PDF image undo/redo insert/move/resize/delete,
- DOCX image undo/redo insert/move/resize/delete,
- drag ownership / exactly-once document drop,
- internal drag does not activate external overlay classification,
- FCX Include Files local image + video round-trip,
- FCX State Only image missing-source placeholder/reconnect behavior,
- document image state capture/restore.

Also run:

```bash
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

If an existing focused browser/manual test script exists, run it. If no browser automation is available, say so explicitly and provide a concise manual smoke-test checklist in the PR/handoff.

Manual smoke-test checklist should include:

```text
1. Open PDF, replace text, hover it → no old ghost text.
2. Move a workspace image → no global drop overlay.
3. Drop PNG into DOCX → exactly one image.
4. Ctrl+Z → inserted DOCX image disappears; redo restores.
5. Move/resize DOCX image → undo/redo geometry.
6. Drop PNG into PDF → exactly one image at pointer.
7. Move/resize PDF image → undo/redo geometry.
8. Save PDF → reopened native PDF contains image at correct location/size.
9. Save DOCX → reopened document contains image with supported geometry.
10. Export Workspace with local image + video using Include Files.
11. Open FCX without original filesystem handles → both image and video survive.
12. State Only with missing image source → image object remains with reconnect UI.
```

---

# 14. Scope discipline

This run is a correctness/direct-manipulation pass. Do not spend the time adding unrelated features such as spreadsheets, Chemium, web builder, huge-PDF virtualization, 3D, or new visual styling systems.

If a complete arbitrary-position DOCX anchor implementation turns out to be too large for this run, prioritize in this order:

1. Correct drop ownership / no overlay duplication.
2. Undoable DOCX image insertion.
3. DOCX image resize with persisted dimensions.
4. DOCX image move with the most correct minimal OOXML anchor support possible.
5. PDF image insertion + move/resize + save + undo/redo.
6. FCX local-image Include Files persistence.
7. PDF hover ghost-text fix.

However, do not ship a DOM-only fake that claims saved DOCX positioning if the serializer cannot preserve it. If a piece cannot be completed honestly, leave it explicitly remaining with exact next steps.

---

# 15. Timebox / handoff

Use up to 30 minutes for this run.

At the 30-minute mark say exactly:

**“conclude active implementation and provide a handoff”**

Do not use the word “stop” as the timebox instruction.

The final handoff must include:

- completed work,
- remaining work,
- files changed,
- tests and exact results,
- known issues/risks,
- manual browser checks still needed,
- exact next steps,
- branch name,
- commit SHA,
- PR number/link if created.

Prefer one coherent PR from current `main` for this pass.