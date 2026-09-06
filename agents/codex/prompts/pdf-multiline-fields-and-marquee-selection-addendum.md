# Addendum: PDF multiline replacement fields and bounded multi-object selection

Read this together with the current next-run prompts:

```text
agents/codex/prompts/document-image-drop-direct-manipulation-fcx-persistence-correctness.md
agents/codex/prompts/expandable-workspace-simple-mode-timed-move-and-snapshot-bounds-addendum.md
```

This is part of the **same next Codex run**. Work from current `main` and preserve all existing good behavior.

FrameChute's document rule remains:

> If a text field can be resized, its usable text area should actually respond to that size.

And the selection rule is:

> Draw a bounded region, select what is inside it, then move the selected things directly.

---

# 1. PDF replacement fields must support real new lines

Current code explicitly intercepts Enter while a `.pdf-edit-text[contenteditable="true"]` is active and immediately blurs/commits the field. That makes multiline editing impossible even though replacement fields have adjustable width and height.

Fix this.

Required behavior:

```text
Double-click replacement field
→ edit text

Enter
→ insert a real newline inside the replacement

Ctrl/Cmd+Enter
→ commit/finish editing (optional but preferred)

Blur/click away
→ commit

Escape
→ cancel the current text edit and restore the pre-edit value
```

Do not use bare Enter as "finish editing" anymore.

Requirements:

- Preserve `\n` in the canonical replacement string.
- Live preview must render those line breaks.
- Save/Save As must preserve them in the generated PDF.
- Undo/redo must treat the completed multiline edit as a normal document history operation.
- Do not create one undo entry per keystroke if the existing history model commits on blur/edit completion.
- Keep keyboard shortcuts scoped so Ctrl/Cmd+Z inside the active PDF editor still uses the correct PDF history.

---

# 2. Adjustable PDF field boxes must define real text layout bounds

The existing width/height handles should not be merely decorative geometry.

The replacement box must act as the text layout area:

```text
field width
→ controls wrapping width

field height
→ controls visible/available multiline area

font size
→ controls line metrics

explicit Enter
→ hard line break
```

Required behavior:

- Replacement text wraps to the field width where practical.
- Explicit newlines are retained even if the text would otherwise fit on one line.
- Resizing wider can reduce automatic wrapping.
- Resizing narrower can add wrapping.
- Increasing field height reveals/adds room for more lines rather than simply stretching an invisible box around single-line text.
- Live layout and saved PDF layout should match as closely as practical.
- Text must not silently disappear merely because a box is too short; if overflow is clipped in the live UI, provide a clear overflow affordance/state rather than losing content on save.
- Do not change the fixed source-mask geometry when only the replacement box is resized. Source mask and replacement geometry remain independent.

### Serialization

Do not rely on a single `drawText(..., { maxWidth })` call if that path does not faithfully implement FrameChute's multiline layout.

Implement a small deterministic layout helper if needed:

```text
replacement string
→ split hard newlines
→ wrap each logical line to width
→ compute line positions using font size / line height
→ draw each line at the correct PDF-space coordinates
```

Store any required line-height value explicitly or use a stable documented default.

Add pure tests for hard line breaks, wrapping, width changes, and PDF-space line placement.

---

# 3. Bounded PDF selection / marquee

Add a direct selection gesture on the PDF page so the user can form a bounded quadrilateral/selection box and select multiple things.

V1 may be an axis-aligned four-corner rectangle drawn from pointer-down to pointer-up, but implement the model cleanly enough that a more general four-corner quadrilateral could be supported later.

Preferred interaction:

```text
start on empty PDF page area
→ drag
→ visible bounded selection box appears
→ release
→ eligible items inside/intersecting the box become selected
```

Keep the selection box constrained to the current PDF page.

The selection region itself is temporary UI; selected document objects are the persistent state.

---

# 4. What the PDF selection can select

At minimum the bounded selection must work with FrameChute-manipulable PDF objects:

- committed replacement text fields,
- inserted PDF images from the document-image prompt.

Where practical, also support selecting original PDF text hitboxes and materializing them into movable replacement records using the existing cover-and-redraw model:

```text
original source text selected
→ keep source mask fixed at original glyph region
→ create replacement record containing the same original text
→ replacement initially occupies the original position
→ moving the selection moves the replacement while the original source stays masked
```

Do not pretend arbitrary baked PDF graphics are movable unless they have a real extraction/redraw model.

For unsupported raw PDF content, either exclude it from selection or clearly leave it untouched.

---

# 5. Move the selected group together

Once multiple eligible PDF objects are selected:

