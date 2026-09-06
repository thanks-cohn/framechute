# Critical addendum: fix internal image drag overlay, make workspace images droppable into PDF, fix inert PDF edit affordance, and make image insertion immediately undoable

Read this together with the current next-run prompts:

```text
agents/codex/prompts/document-image-drop-direct-manipulation-fcx-persistence-correctness.md
agents/codex/prompts/expandable-workspace-simple-mode-timed-move-and-snapshot-bounds-addendum.md
agents/codex/prompts/pdf-multiline-fields-and-marquee-selection-addendum.md
```

This is part of the **same next Codex run** and is a priority correctness blocker, not optional polish.

The user is currently seeing these exact failures:

```text
1. Pick up an existing FrameChute image object
   → global FrameChute ingest/drop overlay appears.

2. Drag that image over a PDF
   → PDF still does not accept/place the image.

3. PDF Edit UI says "Select replacement text to edit."
   → it looks/reads like a control but cannot be clicked.

4. Drop an image into PDF or DOCX
   → Ctrl/Cmd+Z must immediately remove that just-inserted image.
```

The document interaction rule is:

> If I just put it there, Ctrl+Z should take it back out.

---

# 1. Internal FrameChute object movement must NEVER activate the global ingest overlay

The global ingest/drop overlay is for external/native ingestion only.

It must NOT appear for:

```text
- moving an existing FrameChute image object,
- moving any existing FrameChute workspace object,
- moving/resizing an image already inside PDF,
- moving/resizing an image already inside DOCX,
- marquee/group movement inside PDF,
- ordinary pointer-driven workspace movement.
```

Audit drag paths in particular:

```text
src/web-drop.js
src/drop-local-sources.js
src/workspace-ingestion.js
src/workspace.js
```

Current `src/web-drop.js` maintains global drag depth / drop-target UI. Existing rendered image elements must not accidentally start a native browser drag that reaches external-ingestion logic.

Requirements:

- Use pointer-driven FrameChute movement for internal objects.
- Set internal rendered images/media to `draggable=false` where native dragging is not explicitly required.
- Prevent accidental internal `dragstart` propagation where appropriate.
- If an intentional internal transfer channel is needed for inserting a workspace image into a document, classify it explicitly as an **internal FrameChute transfer**, never as external ingestion.
- Internal manipulation must not increment global drag depth or apply global `.is-drop-target` state.
- Robustly clear any stale overlay state on pointerup/cancel/drop/ownership handoff.
- Preserve legitimate external file/URL drag ingestion.

Acceptance:

```text
Grab and move a workspace image around
→ NO global ingest overlay at any point.
```

---

# 2. Existing FrameChute image objects must be droppable into PDF

The main document-image prompt already requires external OS image files to be droppable into PDF. Expand that requirement:

> A FrameChute image already sitting on the workspace must also be usable as a PDF insertion source.

Required flow:

```text
existing FrameChute image object
→ intentionally drag/transfer it over a PDF page
→ PDF page shows a quiet local "Drop into PDF" target state
→ global workspace ingest overlay stays hidden
→ release over PDF page
→ image is inserted at pointer position on the current PDF page
→ inserted PDF image is selected immediately
→ source workspace image remains intact by default
```

Default semantics are **copy into document**, not destructive move.

The workspace source can be backed by:

```text
- local handleKey,
- generated/data URL,
- runtime Blob/object URL,
- direct image URL where bytes can be obtained under current browser security rules.
```

Create one reusable internal image-source resolver so PDF insertion can obtain image bytes + MIME without duplicating unrelated ingestion logic.

If a remote image cannot be fetched because of browser/CORS restrictions, keep the source image untouched and show a clear local failure state. Do not fall back to the global ingest overlay.

Inserted PDF image requirements remain:

- canonical PDF-space position and dimensions,
- body drag to move,
- bottom-right resize,
- preserve aspect ratio by default,
- Save/Save As embeds the image,
- PDF history includes insert/move/resize/delete,
- FCX/workspace persistence preserves dirty document state.

---

# 3. PDF drag ownership must distinguish external ingest, internal transfer, and ordinary movement

Use explicit ownership/state. Do not infer everything from generic browser drag events.

```text
A. External OS/browser image file
   → PDF may claim the drop
   → PDF owns target feedback
   → global overlay hidden while claimed

B. Existing FrameChute workspace image intentionally transferred into PDF
   → PDF may claim it
   → internal FrameChute transfer path
   → global ingest overlay never appears

C. Ordinary repositioning of a workspace object
   → workspace movement only
   → no ingest overlay
```

Do not make merely crossing a PDF rectangle automatically insert the image if the gesture is clearly ordinary workspace movement. Use deterministic local target state. A V1 behavior may be:

```text
eligible image enters PDF page during active move
→ page shows quiet local Drop into PDF target
→ release while target active = insert copy
→ release elsewhere = ordinary move
```

Do not use a fullscreen/global overlay for this.

