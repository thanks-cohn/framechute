# Codex Addendum: PDF Live Preview + Editable Text Field Geometry

## Relationship to the current document-editing pass

Use latest `main`.

Read and follow:

`agents/codex/prompts/document-editing-basics-pdf-text-docx-formatting.md`

This addendum is authoritative where it is more specific about PDF text editing.

The existing PDF editor already records text replacements and can serialize them into a saved PDF. The problem is that editing does not yet feel direct enough: committed changes may not immediately appear in the live PDF surface, and the user cannot meaningfully control the replacement field's geometry or text size.

The goal of this addendum is:

> When I edit PDF text, I should immediately see the result on the page and be able to place and size that replacement like a real visible object.

Do not wait until Save/reopen or a page refresh to show the user what they just changed.

---

# 1. Immediate live PDF text preview is required

After a user commits a text replacement, the visible PDF page must update immediately.

Required behavior:

- edit visible text
- commit with Enter / click-away / explicit commit
- replacement appears immediately in the same place on the current PDF page
- no page change, reload, Save, or reopen is required to see it
- if the same edit is changed again, the live preview updates again immediately
- Undo / Redo updates the visible page immediately as well

The live preview and native saved result must use the SAME edit record/model. Do not create one visual-only DOM state and a different native-save state that can drift apart.

A page re-render is acceptable if it is fast and preserves user position/selection, but prefer updating the affected edit overlay directly when practical.

The user should trust that:

> What I see in FrameChute is what FrameChute intends to save.

---

# 2. Treat a committed PDF replacement as a manipulable text field/object

After selecting or editing a PDF text item, show a subtle editable field/bounding box around the replacement.

This is NOT a request for full Acrobat object editing. It is a compact first-pass text-field geometry tool.

The selected replacement field needs to support four important properties:

1. text content
2. position
3. field width/height
4. text/font size

Conceptually the edit model should be able to represent:

```text
page
source text item/index
original text
replacement text
x
y
width
height
fontSize
rotation
```

All geometry should be stored in PDF-space coordinates, not only CSS pixels.

---

# 3. Positioning

The user must be able to reposition a committed PDF text replacement.

Minimum interaction:

- select the edited text field
- drag the field to a new location on the PDF page
- live preview follows the pointer
- release commits the new PDF-space x/y
- Save / Save As uses the new position
- page change and return preserves the position
- FCX capture/restore preserves the position

Also support small keyboard nudging when the field is selected if practical:

- Arrow keys: small nudge
- Shift + Arrow: larger nudge

Do not let dragging the PDF text field accidentally move the entire FrameChute PDF block.

---

# 4. Field size / bounding box

The user must be able to change the replacement field's usable area.

At minimum provide a visible resize handle or equivalent compact affordance on the selected field.

Required:

- resize field width
- resize field height where useful
- resizing updates live preview
- geometry remains correctly mapped to PDF-space coordinates under zoom/fit scaling
- Save / Save As uses the resulting field geometry

Do not silently change font size merely because the user changes field width/height unless an explicit fit behavior is chosen.

The field is the text's available region; text size is a separate property.

For v1, overflow can be handled conservatively. It is acceptable to clip/wrap within the supported model or visibly indicate overflow. Do not silently draw text far outside the user's selected field.

---

# 5. Text size

When a PDF replacement field is selected, expose a compact text-size control.

Minimum:

```text
[ 12 pt ]
```

Requirements:

- numeric point size
- sensible bounded range
- changing size updates the live preview immediately
- edit record stores the chosen size
- native PDF serialization uses the chosen size
- reopening the current page shows the chosen size
- Undo / Redo covers text-size changes

If an original text size can be reasonably derived from PDF.js text metrics, initialize the control from that value rather than defaulting every edit to 12 pt.

---

# 6. Compact selected-field controls

Do not build a giant floating inspector.

When a PDF edit field is selected, a small contextual strip/popup is enough, conceptually:

```text
[Text…] [12 pt]  Move / resize directly  [Undo] [Redo]
```

Exact UI is flexible.

The important product behavior is direct manipulation:

```text
select text
   ↓
edit
   ↓
see result immediately
   ↓
drag to move
resize field
change pt size
   ↓
Save
```

The PDF itself should remain visually dominant.

---

# 7. Coordinate conversion must be reliable

This is important.

The PDF page can be rendered at different viewport scales and rotations. Do not store or serialize raw screen/CSS coordinates.

Build or reuse explicit helpers for conversion between:

- PDF-space geometry
- viewport/display-space geometry

Use the same conversion for:

- initial text-item geometry
- dragging
- resizing
- live preview
- native save
- page re-render

Test at:

- non-100% scale
- resized PDF block
- rotated page

A user should not move a field 10 px visually and have the saved PDF move it 80 px.

---

# 8. History semantics

PDF Undo / Redo should cover field manipulation, not only string replacement.

A history step should capture changes to:

- replacement text
- x/y position
- width/height
- fontSize

One continuous drag should be one Undo step.

One continuous resize should be one Undo step.

A font-size change committed from the control should be one Undo step.

Undo/Redo must immediately refresh the live PDF surface.

Keep history bounded.

---

# 9. Save fidelity

The current v1 cover-and-redraw PDF strategy is still acceptable for this pass.

However, native serialization must now honor the user-visible field state:

- replacement text
- x/y
- width/height
- font size
- rotation when present

Do not leave the live editor manipulable while Save ignores the field geometry.

If the current serializer's white cover rectangle is based on source glyph geometry, update it carefully so moving/resizing a replacement does not leave contradictory remnants. Preserve unrelated page content.

Be explicit in code/comments that this remains visual replacement rather than arbitrary source-content-stream rewriting.

---

# 10. Acceptance cases

At minimum manually/automatically verify:

1. Edit `Hello` to `Goodbye` -> `Goodbye` appears immediately on the same page.
2. Move the edited field -> live preview follows and remains there after changing pages and returning.
3. Resize field width -> visible editable region changes and survives page re-render.
4. Change text from 12 pt to 20 pt -> preview changes immediately and saved PDF uses 20 pt.
5. Undo text change -> live page updates immediately.
6. Redo -> live page updates immediately.
7. Undo/Redo field move, resize, and font-size change.
8. Save As -> reopen generated PDF -> replacement appears in substantially the same position, field geometry, and text size.
9. Test while the PDF block is rendered at a non-default scale.
10. Test a rotated page and ensure geometry does not visibly drift.

---

# Scope discipline

Do NOT expand this addendum into:

- arbitrary PDF image/object editing
- OCR
- full text reflow
- advanced font embedding/substitution UI
- annotations/comments system
- forms engine
- redaction

This is a focused direct-manipulation upgrade for the existing PDF replacement-text editor.

The key product promise is:

> Edit it, see it immediately, put it where you want it, size the field, choose the text size, and save what you see.

## Time box

Use up to 30 minutes of active implementation.

At the 30-minute mark, conclude active implementation and provide a handoff containing:

- completed work
- remaining work
- files changed
- tests run and exact results
- manual browser checks performed
- known limitations / fidelity boundaries
- exact next steps
- branch / commit / PR state

Leave the repository coherent and buildable. Open one clean PR against latest `main` if reviewable.