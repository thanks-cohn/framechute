# NEXT RUN — document-specific context menus + PDF region objects + Snapshot Save As

Work from current `main` after PR #50. Use up to 30 minutes. Optimize for reusable primitives and future work eliminated, not isolated button count. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Main mission

Turn PDF and DOCX blocks into coherent editor surfaces with their own context-sensitive right-click menus, instead of routing every right-click through the generic FrameChute object menu.

Core routing law:

```text
right-click inside PDF page/editor surface
→ PDF editing context menu

right-click inside DOCX editor surface
→ DOCX editing context menu

right-click document block header/chrome outside editor surface
→ existing generic FrameChute object menu
```

The generic workspace/object menu must remain available on document chrome, but should not dominate document editing.

Prefer a reusable/declarative context-menu registry and selection model rather than giant one-off HTML strings and scattered `if` trees.

---

# P0 — shared editor-context routing primitive

Current `src/layer-menu.js` globally owns workspace `contextmenu` events. Introduce a shared routing boundary so embedded/editor surfaces can claim context before the generic layer menu.

Conceptually:

```text
contextmenu event
→ resolve editor surface
→ resolve selection/context
→ editor-specific command registry
→ render context menu
```

Suggested pure/shared pieces:

```text
resolveEditorContext(event)
commandsForEditorContext(context)
showEditorContextMenu(commands, point)
```

Context should include enough information to support PDF and DOCX without duplicating the entire menu system:

```text
editorKind: pdf | docx
block
surface
selectionKind
selectedObjectId or selected range
pointer coordinates
page / PDF coordinates where relevant
```

Menu must be viewport-aware, keyboard/focus friendly, dismiss on outside click/Escape, and preserve selection while small sub-popovers are used.

---

# P0 — PDF-specific right-click menu

Inside the actual PDF page/text layer, do not show the generic FrameChute object commands such as Minimize, Grab / Move Object, Show image only, etc.

## Empty PDF page area

At minimum:

```text
Add Text Field
Insert Image…
Paste Text / Paste Image when available
Select Region
────────────
Save
Save As…
```

## Existing source PDF text

At minimum:

```text
Edit / Replace Text
Font ›
Text Size…
Delete Text
Revert Edit when applicable
────────────
Save
Save As…
```

## Added/replacement text field

At minimum:

```text
Edit Text
Font ›
Text Size…
Duplicate
Delete Field / Delete Edit
────────────
Bring Forward
Send Back
────────────
Save
Save As…
```

## Image / region object

At minimum:

```text
Move / Pick Up
Resize
Morph / Edit Quad
Duplicate
Delete
────────────
Bring Forward
Send Back
────────────
Save
Save As…
```

Use the canonical PDF edit-object work already merged in PR #50. Do not create DOM-only transient objects that the serializer cannot understand.

---

# P0 — PDF selection and keyboard deletion

PDF editable objects must remain selected after click/right-click so keyboard commands work naturally.

Acceptance:

```text
right-click a large text field
→ field becomes selected
→ dismiss menu
→ press Delete
→ field disappears
→ Ctrl/Cmd+Z restores it
```

The same should work for inserted PDF images and region objects.

Keyboard behavior when PDF editor owns selection:

```text
Delete / Backspace → delete selected editable PDF object
Escape             → deselect / cancel transient tool
Ctrl/Cmd+Z          → undo
Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y → redo
Arrow keys          → nudge when appropriate
Shift+Arrow         → larger nudge
```

Do not let Delete remove the whole PDF workspace block while a PDF edit object is selected.

For original/baked PDF text, `Delete Text` should create an undoable deletion/replacement mask/edit; it must not destructively rewrite unrelated page operators.

---

# P0 — Add Text Field as a canonical PDF object

An added text field should be a real PDF edit object, conceptually:

```text
kind: text
id
page
x / y
width / height
text
fontFamily
fontSize
rotation
z/order
verticalAlign: top
```

Workflow:

```text
right-click empty PDF area
→ Add Text Field
→ click/drag a field rectangle
→ field appears selected/editable
→ type multiline text
→ move/resize
→ font/size via right-click menu
→ Delete removes it
→ undo restores it
→ Save/Save As persists it
```

If drag-to-create is too large for the timebox, click-to-create with a sensible rectangle is acceptable, but the geometry must remain canonical so drag creation is a thin follow-up.

---

# P0 — fix PDF text bottom-alignment bug in shared layout

Reported bug:

```text
editor preview: text appears near top of tall field
saved PDF: text lands near bottom of tall field
```

Fix at the shared PDF layout primitive, not via a serializer-only magic offset.

Canonical field rectangle semantics:

```text
x, y = lower-left in PDF coordinates
width, height = field bounds
verticalAlign = top by default
```

Derive line baselines from the field top:

```text
fieldTop = y + height
firstBaseline = fieldTop - topInset/font ascent
nextBaseline = firstBaseline - lineHeight
```

Preview and serialization must agree conceptually on line boxes/baselines.

Acceptance:

```text
create tall text field
→ one line sits near upper-left
→ Save As
→ reopen
→ line remains upper-left

make field taller
→ text does not sink to bottom
```

Architect so Middle/Bottom alignment can be added later, but Top is the default now.

---

# P0 — PDF Font and Text Size via right-click

Reuse the existing `PDF_STANDARD_FONTS` inventory and resolver. Do not create a second font list.

`Font ›` should expose current supported standardized PDF fonts.

`Text Size…` should open a small anchored mini-popover, not a giant dialog. Include presets plus custom numeric input, for example:

```text
8
10
11
12
14
18
24
36
48
────────
Custom: [ 13.5 ] pt
```

Requirements:

- selection stays active while popover is open;
- Enter applies custom value;
- Escape cancels;
- clamp to honest supported range;
- applying size is one undoable edit;
- preview and saved PDF agree.

If native browser text selection covers only part of a PDF text item and substring formatting is not safe yet, explicitly scope V1 to the selected PDF text item/edit object rather than silently pretending partial-run formatting works.

---

# P1 — PDF Select Region → bounded quadrilateral object

Workflow:

```text
right-click PDF page
→ Select Region
→ drag rectangle (or four-click corners if that primitive is cleaner)
→ selected bounded quadrilateral appears
```

Canonical quad geometry:

```text
p0 top-left
p1 top-right
p2 bottom-right
p3 bottom-left
```

Context commands:

```text
Move / Pick Up
Resize
Morph / Edit Quad
Duplicate
Delete
Bring Forward
Send Back
Reset Quad
```

Safe V1 semantics:

- capture/render the chosen PDF visual region at sensible source resolution;
- create a PDF `region`/image-like edit object backed by that capture;
- leave source page intact by default;
- move/resize/morph the new object;
- optional explicit Cover Source/Cut can be a mask later, but destructive cutting is not default.

`Morph / Edit Quad` should expose four corner handles. Dragging one corner changes only that point.

Do not fake a CSS perspective preview that cannot serialize. If full perspective rasterization cannot fit, land the canonical quad model + corner editing + ordinary rectangular serialization honestly and leave perspective rasterization as the next thin adapter.

Where practical, inserted PDF images and region objects should share the same geometry helper/interface:

```text
id
kind: image | region
page
x / y
width / height
rotation
z/order
quad?
asset/source
```

This should also prepare for future SVG objects.

---

# P0 — DOCX-specific right-click menu

Inside `.docx-editor`, do not show the generic FrameChute object menu. Show a document-formatting menu instead.

The DOCX menu should derive from current text/range/object selection.

## Text selection / caret context

At minimum:

```text
Bold
Italic
Underline
────────────
Font…
Text Size…
Paragraph ›
────────────
Cut
Copy
Paste
────────────
Insert Image…
Save
Save As…
```

`Paragraph ›` may expose a small V1 set such as:

```text
Normal
Heading 1
Heading 2
Heading 3
Align Left
Center
Align Right
Bulleted List
Numbered List
```

Only expose actions that can be serialized honestly by the current DOCX model. If font family/size are not yet part of canonical rich-text runs, extend the canonical run-style model rather than applying DOM-only CSS that disappears in Microsoft Word.

## DOCX image selection

At minimum:

```text
Resize
Replace Image…
Duplicate
Delete
────────────
Wrap / Alignment… (only if honestly supported)
Save
Save As…
```

A selected DOCX image should remain selected after the menu closes so Delete works naturally and Undo can restore it.

## DOCX format primitive rule

Build on the canonical run model introduced by PR #50. Extend that model carefully as needed:

```text
bold
italic
underline
fontFamily?   ← add only with parser/serializer support
fontSize?     ← add only with parser/serializer support
color?        ← optional future
```

Combined formatting must remain composable and survive DOCX save/reopen.

Do not regress underline round-trip correctness.

---

# P0 — Snapshot "Save As" location picker