---

# 4. `Select replacement text to edit.` must not be an inert pseudo-control

Current PDF toolbar markup contains an inert helper span:

```html
<span class="pdf-no-edit">Select replacement text to edit.</span>
```

If this is visually presented like a button/control, that is misleading.

Fix it one of two ways:

### Option A — plain helper text

Keep it as noninteractive status text, but style it clearly as helper copy, not as a button. PDF text itself remains directly clickable/selectable.

### Option B — real explicit action

Replace it with a genuine `Select text` or `Edit text` button.

If using a button:

```text
click button
→ PDF enters a text-selection/edit targeting mode
→ eligible text regions show clear subtle hit areas
→ clicking one selects/materializes its replacement editor
→ Escape exits mode
```

The button must be keyboard accessible and deterministic.

Do not leave a dead control-looking label.

---

# 5. Ctrl/Cmd+Z must immediately remove a just-dropped image from PDF or DOCX

This is mandatory and should be treated as a first-class acceptance test.

For both document types:

```text
Drop image into PDF
→ exactly one image is inserted
→ document becomes dirty
→ immediately press Ctrl/Cmd+Z
→ that inserted image is removed
→ no unrelated text edit or workspace action is undone instead
→ Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y restores the image
```

and:

```text
Drop image into DOCX
→ exactly one image is inserted
→ document becomes dirty
→ immediately press Ctrl/Cmd+Z
→ that inserted image is removed
→ no unrelated text edit or workspace action is undone instead
→ redo restores the image
```

The insertion itself must create one atomic document-history entry.

### History ordering requirement

If the most recent user-visible mutation inside the active document is an image insertion, document Ctrl/Cmd+Z must undo **that insertion first**.

Do not rely on native contenteditable history to infer this.

A correct history model should record document mutations in chronological order, including at least:

```text
- text replacement commit,
- image insertion,
- image move,
- image resize,
- image delete,
- group move where applicable.
```

For DOCX ordinary text typing, native contenteditable undo may remain for text if needed, but FrameChute image insertion history must have deterministic precedence when it is the latest document mutation.

One drop = one history entry. Do not create multiple history entries for the same inserted image due to dragenter/drop/render bookkeeping.

### Undo after internal workspace-image transfer

The same rule applies when the source was an existing FrameChute image:

```text
workspace image → Drop into PDF
→ PDF receives a copy
→ Ctrl/Cmd+Z removes the PDF copy only
→ original workspace image remains untouched
```

Undoing document insertion must never delete the original workspace source object.

---

# 6. Tests / acceptance

Add focused automated coverage for:

```text
1. Existing workspace-image movement does not activate external-ingest overlay state.
2. Internal image transfer into PDF is classified separately from external file drag.
3. PDF claims eligible internal image transfer and inserts exactly one image.
4. Source workspace image remains after PDF insertion.
5. Ctrl/Cmd+Z immediately after PDF image insertion removes that inserted image.
6. Redo restores the PDF image.
7. Ctrl/Cmd+Z immediately after DOCX image insertion removes that inserted image.
8. Redo restores the DOCX image.
9. Undoing document insertion does not remove the source workspace image.
10. `Select replacement text to edit.` is either clearly noninteractive helper text or replaced by a functional real button.
11. External file/URL ingestion still works normally.
```

Manual browser smoke test:

```text
A. Pick up an existing FrameChute image.
   → no global overlay.

B. Move it over a PDF page.
   → PDF shows local target feedback, not global overlay.

C. Release on PDF.
   → one image appears at drop point; source workspace image remains.

D. Press Ctrl+Z immediately.
   → inserted PDF image disappears; workspace source remains.

E. Redo.
   → PDF image returns.

F. Drop a fresh image into DOCX.
   → one image appears.

G. Ctrl+Z immediately.
   → DOCX image disappears.

H. Redo.
   → DOCX image returns.

I. Open PDF Edit menu before selecting text.
   → no dead button-looking `Select replacement text to edit.` control.
```

---

# 7. Preserve all prior next-run requirements

Do not regress:

- PDF ghost-text correction,
- PDF multiline replacement fields,
- PDF marquee/group movement,
- PDF/DOCX image move + bottom-right resize,
- unified document undo/redo,
- FCX local-image persistence,
- expandable workspace edge growth,
- snapshot outermost-object bounds,
- Simple-mode hiding of timed-move commands,
- native Save/Save As,
- external file/URL ingestion,
- spatial permanence.

---

# 8. Timebox / handoff

Use up to 30 minutes.

At the 30-minute mark, **conclude active implementation and provide a handoff**.

Handoff must include:

```text
completed
remaining
files changed
tests/results
known issues/risks
exact next steps
branch/commit/PR
```

Fix the overlay/ownership/undo blockers before optional polish. If the broader PDF marquee or expandable-workspace work cannot all be completed safely in the same timebox, preserve a clean tested boundary and explicitly hand off the remainder rather than weakening these correctness requirements.