```text
drag any selected object / selection body
→ entire group moves together
```

Requirements:

- Preserve relative positions among all selected objects.
- Use PDF coordinates as canonical geometry.
- Constrain the group to the current PDF page unless an explicit future cross-page move feature is implemented.
- One completed group move = one undo history entry.
- Ctrl/Cmd+Z restores every selected object's previous geometry atomically.
- Redo reapplies the group move atomically.
- Internal group movement must never trigger the global workspace drop overlay.
- Selection should survive rerender/zoom while remaining on the same page when practical.

Arrow-key nudging should move the whole selected group when multiple items are selected. Shift+Arrow may keep the existing larger-step convention.

---

# 6. Selection semantics

Use predictable desktop-style behavior:

```text
plain marquee
→ replace current selection

Shift + marquee/click
→ add/toggle items where practical

click empty page
→ clear selection

Escape
→ clear current multi-selection or cancel an in-progress marquee
```

Do not start a marquee when the user is actively editing text, dragging an inserted image, resizing a field, or using a resize handle.

The visible selection region should be quiet and temporary: thin outline, translucent fill at most, no giant modal UI.

---

# 7. Group selection + resizing

The immediate requirement is group movement. Do not overbuild transform tooling if it threatens correctness.

If group resize is implemented in this run, it must be mathematically coherent:

- one group bounding box,
- bottom-right handle or corner handles,
- proportional transformation of child positions/sizes,
- one undo step per completed resize gesture.

If not safely implementable in the timebox, ship/test group selection + group move first and state group resize as remaining work.

Individual selected text/image objects must retain their existing individual resize handles.

---

# 8. Save / workspace persistence

Multiline text and multi-object moved geometry must survive:

- PDF rerender,
- page navigation,
- PDF Save,
- PDF Save As,
- ordinary FrameChute workspace save/restore,
- `.fcx` Export Workspace / Open Workspace.

The saved PDF should show the same multiline text layout and moved object placement seen in FrameChute.

Selection chrome itself does not need to be persisted unless the current workspace-state model naturally preserves active selection. The document content/geometry absolutely must be.

---

# 9. Preserve existing source-mask behavior

Do not regress the PDF ghost-text correction requested in the main correctness prompt.

For any source text that becomes a movable replacement through individual editing or marquee selection:

```text
source mask
→ stays at original source glyph location

replacement geometry
→ may move/resize independently

hover
→ never resurrect original source text
```

The existing source and replacement rectangles must remain conceptually separate.

---

# 10. Tests / acceptance

Add focused pure tests where possible.

Minimum automated coverage:

```text
1. Enter produces a newline in active PDF text editing rather than committing.
2. Ctrl/Cmd+Enter or blur commits multiline replacement.
3. Escape restores pre-edit replacement text.
4. Multiline canonical text round-trips with \n intact.
5. Text layout helper preserves explicit newlines.
6. Text wraps deterministically to field width.
7. Resizing width changes wrapping without mutating source-mask bounds.
8. Selection rectangle containment/intersection works in page/PDF coordinates.
9. Multi-selection group move preserves relative geometry.
10. Group move is one atomic undo/redo history operation.
11. Selection/move does not trigger workspace ingestion overlay.
12. PDF Save/Save As preserves multiline layout and moved selected objects.
```

Manual smoke test:

```text
A. Double-click a PDF replacement field. Type:
   First line
   Second line
   Third line
   → Enter creates actual new lines.

B. Resize the field narrower/wider.
   → wrapping responds to field width.

C. Save As and reopen the PDF.
   → multiline layout remains.

D. Drag a rectangle around two replacement fields and one inserted image.
   → all three become selected.

E. Drag the selection.
   → all three move together and preserve spacing.

F. Ctrl+Z.
   → entire group returns in one step.

G. Redo.
   → entire group move returns.

H. Hover moved/replaced text.
   → original source glyphs do not reappear.
```

---

# 11. Preserve current good behavior

Do not regress:

- PDF source masking,
- direct text field move/resize,
- PDF inserted-image direct manipulation from the main prompt,
- image/document undo/redo,
- PDF page navigation,
- compact PDF toolbar/popdowns,
- Save/Save As,
- PDF image export,
- document drop ownership,
- expandable workspace work,
- snapshot bounds behavior,
- Simple/Advanced menu separation.

---

# 12. Timebox / handoff

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

If general four-corner/non-axis-aligned PDF quadrilateral selection is too large for this pass, implement a correct page-bounded rectangular four-corner marquee first, keep the selection geometry helper extensible, and state arbitrary quadrilateral selection as remaining work rather than landing an unstable transform model.