The `Take Snapshot` / snapshot export flow must allow the user to choose a destination using a native Save As-style file picker when the browser supports it.

Current behavior already has a snapshot export dialog with filename/format/scale/quality. Preserve that configuration UI, but after the user confirms export:

```text
Take Snapshot
→ configure format/scale/quality/filename
→ Save Snapshot
→ native Save As location picker when available
→ write chosen file
```

Use `showSaveFilePicker()` where supported, with correct extension/MIME filters for PNG/JPEG/WebP. Reuse the existing native-save/document-save patterns where sensible rather than writing another unrelated save implementation.

Fallback when picker is unavailable:

```text
normal browser download with suggested filename
```

Requirements:

- cancellation is not an error;
- chosen filename extension stays consistent with selected format;
- snapshot bytes are generated once per export transaction where practical;
- do not silently save to a fixed Downloads location when a native location picker is available;
- keep current snapshot bounds/scale/quality behavior;
- future region export should be able to reuse the same Save As primitive.

Acceptance:

```text
Take Snapshot
→ PNG
→ Save Snapshot
→ native location picker opens
→ choose folder/name
→ PNG appears there

Cancel picker
→ no file written, no scary error
```

---

# Architectural target

Aim for:

```text
Editor surface
   ↓
context routing
   ↓
selection model
   ↓
command registry
   ↓
canonical document/edit objects
   ↓
history
   ↓
preview + serializer
```

And a shared save path:

```text
render/serialize Blob once
→ Save / Save As policy
→ native picker when available
→ download fallback
```

Avoid DOM-only edits that look correct but disappear after Save/Reopen.

---

# Preserve existing good behavior

Do not regress:

- PR #49/#50 PDF standard fonts, width-aware wrapping, multiline/repeated spaces, height clipping;
- PDF Save/Save As single-serialization transaction;
- PDF page operations and image export;
- DOCX canonical rich-text runs and combined bold/italic/underline round-trip;
- DOCX embedded image handling;
- workspace coordinate permanence: passive viewport/UI changes never rewrite object x/y;
- internal drag rule: moving/resizing/selecting/morphing existing objects must never show the global `Drop into FrameChute` overlay;
- existing generic context menu on document chrome/outside editor surfaces.

---

# Tests

Prefer pure helper tests for the hard decisions. Add focused coverage where practical for:

1. editor-specific context routing (PDF/DOCX surface vs generic document chrome);
2. PDF command applicability by selection kind;
3. PDF selected field/image/region Delete + undo;
4. top-aligned PDF baseline math in tall fields;
5. PDF font and size commands mutate canonical objects;
6. quad normalization / corner movement;
7. DOCX context commands mutate canonical runs, not DOM-only state;
8. DOCX combined styles remain composable after any menu-based formatting path;
9. DOCX image Delete/Undo if implemented;
10. Snapshot native Save As writer/picker behavior and cancellation fallback.

---

# Manual acceptance if Chromium is available

```text
1. Right-click inside PDF page → PDF menu, not generic menu.
2. Right-click PDF header → generic FrameChute menu.
3. Add PDF text field → font/size via context menu → Save As/reopen.
4. Dismiss PDF menu → Delete selected field → Undo restores.
5. Tall PDF field saves text at top, not bottom.
6. Select Region → move/resize; quad morph if honestly implemented.
7. Right-click inside DOCX editor → DOCX formatting menu, not generic menu.
8. DOCX underline + combined formatting survive Save As/reopen.
9. DOCX image context actions operate on the image, not whole block.
10. Take Snapshot → Save Snapshot → native Save As picker → chosen location receives file.
11. Cancel Snapshot picker → no error/no file.
12. Internal document manipulation never shows global ingest overlay.
```

If Chromium or Word is unavailable, state exactly what was not manually tested.

---

# 30-minute priority order

```text
1. shared editor-context routing primitive
2. PDF menu + selection + Delete/Undo + Add Text Field
3. PDF top-aligned text layout + font/size mini-popover
4. DOCX custom menu using canonical rich-text runs
5. Snapshot Save As picker via shared native-save path
6. PDF Select Region + quad geometry
7. image/region geometry unification and polish
```

If full quad perspective cannot fit, do not sacrifice PDF/DOCX editor-context correctness or Snapshot Save As to force it in.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- reusable primitives landed,
- user-visible issues solved,
- remaining thin adapters,
- files changed,
- tests/results,
- manual checks performed/not performed,
- risks/issues,
- exact next highest-leverage root pass,
- branch,
- commit,
- PR.
